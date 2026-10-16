-- =====================================================
-- SECURE FIX FOR BOOKING & PAYMENT PIPELINE + RLS
-- =====================================================
-- Run this script in the Supabase SQL Editor
-- =====================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. CREATE BOOKINGS TABLE (IF NOT EXISTS) & ENSURE ALL COLUMNS
CREATE TABLE IF NOT EXISTS bookings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  consultant_id UUID REFERENCES consultants(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  date DATE NOT NULL,
  time TEXT NOT NULL,
  message TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled', 'missed')),
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'refunded', 'rejected')),
  session_duration INTEGER DEFAULT 60,
  session_price NUMERIC(10, 2),
  meeting_room_id TEXT,
  participants_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure meeting_room_id and participants_count exist if table already created
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS meeting_room_id TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS participants_count INTEGER DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 3. CREATE UPI_PAYMENTS TABLE (IF NOT EXISTS)
CREATE TABLE IF NOT EXISTS upi_payments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  transaction_id TEXT NOT NULL,
  payment_amount NUMERIC(10, 2) NOT NULL,
  payment_method TEXT DEFAULT 'UPI',
  consultant_id UUID REFERENCES consultants(id) ON DELETE SET NULL,
  session_duration INTEGER DEFAULT 60,
  booking_date DATE,
  booking_time TEXT,
  booking_message TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected')),
  admin_notes TEXT,
  verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. ENABLE REALTIME REPLICATION FOR BOOKINGS AND UPI_PAYMENTS
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE bookings;
  EXCEPTION WHEN duplicate_object THEN
    -- Table already in publication
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE upi_payments;
  EXCEPTION WHEN duplicate_object THEN
    -- Table already in publication
  END;
END;
$$;

-- 5. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE upi_payments ENABLE ROW LEVEL SECURITY;

-- Helper admin function
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

-- Drop existing policies to prevent conflicts
DROP POLICY IF EXISTS "Anyone can create bookings" ON bookings;
DROP POLICY IF EXISTS "Authenticated users can create bookings" ON bookings;
DROP POLICY IF EXISTS "Users can create bookings" ON bookings;
DROP POLICY IF EXISTS "Users can view own bookings" ON bookings;
DROP POLICY IF EXISTS "Admins can view all bookings" ON bookings;
DROP POLICY IF EXISTS "Everyone can view bookings" ON bookings;
DROP POLICY IF EXISTS "Users can update own bookings" ON bookings;
DROP POLICY IF EXISTS "Admins can update bookings" ON bookings;
DROP POLICY IF EXISTS "Admins can delete bookings" ON bookings;
DROP POLICY IF EXISTS "Admins can manage bookings" ON bookings;
DROP POLICY IF EXISTS "Users and admins can view bookings" ON bookings;
DROP POLICY IF EXISTS "Users and admins can update bookings" ON bookings;
DROP POLICY IF EXISTS "Secure view bookings" ON bookings;
DROP POLICY IF EXISTS "Secure update bookings" ON bookings;
DROP POLICY IF EXISTS "Admin delete bookings" ON bookings;

DROP POLICY IF EXISTS "Anyone can insert upi_payments" ON upi_payments;
DROP POLICY IF EXISTS "Users can view own upi_payments" ON upi_payments;
DROP POLICY IF EXISTS "Admins can view all upi_payments" ON upi_payments;
DROP POLICY IF EXISTS "Everyone can view upi_payments" ON upi_payments;
DROP POLICY IF EXISTS "Users and admins can view upi_payments" ON upi_payments;
DROP POLICY IF EXISTS "Users and admins can update upi_payments" ON upi_payments;
DROP POLICY IF EXISTS "Admins can update upi_payments" ON upi_payments;
DROP POLICY IF EXISTS "Admins can delete upi_payments" ON upi_payments;
DROP POLICY IF EXISTS "Secure view upi_payments" ON upi_payments;
DROP POLICY IF EXISTS "Admin update upi_payments" ON upi_payments;
DROP POLICY IF EXISTS "Admin delete upi_payments" ON upi_payments;

-- BOOKINGS POLICIES ----
CREATE POLICY "Anyone can create bookings"
  ON bookings FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Secure view bookings"
  ON bookings FOR SELECT
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

CREATE POLICY "Secure update bookings"
  ON bookings FOR UPDATE
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

CREATE POLICY "Admin delete bookings"
  ON bookings FOR DELETE
  TO authenticated
  USING (
    public.is_admin()
  );

-- UPI_PAYMENTS POLICIES ----
CREATE POLICY "Anyone can insert upi_payments"
  ON upi_payments FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Secure view upi_payments"
  ON upi_payments FOR SELECT
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

CREATE POLICY "Admin update upi_payments"
  ON upi_payments FOR UPDATE
  TO authenticated
  USING (
    public.is_admin()
  );

CREATE POLICY "Admin delete upi_payments"
  ON upi_payments FOR DELETE
  TO authenticated
  USING (
    public.is_admin()
  );

-- 6. INDEXES FOR FAST PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_consultant_id ON bookings(consultant_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_payment_status ON bookings(payment_status);
CREATE INDEX IF NOT EXISTS idx_upi_payments_booking_id ON upi_payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_upi_payments_user_id ON upi_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_upi_payments_status ON upi_payments(status);
