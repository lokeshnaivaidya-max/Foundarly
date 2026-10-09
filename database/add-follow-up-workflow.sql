-- ============================================================================
-- FOUNDARLY PRODUCTION DATABASE MIGRATION: 
-- FOLLOW-UP WORKFLOW, FIELD PROTECTION, TIGHTENED RLS & DISTRIBUTED RATE LIMITER
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Non-recursive admin helper
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
  status TEXT NOT NULL DEFAULT 'pending_consultant' 
    CHECK (status IN ('pending_consultant', 'alternative_proposed', 'confirmed', 'declined', 'completed', 'expired')),
  rejoin_deadline TIMESTAMPTZ NOT NULL,
  client_notified_at TIMESTAMPTZ,
  consultant_notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Defensive additions for pre-existing tables
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

-- Unique index to prevent duplicate pending/active follow-up requests per booking
CREATE UNIQUE INDEX IF NOT EXISTS idx_active_follow_up_per_booking 
ON public.follow_up_requests(booking_id) 
WHERE status IN ('pending_consultant', 'alternative_proposed', 'confirmed');

CREATE INDEX IF NOT EXISTS idx_follow_up_booking_id ON public.follow_up_requests(booking_id);
CREATE INDEX IF NOT EXISTS idx_follow_up_client_id ON public.follow_up_requests(client_id);
CREATE INDEX IF NOT EXISTS idx_follow_up_consultant_id ON public.follow_up_requests(consultant_id);
CREATE INDEX IF NOT EXISTS idx_follow_up_status ON public.follow_up_requests(status);
CREATE INDEX IF NOT EXISTS idx_follow_up_deadline ON public.follow_up_requests(rejoin_deadline);

-- Field protection trigger
CREATE OR REPLACE FUNCTION public.protect_follow_up_request_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_admin() OR current_setting('role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id THEN RAISE EXCEPTION 'Field "id" is immutable.'; END IF;
  IF NEW.booking_id IS DISTINCT FROM OLD.booking_id THEN RAISE EXCEPTION 'Field "booking_id" is immutable.'; END IF;
  IF NEW.client_id IS DISTINCT FROM OLD.client_id THEN RAISE EXCEPTION 'Field "client_id" is immutable.'; END IF;
  IF NEW.consultant_id IS DISTINCT FROM OLD.consultant_id THEN RAISE EXCEPTION 'Field "consultant_id" is immutable.'; END IF;
  IF NEW.meeting_room_id IS DISTINCT FROM OLD.meeting_room_id THEN RAISE EXCEPTION 'Field "meeting_room_id" is immutable.'; END IF;
  IF NEW.rejoin_deadline IS DISTINCT FROM OLD.rejoin_deadline THEN RAISE EXCEPTION 'Field "rejoin_deadline" is immutable.'; END IF;
  IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN RAISE EXCEPTION 'Field "created_at" is immutable.'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.consultants c 
    WHERE c.id = OLD.consultant_id 
      AND (c.user_id = auth.uid() OR LOWER(c.email) = LOWER(COALESCE(auth.jwt() ->> 'email', '')))
  ) THEN
    IF NEW.reason IS DISTINCT FROM OLD.reason OR
       NEW.preferred_date IS DISTINCT FROM OLD.preferred_date OR
       NEW.preferred_time IS DISTINCT FROM OLD.preferred_time OR
       NEW.alternative_date IS DISTINCT FROM OLD.alternative_date OR
       NEW.alternative_time IS DISTINCT FROM OLD.alternative_time OR
       NEW.consultant_note IS DISTINCT FROM OLD.consultant_note THEN
      RAISE EXCEPTION 'Clients cannot modify consultant proposal fields or initial request details.';
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.consultants c 
    WHERE c.id = OLD.consultant_id 
      AND (c.user_id = auth.uid() OR LOWER(c.email) = LOWER(COALESCE(auth.jwt() ->> 'email', '')))
  ) THEN
    IF NEW.reason IS DISTINCT FROM OLD.reason OR
       NEW.preferred_date IS DISTINCT FROM OLD.preferred_date OR
       NEW.preferred_time IS DISTINCT FROM OLD.preferred_time OR
       NEW.client_name IS DISTINCT FROM OLD.client_name OR
       NEW.client_email IS DISTINCT FROM OLD.client_email THEN
      RAISE EXCEPTION 'Consultants cannot modify client request details.';
    END IF;
  END IF;

  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_follow_up_request_fields ON public.follow_up_requests;
CREATE TRIGGER trg_protect_follow_up_request_fields
BEFORE UPDATE ON public.follow_up_requests
FOR EACH ROW
EXECUTE FUNCTION public.protect_follow_up_request_fields();

