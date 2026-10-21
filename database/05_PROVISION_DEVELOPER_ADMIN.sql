-- ============================================================================
-- FOUNDARLY PRODUCTION DATABASE SCRIPT:
-- PROVISION DEVELOPER ADMIN ACCOUNT (foundarly@developer.in)
-- ============================================================================
-- Execution:
--   Run this script inside the Supabase Dashboard SQL Editor:
--   https://supabase.com/dashboard/project/rfyxnshvtfswvaogjzwq/sql
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Defensive check: Ensure profiles_role_check allows 'developer_admin' even if run standalone
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'profiles'
      AND con.conname = 'profiles_role_check'
      AND pg_get_constraintdef(con.oid) LIKE '%developer_admin%'
  ) THEN
    ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
    ALTER TABLE public.profiles 
      ADD CONSTRAINT profiles_role_check 
      CHECK (role IN ('super_admin', 'developer_admin', 'admin', 'consultant', 'client'));
  END IF;
END $$;

DO $$
DECLARE
  target_email TEXT := 'foundarly@developer.in';
  initial_password TEXT := 'foundar@developer';
  dev_user_id UUID;
BEGIN
  -- 1. Check if user already exists in auth.users
  SELECT id INTO dev_user_id FROM auth.users WHERE LOWER(email) = LOWER(target_email);

  IF dev_user_id IS NOT NULL THEN
    -- Update existing user password and confirmed status
    UPDATE auth.users
    SET 
      encrypted_password = crypt(initial_password, gen_salt('bf')),
      email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
      confirmed_at = COALESCE(confirmed_at, NOW()),
      updated_at = NOW(),
      raw_user_meta_data = jsonb_build_object(
        'full_name', 'Developer Admin',
        'must_change_password', true
      )
    WHERE id = dev_user_id;

    RAISE NOTICE '✅ Updated existing auth user % with initial password and must_change_password flag', target_email;
  ELSE
    -- Create new auth user
    dev_user_id := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      dev_user_id,
      'authenticated',
      'authenticated',
      target_email,
      crypt(initial_password, gen_salt('bf')),
      NOW(),
      NOW(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Developer Admin","must_change_password":true}'::jsonb,
      NOW(),
      NOW(),
      '',
      '',
      '',
      ''
    );

    RAISE NOTICE '✅ Created new auth user % with ID %', target_email, dev_user_id;
  END IF;

  -- 2. Upsert profile strictly with role = 'developer_admin'
  INSERT INTO public.profiles (id, full_name, role, created_at, updated_at)
  VALUES (
    dev_user_id,
    'Developer Admin',
    'developer_admin',
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    role = 'developer_admin',
    full_name = 'Developer Admin',
    updated_at = NOW();

  RAISE NOTICE '✅ public.profiles strictly set to role = developer_admin for %', target_email;
END $$;

-- Verification Query
SELECT 
  u.id,
  u.email,
  u.email_confirmed_at IS NOT NULL AS email_confirmed,
  u.raw_user_meta_data->>'must_change_password' AS must_change_password,
  p.role,
  p.full_name
FROM auth.users u
JOIN public.profiles p ON p.id = u.id
WHERE u.email = 'foundarly@developer.in';
