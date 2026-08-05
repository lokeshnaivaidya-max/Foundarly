-- =====================================================
-- TEST FAQ INSERT - Diagnose the problem
-- =====================================================

-- Check if you're logged in and your role
SELECT 
  'Current User' as check_type,
  auth.uid() as user_id,
  (SELECT role FROM profiles WHERE id = auth.uid()) as user_role,
  (SELECT email FROM auth.users WHERE id = auth.uid()) as email;

-- Check FAQ table structure
SELECT 
  'FAQ Table Structure' as check_type,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'faqs'
ORDER BY ordinal_position;

-- Check FAQ policies
SELECT 
  'FAQ Policies' as check_type,
  policyname,
  permissive,
  roles,
  cmd,
  qual as using_clause,
  with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'faqs'
ORDER BY policyname;

-- Try to insert a test FAQ
DO $$
DECLARE
  test_id UUID;
  user_role TEXT;
BEGIN
  -- Get user role
  SELECT role INTO user_role FROM profiles WHERE id = auth.uid();
  
  RAISE NOTICE '';
  RAISE NOTICE '=== FAQ INSERT TEST ===';
  RAISE NOTICE 'Your role: %', COALESCE(user_role, 'NOT LOGGED IN');
  RAISE NOTICE '';
  
  IF user_role IS NULL THEN
    RAISE NOTICE '❌ You are not logged in!';
    RAISE NOTICE '   Log in to your app first, then run this test.';
    RETURN;
  END IF;
  
  IF user_role != 'admin' THEN
    RAISE NOTICE '❌ You are not an admin! Your role: %', user_role;
    RAISE NOTICE '   Run: SELECT make_user_admin(''your@email.com'');';
    RETURN;
  END IF;
  
  -- Try to insert
  BEGIN
    INSERT INTO faqs (question, answer, order_index)
    VALUES ('Test Question', 'Test Answer', 999)
    RETURNING id INTO test_id;
    
    RAISE NOTICE '✅ SUCCESS! FAQ inserted with ID: %', test_id;
    
    -- Clean up test data
    DELETE FROM faqs WHERE id = test_id;
    RAISE NOTICE '✅ Test FAQ deleted (cleanup)';
    
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '❌ INSERT FAILED!';
    RAISE NOTICE '   Error: %', SQLERRM;
    RAISE NOTICE '';
    RAISE NOTICE '🔍 Possible causes:';
    RAISE NOTICE '   1. RLS policy blocking insert';
    RAISE NOTICE '   2. Missing required columns';
    RAISE NOTICE '   3. Constraint violation';
  END;
  
  RAISE NOTICE '';
END $$;

-- Show existing FAQs
SELECT 
  'Existing FAQs' as check_type,
  COUNT(*) as total_faqs
FROM faqs;

-- Test if you can read FAQs
SELECT 
  'Can Read FAQs' as check_type,
  id,
  question,
  order_index
FROM faqs
ORDER BY order_index
LIMIT 3;
