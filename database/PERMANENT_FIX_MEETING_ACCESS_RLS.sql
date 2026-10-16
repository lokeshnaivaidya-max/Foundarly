-- ============================================================================
-- FOUNDARLY PRODUCTION DATABASE MIGRATION:
-- SECURE FIX FOR "MEETING SESSION NOT FOUND" ERROR
-- ============================================================================
-- Execute this script in the Supabase SQL Editor:
-- https://supabase.com/dashboard/project/rfyxnshvtfswvaogjzwq/sql
-- ============================================================================

-- 1. Ensure extensions exist
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Ensure meeting columns exist on public.bookings
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS meeting_room_id TEXT;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS participants_count INTEGER DEFAULT 0;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS meeting_started_at TIMESTAMPTZ;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS meeting_ended_at TIMESTAMPTZ;

-- 3. Backfill meeting_room_id for any bookings where it is NULL
UPDATE public.bookings
SET meeting_room_id = 'foundarly-' || id::TEXT
WHERE meeting_room_id IS NULL OR meeting_room_id = '';

-- 4. Create performance indexes for instant meeting room and email lookups
CREATE INDEX IF NOT EXISTS idx_bookings_meeting_room_id ON public.bookings(meeting_room_id);
CREATE INDEX IF NOT EXISTS idx_bookings_email_lower ON public.bookings(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_consultants_user_id ON public.consultants(user_id);
CREATE INDEX IF NOT EXISTS idx_consultants_email_lower ON public.consultants(LOWER(email));

-- ============================================================================
-- 5. SECURE DEFINER RPC: lookup_meeting_room
-- Allows authenticated and service_role callers to safely look up a booking
-- by meeting_room_id, prefixed ID ('foundarly-<uuid>'), or bare booking UUID.
-- Returns at most 1 room record without exposing payment details.
-- Participant access control is authoritatively validated by server & client logic.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.lookup_meeting_room(p_room_id TEXT)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  consultant_id UUID,
  name TEXT,
  email TEXT,
  "date" DATE,
  "time" TEXT,
  message TEXT,
  status TEXT,
  payment_status TEXT,
  session_duration INTEGER,
  session_price NUMERIC,
  meeting_room_id TEXT,
  participants_count INTEGER,
  meeting_started_at TIMESTAMPTZ,
  meeting_ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  consultant_name TEXT,
  consultant_email TEXT,
  consultant_title TEXT,
  consultant_user_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_clean TEXT := TRIM(p_room_id);
  v_raw TEXT;
  v_prefixed TEXT;
BEGIN
  IF v_clean IS NULL OR v_clean = '' THEN
    RETURN;
  END IF;

  -- Normalize URL or path fragments if present
  IF v_clean LIKE '%/meeting/%' THEN
    v_clean := SPLIT_PART(v_clean, '/meeting/', 2);
  END IF;
  v_clean := SPLIT_PART(SPLIT_PART(v_clean, '?', 1), '#', 1);
  v_clean := RTRIM(v_clean, '/');

  -- Derive prefix and raw variants
  IF v_clean LIKE 'foundarly-%' THEN
    v_raw := SUBSTRING(v_clean FROM 11);
    v_prefixed := v_clean;
  ELSE
    v_raw := v_clean;
    v_prefixed := 'foundarly-' || v_clean;
  END IF;

  RETURN QUERY
  SELECT 
    b.id,
    b.user_id,
    b.consultant_id,
    b.name,
    b.email,
    b.date,
    b.time,
    b.message,
    b.status,
    b.payment_status,
    b.session_duration,
    b.session_price,
    b.meeting_room_id,
    b.participants_count,
    b.meeting_started_at,
    b.meeting_ended_at,
    b.created_at,
    b.updated_at,
    c.name AS consultant_name,
    c.email AS consultant_email,
    c.title AS consultant_title,
    c.user_id AS consultant_user_id
  FROM public.bookings b
  LEFT JOIN public.consultants c ON c.id = b.consultant_id
  WHERE b.meeting_room_id = v_clean 
     OR b.meeting_room_id = v_prefixed 
     OR b.meeting_room_id = v_raw 
     OR (v_raw ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND b.id = v_raw::UUID) 
     OR (v_clean ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND b.id = v_clean::UUID)
  LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.lookup_meeting_room(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_meeting_room(TEXT) TO authenticated, service_role;

-- ============================================================================
-- 6. STRICT LEAST-PRIVILEGE RLS POLICIES FOR public.bookings
-- ============================================================================
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- Clean up older conflicting policies
DROP POLICY IF EXISTS "Anyone can insert bookings" ON public.bookings;
DROP POLICY IF EXISTS "Anyone can create bookings" ON public.bookings;
DROP POLICY IF EXISTS "Public read bookings" ON public.bookings;
DROP POLICY IF EXISTS "User view own bookings" ON public.bookings;
DROP POLICY IF EXISTS "User update own bookings" ON public.bookings;
DROP POLICY IF EXISTS "Admin delete bookings" ON public.bookings;
DROP POLICY IF EXISTS "Admin manage bookings" ON public.bookings;
DROP POLICY IF EXISTS "Secure view bookings" ON public.bookings;
DROP POLICY IF EXISTS "Secure update bookings" ON public.bookings;
DROP POLICY IF EXISTS "Users can view own bookings" ON public.bookings;
DROP POLICY IF EXISTS "Users and admins can view bookings" ON public.bookings;
DROP POLICY IF EXISTS "Users and admins can update bookings" ON public.bookings;
DROP POLICY IF EXISTS "Read bookings" ON public.bookings;
DROP POLICY IF EXISTS "Consultants can view own bookings" ON public.bookings;
DROP POLICY IF EXISTS "Consultants can view their bookings" ON public.bookings;

-- 6a. INSERT: Anyone can book a consultation
CREATE POLICY "Anyone can create bookings" ON public.bookings
  FOR INSERT
  WITH CHECK (true);

-- 6b. SELECT: Restricted to authorized clients, assigned consultants, and admins
CREATE POLICY "Secure view bookings" ON public.bookings
  FOR SELECT
  TO authenticated
  USING (
    -- Client by user_id
    (auth.uid() IS NOT NULL AND auth.uid() = user_id)
    -- Client by email in JWT (guest bookings where user_id was originally null)
    OR (auth.jwt() ->> 'email' IS NOT NULL AND LOWER(email) = LOWER(auth.jwt() ->> 'email'))
    -- Assigned Consultant by user_id or email
    OR consultant_id IN (
      SELECT c.id FROM public.consultants c
      WHERE c.user_id = auth.uid() 
         OR (auth.jwt() ->> 'email' IS NOT NULL AND LOWER(c.email) = LOWER(auth.jwt() ->> 'email'))
    )
    -- Admin by is_admin() function
    OR public.is_admin()
  );

-- 6c. UPDATE: Clients can self-heal guest user_id link; consultants can update; admins can update
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
  );

-- 6d. DELETE: Admins only
CREATE POLICY "Admin delete bookings" ON public.bookings
  FOR DELETE
  TO authenticated
  USING (
    public.is_admin()
  );

-- Permissions
GRANT SELECT, INSERT, UPDATE ON TABLE public.bookings TO authenticated, service_role;
GRANT INSERT ON TABLE public.bookings TO anon;
