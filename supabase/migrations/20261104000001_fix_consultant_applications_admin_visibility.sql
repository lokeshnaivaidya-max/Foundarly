-- Migration: consultant application admin visibility for all administrative roles
--
-- The original policy (20260805000002) only recognised profiles.role = 'admin'.
-- The application resolves super_admin and developer_admin as administrators, so
-- those accounts could open Admin -> Consultant Applications but receive an
-- empty list (RLS filtered every row). This migration is additive and safe to
-- re-run: it only replaces the consultant_applications policies.

ALTER TABLE public.consultant_applications ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.consultant_applications
  TO anon, authenticated, service_role;

-- Public submission must keep working without a login.
DROP POLICY IF EXISTS "Anyone insert consultant applications" ON public.consultant_applications;
CREATE POLICY "Anyone insert consultant applications"
ON public.consultant_applications
FOR INSERT
TO public
WITH CHECK (true);

DROP POLICY IF EXISTS "Admins select consultant applications" ON public.consultant_applications;
CREATE POLICY "Admins select consultant applications"
ON public.consultant_applications
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE public.profiles.id = auth.uid()
      AND lower(public.profiles.role) IN ('admin', 'super_admin', 'developer_admin')
  )
);

DROP POLICY IF EXISTS "Admins update consultant applications" ON public.consultant_applications;
CREATE POLICY "Admins update consultant applications"
ON public.consultant_applications
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE public.profiles.id = auth.uid()
      AND lower(public.profiles.role) IN ('admin', 'super_admin', 'developer_admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE public.profiles.id = auth.uid()
      AND lower(public.profiles.role) IN ('admin', 'super_admin', 'developer_admin')
  )
);

DROP POLICY IF EXISTS "Admins delete consultant applications" ON public.consultant_applications;
CREATE POLICY "Admins delete consultant applications"
ON public.consultant_applications
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE public.profiles.id = auth.uid()
      AND lower(public.profiles.role) IN ('admin', 'super_admin', 'developer_admin')
  )
);
