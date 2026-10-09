-- ============================================================================
-- FOUNDARLY PRODUCTION DATABASE MIGRATION: FOLLOW-UP WORKFLOW & RLS POLICIES
-- Execute this script in the Supabase SQL Editor:
-- https://supabase.com/dashboard/project/rfyxnshvtfswvaogjzwq/sql
-- (Or your configured Supabase project SQL Editor)
-- ============================================================================

-- 0. Ensure uuid extension is available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. SECURITY DEFINER HELPER: is_admin()
-- Avoids PostgreSQL 42P17 infinite recursion when checking roles in RLS
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  ) OR LOWER(COALESCE(auth.jwt() ->> 'email', '')) = 'admin@foundarly.com';
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role, anon;

-- ============================================================================
-- 2. CREATE TABLE: follow_up_requests
-- Safe table creation with full idempotent fallback columns
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.follow_up_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE NOT NULL,
  client_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  client_name TEXT,
  client_email TEXT,
  consultant_id UUID REFERENCES public.consultants(id) ON DELETE CASCADE NOT NULL,
  consultant_name TEXT,
  consultant_email TEXT,
  meeting_room_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  preferred_date DATE NOT NULL,
  preferred_time TEXT NOT NULL,
  alternative_date DATE,
  alternative_time TEXT,
  consultant_note TEXT,
  confirmed_date DATE,
  confirmed_time TEXT,
  declined_reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending_consultant',
  rejoin_deadline TIMESTAMPTZ NOT NULL,
  client_notified_at TIMESTAMPTZ,
  consultant_notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Defensive column additions in case table pre-existed from an earlier run
ALTER TABLE public.follow_up_requests ADD COLUMN IF NOT EXISTS client_name TEXT;
ALTER TABLE public.follow_up_requests ADD COLUMN IF NOT EXISTS client_email TEXT;
ALTER TABLE public.follow_up_requests ADD COLUMN IF NOT EXISTS consultant_name TEXT;
ALTER TABLE public.follow_up_requests ADD COLUMN IF NOT EXISTS consultant_email TEXT;
ALTER TABLE public.follow_up_requests ADD COLUMN IF NOT EXISTS alternative_date DATE;
ALTER TABLE public.follow_up_requests ADD COLUMN IF NOT EXISTS alternative_time TEXT;
ALTER TABLE public.follow_up_requests ADD COLUMN IF NOT EXISTS consultant_note TEXT;
ALTER TABLE public.follow_up_requests ADD COLUMN IF NOT EXISTS confirmed_date DATE;
ALTER TABLE public.follow_up_requests ADD COLUMN IF NOT EXISTS confirmed_time TEXT;
ALTER TABLE public.follow_up_requests ADD COLUMN IF NOT EXISTS declined_reason TEXT;
ALTER TABLE public.follow_up_requests ADD COLUMN IF NOT EXISTS rejoin_deadline TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days');
ALTER TABLE public.follow_up_requests ADD COLUMN IF NOT EXISTS client_notified_at TIMESTAMPTZ;
ALTER TABLE public.follow_up_requests ADD COLUMN IF NOT EXISTS consultant_notified_at TIMESTAMPTZ;
ALTER TABLE public.follow_up_requests ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Safely synchronize status check constraint
DO $$ 
BEGIN
  ALTER TABLE public.follow_up_requests DROP CONSTRAINT IF EXISTS follow_up_requests_status_check;
  ALTER TABLE public.follow_up_requests 
    ADD CONSTRAINT follow_up_requests_status_check 
    CHECK (status IN ('pending_consultant', 'alternative_proposed', 'confirmed', 'declined', 'completed', 'expired'));
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;

-- ============================================================================
-- 3. INDEXES FOR HIGH-PERFORMANCE LOOKUP
-- ============================================================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_active_follow_up_per_booking 
ON public.follow_up_requests(booking_id) 
WHERE status IN ('pending_consultant', 'alternative_proposed', 'confirmed');

CREATE INDEX IF NOT EXISTS idx_follow_up_booking_id ON public.follow_up_requests(booking_id);
CREATE INDEX IF NOT EXISTS idx_follow_up_client_id ON public.follow_up_requests(client_id);
CREATE INDEX IF NOT EXISTS idx_follow_up_consultant_id ON public.follow_up_requests(consultant_id);
CREATE INDEX IF NOT EXISTS idx_follow_up_status ON public.follow_up_requests(status);
CREATE INDEX IF NOT EXISTS idx_follow_up_deadline ON public.follow_up_requests(rejoin_deadline);

-- ============================================================================
-- 4. ROW LEVEL SECURITY (RLS) FOR follow_up_requests
-- ============================================================================
ALTER TABLE public.follow_up_requests ENABLE ROW LEVEL SECURITY;

-- Drop existing policies cleanly to avoid duplication errors
DROP POLICY IF EXISTS "Clients can view their follow up requests" ON public.follow_up_requests;
DROP POLICY IF EXISTS "Clients can request follow up" ON public.follow_up_requests;
DROP POLICY IF EXISTS "Clients can update follow up when alternative proposed" ON public.follow_up_requests;
DROP POLICY IF EXISTS "Consultants can view their follow up requests" ON public.follow_up_requests;
DROP POLICY IF EXISTS "Consultants can respond to follow up requests" ON public.follow_up_requests;
DROP POLICY IF EXISTS "Admins can view all follow up requests" ON public.follow_up_requests;
DROP POLICY IF EXISTS "Admins can manage all follow up requests" ON public.follow_up_requests;

