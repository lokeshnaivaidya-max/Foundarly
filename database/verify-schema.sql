-- Verify Database Schema Before Running Consultant Earnings System
-- Run this first to check if all required tables and columns exist

-- =====================================================
-- CHECK REQUIRED TABLES
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '=== CHECKING REQUIRED TABLES ===';
  
  -- Check consultants table
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'consultants') THEN
    RAISE NOTICE '✅ consultants table exists';
  ELSE
    RAISE EXCEPTION '❌ consultants table does not exist! Run supabase-setup.sql first';
  END IF;
  
  -- Check bookings table
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bookings') THEN
    RAISE NOTICE '✅ bookings table exists';
  ELSE
    RAISE EXCEPTION '❌ bookings table does not exist! Run supabase-setup.sql first';
  END IF;
  
  -- Check testimonials table
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'testimonials') THEN
    RAISE NOTICE '✅ testimonials table exists';
  ELSE
    RAISE WARNING '⚠️  testimonials table does not exist - ratings will not work';
  END IF;
  
  -- Check profiles table
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles') THEN
    RAISE NOTICE '✅ profiles table exists';
  ELSE
    RAISE WARNING '⚠️  profiles table does not exist - admin checks may fail';
  END IF;
END $$;

-- =====================================================
-- CHECK REQUIRED COLUMNS IN CONSULTANTS
-- =====================================================

DO $$
DECLARE
  missing_columns TEXT[] := ARRAY[]::TEXT[];
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== CHECKING CONSULTANTS TABLE COLUMNS ===';
  
  -- Check for id column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'consultants' AND column_name = 'id'
  ) THEN
    missing_columns := array_append(missing_columns, 'id');
  END IF;
  
  -- Check for name column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'consultants' AND column_name = 'name'
  ) THEN
    missing_columns := array_append(missing_columns, 'name');
  END IF;
  
  IF array_length(missing_columns, 1) > 0 THEN
    RAISE EXCEPTION '❌ Missing columns in consultants: %', array_to_string(missing_columns, ', ');
  ELSE
    RAISE NOTICE '✅ All required columns exist in consultants';
  END IF;
  
  -- Check if user_id exists (will be added by migration)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'consultants' AND column_name = 'user_id'
  ) THEN
    RAISE NOTICE '✅ user_id column already exists in consultants';
  ELSE
    RAISE NOTICE 'ℹ️  user_id column will be added by migration';
  END IF;
END $$;

-- =====================================================
-- CHECK REQUIRED COLUMNS IN BOOKINGS
-- =====================================================

DO $$
DECLARE
  missing_columns TEXT[] := ARRAY[]::TEXT[];
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== CHECKING BOOKINGS TABLE COLUMNS ===';
  
  -- Check for required columns
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'bookings' AND column_name = 'id'
  ) THEN
    missing_columns := array_append(missing_columns, 'id');
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'bookings' AND column_name = 'consultant_id'
  ) THEN
    missing_columns := array_append(missing_columns, 'consultant_id');
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'bookings' AND column_name = 'status'
  ) THEN
    missing_columns := array_append(missing_columns, 'status');
  END IF;
  
  IF array_length(missing_columns, 1) > 0 THEN
    RAISE EXCEPTION '❌ Missing columns in bookings: %', array_to_string(missing_columns, ', ');
  ELSE
    RAISE NOTICE '✅ All required columns exist in bookings';
  END IF;
  
  -- Check if new columns exist (will be added by migration)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'bookings' AND column_name = 'consultant_earnings'
  ) THEN
    RAISE NOTICE '✅ consultant_earnings column already exists';
  ELSE
    RAISE NOTICE 'ℹ️  consultant_earnings column will be added by migration';
  END IF;
END $$;

-- =====================================================
-- CHECK TESTIMONIALS TABLE STRUCTURE
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== CHECKING TESTIMONIALS TABLE ===';
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'testimonials') THEN
    -- Check for rating column
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'testimonials' AND column_name = 'rating'
    ) THEN
      RAISE NOTICE '✅ rating column exists in testimonials';
    ELSE
      RAISE WARNING '⚠️  rating column missing in testimonials';
    END IF;
    
    -- Check for booking_id column
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'testimonials' AND column_name = 'booking_id'
    ) THEN
      RAISE NOTICE '✅ booking_id column exists in testimonials';
    ELSE
      RAISE NOTICE 'ℹ️  booking_id column will be added (run add-review-fields.sql)';
    END IF;
    
    -- Check for status column
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'testimonials' AND column_name = 'status'
    ) THEN
      RAISE NOTICE '✅ status column exists in testimonials';
    ELSE
      RAISE WARNING '⚠️  status column missing in testimonials';
    END IF;
  END IF;
END $$;

-- =====================================================
-- CHECK AUTH.USERS ACCESS
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== CHECKING AUTH ACCESS ===';
  
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'auth' AND table_name = 'users'
  ) THEN
    RAISE NOTICE '✅ auth.users table accessible';
  ELSE
    RAISE WARNING '⚠️  Cannot access auth.users - RLS policies may fail';
  END IF;
END $$;

-- =====================================================
-- SUMMARY
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== VERIFICATION COMPLETE ===';
  RAISE NOTICE 'If all checks passed, you can run: consultant-earnings-system.sql';
  RAISE NOTICE 'If warnings appeared, the system will work but some features may be limited';
  RAISE NOTICE '';
END $$;

-- =====================================================
-- OPTIONAL: VIEW CURRENT SCHEMA
-- =====================================================

-- Uncomment to see all tables
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_schema = 'public' 
-- ORDER BY table_name;

-- Uncomment to see consultants columns
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'consultants'
-- ORDER BY ordinal_position;

-- Uncomment to see bookings columns
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'bookings'
-- ORDER BY ordinal_position;
