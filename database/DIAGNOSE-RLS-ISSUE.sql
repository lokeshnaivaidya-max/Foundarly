-- =====================================================
-- DIAGNOSE RLS ISSUE - Why data shows before login but not after
-- =====================================================
-- Run this in Supabase SQL Editor to diagnose the problem
-- =====================================================

-- =====================================================
-- 1. CHECK CURRENT USER
-- =====================================================

SELECT 
  'Current User Info' as check_type,
  auth.uid() as user_id,
  auth.role() as user_role;

-- =====================================================
-- 2. CHECK IF USER HAS PROFILE
-- =====================================================

SELECT 
  'User Profile Check' as check_type,
  p.id,
  p.role,
  p.full_name,
  u.email
FROM profiles p
JOIN auth.users u ON u.id = p.id
WHERE p.id = auth.uid();

-- If this returns nothing, your profile is missing!

-- =====================================================
-- 3. CHECK CONSULTANTS POLICIES
-- =====================================================

-- Check what policies exist
SELECT 
  'Consultants Policies' as check_type,
  policyname,
  permissive,
  roles,
  cmd,
  qual as using_clause
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'consultants'
ORDER BY policyname;

-- Test if you can see consultants
SELECT 
  'Consultants Visible' as check_type,
  COUNT(*) as total_count,
  COUNT(*) FILTER (WHERE is_active = true) as active_count
FROM consultants;

-- =====================================================
-- 4. CHECK TESTIMONIALS POLICIES
-- =====================================================

SELECT 
  'Testimonials Policies' as check_type,
  policyname,
  permissive,
  roles,
  cmd,
  qual as using_clause
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'testimonials'
ORDER BY policyname;

-- Test if you can see testimonials
SELECT 
  'Testimonials Visible' as check_type,
  COUNT(*) as total_count,
  COUNT(*) FILTER (WHERE status = 'published') as published_count
FROM testimonials;

-- =====================================================
-- 5. CHECK PRICING POLICIES
-- =====================================================

SELECT 
  'Pricing Policies' as check_type,
  policyname,
  permissive,
  roles,
  cmd,
  qual as using_clause
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'pricing_tiers'
ORDER BY policyname;

-- Test if you can see pricing
SELECT 
  'Pricing Visible' as check_type,
  COUNT(*) as total_count,
  COUNT(*) FILTER (WHERE is_active = true) as active_count
FROM pricing_tiers;

-- =====================================================
-- 6. CHECK ALL RLS ENABLED TABLES
-- =====================================================

SELECT 
  'RLS Enabled Tables' as check_type,
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND rowsecurity = true
ORDER BY tablename;

-- =====================================================
-- 7. COMMON ISSUES DIAGNOSIS
-- =====================================================

DO $$
DECLARE
  user_exists BOOLEAN;
  profile_exists BOOLEAN;
  profile_role TEXT;
  consultant_count INTEGER;
  testimonial_count INTEGER;
BEGIN
  -- Check if user is authenticated
  IF auth.uid() IS NULL THEN
    RAISE NOTICE '❌ ISSUE: You are NOT logged in (anonymous user)';
    RAISE NOTICE '   Solution: Log in to your app first';
  ELSE
    RAISE NOTICE '✅ You are logged in as: %', auth.uid();
    
    -- Check if profile exists
    SELECT EXISTS(SELECT 1 FROM profiles WHERE id = auth.uid()) INTO profile_exists;
    
    IF NOT profile_exists THEN
      RAISE NOTICE '❌ ISSUE: Your profile does NOT exist in profiles table';
      RAISE NOTICE '   Solution: Run fix-admin-access.sql to create your profile';
    ELSE
      -- Get profile role
      SELECT role INTO profile_role FROM profiles WHERE id = auth.uid();
      RAISE NOTICE '✅ Your profile exists with role: %', profile_role;
    END IF;
  END IF;
  
  -- Check if data is visible
  SELECT COUNT(*) INTO consultant_count FROM consultants WHERE is_active = true;
  SELECT COUNT(*) INTO testimonial_count FROM testimonials WHERE status = 'published';
  
  RAISE NOTICE '';
  RAISE NOTICE '📊 Data Visibility:';
  RAISE NOTICE '   Consultants visible: %', consultant_count;
  RAISE NOTICE '   Testimonials visible: %', testimonial_count;
  
  IF consultant_count = 0 OR testimonial_count = 0 THEN
    RAISE NOTICE '';
    RAISE NOTICE '❌ ISSUE: Data is NOT visible after login';
    RAISE NOTICE '   This means RLS policies are blocking authenticated users';
    RAISE NOTICE '';
    RAISE NOTICE '🔧 SOLUTION:';
    RAISE NOTICE '   1. Run FIXED-RLS-POLICIES.sql (the updated version)';
    RAISE NOTICE '   2. Make sure policies use USING (condition) without TO authenticated';
    RAISE NOTICE '   3. Separate policies for anonymous and authenticated users';
  ELSE
    RAISE NOTICE '✅ Data is visible!';
  END IF;
END $$;

-- =====================================================
-- 8. RECOMMENDED FIX
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=======================================================';
  RAISE NOTICE 'RECOMMENDED FIX FOR "DATA SHOWS BEFORE LOGIN BUT NOT AFTER"';
  RAISE NOTICE '=======================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'The problem is that RLS policies are using:';
  RAISE NOTICE '  ❌ USING (condition OR EXISTS(...))';
  RAISE NOTICE '';
  RAISE NOTICE 'This fails because when you login, the OR condition';
  RAISE NOTICE 'tries to check EXISTS() which might fail if your profile';
  RAISE NOTICE 'is missing or the query is slow.';
  RAISE NOTICE '';
  RAISE NOTICE 'SOLUTION: Use TWO separate policies:';
  RAISE NOTICE '';
  RAISE NOTICE '  ✅ Policy 1: USING (is_active = true)';
  RAISE NOTICE '     - No TO clause = works for everyone';
  RAISE NOTICE '';
  RAISE NOTICE '  ✅ Policy 2: USING (EXISTS(...)) TO authenticated';
  RAISE NOTICE '     - Only for admins to see drafts/inactive';
  RAISE NOTICE '';
  RAISE NOTICE 'Run the UPDATED FIXED-RLS-POLICIES.sql file!';
  RAISE NOTICE '';
END $$;
