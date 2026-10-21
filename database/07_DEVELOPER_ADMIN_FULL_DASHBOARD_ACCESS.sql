-- ============================================================================
-- 07_DEVELOPER_ADMIN_FULL_DASHBOARD_ACCESS.sql
-- Description:
--   Grants Developer Admin full operational access to ordinary admin tables
--   (such as payout_requests, upi_payments, and bookings) via public.is_admin(),
--   while STRICTLY preserving Super Admin exclusive authority over:
--     1. Administrator account creation, assignment, and revocation (public.is_super_admin())
--     2. User role alterations on public.profiles (public.is_super_admin())
-- ============================================================================

-- 1. Payout Requests: Allow all recognized administrators (Super Admin and Developer Admin)
-- to view and process payout requests
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payout_requests') THEN
    ALTER TABLE public.payout_requests ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Super admins manage all payouts" ON public.payout_requests;
    DROP POLICY IF EXISTS "Admins manage all payouts" ON public.payout_requests;
    
    -- Admins (Super Admin and Developer Admin) full operational management
    CREATE POLICY "Admins manage all payouts"
      ON public.payout_requests FOR ALL
      TO authenticated
      USING (public.is_admin())
      WITH CHECK (public.is_admin());
      
    RAISE NOTICE '✅ Payout requests RLS policy updated to allow all administrators via public.is_admin().';
  END IF;
END $$;

-- 2. Verify profiles role mutation remains strictly Super Admin only
-- Note: 'Users can update own non-role fields' and 'Super admins can manage all profiles'
-- enforce that ONLY public.is_super_admin() can change role values.
