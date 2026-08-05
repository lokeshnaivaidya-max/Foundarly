-- =====================================================
-- RESET / RECREATE ADMIN USER (admin@foundarly.com)
-- =====================================================
-- Execute this script inside the Supabase SQL Editor:
-- Project: https://rfyxnshvtfswvaogjzwq.supabase.co
-- =====================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  target_email TEXT := 'admin@foundarly.com';
  target_password TEXT := 'admin1234';
  admin_uid UUID;
BEGIN
  -- 1. Check if user already exists
  SELECT id INTO admin_uid FROM auth.users WHERE email = target_email;

  IF admin_uid IS NOT NULL THEN
    -- Update password and confirm email directly
    UPDATE auth.users
    SET 
      encrypted_password = crypt(target_password, gen_salt('bf')),
      email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
      confirmed_at = COALESCE(confirmed_at, NOW()),
      updated_at = NOW(),
      aud = 'authenticated',
      role = 'authenticated',
      raw_app_meta_data = '{"provider":"email","providers":["email"]}',
      raw_user_meta_data = '{"full_name":"Admin User"}'
    WHERE id = admin_uid;

    RAISE NOTICE 'Updated existing user % with new encrypted password and confirmed email', target_email;
  ELSE
    -- Insert new auth user with confirmed email
    admin_uid := gen_random_uuid();

    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      confirmed_at,
      recovery_sent_at,
      last_sign_in_at,
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
      admin_uid,
      'authenticated',
      'authenticated',
      target_email,
      crypt(target_password, gen_salt('bf')),
      NOW(),
      NOW(),
      NULL,
      NOW(),
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"Admin User"}',
      NOW(),
      NOW(),
      '',
      '',
      '',
      ''
    );

    RAISE NOTICE 'Created new auth user % (ID: %)', target_email, admin_uid;
  END IF;

  -- 2. Ensure public.profiles entry exists with role = 'admin'
  INSERT INTO public.profiles (id, email, full_name, role, created_at, updated_at)
  VALUES (
    admin_uid,
    target_email,
    'Admin User',
    'admin',
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    role = 'admin',
    email = target_email,
    full_name = 'Admin User',
    updated_at = NOW();

  RAISE NOTICE 'Ensured public.profiles has role=admin for %', target_email;
END $$;

-- Verify the account
SELECT 
  u.id, 
  u.email, 
  u.email_confirmed_at IS NOT NULL AS email_confirmed,
  p.role 
FROM auth.users u
JOIN public.profiles p ON p.id = u.id
WHERE u.email = 'admin@foundarly.com';
