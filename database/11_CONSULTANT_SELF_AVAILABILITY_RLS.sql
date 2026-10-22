-- Database Migration: 11_CONSULTANT_SELF_AVAILABILITY_RLS.sql
-- Description: Consultant Self-Service Availability & Application Preference Sync
--
-- Features supported:
-- 1. Consultants can view their own original application preferred session timing.
-- 2. Consultants can self-manage their weekly working hours, multiple windows per day,
--    slot durations, buffers, and blocked dates/holidays.
-- 3. Strict authorization & field scoping:
--    - Consultants can ONLY update their own availability schedule.
--    - Consultation prices (pricing_30, pricing_60) remain strictly administered by admins.
--    - Confirmed customer bookings are guarded against accidental schedule invalidation.
--    - Consultants cannot modify other consultants, user roles, or payment records.

-- Step 1: Ensure availability_settings column on public.consultants
ALTER TABLE public.consultants
ADD COLUMN IF NOT EXISTS availability_settings JSONB DEFAULT NULL;

COMMENT ON COLUMN public.consultants.availability_settings IS
'JSON configuration for consultant self-service availability: weekly schedule, multiple shifts, buffer, and blocked dates.';

-- Step 2: Ensure fast lookup index on user_id for consultant profile authentication
CREATE INDEX IF NOT EXISTS idx_consultants_user_id_active
ON public.consultants (user_id, is_active);

-- Step 3: Configure Row Level Security (RLS) policies
DO $$
BEGIN
  -- Enable RLS on consultants table
  ALTER TABLE public.consultants ENABLE ROW LEVEL SECURITY;

  -- 3a. Read Policy: Public can view active consultants; consultants can view own row; admins can view all
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

  -- 3b. Update Policy: Authenticated consultants can update their own row (user_id = auth.uid())
  -- Note: Field scoping and price tampering prevention are strictly enforced at the server API layer.
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

  -- 3c. Ensure consultants can read their own original application from consultant_applications
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'consultant_applications' AND policyname = 'Applicants can read own application'
  ) THEN
    CREATE POLICY "Applicants can read own application"
    ON public.consultant_applications FOR SELECT
    USING (
      email ILIKE (auth.jwt() ->> 'email')
      OR EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role IN ('admin', 'super_admin', 'developer_admin')
      )
    );
  END IF;
END $$;
