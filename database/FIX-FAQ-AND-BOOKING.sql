-- =====================================================
-- FIX FAQ INSERT AND BOOKING COLUMNS
-- =====================================================

-- =====================================================
-- PART 1: Add missing columns to bookings table
-- =====================================================

-- Add session_duration column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'bookings' AND column_name = 'session_duration'
  ) THEN
    ALTER TABLE bookings ADD COLUMN session_duration INTEGER;
    RAISE NOTICE '✅ Added session_duration column to bookings';
  ELSE
    RAISE NOTICE '✓ session_duration column already exists';
  END IF;
END $$;

-- Add session_price column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'bookings' AND column_name = 'session_price'
  ) THEN
    ALTER TABLE bookings ADD COLUMN session_price NUMERIC(10, 2);
    RAISE NOTICE '✅ Added session_price column to bookings';
  ELSE
    RAISE NOTICE '✓ session_price column already exists';
  END IF;
END $$;

-- =====================================================
-- PART 2: Fix FAQ RLS policies
-- =====================================================

-- Drop existing FAQ policies
DROP POLICY IF EXISTS "public_read_faqs" ON faqs;
DROP POLICY IF EXISTS "admins_full_access_faqs" ON faqs;
DROP POLICY IF EXISTS "auth_write_faqs" ON faqs;
DROP POLICY IF EXISTS "allow_read_faqs" ON faqs;
DROP POLICY IF EXISTS "allow_write_faqs" ON faqs;

-- Everyone can read FAQs
CREATE POLICY "public_read_faqs"
  ON faqs FOR SELECT
  USING (true);

-- Admins can do everything with FAQs
CREATE POLICY "admins_full_access_faqs"
  ON faqs FOR ALL
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  )
  WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

-- =====================================================
-- PART 3: Verify bookings table structure
-- =====================================================

DO $$
DECLARE
  col_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO col_count
  FROM information_schema.columns
  WHERE table_name = 'bookings' 
    AND column_name IN ('session_duration', 'session_price');
  
  RAISE NOTICE '';
  RAISE NOTICE '✅ =====================================================';
  RAISE NOTICE '✅ FIX APPLIED!';
  RAISE NOTICE '✅ =====================================================';
  RAISE NOTICE '';
  RAISE NOTICE '📊 Bookings table:';
  RAISE NOTICE '   Columns added: %/2', col_count;
  
  IF col_count = 2 THEN
    RAISE NOTICE '   ✅ session_duration: EXISTS';
    RAISE NOTICE '   ✅ session_price: EXISTS';
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '📋 FAQ policies:';
  RAISE NOTICE '   ✅ Public can read FAQs';
  RAISE NOTICE '   ✅ Admins can create/update/delete FAQs';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 Next steps:';
  RAISE NOTICE '   1. Refresh your admin panel';
  RAISE NOTICE '   2. Try adding a new FAQ';
  RAISE NOTICE '   3. Try creating a booking';
  RAISE NOTICE '   4. Both should work now!';
  RAISE NOTICE '';
END $$;

-- =====================================================
-- PART 4: Show bookings table structure
-- =====================================================

SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'bookings'
ORDER BY ordinal_position;
