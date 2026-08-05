-- ====================================================================
-- SECURE RLS POLICIES AND HELPER FUNCTIONS FOR FOUNDARLY
-- Run this script in your Supabase SQL Editor to resolve RLS issues securely.
-- ====================================================================

-- 1. SECURITY DEFINER Helper Function
-- Bypasses RLS during role evaluation to eliminate 42P17 recursion loops.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.profiles 
    WHERE id = auth.uid() 
      AND role = 'admin'
  );
$$;

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- 2. Ensure RLS is enabled on all core tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultant_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- 3. PROFILES RLS Policies
-- Strictly restricts profile reads: authenticated users can only view their own profile, while admins can view all profiles.
DROP POLICY IF EXISTS "Public profiles read" ON public.profiles;
DROP POLICY IF EXISTS "Users update own profile or Admin manage" ON public.profiles;
DROP POLICY IF EXISTS "Users read own profile or Admin read all" ON public.profiles;
DROP POLICY IF EXISTS "Users update own profile or Admin update all" ON public.profiles;

CREATE POLICY "Users read own profile or Admin read all"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR public.is_admin());

CREATE POLICY "Users update own profile or Admin update all"
  ON public.profiles FOR ALL
  TO authenticated
  USING (id = auth.uid() OR public.is_admin())
  WITH CHECK (id = auth.uid() OR public.is_admin());

-- 4. CONSULTANTS RLS Policies
DROP POLICY IF EXISTS "Public read active consultants" ON public.consultants;
DROP POLICY IF EXISTS "Admin manage consultants" ON public.consultants;

CREATE POLICY "Public read active consultants"
  ON public.consultants FOR SELECT
  TO public
  USING (is_active = true OR public.is_admin());

CREATE POLICY "Admin manage consultants"
  ON public.consultants FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 5. CONSULTANT_APPLICATIONS RLS Policies
DROP POLICY IF EXISTS "Anyone insert application" ON public.consultant_applications;
DROP POLICY IF EXISTS "Admin manage consultant applications" ON public.consultant_applications;

CREATE POLICY "Anyone insert application"
  ON public.consultant_applications FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Admin manage consultant applications"
  ON public.consultant_applications FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 6. SITE_SETTINGS RLS Policies
DROP POLICY IF EXISTS "Public read site settings" ON public.site_settings;
DROP POLICY IF EXISTS "Admin manage site settings" ON public.site_settings;

CREATE POLICY "Public read site settings"
  ON public.site_settings FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Admin manage site settings"
  ON public.site_settings FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
