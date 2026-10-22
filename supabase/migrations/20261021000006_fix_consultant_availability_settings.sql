-- Migration: 20261021000006_fix_consultant_availability_settings.sql
-- Description: Add availability_settings column to consultants, configure RLS, and reload schema cache

ALTER TABLE public.consultants
ADD COLUMN IF NOT EXISTS availability_settings JSONB DEFAULT NULL;

COMMENT ON COLUMN public.consultants.availability_settings IS
'JSON configuration for consultant self-service availability: weekly schedule, multiple shifts, buffer, and blocked dates.';

CREATE INDEX IF NOT EXISTS idx_consultants_user_id_active
ON public.consultants (user_id, is_active);

CREATE INDEX IF NOT EXISTS idx_consultants_pricing_active
ON public.consultants (is_active, pricing_30, pricing_60);

UPDATE public.consultants
SET availability_settings = CASE
  WHEN (social_links->'availability_settings') IS NOT NULL THEN (social_links->'availability_settings')
  WHEN availability IS NOT NULL AND availability LIKE '{"%' THEN availability::jsonb
  ELSE NULL
END
WHERE availability_settings IS NULL 
  AND ((social_links->'availability_settings') IS NOT NULL OR (availability IS NOT NULL AND availability LIKE '{"%'));

DO $$
BEGIN
  ALTER TABLE public.consultants ENABLE ROW LEVEL SECURITY;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'consultants' AND policyname = 'Consultants can read own profile and public can read active'
  ) THEN
    CREATE POLICY "Consultants can read own profile and public can read active"
    ON public.consultants FOR SELECT
    USING (
      is_active = true 
      OR user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role IN ('admin', 'super_admin', 'developer_admin')
      )
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'consultants' AND policyname = 'Consultants self-update own availability'
  ) THEN
    CREATE POLICY "Consultants self-update own availability"
    ON public.consultants FOR UPDATE
    USING (
      user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role IN ('admin', 'super_admin', 'developer_admin')
      )
    );
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
