-- ==============================================================================
-- SECURE RLS POLICIES FOR BOOKINGS TABLE
-- Copy and run this script in your Supabase SQL Editor (https://supabase.com)
-- ==============================================================================

-- 1. Ensure RLS is enabled on bookings
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- 2. Clean up existing policies on bookings
DROP POLICY IF EXISTS "Anyone can insert bookings" ON public.bookings;
DROP POLICY IF EXISTS "Public read bookings" ON public.bookings;
DROP POLICY IF EXISTS "User view own bookings" ON public.bookings;
DROP POLICY IF EXISTS "User update own bookings" ON public.bookings;
DROP POLICY IF EXISTS "Admin delete bookings" ON public.bookings;
DROP POLICY IF EXISTS "Admin manage bookings" ON public.bookings;
DROP POLICY IF EXISTS "Secure view bookings" ON public.bookings;
DROP POLICY IF EXISTS "Secure update bookings" ON public.bookings;

-- 3. INSERT POLICY: Public / Anonymous can create bookings
CREATE POLICY "Anyone can insert bookings" ON public.bookings
  FOR INSERT
  WITH CHECK (true);

-- 4. SELECT POLICY: SECURE - Strictly restricted read access
-- - Customers can only view their own bookings (by user_id or email)
-- - Admins can view ALL bookings (by admin role or admin email)
-- - NO PUBLIC SELECT ALLOWED
CREATE POLICY "Secure view bookings" ON public.bookings
  FOR SELECT
  USING (
    -- User views their own booking by auth UID
    (auth.uid() IS NOT NULL AND auth.uid() = user_id)
    -- OR user views their own booking by matching email in JWT
    OR (auth.jwt() ->> 'email' IS NOT NULL AND LOWER(email) = LOWER(auth.jwt() ->> 'email'))
    -- OR Admin user checked against public.profiles
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
    -- OR Admin user by authorized admin email
    OR LOWER(auth.jwt() ->> 'email') = 'admin@foundarly.com'
  );

-- 5. UPDATE POLICY: Only owners or admins can update
CREATE POLICY "Secure update bookings" ON public.bookings
  FOR UPDATE
  USING (
    (auth.uid() IS NOT NULL AND auth.uid() = user_id)
    OR (auth.jwt() ->> 'email' IS NOT NULL AND LOWER(email) = LOWER(auth.jwt() ->> 'email'))
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
    OR LOWER(auth.jwt() ->> 'email') = 'admin@foundarly.com'
  );

-- 6. DELETE POLICY: Only admins can delete bookings
CREATE POLICY "Admin delete bookings" ON public.bookings
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
    OR LOWER(auth.jwt() ->> 'email') = 'admin@foundarly.com'
  );
