-- ============================================================================
-- FOUNDARLY PRODUCTION DATABASE MIGRATION: 
-- 12_FIX_CONSULTANT_AVAILABILITY_SETTINGS_SCHEMA_CACHE.sql
--
-- Description:
-- Adds availability_settings JSONB to public.consultants table, backfills from
-- social_links.availability_settings, configures RLS, and reloads PostgREST schema cache.
--
-- Supabase Project: rfyxnshvtfswvaogjzwq
-- Supabase Dashboard URL: https://supabase.com/dashboard/project/rfyxnshvtfswvaogjzwq/sql
-- ============================================================================

-- Step 1: Add availability_settings column idempotently (preserves all existing rows & data)
ALTER TABLE public.consultants
ADD COLUMN IF NOT EXISTS availability_settings JSONB DEFAULT NULL;

COMMENT ON COLUMN public.consultants.availability_settings IS
'JSON configuration for consultant self-service availability: weekly schedule, multiple shifts, buffer, and blocked dates.';

-- Step 2: Ensure fast lookup indexes
CREATE INDEX IF NOT EXISTS idx_consultants_user_id_active
ON public.consultants (user_id, is_active);

CREATE INDEX IF NOT EXISTS idx_consultants_pricing_active
ON public.consultants (is_active, pricing_30, pricing_60);

-- Step 3: Backfill any existing availability data from social_links or availability column
UPDATE public.consultants
SET availability_settings = CASE
  WHEN (social_links->'availability_settings') IS NOT NULL THEN (social_links->'availability_settings')
  WHEN availability IS NOT NULL AND availability LIKE '{"%' THEN availability::jsonb
  ELSE NULL
END
WHERE availability_settings IS NULL 
  AND ((social_links->'availability_settings') IS NOT NULL OR (availability IS NOT NULL AND availability LIKE '{"%'));

-- Step 4: Ensure RLS policies permit consultants to self-update their own availability
DO $$
BEGIN
  ALTER TABLE public.consultants ENABLE ROW LEVEL SECURITY;

  -- 4a. Read policy: active consultants are public, consultants can read own, admins can read all
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

  -- 4b. Update policy: authenticated consultant can update own profile (user_id = auth.uid()) or admin
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

-- Step 5: Reload PostgREST schema cache so the column is immediately visible to all API requests
NOTIFY pgrst, 'reload schema';
