-- ====================================================================
-- SECURE FOUNDARLY AUTHORIZATION & ROW LEVEL SECURITY (RLS) POLICIES
-- ====================================================================
-- Run this script in the Supabase SQL Editor to enforce strict server-side
-- role isolation, prevent privilege escalation, and sanitize any accidental
-- admin roles previously assigned to normal user accounts.
-- ====================================================================

-- 1. SANITIZE ACCIDENTAL ADMIN ROLES
-- Demote any non-primary admin accounts back to standard 'client' role.
-- Replace 'admin@foundarly.com' with your official production admin email(s).
UPDATE public.profiles
SET role = 'client', updated_at = NOW()
WHERE role = 'admin'
  AND id NOT IN (
    SELECT id FROM auth.users 
    WHERE LOWER(email) IN ('admin@foundarly.com')
  );

-- 2. ENABLE ROW LEVEL SECURITY (RLS) ON PROFILES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. POLICIES: SELECT (READING PROFILES)
-- Authenticated users can view profiles
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;

CREATE POLICY "Users can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

-- 4. POLICIES: UPDATE (EDITING PROFILES)
-- CRITICAL SECURITY RULE: Users can only update non-role fields of their own profile.
-- Users CANNOT change their own 'role' column to 'admin'.
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own non-role fields" ON public.profiles;

CREATE POLICY "Users can update own non-role fields"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    -- Ensure the user cannot elevate their role to admin
    AND (
      role IS NOT DISTINCT FROM (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
      OR (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid()) = 'admin'
    )
  );

-- 5. TRIGGER: SAFE DEFAULT ROLE ON NEW USER SIGNUP
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role, is_consultant, created_at, updated_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    'client', -- ALWAYS default new users to 'client', never 'admin'
    false,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6. VERIFY CURRENT ROLES
SELECT 
  p.id,
  u.email,
  p.role,
  p.full_name,
  p.updated_at
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
ORDER BY p.updated_at DESC;
