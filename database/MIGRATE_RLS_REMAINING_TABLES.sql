-- Dynamic RLS Migration for Consultants, Consultant Applications, and Site Settings
-- Drops all existing policies on these tables dynamically to prevent leftover recursive policies

DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN (SELECT policyname FROM pg_policies WHERE tablename = 'consultants' AND schemaname = 'public') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.consultants;', pol.policyname);
    END LOOP;

    FOR pol IN (SELECT policyname FROM pg_policies WHERE tablename = 'consultant_applications' AND schemaname = 'public') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.consultant_applications;', pol.policyname);
    END LOOP;

    FOR pol IN (SELECT policyname FROM pg_policies WHERE tablename = 'site_settings' AND schemaname = 'public') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.site_settings;', pol.policyname);
    END LOOP;
END $$;

ALTER TABLE public.consultants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultant_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- New Non-Recursive Policies
CREATE POLICY "Public read active consultants" ON public.consultants FOR SELECT TO public USING (is_active = true OR public.is_admin());
CREATE POLICY "Admin manage consultants" ON public.consultants FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Anyone insert application" ON public.consultant_applications FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Admin manage consultant applications" ON public.consultant_applications FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Public read site settings" ON public.site_settings FOR SELECT TO public USING (true);
CREATE POLICY "Admin manage site settings" ON public.site_settings FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
