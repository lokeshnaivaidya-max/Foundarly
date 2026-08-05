-- =====================================================
-- ADMIN USER MANAGEMENT FUNCTIONS
-- =====================================================
-- This file contains SQL functions to manage admin users
-- =====================================================

-- =====================================================
-- FUNCTION: Make a user an admin
-- =====================================================
CREATE OR REPLACE FUNCTION make_user_admin(user_email TEXT)
RETURNS TEXT AS $$
DECLARE
  user_record RECORD;
BEGIN
  -- Find the user by email
  SELECT id, email INTO user_record
  FROM auth.users
  WHERE email = user_email;
  
  IF NOT FOUND THEN
    RETURN '❌ User not found: ' || user_email;
  END IF;
  
  -- Update the profile to admin role
  UPDATE profiles
  SET role = 'admin'
  WHERE id = user_record.id;
  
  IF FOUND THEN
    RETURN '✅ User ' || user_email || ' is now an admin';
  ELSE
    RETURN '❌ Profile not found for user: ' || user_email;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNCTION: Remove admin role from a user
-- =====================================================
CREATE OR REPLACE FUNCTION remove_admin_role(user_email TEXT)
RETURNS TEXT AS $$
DECLARE
  user_record RECORD;
BEGIN
  -- Find the user by email
  SELECT id, email INTO user_record
  FROM auth.users
  WHERE email = user_email;
  
  IF NOT FOUND THEN
    RETURN '❌ User not found: ' || user_email;
  END IF;
  
  -- Update the profile to user role
  UPDATE profiles
  SET role = 'user'
  WHERE id = user_record.id;
  
  IF FOUND THEN
    RETURN '✅ Admin role removed from ' || user_email;
  ELSE
    RETURN '❌ Profile not found for user: ' || user_email;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNCTION: List all admin users
-- =====================================================
CREATE OR REPLACE FUNCTION list_admin_users()
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  full_name TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    u.email,
    p.full_name,
    p.created_at
  FROM profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE p.role = 'admin'
  ORDER BY p.created_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNCTION: Check if a user is an admin
-- =====================================================
CREATE OR REPLACE FUNCTION is_user_admin(user_email TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  user_record RECORD;
  user_role TEXT;
BEGIN
  -- Find the user by email
  SELECT id INTO user_record
  FROM auth.users
  WHERE email = user_email;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Check the role
  SELECT role INTO user_role
  FROM profiles
  WHERE id = user_record.id;
  
  RETURN (user_role = 'admin');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNCTION: Helper function for RLS policies
-- =====================================================
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    SELECT role = 'admin'
    FROM profiles
    WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- =====================================================
-- USAGE EXAMPLES
-- =====================================================

-- Make a user an admin:
-- SELECT make_user_admin('user@example.com');

-- Remove admin role:
-- SELECT remove_admin_role('user@example.com');

-- List all admins:
-- SELECT * FROM list_admin_users();

-- Check if user is admin:
-- SELECT is_user_admin('user@example.com');

-- Use in RLS policies:
-- CREATE POLICY "admins_can_do_anything"
--   ON some_table FOR ALL
--   USING (is_admin());

-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ =====================================================';
  RAISE NOTICE '✅ ADMIN MANAGEMENT FUNCTIONS CREATED!';
  RAISE NOTICE '✅ =====================================================';
  RAISE NOTICE '';
  RAISE NOTICE '📋 Available functions:';
  RAISE NOTICE '   1. make_user_admin(email) - Grant admin role';
  RAISE NOTICE '   2. remove_admin_role(email) - Remove admin role';
  RAISE NOTICE '   3. list_admin_users() - List all admins';
  RAISE NOTICE '   4. is_user_admin(email) - Check if user is admin';
  RAISE NOTICE '   5. is_admin() - Helper for RLS policies';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 Example usage:';
  RAISE NOTICE '   SELECT make_user_admin(''your-email@example.com'');';
  RAISE NOTICE '';
END $$;
