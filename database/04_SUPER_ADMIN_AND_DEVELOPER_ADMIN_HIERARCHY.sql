-- ============================================================================
-- FOUNDARLY PRODUCTION DATABASE MIGRATION:
-- SUPER ADMIN & DEVELOPER ADMIN ROLE HIERARCHY WITH ROW LEVEL SECURITY (RLS)
-- ============================================================================
-- Migration: 04_SUPER_ADMIN_AND_DEVELOPER_ADMIN_HIERARCHY.sql
-- Description:
--   1. Updates `profiles_role_check` constraint FIRST to allow:
--      'super_admin', 'developer_admin', 'admin', 'consultant', 'client'
--      (Fixes: ERROR 23514 check constraint "profiles_role_check" violation)
--   2. Safely promotes ONLY the verified primary admin account (admin@foundarly.com)
--      Preserves all existing account credentials, consultants, and clients.
--      Demotes any non-allowlisted legacy admin records to 'client' to prevent accidental promotions.
--   3. Introduces the distinct 'developer_admin' role with least-privilege technical access
--   4. Updates database helper functions:
--        - public.is_super_admin()
--        - public.is_developer_admin()
--        - public.is_admin() (returns true for super_admin or developer_admin)
--   5. Updates auth trigger (handle_new_user) for safe new user role assignment
--   6. Hardens RLS on public.profiles:
--        - Public read allowed (anon & authenticated) so consultant cards/bios are visible
--        - Only super_admin can update user roles
--        - Regular users and developer_admin CANNOT alter role columns (prevents self-elevation)
--   7. Hardens RLS on financial & sensitive tables:
--        - Restricts payout_requests, consultant_earnings, upi_payments to super_admin only
--        - Preserves consultant payout requests & customer payment creation
--   8. Updates bookings, categories, and referral tables for Super Admin compatibility
--   9. Provides secure SQL management functions for Super Admin to assign/revoke Developer Admin
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. UPDATE CHECK CONSTRAINT ON public.profiles (BEFORE CHANGING ANY ROLES)
-- ----------------------------------------------------------------------------
-- Fixes error: 23514 (violates check constraint "profiles_role_check")
-- The constraint MUST be updated prior to modifying any profile roles.

-- 1a. Clean up any invalid or null roles before applying the updated check constraint
UPDATE public.profiles
SET role = 'client'
WHERE role IS NULL 
   OR role NOT IN ('super_admin', 'developer_admin', 'admin', 'consultant', 'client');

-- 1b. Dynamically drop any existing check constraints referencing the role column
DO $$
DECLARE
  con_rec RECORD;
BEGIN
  FOR con_rec IN (
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'profiles'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%role%'
  ) LOOP
    EXECUTE 'ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS ' || quote_ident(con_rec.conname);
  END LOOP;
END $$;

-- Explicitly ensure 'profiles_role_check' is dropped
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

-- 1c. Add the updated check constraint with all intended and legitimate roles
ALTER TABLE public.profiles 
  ADD CONSTRAINT profiles_role_check 
  CHECK (role IN ('super_admin', 'developer_admin', 'admin', 'consultant', 'client'));

-- ----------------------------------------------------------------------------
-- 2. PROMOTE ONLY THE INTENDED PRIMARY ADMIN TO SUPER ADMIN
-- ----------------------------------------------------------------------------
-- Targeted promotion: Only the designated primary admin (admin@foundarly.com)
-- is promoted to 'super_admin'.
-- Never promotes all existing admins.
-- Safely demotes any unauthorized legacy 'admin' or unverified 'super_admin' to 'client' (or 'consultant').
DO $$
DECLARE
  primary_admin_email TEXT := 'admin@foundarly.com';
  primary_admin_id UUID;
BEGIN
  -- 2a. Locate the primary admin by verified email
  SELECT id INTO primary_admin_id
  FROM auth.users
  WHERE LOWER(email) = LOWER(primary_admin_email);

  IF primary_admin_id IS NOT NULL THEN
    -- Ensure profile exists and promote ONLY the primary admin to super_admin
    INSERT INTO public.profiles (id, role, full_name, updated_at)
    VALUES (primary_admin_id, 'super_admin', 'Super Admin', NOW())
    ON CONFLICT (id) DO UPDATE
    SET role = 'super_admin', updated_at = NOW();

    RAISE NOTICE '✅ Ensured and promoted primary admin (%) with ID % to super_admin.', primary_admin_email, primary_admin_id;
  ELSE
    RAISE NOTICE '⚠️ Primary admin user % not found in auth.users. The account will receive super_admin role automatically upon registration or login.', primary_admin_email;
  END IF;

  -- 2b. Safety defense: Neutralize any non-allowlisted accounts that held legacy 'admin' or unverified 'super_admin'
  -- Preserve consultants by retaining consultant status if is_consultant = true
  UPDATE public.profiles
  SET role = CASE WHEN COALESCE(is_consultant, false) = true THEN 'consultant' ELSE 'client' END,
      updated_at = NOW()
  WHERE role IN ('admin', 'super_admin')
    AND id NOT IN (
      SELECT id FROM auth.users 
      WHERE LOWER(email) = LOWER(primary_admin_email)
    );