-- Enable RLS
ALTER TABLE public.follow_up_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Clients can view their follow up requests" ON public.follow_up_requests;
DROP POLICY IF EXISTS "Clients can request follow up" ON public.follow_up_requests;
DROP POLICY IF EXISTS "Clients can update follow up when alternative proposed" ON public.follow_up_requests;
DROP POLICY IF EXISTS "Consultants can view their follow up requests" ON public.follow_up_requests;
DROP POLICY IF EXISTS "Consultants can respond to follow up requests" ON public.follow_up_requests;
DROP POLICY IF EXISTS "Admins can view all follow up requests" ON public.follow_up_requests;
DROP POLICY IF EXISTS "Admins can manage all follow up requests" ON public.follow_up_requests;

-- 1. Client can view their own follow-ups
CREATE POLICY "Clients can view their follow up requests" 
ON public.follow_up_requests 
FOR SELECT 
USING (
  auth.uid() = client_id OR 
  EXISTS (
    SELECT 1 FROM public.bookings b 
    WHERE b.id = follow_up_requests.booking_id 
      AND (b.user_id = auth.uid() OR LOWER(b.email) = LOWER(COALESCE(auth.jwt() ->> 'email', '')))
  )
);

-- 2. Client can insert follow-ups for their own bookings
CREATE POLICY "Clients can request follow up" 
ON public.follow_up_requests 
FOR INSERT 
WITH CHECK (
  (
    auth.uid() = client_id OR 
    EXISTS (
      SELECT 1 FROM public.bookings b 
      WHERE b.id = follow_up_requests.booking_id 
        AND (b.user_id = auth.uid() OR LOWER(b.email) = LOWER(COALESCE(auth.jwt() ->> 'email', '')))
    )
  )
  AND status = 'pending_consultant'
);

-- 3. Client can respond to alternative time proposed by consultant
CREATE POLICY "Clients can update follow up when alternative proposed" 
ON public.follow_up_requests 
FOR UPDATE 
USING (
  (
    auth.uid() = client_id OR 
    EXISTS (
      SELECT 1 FROM public.bookings b 
      WHERE b.id = follow_up_requests.booking_id 
        AND (b.user_id = auth.uid() OR LOWER(b.email) = LOWER(COALESCE(auth.jwt() ->> 'email', '')))
    )
  )
  AND status = 'alternative_proposed'
)
WITH CHECK (
  (
    auth.uid() = client_id OR 
    EXISTS (
      SELECT 1 FROM public.bookings b 
      WHERE b.id = follow_up_requests.booking_id 
        AND (b.user_id = auth.uid() OR LOWER(b.email) = LOWER(COALESCE(auth.jwt() ->> 'email', '')))
    )
  )
  AND status IN ('confirmed', 'declined')
);

-- 4. Assigned Consultants can view follow-up requests assigned to them
CREATE POLICY "Consultants can view their follow up requests" 
ON public.follow_up_requests 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.consultants c 
    WHERE c.id = follow_up_requests.consultant_id 
      AND (c.user_id = auth.uid() OR LOWER(c.email) = LOWER(COALESCE(auth.jwt() ->> 'email', '')))
  )
);

-- 5. Assigned Consultants can respond (accept, propose alternative, decline)
CREATE POLICY "Consultants can respond to follow up requests" 
ON public.follow_up_requests 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.consultants c 
    WHERE c.id = follow_up_requests.consultant_id 
      AND (c.user_id = auth.uid() OR LOWER(c.email) = LOWER(COALESCE(auth.jwt() ->> 'email', '')))
  )
  AND status IN ('pending_consultant', 'alternative_proposed')
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.consultants c 
    WHERE c.id = follow_up_requests.consultant_id 
      AND (c.user_id = auth.uid() OR LOWER(c.email) = LOWER(COALESCE(auth.jwt() ->> 'email', '')))
  )
  AND status IN ('confirmed', 'alternative_proposed', 'declined')
);

-- 6. Admins can view all follow-up requests
CREATE POLICY "Admins can view all follow up requests"
ON public.follow_up_requests
FOR SELECT
USING (public.is_admin());

-- 7. Admins can manage all follow-up requests
CREATE POLICY "Admins can manage all follow up requests"
ON public.follow_up_requests
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- 8. Table-level permissions
GRANT ALL ON TABLE public.follow_up_requests TO authenticated, service_role;
GRANT SELECT, INSERT ON TABLE public.follow_up_requests TO anon;

-- 9. Rate limit entries & RPC
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
  DELETE FROM public.rate_limit_entries 
  WHERE key = p_key AND reset_at <= v_now;

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
