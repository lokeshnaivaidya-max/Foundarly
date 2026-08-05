-- =====================================================
-- FIX ADMIN ACCESS AND PROFILE ISSUES
-- =====================================================
-- Run this in Supabase SQL Editor
-- =====================================================

-- Step 1: Check if your user exists in auth.users
-- Replace 'your-email@example.com' with your actual email
DO $$
DECLARE
  user_email TEXT := 'starkcloudie@gmail.com'; -- CHANGE THIS TO YOUR EMAIL
  user_record RECORD;
BEGIN
  SELECT id, email INTO user_record FROM auth.users WHERE email = user_email;
  
  IF user_record.id IS NULL THEN
    RAISE NOTICE '❌ User not found with email: %', user_email;
    RAISE NOTICE 'Please sign up first or check your email spelling';
  ELSE
    RAISE NOTICE '✅ User found: % (ID: %)', user_record.email, user_record.id;
    
    -- Step 2: Check if profile exists
    IF EXISTS (SELECT 1 FROM public.profiles WHERE id = user_record.id) THEN
      RAISE NOTICE '✅ Profile exists';
      
      -- Step 3: Update user to admin
      UPDATE public.profiles 
      SET role = 'admin' 
      WHERE id = user_record.id;
      
      RAISE NOTICE '✅ User role updated to admin';
    ELSE
      RAISE NOTICE '❌ Profile does not exist, creating now...';
      
      -- Create profile with admin role
      INSERT INTO public.profiles (id, role, full_name)
      VALUES (
        user_record.id,
        'admin',
        COALESCE((SELECT raw_user_meta_data->>'full_name' FROM auth.users WHERE id = user_record.id), 'Admin User')
      );
      
      RAISE NOTICE '✅ Profile created with admin role';
    END IF;
  END IF;
END $$;

-- =====================================================
-- VERIFY SETUP
-- =====================================================

-- Show all profiles (you should see your admin user)
SELECT 
  p.id,
  u.email,
  p.role,
  p.full_name,
  p.created_at
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
ORDER BY p.created_at DESC;

-- =====================================================
-- FIX RLS POLICIES IF NEEDED
-- =====================================================

-- Ensure profiles can be read by authenticated users
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Ensure the trigger exists for new users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'client'
  );
  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    -- Profile already exists, ignore
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- DONE!
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '🎉 Setup Complete!';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Check the query results above to verify your admin user';
  RAISE NOTICE '2. Log out and log back in to your app';
  RAISE NOTICE '3. You should now have admin access';
  RAISE NOTICE '';
END $$;