END $$;

-- ----------------------------------------------------------------------------
-- 3. SECURE ROLE HELPER FUNCTIONS
-- ----------------------------------------------------------------------------

-- Helper: Check if current authenticated user has Super Admin privileges
-- Checks explicit email allowlist first, then verified super_admin profile role
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT 
    LOWER(COALESCE(auth.jwt() ->> 'email', '')) = 'admin@foundarly.com'
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    );
$$;

-- Helper: Check if current authenticated user has Developer Admin role
CREATE OR REPLACE FUNCTION public.is_developer_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'developer_admin'
  );
$$;

-- Helper: Check if user is any recognized administrator (Super Admin OR Developer Admin)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.is_super_admin() OR public.is_developer_admin();
$$;

GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.is_developer_admin() TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role, anon;

-- ----------------------------------------------------------------------------
-- 4. UPDATE USER SIGNUP TRIGGER (SAFE DEFAULT ROLE & ADMIN ALLOCATION)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role, created_at, updated_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    CASE 
      WHEN LOWER(NEW.email) = 'admin@foundarly.com' THEN 'super_admin'
      ELSE 'client'
    END,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    full_name = COALESCE(NULLIF(public.profiles.full_name, ''), EXCLUDED.full_name),
    role = CASE
      WHEN LOWER(NEW.email) = 'admin@foundarly.com' THEN 'super_admin'
      ELSE public.profiles.role
    END,
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 5. PROFILES ROW LEVEL SECURITY (RLS) POLICIES
-- ----------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop all legacy and potential conflicting policies
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own non-role fields" ON public.profiles;
DROP POLICY IF EXISTS "Super admins can manage all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;

-- Read policy: Anyone (including unauthenticated visitors for consultant cards/bios) can view profiles
CREATE POLICY "Public profiles are viewable by everyone"
  ON public.profiles FOR SELECT
  TO authenticated, anon
  USING (true);

-- Insert policy: Authenticated users can insert their own profile with 'client' role (or super admin can insert any)
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = id
    AND (
      role = 'client'
      OR public.is_super_admin()
    )
  );

