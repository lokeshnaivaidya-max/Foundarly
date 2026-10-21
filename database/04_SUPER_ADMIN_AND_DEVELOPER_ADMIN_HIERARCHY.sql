-- ============================================================================
-- FOUNDARLY PRODUCTION DATABASE MIGRATION:
-- SUPER ADMIN & DEVELOPER ADMIN ROLE HIERARCHY WITH ROW LEVEL SECURITY (RLS)
-- ============================================================================
-- Migration: 04_SUPER_ADMIN_AND_DEVELOPER_ADMIN_HIERARCHY.sql
-- Description:
--   1. Upgrades existing primary admin accounts (role = 'admin') to 'super_admin'
--   2. Introduces the distinct 'developer_admin' role with least-privilege access
--   3. Updates database helper functions:
--        - public.is_super_admin()
--        - public.is_developer_admin()
--        - public.is_admin() (returns true for either super_admin or developer_admin)
--   4. Hardens RLS on public.profiles:
--        - Only super_admin can update user roles
--        - Regular users and developer_admin CANNOT alter role columns (prevents self-elevation)
--   5. Hardens RLS on financial & sensitive tables:
--        - Restricts payout_requests, consultant_earnings, upi_payments to super_admin only
--   6. Provides secure SQL management functions for Super Admin to assign/revoke Developer Admin
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. UPGRADE EXISTING PRIMARY ADMIN TO SUPER ADMIN
-- ----------------------------------------------------------------------------
-- Safely promotes existing verified administrator profiles with role = 'admin'
-- to the explicit 'super_admin' role. Regular clients and consultants are untouched.
UPDATE public.profiles
SET role = 'super_admin', updated_at = NOW()
WHERE role = 'admin';

-- ----------------------------------------------------------------------------
-- 2. SECURE ROLE HELPER FUNCTIONS
-- ----------------------------------------------------------------------------

-- Helper: Check if current authenticated user has Super Admin privileges
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('super_admin', 'admin')
  ) OR LOWER(COALESCE(auth.jwt() ->> 'email', '')) = 'admin@foundarly.com';
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
-- 3. PROFILES ROW LEVEL SECURITY (RLS) POLICIES
-- ----------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Users can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

-- CRITICAL: Prevent privilege escalation.
-- Regular users can only update their own non-role profile attributes.
-- Developer Admins CANNOT update anyone's role or elevate themselves.
-- ONLY Super Admin can update the role column.
DROP POLICY IF EXISTS "Users can update own non-role fields" ON public.profiles;
DROP POLICY IF EXISTS "Super admins can manage all profiles" ON public.profiles;

CREATE POLICY "Users can update own non-role fields"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    -- Must not change role unless already a super_admin
    AND (
      role IS NOT DISTINCT FROM (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
      OR public.is_super_admin()
    )
  );

CREATE POLICY "Super admins can manage all profiles"
  ON public.profiles FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- ----------------------------------------------------------------------------
-- 4. FINANCIAL & SENSITIVE TABLES RLS (RESTRICTED TO SUPER ADMIN ONLY)
-- ----------------------------------------------------------------------------

-- Payout Requests: Developer Admin must NEVER view or modify financial payouts
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payout_requests') THEN
    ALTER TABLE public.payout_requests ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Admins can view all payout requests" ON public.payout_requests;
    DROP POLICY IF EXISTS "Admins can update payout requests" ON public.payout_requests;
    DROP POLICY IF EXISTS "Super admins can view all payout requests" ON public.payout_requests;
    DROP POLICY IF EXISTS "Super admins can update payout requests" ON public.payout_requests;
    
    CREATE POLICY "Super admins can view all payout requests"
      ON public.payout_requests FOR SELECT
      TO authenticated
      USING (public.is_super_admin());

    CREATE POLICY "Super admins can update payout requests"
      ON public.payout_requests FOR UPDATE
      TO authenticated
      USING (public.is_super_admin())
      WITH CHECK (public.is_super_admin());
  END IF;
END $$;

-- Consultant Earnings: Developer Admin must NEVER view or modify consultant earnings
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'consultant_earnings') THEN
    ALTER TABLE public.consultant_earnings ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Admins can view all earnings" ON public.consultant_earnings;
    DROP POLICY IF EXISTS "Super admins can view all earnings" ON public.consultant_earnings;
    
    CREATE POLICY "Super admins can view all earnings"
      ON public.consultant_earnings FOR SELECT
      TO authenticated
      USING (public.is_super_admin());
  END IF;
END $$;

-- UPI Payments: Developer Admin must NEVER access sensitive payment records or approve payments
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'upi_payments') THEN
    ALTER TABLE public.upi_payments ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Super admins manage upi payments" ON public.upi_payments;
    CREATE POLICY "Super admins manage upi payments"
      ON public.upi_payments FOR ALL
      TO authenticated
      USING (public.is_super_admin())
      WITH CHECK (public.is_super_admin());
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 5. SECURE MANAGEMENT PROCEDURES FOR SUPER ADMIN
-- ----------------------------------------------------------------------------

-- Procedure: Assign Developer Admin Role (Callable only by Super Admin)
CREATE OR REPLACE FUNCTION public.assign_developer_admin(target_email TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  caller_is_super BOOLEAN;
  target_user_id UUID;
BEGIN
  -- Strict caller verification
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

  UPDATE public.profiles
  SET role = 'developer_admin', updated_at = NOW()
  WHERE id = target_user_id;

  RETURN '✅ Success: User ' || target_email || ' assigned role developer_admin.';
END;
$$;

-- Procedure: Revoke Developer Admin Role (Demote to client)
CREATE OR REPLACE FUNCTION public.revoke_developer_admin(target_email TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
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

  UPDATE public.profiles
  SET role = 'super_admin', updated_at = NOW()
  WHERE id = target_user_id;

  RETURN '✅ Success: User ' || target_email || ' promoted to super_admin.';
END;
$$;

GRANT EXECUTE ON FUNCTION public.assign_developer_admin(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_developer_admin(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_super_admin(TEXT) TO authenticated;
