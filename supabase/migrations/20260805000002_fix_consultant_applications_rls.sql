-- Migration: Fix Row Level Security (RLS) and Table Grants on consultant_applications
-- Ensures public/anon and authenticated users can submit applications without RLS violations
-- Ensures admins can read, update, approve, reject, and delete applications safely.

-- 1. Ensure RLS is enabled on the table
ALTER TABLE public.consultant_applications ENABLE ROW LEVEL SECURITY;

-- 2. Grant table-level permissions to anon, authenticated, and service_role
GRANT ALL ON TABLE public.consultant_applications TO anon, authenticated, service_role;

-- 3. Drop any existing policies on consultant_applications to ensure clean & idempotent setup
DROP POLICY IF EXISTS "Anyone apply consultant" ON public.consultant_applications;
DROP POLICY IF EXISTS "Admins view consultant applications" ON public.consultant_applications;
DROP POLICY IF EXISTS "Admins manage consultant applications" ON public.consultant_applications;
DROP POLICY IF EXISTS "Anyone insert consultant applications" ON public.consultant_applications;
DROP POLICY IF EXISTS "Admins select consultant applications" ON public.consultant_applications;
DROP POLICY IF EXISTS "Admins update consultant applications" ON public.consultant_applications;
DROP POLICY IF EXISTS "Admins delete consultant applications" ON public.consultant_applications;

-- 4. INSERT Policy: Allow anyone (unauthenticated anon and authenticated users) to submit an application
CREATE POLICY "Anyone insert consultant applications"
ON public.consultant_applications
FOR INSERT
TO public
WITH CHECK (true);

-- 5. SELECT Policy: Allow admin users to view all consultant applications
CREATE POLICY "Admins select consultant applications"
ON public.consultant_applications
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE public.profiles.id = auth.uid()
      AND public.profiles.role = 'admin'
  )
);

-- 6. UPDATE Policy: Allow admin users to update applications (e.g., status, notes)
CREATE POLICY "Admins update consultant applications"
ON public.consultant_applications
FOR UPDATE
TO public
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE public.profiles.id = auth.uid()
      AND public.profiles.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE public.profiles.id = auth.uid()
      AND public.profiles.role = 'admin'
  )
);

-- 7. DELETE Policy: Allow admin users to delete applications
CREATE POLICY "Admins delete consultant applications"
ON public.consultant_applications
FOR DELETE
TO public
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE public.profiles.id = auth.uid()
      AND public.profiles.role = 'admin'
  )
);