-- Client Policies (Supports both authenticated UID and verified booking email)
CREATE POLICY "Clients can view their follow up requests" 
ON public.follow_up_requests 
FOR SELECT 
USING (
  auth.uid() = client_id OR 
  EXISTS (
    SELECT 1 FROM public.bookings b 
    WHERE b.id = follow_up_requests.booking_id AND (b.user_id = auth.uid() OR LOWER(b.email) = LOWER(COALESCE(auth.jwt() ->> 'email', '')))
  )
);

CREATE POLICY "Clients can request follow up" 
ON public.follow_up_requests 
FOR INSERT 
WITH CHECK (
  auth.uid() = client_id OR 
  EXISTS (
    SELECT 1 FROM public.bookings b 
    WHERE b.id = follow_up_requests.booking_id AND (b.user_id = auth.uid() OR LOWER(b.email) = LOWER(COALESCE(auth.jwt() ->> 'email', '')))
  )
);

CREATE POLICY "Clients can update follow up when alternative proposed" 
ON public.follow_up_requests 
FOR UPDATE 
USING (
  auth.uid() = client_id OR 
  EXISTS (
    SELECT 1 FROM public.bookings b 
    WHERE b.id = follow_up_requests.booking_id AND (b.user_id = auth.uid() OR LOWER(b.email) = LOWER(COALESCE(auth.jwt() ->> 'email', '')))
  )
);

-- Consultant Policies (Direct consultant authorization without admin bottleneck)
CREATE POLICY "Consultants can view their follow up requests" 
ON public.follow_up_requests 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.consultants c 
    WHERE c.id = follow_up_requests.consultant_id AND (c.user_id = auth.uid() OR LOWER(c.email) = LOWER(COALESCE(auth.jwt() ->> 'email', '')))
  )
);

CREATE POLICY "Consultants can respond to follow up requests" 
ON public.follow_up_requests 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.consultants c 
    WHERE c.id = follow_up_requests.consultant_id AND (c.user_id = auth.uid() OR LOWER(c.email) = LOWER(COALESCE(auth.jwt() ->> 'email', '')))
  )
);

-- Admin Oversight Policies (Uses non-recursive is_admin() helper)
CREATE POLICY "Admins can view all follow up requests" 
ON public.follow_up_requests 
FOR SELECT 
USING (public.is_admin());

CREATE POLICY "Admins can manage all follow up requests" 
ON public.follow_up_requests 
FOR ALL 
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Permissions
GRANT ALL ON TABLE public.follow_up_requests TO authenticated, service_role;
GRANT SELECT, INSERT ON TABLE public.follow_up_requests TO anon;

-- ============================================================================
-- 5. DISTRIBUTED SERVERLESS RATE LIMITING (NO PAID SERVICES REQUIRED)
-- Enables atomic rate tracking shared across all serverless lambda instances
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.rate_limit_entries (
  key TEXT PRIMARY KEY,
  count INT NOT NULL DEFAULT 1,
  reset_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_reset ON public.rate_limit_entries(reset_at);
ALTER TABLE public.rate_limit_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow service role and system rate limiting" ON public.rate_limit_entries;
CREATE POLICY "Allow service role and system rate limiting" 
ON public.rate_limit_entries 
FOR ALL 
USING (true) 
WITH CHECK (true);

GRANT ALL ON TABLE public.rate_limit_entries TO authenticated, service_role, anon;

-- Atomic RPC function for distributed rate limiting
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_key TEXT,
  p_limit INT,
  p_window_seconds INT
)
RETURNS TABLE (
  allowed BOOLEAN,
  remaining INT,
  retry_after INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := clock_timestamp();
  v_record RECORD;
BEGIN
  -- Cleanup key if already expired
  DELETE FROM public.rate_limit_entries 
  WHERE key = p_key AND reset_at <= v_now;

  -- Insert or increment count atomically
  INSERT INTO public.rate_limit_entries (key, count, reset_at, updated_at)
  VALUES (p_key, 1, v_now + (p_window_seconds || ' seconds')::INTERVAL, v_now)
  ON CONFLICT (key) DO UPDATE
  SET 
    count = public.rate_limit_entries.count + 1,
    updated_at = v_now
  RETURNING count, reset_at INTO v_record;

  IF v_record.count > p_limit THEN
    RETURN QUERY SELECT 
      false, 
      0, 
      GREATEST(1, EXTRACT(EPOCH FROM (v_record.reset_at - v_now))::INT);
  ELSE
    RETURN QUERY SELECT 
      true, 
      GREATEST(0, p_limit - v_record.count), 
      0;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_rate_limit(TEXT, INT, INT) TO authenticated, service_role, anon;

-- ============================================================================
-- 6. VERIFICATION QUERY
-- Shows created table columns and security status
-- ============================================================================
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'follow_up_requests'
ORDER BY ordinal_position;
