-- Migration: 20261021000002_developer_admin_full_dashboard_access.sql
-- Allow Developer Admin operational management of payout_requests while keeping profile roles Super Admin only

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payout_requests') THEN
    ALTER TABLE public.payout_requests ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Super admins manage all payouts" ON public.payout_requests;
    DROP POLICY IF EXISTS "Admins manage all payouts" ON public.payout_requests;
    
    CREATE POLICY "Admins manage all payouts"
      ON public.payout_requests FOR ALL
      TO authenticated
      USING (public.is_admin())
      WITH CHECK (public.is_admin());
  END IF;
END $$;