-- Update policy: Users can update their own non-role fields. Privilege escalation is strictly blocked.
CREATE POLICY "Users can update own non-role fields"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id OR public.is_super_admin())
  WITH CHECK (
    (
      auth.uid() = id
      AND (
        role IS NOT DISTINCT FROM (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
        OR public.is_super_admin()
      )
    )
    OR public.is_super_admin()
  );

-- Full management: Super Admin has full control over all profile records
CREATE POLICY "Super admins can manage all profiles"
  ON public.profiles FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- ----------------------------------------------------------------------------
-- 6. FINANCIAL & SENSITIVE TABLES RLS (RESTRICTED TO SUPER ADMIN ONLY)
-- ----------------------------------------------------------------------------

-- Payout Requests: Developer Admin must NEVER view or modify financial payouts
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payout_requests') THEN
    ALTER TABLE public.payout_requests ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Admins can view all payout requests" ON public.payout_requests;
    DROP POLICY IF EXISTS "Admins can update payout requests" ON public.payout_requests;
    DROP POLICY IF EXISTS "Admin manage payouts" ON public.payout_requests;
    DROP POLICY IF EXISTS "Super admins can view all payout requests" ON public.payout_requests;
    DROP POLICY IF EXISTS "Super admins can update payout requests" ON public.payout_requests;
    DROP POLICY IF EXISTS "Super admins manage all payouts" ON public.payout_requests;
    DROP POLICY IF EXISTS "Consultants can view own payout requests" ON public.payout_requests;
    DROP POLICY IF EXISTS "Consultant view own payouts" ON public.payout_requests;
    DROP POLICY IF EXISTS "Consultants can create payout requests" ON public.payout_requests;
    DROP POLICY IF EXISTS "Consultant create payout" ON public.payout_requests;
    
    -- Super Admin full management
    CREATE POLICY "Super admins manage all payouts"
      ON public.payout_requests FOR ALL
      TO authenticated
      USING (public.is_super_admin())
      WITH CHECK (public.is_super_admin());

    -- Consultants view their own payout requests
    CREATE POLICY "Consultants can view own payout requests"
      ON public.payout_requests FOR SELECT
      TO authenticated
      USING (
        auth.uid() = consultant_id
        OR EXISTS (
          SELECT 1 FROM public.consultants c
          WHERE c.id = payout_requests.consultant_id AND c.user_id = auth.uid()
        )
      );

    -- Consultants create payout requests for themselves
    CREATE POLICY "Consultants can create payout requests"
      ON public.payout_requests FOR INSERT
      TO authenticated
      WITH CHECK (
        auth.uid() = consultant_id
        OR EXISTS (
          SELECT 1 FROM public.consultants c
          WHERE c.id = payout_requests.consultant_id AND c.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Consultant Earnings: Developer Admin must NEVER view or modify consultant earnings
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'consultant_earnings') THEN
    ALTER TABLE public.consultant_earnings ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Admins can view all earnings" ON public.consultant_earnings;
    DROP POLICY IF EXISTS "Super admins can view all earnings" ON public.consultant_earnings;
    DROP POLICY IF EXISTS "Super admins manage all earnings" ON public.consultant_earnings;
    DROP POLICY IF EXISTS "Consultants can view own earnings" ON public.consultant_earnings;
    
    -- Super Admin full access
    CREATE POLICY "Super admins manage all earnings"
      ON public.consultant_earnings FOR ALL
      TO authenticated
      USING (public.is_super_admin())
      WITH CHECK (public.is_super_admin());

    -- Consultants view their own earnings
    CREATE POLICY "Consultants can view own earnings"
      ON public.consultant_earnings FOR SELECT
      TO authenticated
      USING (
        consultant_id IN (
          SELECT id FROM public.consultants WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- UPI Payments: Developer Admin must NEVER access sensitive payment records or approve payments
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'upi_payments') THEN
    ALTER TABLE public.upi_payments ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Admins can view all upi_payments" ON public.upi_payments;
    DROP POLICY IF EXISTS "Admins can update upi_payments" ON public.upi_payments;
    DROP POLICY IF EXISTS "Admins can delete upi_payments" ON public.upi_payments;
    DROP POLICY IF EXISTS "Admin update upi_payments" ON public.upi_payments;
    DROP POLICY IF EXISTS "Admin delete upi_payments" ON public.upi_payments;
    DROP POLICY IF EXISTS "Admins manage UPI payments" ON public.upi_payments;
    DROP POLICY IF EXISTS "Super admins manage upi payments" ON public.upi_payments;
    
    -- Super Admin full access (Approve/Reject/Verify UPI payments)
    CREATE POLICY "Super admins manage upi payments"
      ON public.upi_payments FOR ALL
      TO authenticated
      USING (public.is_super_admin())
      WITH CHECK (public.is_super_admin());
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 7. REFRESH CROSS-TABLE RLS POLICIES FOR SUPER ADMIN COMPATIBILITY
-- ----------------------------------------------------------------------------

-- Bookings table: Ensure Super Admin has full view/update/delete permissions
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bookings') THEN
    ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Secure view bookings" ON public.bookings;
    DROP POLICY IF EXISTS "Secure update bookings" ON public.bookings;
    DROP POLICY IF EXISTS "Admin delete bookings" ON public.bookings;

    CREATE POLICY "Secure view bookings" ON public.bookings
      FOR SELECT
      USING (
        (auth.uid() IS NOT NULL AND auth.uid() = user_id)
        OR (auth.jwt() ->> 'email' IS NOT NULL AND LOWER(email) = LOWER(auth.jwt() ->> 'email'))
        OR public.is_super_admin()
      );

    CREATE POLICY "Secure update bookings" ON public.bookings
      FOR UPDATE
      USING (
        (auth.uid() IS NOT NULL AND auth.uid() = user_id)
        OR (auth.jwt() ->> 'email' IS NOT NULL AND LOWER(email) = LOWER(auth.jwt() ->> 'email'))
        OR public.is_super_admin()
      );

    CREATE POLICY "Admin delete bookings" ON public.bookings
      FOR DELETE
      USING (public.is_super_admin());
  END IF;
END $$;

-- Categories & Referrals: Update legacy 'role = admin' check to public.is_super_admin()
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'categories') THEN
    DROP POLICY IF EXISTS "Admin categories access" ON public.categories;
    CREATE POLICY "Admin categories access" ON public.categories 
      FOR ALL TO authenticated
      USING (public.is_super_admin())
      WITH CHECK (public.is_super_admin());
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'referral_codes' AND table_name = 'referral_codes') 
     OR EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'referral_codes') THEN
    DROP POLICY IF EXISTS "Admin referral_codes access" ON public.referral_codes;
    CREATE POLICY "Admin referral_codes access" ON public.referral_codes 
      FOR ALL TO authenticated
      USING (public.is_super_admin())
      WITH CHECK (public.is_super_admin());
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'referral_usages') THEN
    DROP POLICY IF EXISTS "Admin referral_usages access" ON public.referral_usages;
    CREATE POLICY "Admin referral_usages access" ON public.referral_usages 
      FOR ALL TO authenticated
      USING (public.is_super_admin())
      WITH CHECK (public.is_super_admin());
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 8. SECURE MANAGEMENT PROCEDURES FOR SUPER ADMIN
-- ----------------------------------------------------------------------------

