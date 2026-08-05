-- Helper Script: Link Consultants to User Accounts
-- Run this after consultant-earnings-system.sql

-- =====================================================
-- OPTION 1: Link Existing Consultant to Your Account
-- =====================================================

-- Replace 'consultant-name-here' with the actual consultant name
-- This will link that consultant to your currently logged-in user
UPDATE consultants 
SET user_id = auth.uid() 
WHERE name = 'consultant-name-here';

-- Example:
-- UPDATE consultants SET user_id = auth.uid() WHERE name = 'John Doe';

-- =====================================================
-- OPTION 2: Link by Consultant ID
-- =====================================================

-- If you know the consultant ID and user ID:
-- UPDATE consultants 
-- SET user_id = 'user-uuid-here' 
-- WHERE id = 'consultant-uuid-here';

-- =====================================================
-- OPTION 3: Create Test Consultant Linked to You
-- =====================================================

-- This creates a new consultant and links it to your account
INSERT INTO consultants (
  name,
  title,
  bio,
  expertise,
  pricing_30,
  pricing_60,
  user_id,
  is_active
) VALUES (
  'Test Consultant',
  'Professional Consultant',
  'Expert consultant for testing the platform',
  ARRAY['Business', 'Strategy', 'Consulting'],
  1000,
  1800,
  auth.uid(),  -- Links to your current user
  true
);

-- =====================================================
-- OPTION 4: Link All Consultants to Specific Users
-- =====================================================

-- If you have a mapping of consultant emails to user emails:
-- (Requires adding email field to consultants first)

-- Add email field if not exists
ALTER TABLE consultants ADD COLUMN IF NOT EXISTS email TEXT;

-- Then link by email:
-- UPDATE consultants c
-- SET user_id = u.id
-- FROM auth.users u
-- WHERE c.email = u.email;

-- =====================================================
-- VERIFY LINKING
-- =====================================================

-- Check which consultants are linked to users:
SELECT 
  c.id,
  c.name,
  c.user_id,
  u.email as user_email
FROM consultants c
LEFT JOIN auth.users u ON c.user_id = u.id
ORDER BY c.name;

-- Check if YOUR account is linked to a consultant:
SELECT 
  c.id,
  c.name,
  c.title,
  c.user_id
FROM consultants c
WHERE c.user_id = auth.uid();

-- =====================================================
-- TESTING: Quick Setup for Development
-- =====================================================

-- For quick testing, link the first consultant to your account:
-- UPDATE consultants 
-- SET user_id = auth.uid() 
-- WHERE id = (SELECT id FROM consultants LIMIT 1);

-- Or create a test consultant:
-- DO $$
-- DECLARE
--   new_consultant_id UUID;
-- BEGIN
--   INSERT INTO consultants (name, title, bio, expertise, pricing_30, pricing_60, user_id, is_active)
--   VALUES (
--     'Test Consultant',
--     'Test Professional',
--     'Testing consultant dashboard',
--     ARRAY['Testing'],
--     1000,
--     1800,
--     auth.uid(),
--     true
--   )
--   RETURNING id INTO new_consultant_id;
--   
--   RAISE NOTICE 'Created consultant with ID: %', new_consultant_id;
-- END $$;

-- =====================================================
-- NOTES
-- =====================================================

-- 1. Each consultant should have a unique user_id
-- 2. A user can only be linked to ONE consultant
-- 3. After linking, the user can access /consultant-dashboard
-- 4. Consultants without user_id cannot login to dashboard
-- 5. When approving consultant applications, remember to set user_id

