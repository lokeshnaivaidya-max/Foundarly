-- ============================================================================
-- FIX CONSULTANT APPLICATIONS & CONSULTANTS RLS POLICIES
-- ============================================================================
-- Run this migration in your Supabase SQL Editor to resolve permission/RLS errors
-- during consultant application approval, creation, update, and deletion.
--
-- This script is completely IDEMPOTENT and safe to execute multiple times.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Enable Row Level Security (RLS) on both tables
-- ----------------------------------------------------------------------------
ALTER TABLE public.consultant_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultants ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 2. Explicitly drop known legacy/conflicting policies on consultant_applications
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Anyone submit consultant application" ON public.consultant_applications;
DROP POLICY IF EXISTS "Public insert consultant applications" ON public.consultant_applications;
DROP POLICY IF EXISTS "public_insert_consultant_applications" ON public.consultant_applications;
DROP POLICY IF EXISTS "Admin manage consultant applications" ON public.consultant_applications;
DROP POLICY IF EXISTS "Admin select consultant applications" ON public.consultant_applications;
DROP POLICY IF EXISTS "Admin update consultant applications" ON public.consultant_applications;
DROP POLICY IF EXISTS "Admin delete consultant applications" ON public.consultant_applications;
DROP POLICY IF EXISTS "Users can submit applications" ON public.consultant_applications;
DROP POLICY IF EXISTS "Users can view own applications" ON public.consultant_applications;
DROP POLICY IF EXISTS "Admins can view all applications" ON public.consultant_applications;
DROP POLICY IF EXISTS "Admins can update applications" ON public.consultant_applications;
DROP POLICY IF EXISTS "Admins can delete applications" ON public.consultant_applications;
DROP POLICY IF EXISTS "admins_full_access_consultant_applications" ON public.consultant_applications;

-- ----------------------------------------------------------------------------
-- 3. Create fresh, secure RLS policies for consultant_applications
-- ----------------------------------------------------------------------------

-- 3a. Anyone (public/unauthenticated or authenticated) can submit an application
CREATE POLICY "Public insert consultant applications" 
ON public.consultant_applications 
FOR INSERT 
TO public 
WITH CHECK (true);

-- 3b. Authenticated Admins can view (SELECT) all consultant applications
CREATE POLICY "Admin select consultant applications" 
ON public.consultant_applications 
FOR SELECT 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- 3c. Authenticated Admins can update applications (Approve / Reject / Notes)
-- Includes both USING and WITH CHECK clauses for PostgREST .select() compatibility
CREATE POLICY "Admin update consultant applications" 
ON public.consultant_applications 
FOR UPDATE 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- 3d. Authenticated Admins can delete consultant applications
CREATE POLICY "Admin delete consultant applications" 
ON public.consultant_applications 
FOR DELETE 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- ----------------------------------------------------------------------------
-- 4. Explicitly drop known legacy/conflicting policies on consultants
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public read active consultants" ON public.consultants;
DROP POLICY IF EXISTS "Public read consultants" ON public.consultants;
DROP POLICY IF EXISTS "public_read_consultants" ON public.consultants;
DROP POLICY IF EXISTS "allow_read_consultants" ON public.consultants;
DROP POLICY IF EXISTS "Consultants are viewable by everyone" ON public.consultants;
DROP POLICY IF EXISTS "Anyone can view active consultants" ON public.consultants;
DROP POLICY IF EXISTS "Everyone can view active consultants" ON public.consultants;
DROP POLICY IF EXISTS "Admins can view all consultants" ON public.consultants;
DROP POLICY IF EXISTS "Admin manage consultants" ON public.consultants;
DROP POLICY IF EXISTS "Admin select consultants" ON public.consultants;
DROP POLICY IF EXISTS "Admin insert consultants" ON public.consultants;
DROP POLICY IF EXISTS "Only admins can insert consultants" ON public.consultants;
DROP POLICY IF EXISTS "Admins can insert consultants" ON public.consultants;
DROP POLICY IF EXISTS "Admin update consultants" ON public.consultants;
DROP POLICY IF EXISTS "Only admins can update consultants" ON public.consultants;
DROP POLICY IF EXISTS "Admins can update consultants" ON public.consultants;
DROP POLICY IF EXISTS "Admin delete consultants" ON public.consultants;
DROP POLICY IF EXISTS "Only admins can delete consultants" ON public.consultants;
DROP POLICY IF EXISTS "Admins can delete consultants" ON public.consultants;
DROP POLICY IF EXISTS "Admins can manage consultants" ON public.consultants;
DROP POLICY IF EXISTS "allow_write_consultants" ON public.consultants;
DROP POLICY IF EXISTS "auth_write_consultants" ON public.consultants;
DROP POLICY IF EXISTS "admins_full_access_consultants" ON public.consultants;
DROP POLICY IF EXISTS "Allow service role to read all consultants" ON public.consultants;

-- ----------------------------------------------------------------------------
-- 5. Create fresh, secure RLS policies for consultants
-- ----------------------------------------------------------------------------

-- 5a. Public can view active consultants; Admins can view all consultants (including inactive)
CREATE POLICY "Public read consultants" 
ON public.consultants 
FOR SELECT 
TO public 
USING (
  is_active = true OR 
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- 5b. Authenticated Admins can insert new consultants (e.g., upon application approval)
CREATE POLICY "Admin insert consultants" 
ON public.consultants 
FOR INSERT 
TO authenticated 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- 5c. Authenticated Admins can update consultant profiles
CREATE POLICY "Admin update consultants" 
ON public.consultants 
FOR UPDATE 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- 5d. Authenticated Admins can delete consultants
CREATE POLICY "Admin delete consultants" 
ON public.consultants 
FOR DELETE 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);
