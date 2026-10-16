-- ============================================================================
-- FOUNDARLY PRODUCTION SECURITY REMEDIATION:
-- REMOVES UNRESTRICTED 'OR true' ACCESS ON BOOKINGS & UPI_PAYMENTS
-- RESTORES LEAST-PRIVILEGE RLS POLICIES ACROSS ALL OPERATIONS
-- ============================================================================
-- Execute this script in the Supabase SQL Editor:
-- https://supabase.com/dashboard/project/rfyxnshvtfswvaogjzwq/sql
-- ============================================================================

-- 1. Ensure required extensions exist
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Ensure all referenced columns exist on public.bookings
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS meeting_room_id TEXT;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS participants_count INTEGER DEFAULT 0;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS meeting_started_at TIMESTAMPTZ;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS meeting_ended_at TIMESTAMPTZ;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 3. Ensure is_admin() helper function exists with safe search_path
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  ) OR LOWER(COALESCE(auth.jwt() ->> 'email', '')) = 'admin@foundarly.com';
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role, anon;

-- ============================================================================
-- 4. SECURE lookup_meeting_room() RPC
-- Note: "date" and "time" are quoted because they are reserved SQL keywords.
-- Returns at most 1 room record by room_id or UUID without exposing payments.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.lookup_meeting_room(p_room_id TEXT)
RETURNS TABLE (
  "id" UUID,
  "user_id" UUID,
  "consultant_id" UUID,
  "name" TEXT,
  "email" TEXT,
  "date" DATE,
  "time" TEXT,
  "message" TEXT,
  "status" TEXT,
  "payment_status" TEXT,
  "session_duration" INTEGER,
  "session_price" NUMERIC,
  "meeting_room_id" TEXT,
  "participants_count" INTEGER,
  "meeting_started_at" TIMESTAMPTZ,
  "meeting_ended_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ,
  "updated_at" TIMESTAMPTZ,
  "consultant_name" TEXT,
  "consultant_email" TEXT,
  "consultant_title" TEXT,
  "consultant_user_id" UUID
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
    b.date AS "date",
    b.time AS "time",
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
-- 5. REMEDIATE public.bookings RLS POLICIES
-- ============================================================================
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- Clean up older or insecure policies
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

-- 5a. INSERT: Any user (including guest clients) can create a booking request
CREATE POLICY "Anyone can create bookings" ON public.bookings
  FOR INSERT
  WITH CHECK (true);

-- 5b. SELECT: Strictly restricted to clients (user_id/email), assigned consultants, and admins
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

-- 5c. UPDATE: Clients can self-heal link or cancel; consultants can update session state; admins full control
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

-- 5d. DELETE: Strictly admins only (NEVER 'OR true')
CREATE POLICY "Admin delete bookings" ON public.bookings
  FOR DELETE
  TO authenticated
  USING (
    public.is_admin()
  );

GRANT SELECT, INSERT, UPDATE ON TABLE public.bookings TO authenticated, service_role;
GRANT INSERT ON TABLE public.bookings TO anon;

-- ============================================================================
-- 6. REMEDIATE public.upi_payments RLS POLICIES
-- ============================================================================
ALTER TABLE public.upi_payments ENABLE ROW LEVEL SECURITY;

-- Drop all insecure policies that contained 'OR true'
DROP POLICY IF EXISTS "Anyone can insert upi_payments" ON public.upi_payments;
DROP POLICY IF EXISTS "Users can view own upi_payments" ON public.upi_payments;
DROP POLICY IF EXISTS "Admins can view all upi_payments" ON public.upi_payments;
DROP POLICY IF EXISTS "Everyone can view upi_payments" ON public.upi_payments;
DROP POLICY IF EXISTS "Users and admins can view upi_payments" ON public.upi_payments;
DROP POLICY IF EXISTS "Users and admins can update upi_payments" ON public.upi_payments;
DROP POLICY IF EXISTS "Admins can update upi_payments" ON public.upi_payments;
DROP POLICY IF EXISTS "Admins can delete upi_payments" ON public.upi_payments;
DROP POLICY IF EXISTS "Secure view upi_payments" ON public.upi_payments;
DROP POLICY IF EXISTS "Secure update upi_payments" ON public.upi_payments;
DROP POLICY IF EXISTS "Secure delete upi_payments" ON public.upi_payments;
DROP POLICY IF EXISTS "Admin update upi_payments" ON public.upi_payments;
DROP POLICY IF EXISTS "Admin delete upi_payments" ON public.upi_payments;

-- 6a. INSERT: Any user (including guest customers) can submit payment verification data
CREATE POLICY "Anyone can insert upi_payments" ON public.upi_payments
  FOR INSERT
  WITH CHECK (true);

-- 6b. SELECT: Restricted to customer who paid (by user_id, email, or booking), assigned consultant, and admin
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

-- 6c. UPDATE: Strictly admins only (verifying or rejecting payments)
CREATE POLICY "Admin update upi_payments" ON public.upi_payments
  FOR UPDATE
  TO authenticated
  USING (
    public.is_admin()
  );

-- 6d. DELETE: Strictly admins only (NEVER 'OR true')
CREATE POLICY "Admin delete upi_payments" ON public.upi_payments
  FOR DELETE
  TO authenticated
  USING (
    public.is_admin()
  );

GRANT SELECT, INSERT ON TABLE public.upi_payments TO authenticated, service_role;
GRANT INSERT ON TABLE public.upi_payments TO anon;
GRANT UPDATE, DELETE ON TABLE public.upi_payments TO authenticated, service_role;

-- Verification summary
SELECT 'Remediation completed successfully' AS status;
