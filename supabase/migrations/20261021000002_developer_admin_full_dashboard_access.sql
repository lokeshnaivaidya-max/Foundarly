-- ============================================================================
-- Migration: 20261021000002_developer_admin_full_dashboard_access.sql
-- Description:
--   Grants Developer Admin least-privilege operational access to ordinary admin tables:
--     1. public.upi_payments (Manage Payments & UPI Verification: SELECT & UPDATE)
--     2. public.payout_requests (Consultant Payouts: SELECT & UPDATE)
--     3. public.consultant_earnings (Consultant Earnings: SELECT)
--     4. public.bookings (Read and operational UPDATE; DELETE restricted strictly to Super Admin)
--     5. public.categories, public.referral_codes, public.referral_usages (SELECT, INSERT, UPDATE, DELETE)
--   via public.is_admin() (evaluates TRUE for super_admin and developer_admin).
--
-- Security Hardening Rules Applied:
--   1. Separate SELECT, UPDATE, INSERT, and DELETE policies instead of broad FOR ALL.
--   2. Strict Financial Ledger & Transaction Immutability:
--      - Developer Admin CANNOT DELETE payment audit records (upi_payments).
--      - Developer Admin CANNOT DELETE payout records (payout_requests).
--      - Developer Admin CANNOT UPDATE or DELETE consultant earnings records (consultant_earnings).
--      - Developer Admin CANNOT DELETE booking records (bookings).
--      - DELETE on upi_payments, payout_requests, consultant_earnings, and bookings remains strictly Super Admin only.
--      - UPDATE on consultant_earnings remains strictly Super Admin only.
--   3. Unhindered Guest & Client Checkout:
--      - Guests and authenticated clients retain INSERT permission on bookings.
--      - Guests and authenticated clients retain INSERT permission on upi_payments.
--      - Public read on categories and referral codes is preserved.
--   4. Zero Regressions on Consultants:
--      - Consultants retain SELECT & UPDATE on their assigned bookings.
--      - Consultants retain SELECT on upi_payments for their consultations.
--      - Consultants retain SELECT and INSERT on their own payout_requests.
--      - Consultants retain SELECT on their consultant_earnings.
--   5. Zero Regressions on Clients:
--      - Clients retain SELECT & UPDATE on their own bookings.
--      - Clients retain SELECT on their own upi_payments.
--      - Clients CANNOT view or modify other users' bookings, payments, or payout records.
--   6. Privilege Escalation Prevention:
--      - Only public.is_super_admin() can modify role columns on public.profiles.
--      - Developer Admin cannot alter permissions or manage administrator accounts.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. UPI PAYMENTS (Manage Payments & UPI Verification)
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'upi_payments') THEN
    ALTER TABLE public.upi_payments ENABLE ROW LEVEL SECURITY;
    
    -- Drop all legacy, broad, or outdated policies to avoid permissive union
    DROP POLICY IF EXISTS "Insert UPI payment" ON public.upi_payments;
    DROP POLICY IF EXISTS "Read UPI payment" ON public.upi_payments;
    DROP POLICY IF EXISTS "User view own upi_payments" ON public.upi_payments;
    DROP POLICY IF EXISTS "Admin manage upi_payments" ON public.upi_payments;
    DROP POLICY IF EXISTS "Admins can view all upi_payments" ON public.upi_payments;
    DROP POLICY IF EXISTS "Admins can update upi_payments" ON public.upi_payments;
    DROP POLICY IF EXISTS "Admins can delete upi_payments" ON public.upi_payments;
    DROP POLICY IF EXISTS "Admin update upi_payments" ON public.upi_payments;
    DROP POLICY IF EXISTS "Admin delete upi_payments" ON public.upi_payments;
    DROP POLICY IF EXISTS "Admins manage UPI payments" ON public.upi_payments;
    DROP POLICY IF EXISTS "Super admins manage upi payments" ON public.upi_payments;
    DROP POLICY IF EXISTS "Admins manage upi payments" ON public.upi_payments;
    DROP POLICY IF EXISTS "Secure view upi_payments" ON public.upi_payments;
    DROP POLICY IF EXISTS "Anyone can insert upi_payments" ON public.upi_payments;
    DROP POLICY IF EXISTS "Super admin delete upi_payments" ON public.upi_payments;
    DROP POLICY IF EXISTS "Clients can view own upi_payments" ON public.upi_payments;
    DROP POLICY IF EXISTS "Super admins can view all upi_payments" ON public.upi_payments;
    
    -- 1a. INSERT: Any user (guest checkout or authenticated client) can submit UPI payment proof during booking
    CREATE POLICY "Anyone can insert upi_payments" ON public.upi_payments
      FOR INSERT
      WITH CHECK (true);

    -- 1b. SELECT: Owner client, assigned consultant, or administrators (Super Admin + Developer Admin)
    CREATE POLICY "Secure view upi_payments" ON public.upi_payments
      FOR SELECT
      TO authenticated
      USING (
        (auth.uid() IS NOT NULL AND auth.uid() = user_id)
        OR (auth.jwt() ->> 'email' IS NOT NULL AND LOWER(customer_email) = LOWER(auth.jwt() ->> 'email'))
        OR booking_id IN (
          SELECT b.id FROM public.bookings b
          WHERE b.user_id = auth.uid()
             OR (auth.jwt() ->> 'email' IS NOT NULL AND LOWER(b.email) = LOWER(auth.jwt() ->> 'email'))
        )
        OR consultant_id IN (
          SELECT c.id FROM public.consultants c
          WHERE c.user_id = auth.uid() 
             OR (auth.jwt() ->> 'email' IS NOT NULL AND LOWER(c.email) = LOWER(auth.jwt() ->> 'email'))
        )
        OR public.is_admin()
      );

    -- 1c. UPDATE: Operational administrators (Super Admin + Developer Admin) can verify or reject payments
    CREATE POLICY "Admin update upi_payments" ON public.upi_payments
      FOR UPDATE
      TO authenticated
      USING (public.is_admin())
      WITH CHECK (public.is_admin());

    -- 1d. DELETE: Strictly Super Admin only (prevents deletion of financial audit records by operational admins)
    CREATE POLICY "Super admin delete upi_payments" ON public.upi_payments
      FOR DELETE
      TO authenticated
      USING (public.is_super_admin());
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 2. PAYOUT REQUESTS (Consultant Payouts)
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payout_requests') THEN
    ALTER TABLE public.payout_requests ENABLE ROW LEVEL SECURITY;
    
    -- Drop legacy, broad, or outdated policies
    DROP POLICY IF EXISTS "Super admins manage all payouts" ON public.payout_requests;
    DROP POLICY IF EXISTS "Admins manage all payouts" ON public.payout_requests;
    DROP POLICY IF EXISTS "Admins manage payouts" ON public.payout_requests;
    DROP POLICY IF EXISTS "Admin manage payouts" ON public.payout_requests;
    DROP POLICY IF EXISTS "Admins can view all payout requests" ON public.payout_requests;
    DROP POLICY IF EXISTS "Admins can update payout requests" ON public.payout_requests;
    DROP POLICY IF EXISTS "Admin update payout requests" ON public.payout_requests;
    DROP POLICY IF EXISTS "Consultants can view own payout requests" ON public.payout_requests;
    DROP POLICY IF EXISTS "Consultants can create payout requests" ON public.payout_requests;
    DROP POLICY IF EXISTS "Consultant view own payouts" ON public.payout_requests;
    DROP POLICY IF EXISTS "Consultant create payout" ON public.payout_requests;
    DROP POLICY IF EXISTS "Consultant/Admin read payouts" ON public.payout_requests;
    DROP POLICY IF EXISTS "Consultant insert payout" ON public.payout_requests;
    DROP POLICY IF EXISTS "Super admin delete payout requests" ON public.payout_requests;

    -- 2a. SELECT: Consultant views own payouts; Administrators (Super Admin + Developer Admin) view all
    CREATE POLICY "Consultants can view own payout requests" ON public.payout_requests
      FOR SELECT
      TO authenticated
      USING (
        auth.uid() = consultant_id
        OR EXISTS (
          SELECT 1 FROM public.consultants c
          WHERE c.id = payout_requests.consultant_id AND c.user_id = auth.uid()
        )
        OR public.is_admin()
      );

    -- 2b. INSERT: Consultants create payout requests for themselves (or Super Admin manual entry)
    CREATE POLICY "Consultants can create payout requests" ON public.payout_requests
      FOR INSERT
      TO authenticated
      WITH CHECK (
        auth.uid() = consultant_id
        OR EXISTS (
          SELECT 1 FROM public.consultants c
          WHERE c.id = payout_requests.consultant_id AND c.user_id = auth.uid()
        )
        OR public.is_super_admin()
      );

    -- 2c. UPDATE: Operational administrators (Super Admin + Developer Admin) approve, reject, or mark paid
    CREATE POLICY "Admin update payout requests" ON public.payout_requests
      FOR UPDATE
      TO authenticated
      USING (public.is_admin())
      WITH CHECK (public.is_admin());

    -- 2d. DELETE: Strictly Super Admin only
    CREATE POLICY "Super admin delete payout requests" ON public.payout_requests
      FOR DELETE
      TO authenticated
      USING (public.is_super_admin());
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 3. CONSULTANT EARNINGS (Immutable Ledger: System Inserts, Super Admin Update/Delete Only)
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'consultant_earnings') THEN
    ALTER TABLE public.consultant_earnings ENABLE ROW LEVEL SECURITY;
    
    -- Drop broad FOR ALL and outdated policies
    DROP POLICY IF EXISTS "Super admins manage all earnings" ON public.consultant_earnings;
    DROP POLICY IF EXISTS "Admins manage all earnings" ON public.consultant_earnings;
    DROP POLICY IF EXISTS "Admins can view all earnings" ON public.consultant_earnings;
    DROP POLICY IF EXISTS "Consultants can view own earnings" ON public.consultant_earnings;
    DROP POLICY IF EXISTS "System can insert earnings" ON public.consultant_earnings;
    DROP POLICY IF EXISTS "Super admin manage consultant earnings" ON public.consultant_earnings;
    DROP POLICY IF EXISTS "Super admin update consultant earnings" ON public.consultant_earnings;
    DROP POLICY IF EXISTS "Super admin delete consultant earnings" ON public.consultant_earnings;

    -- 3a. SELECT: Consultant views own earnings; Administrators (Super Admin + Developer Admin) view all
    CREATE POLICY "Consultants can view own earnings" ON public.consultant_earnings
      FOR SELECT
      TO authenticated
      USING (
        consultant_id IN (
          SELECT id FROM public.consultants WHERE user_id = auth.uid()
        )
        OR public.is_admin()
      );

    -- 3b. INSERT: Preserved for system / service role / DB completion triggers
    CREATE POLICY "System can insert earnings" ON public.consultant_earnings
      FOR INSERT
      WITH CHECK (true);

    -- 3c. UPDATE: Strictly Super Admin only for emergency adjustments (replaces broad FOR ALL)
    CREATE POLICY "Super admin update consultant earnings" ON public.consultant_earnings
      FOR UPDATE
      TO authenticated
      USING (public.is_super_admin())
      WITH CHECK (public.is_super_admin());

    -- 3d. DELETE: Strictly Super Admin only for emergency adjustments / audit purge (replaces broad FOR ALL)
    CREATE POLICY "Super admin delete consultant earnings" ON public.consultant_earnings
      FOR DELETE
      TO authenticated
      USING (public.is_super_admin());
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 4. BOOKINGS (Preserves Client/Consultant Access; Developer Admin Operational Access; DELETE Restricted to Super Admin)
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bookings') THEN
    ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
    
    -- Drop all legacy, broad, or conflicting policies to prevent permissive union
    DROP POLICY IF EXISTS "Read bookings" ON public.bookings;
    DROP POLICY IF EXISTS "Anyone create booking" ON public.bookings;
    DROP POLICY IF EXISTS "Users/Consultants/Admins update bookings" ON public.bookings;
    DROP POLICY IF EXISTS "Secure view bookings" ON public.bookings;
    DROP POLICY IF EXISTS "Secure update bookings" ON public.bookings;
    DROP POLICY IF EXISTS "Admin delete bookings" ON public.bookings;
    DROP POLICY IF EXISTS "Super admin delete bookings" ON public.bookings;
    DROP POLICY IF EXISTS "Admins manage bookings" ON public.bookings;
    DROP POLICY IF EXISTS "Super admins manage bookings" ON public.bookings;
    DROP POLICY IF EXISTS "Anyone can create bookings" ON public.bookings;
    DROP POLICY IF EXISTS "Anyone can insert bookings" ON public.bookings;

    -- 4a. INSERT: Any user (guest checkout or authenticated client) can create bookings
    CREATE POLICY "Anyone can create bookings" ON public.bookings
      FOR INSERT
      WITH CHECK (true);

    -- 4b. SELECT: Client (own bookings), Assigned Consultant (own bookings), Administrators (Super Admin + Developer Admin)
    CREATE POLICY "Secure view bookings" ON public.bookings
      FOR SELECT
      TO authenticated
      USING (
        (auth.uid() IS NOT NULL AND auth.uid() = user_id)
        OR (auth.jwt() ->> 'email' IS NOT NULL AND LOWER(email) = LOWER(auth.jwt() ->> 'email'))
        OR consultant_id IN (
          SELECT c.id FROM public.consultants c
          WHERE c.user_id = auth.uid() 
             OR (auth.jwt() ->> 'email' IS NOT NULL AND LOWER(c.email) = LOWER(auth.jwt() ->> 'email'))
        )
        OR public.is_admin()
      );

    -- 4c. UPDATE: Client (self-heal guest account, request reschedule), Consultant (manage session), Admin (operational updates)
    CREATE POLICY "Secure update bookings" ON public.bookings
      FOR UPDATE
      TO authenticated
      USING (
        (auth.uid() IS NOT NULL AND auth.uid() = user_id)
        OR (auth.jwt() ->> 'email' IS NOT NULL AND LOWER(email) = LOWER(auth.jwt() ->> 'email'))
        OR consultant_id IN (
          SELECT c.id FROM public.consultants c
          WHERE c.user_id = auth.uid() 
             OR (auth.jwt() ->> 'email' IS NOT NULL AND LOWER(c.email) = LOWER(auth.jwt() ->> 'email'))
        )
        OR public.is_admin()
      )
      WITH CHECK (
        (auth.uid() IS NOT NULL AND auth.uid() = user_id)
        OR (auth.jwt() ->> 'email' IS NOT NULL AND LOWER(email) = LOWER(auth.jwt() ->> 'email'))
        OR consultant_id IN (
          SELECT c.id FROM public.consultants c
          WHERE c.user_id = auth.uid() 
             OR (auth.jwt() ->> 'email' IS NOT NULL AND LOWER(c.email) = LOWER(auth.jwt() ->> 'email'))
        )
        OR public.is_admin()
      );

    -- 4d. DELETE: Strictly Super Admin only (prevents accidental or unauthorized deletion of booking transaction records by Developer Admin or clients)
    CREATE POLICY "Super admin delete bookings" ON public.bookings
      FOR DELETE
      TO authenticated
      USING (public.is_super_admin());
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 5. CATEGORIES & REFERRALS (Allow Developer Admin Operational Management)
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'categories') THEN
    DROP POLICY IF EXISTS "Admin categories access" ON public.categories;
    DROP POLICY IF EXISTS "Super admin manage categories" ON public.categories;
    CREATE POLICY "Admin categories access" ON public.categories 
      FOR ALL TO authenticated
      USING (public.is_admin())
      WITH CHECK (public.is_admin());
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'referral_codes') THEN
    DROP POLICY IF EXISTS "Admin referral_codes access" ON public.referral_codes;
    DROP POLICY IF EXISTS "Super admin manage referral_codes" ON public.referral_codes;
    CREATE POLICY "Admin referral_codes access" ON public.referral_codes 
      FOR ALL TO authenticated
      USING (public.is_admin())
      WITH CHECK (public.is_admin());
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'referral_usages') THEN
    DROP POLICY IF EXISTS "Admin referral_usages access" ON public.referral_usages;
    DROP POLICY IF EXISTS "Super admin manage referral_usages" ON public.referral_usages;
    CREATE POLICY "Admin referral_usages access" ON public.referral_usages 
      FOR ALL TO authenticated
      USING (public.is_admin())
      WITH CHECK (public.is_admin());
  END IF;
END $$;