-- Procedure: Assign Developer Admin Role (Callable only by Super Admin)
CREATE OR REPLACE FUNCTION public.assign_developer_admin(target_email TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  caller_is_super BOOLEAN;
  target_user_id UUID;
BEGIN
  caller_is_super := public.is_super_admin();
  IF NOT caller_is_super THEN
    RAISE EXCEPTION 'Access Denied: Only Super Administrators can assign Developer Admin roles.';
  END IF;

  SELECT id INTO target_user_id
  FROM auth.users
  WHERE LOWER(email) = LOWER(TRIM(target_email));

  IF target_user_id IS NULL THEN
    RETURN '❌ Error: User with email ' || target_email || ' not found in auth.users.';
  END IF;

  INSERT INTO public.profiles (id, role, updated_at)
  VALUES (target_user_id, 'developer_admin', NOW())
  ON CONFLICT (id) DO UPDATE
  SET role = 'developer_admin', updated_at = NOW();

  RETURN '✅ Success: User ' || target_email || ' assigned role developer_admin.';
END;
$$;

-- Procedure: Revoke Developer Admin Role (Demote to client)
CREATE OR REPLACE FUNCTION public.revoke_developer_admin(target_email TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  caller_is_super BOOLEAN;
  target_user_id UUID;
BEGIN
  caller_is_super := public.is_super_admin();
  IF NOT caller_is_super THEN
    RAISE EXCEPTION 'Access Denied: Only Super Administrators can revoke Developer Admin roles.';
  END IF;

  SELECT id INTO target_user_id
  FROM auth.users
  WHERE LOWER(email) = LOWER(TRIM(target_email));

  IF target_user_id IS NULL THEN
    RETURN '❌ Error: User with email ' || target_email || ' not found in auth.users.';
  END IF;

  UPDATE public.profiles
  SET role = 'client', updated_at = NOW()
  WHERE id = target_user_id AND role = 'developer_admin';

  RETURN '✅ Success: Developer Admin privileges revoked for ' || target_email || ' (demoted to client).';
END;
$$;

-- Procedure: Promote to Super Admin (Callable only by existing Super Admin)
CREATE OR REPLACE FUNCTION public.assign_super_admin(target_email TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  caller_is_super BOOLEAN;
  target_user_id UUID;
BEGIN
  caller_is_super := public.is_super_admin();
  IF NOT caller_is_super THEN
    RAISE EXCEPTION 'Access Denied: Only Super Administrators can promote users to Super Admin.';
  END IF;

  SELECT id INTO target_user_id
  FROM auth.users
  WHERE LOWER(email) = LOWER(TRIM(target_email));

  IF target_user_id IS NULL THEN
    RETURN '❌ Error: User with email ' || target_email || ' not found in auth.users.';
  END IF;

  INSERT INTO public.profiles (id, role, updated_at)
  VALUES (target_user_id, 'super_admin', NOW())
  ON CONFLICT (id) DO UPDATE
  SET role = 'super_admin', updated_at = NOW();

  RETURN '✅ Success: User ' || target_email || ' promoted to super_admin.';
END;
$$;

GRANT EXECUTE ON FUNCTION public.assign_developer_admin(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_developer_admin(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_super_admin(TEXT) TO authenticated;
