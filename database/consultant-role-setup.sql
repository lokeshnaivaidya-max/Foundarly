-- Ensure All Consultants Have Proper Role and Access
-- Run this after consultant-earnings-system.sql

-- =====================================================
-- 1. UPDATE PROFILES TABLE FOR CONSULTANTS
-- =====================================================

-- Set consultant role for all users linked to consultants
UPDATE profiles 
SET role = 'consultant'
WHERE id IN (
  SELECT user_id 
  FROM consultants 
  WHERE user_id IS NOT NULL
);

-- =====================================================
-- 2. CREATE FUNCTION TO AUTO-SET CONSULTANT ROLE
-- =====================================================

-- Function to automatically set consultant role when user_id is added to consultants
CREATE OR REPLACE FUNCTION set_consultant_role()
RETURNS TRIGGER AS $$
BEGIN
  -- If user_id is being set (INSERT or UPDATE)
  IF NEW.user_id IS NOT NULL THEN
    -- Update the user's profile to have consultant role
    UPDATE profiles 
    SET role = 'consultant'
    WHERE id = NEW.user_id;
    
    -- If profile doesn't exist, create it
    INSERT INTO profiles (id, role, full_name)
    VALUES (NEW.user_id, 'consultant', NEW.name)
    ON CONFLICT (id) 
    DO UPDATE SET role = 'consultant';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 3. CREATE TRIGGER FOR AUTO ROLE ASSIGNMENT
-- =====================================================

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_set_consultant_role ON consultants;

-- Create trigger that fires when consultants table is updated
CREATE TRIGGER trigger_set_consultant_role
  AFTER INSERT OR UPDATE OF user_id ON consultants
  FOR EACH ROW
  WHEN (NEW.user_id IS NOT NULL)
  EXECUTE FUNCTION set_consultant_role();

-- =====================================================
-- 4. UPDATE CONSULTANT DASHBOARD ACCESS CONTROL
-- =====================================================

-- Function to check if user is a consultant
CREATE OR REPLACE FUNCTION is_consultant(user_uuid UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM consultants c
    JOIN profiles p ON c.user_id = p.id
    WHERE c.user_id = user_uuid 
    AND p.role = 'consultant'
    AND c.is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 5. UPDATE RLS POLICIES FOR BETTER ACCESS CONTROL
-- =====================================================

-- Update consultant dashboard stats view access
DROP POLICY IF EXISTS "Consultants can view own dashboard stats" ON consultant_dashboard_stats;
CREATE POLICY "Consultants can view own dashboard stats"
  ON consultant_dashboard_stats FOR SELECT
  USING (
    user_id = auth.uid() 
    AND EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'consultant'
    )
  );

-- Update payout requests policies
DROP POLICY IF EXISTS "Consultants can view own payout requests" ON payout_requests;
CREATE POLICY "Consultants can view own payout requests"
  ON payout_requests FOR SELECT
  USING (
    consultant_id IN (
      SELECT c.id FROM consultants c
      JOIN profiles p ON c.user_id = p.id
      WHERE c.user_id = auth.uid() 
      AND p.role = 'consultant'
    )
  );

DROP POLICY IF EXISTS "Consultants can create payout requests" ON payout_requests;
CREATE POLICY "Consultants can create payout requests"
  ON payout_requests FOR INSERT
  WITH CHECK (
    consultant_id IN (
      SELECT c.id FROM consultants c
      JOIN profiles p ON c.user_id = p.id
      WHERE c.user_id = auth.uid() 
      AND p.role = 'consultant'
    )
  );

-- Update consultant earnings policies
DROP POLICY IF EXISTS "Consultants can view own earnings" ON consultant_earnings;
CREATE POLICY "Consultants can view own earnings"
  ON consultant_earnings FOR SELECT
  USING (
    consultant_id IN (
      SELECT c.id FROM consultants c
      JOIN profiles p ON c.user_id = p.id
      WHERE c.user_id = auth.uid() 
      AND p.role = 'consultant'
    )
  );

-- Update bookings policies for consultants
DROP POLICY IF EXISTS "Consultants can view own bookings" ON bookings;
CREATE POLICY "Consultants can view own bookings"
  ON bookings FOR SELECT
  USING (
    consultant_id IN (
      SELECT c.id FROM consultants c
      JOIN profiles p ON c.user_id = p.id
      WHERE c.user_id = auth.uid() 
      AND p.role = 'consultant'
    )
  );

DROP POLICY IF EXISTS "Consultants can update own bookings" ON bookings;
CREATE POLICY "Consultants can update own bookings"
  ON bookings FOR UPDATE
  USING (
    consultant_id IN (
      SELECT c.id FROM consultants c
      JOIN profiles p ON c.user_id = p.id
      WHERE c.user_id = auth.uid() 
      AND p.role = 'consultant'
    )
  );

-- =====================================================
-- 6. CREATE HELPER FUNCTIONS FOR ROLE MANAGEMENT
-- =====================================================

-- Function to promote user to consultant
CREATE OR REPLACE FUNCTION promote_to_consultant(
  user_email TEXT,
  consultant_name TEXT,
  consultant_title TEXT,
  consultant_bio TEXT,
  consultant_expertise TEXT[],
  pricing_30_min INTEGER,
  pricing_60_min INTEGER,
  consultant_email TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  user_uuid UUID;
  consultant_uuid UUID;
BEGIN
  -- Get user ID by email
  SELECT id INTO user_uuid
  FROM auth.users
  WHERE email = user_email;
  
  IF user_uuid IS NULL THEN
    RAISE EXCEPTION 'User with email % not found', user_email;
  END IF;
  
  -- Check if user is already a consultant
  IF EXISTS (SELECT 1 FROM consultants WHERE user_id = user_uuid) THEN
    RAISE EXCEPTION 'User % is already a consultant', user_email;
  END IF;
  
  -- Create consultant record
  INSERT INTO consultants (
    name,
    title,
    bio,
    expertise,
    pricing_30,
    pricing_60,
    user_id,
    email,
    is_active
  ) VALUES (
    consultant_name,
    consultant_title,
    consultant_bio,
    consultant_expertise,
    pricing_30_min,
    pricing_60_min,
    user_uuid,
    COALESCE(consultant_email, user_email),
    true
  ) RETURNING id INTO consultant_uuid;
  
  -- Update profile role (trigger will also do this, but being explicit)
  UPDATE profiles 
  SET role = 'consultant', full_name = consultant_name
  WHERE id = user_uuid;
  
  RETURN consultant_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to revoke consultant access
CREATE OR REPLACE FUNCTION revoke_consultant_access(consultant_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
  user_uuid UUID;
BEGIN
  -- Get user_id from consultant
  SELECT user_id INTO user_uuid
  FROM consultants
  WHERE id = consultant_uuid;
  
  IF user_uuid IS NULL THEN
    RAISE EXCEPTION 'Consultant not found or not linked to user';
  END IF;
  
  -- Deactivate consultant
  UPDATE consultants 
  SET is_active = false, user_id = NULL
  WHERE id = consultant_uuid;
  
  -- Change user role back to client
  UPDATE profiles 
  SET role = 'client'
  WHERE id = user_uuid;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 7. CREATE VIEW FOR CONSULTANT USER MANAGEMENT
-- =====================================================

CREATE OR REPLACE VIEW consultant_users AS
SELECT 
  c.id as consultant_id,
  c.name as consultant_name,
  c.email as consultant_email,
  c.user_id,
  c.is_active,
  p.role as user_role,
  p.full_name as profile_name,
  u.email as auth_email,
  u.created_at as user_created_at,
  c.created_at as consultant_created_at
FROM consultants c
LEFT JOIN profiles p ON c.user_id = p.id
LEFT JOIN auth.users u ON c.user_id = u.id
ORDER BY c.created_at DESC;

-- =====================================================
-- 8. GRANT PERMISSIONS FOR HELPER FUNCTIONS
-- =====================================================

-- Allow admins to use management functions
GRANT EXECUTE ON FUNCTION promote_to_consultant TO authenticated;
GRANT EXECUTE ON FUNCTION revoke_consultant_access TO authenticated;
GRANT EXECUTE ON FUNCTION is_consultant TO authenticated;

-- RLS for consultant_users view
ALTER VIEW consultant_users SET (security_barrier = true);

-- =====================================================
-- 9. VERIFICATION QUERIES
-- =====================================================

-- Check all consultants have proper roles
DO $$
DECLARE
  consultant_count INTEGER;
  role_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO consultant_count
  FROM consultants
  WHERE user_id IS NOT NULL AND is_active = true;
  
  SELECT COUNT(*) INTO role_count
  FROM consultants c
  JOIN profiles p ON c.user_id = p.id
  WHERE c.user_id IS NOT NULL 
  AND c.is_active = true 
  AND p.role = 'consultant';
  
  RAISE NOTICE 'Active consultants with user_id: %', consultant_count;
  RAISE NOTICE 'Consultants with proper role: %', role_count;
  
  IF consultant_count != role_count THEN
    RAISE WARNING 'Some consultants do not have proper consultant role!';
  ELSE
    RAISE NOTICE '✅ All consultants have proper roles';
  END IF;
END $$;

-- =====================================================
-- SUMMARY
-- =====================================================

COMMENT ON FUNCTION set_consultant_role() IS 'Automatically sets consultant role when user_id is added to consultants table';
COMMENT ON FUNCTION is_consultant(UUID) IS 'Checks if a user is an active consultant with proper role';
COMMENT ON FUNCTION promote_to_consultant IS 'Promotes a user to consultant with all proper setup';
COMMENT ON FUNCTION revoke_consultant_access IS 'Revokes consultant access and changes role back to client';
COMMENT ON VIEW consultant_users IS 'View showing all consultants with their user account details and roles';

-- =====================================================
-- USAGE EXAMPLES
-- =====================================================

-- Example: Promote user to consultant
-- SELECT promote_to_consultant(
--   'user@example.com',
--   'John Doe',
--   'Business Consultant',
--   'Expert in business strategy',
--   ARRAY['Business', 'Strategy'],
--   1000,
--   1800,
--   'john@consultant.com'
-- );

-- Example: Check if current user is consultant
-- SELECT is_consultant();

-- Example: View all consultant users
-- SELECT * FROM consultant_users;

-- Example: Revoke consultant access
-- SELECT revoke_consultant_access('consultant-uuid-here');