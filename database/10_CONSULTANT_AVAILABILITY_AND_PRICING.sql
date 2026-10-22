-- Database Script: 10_CONSULTANT_AVAILABILITY_AND_PRICING.sql
-- Description: Consultant Availability & Consultation Pricing Management Schema & RLS Policies.
-- Supports:
-- 1. Weekly schedule with multiple time windows per day (e.g. 10 AM-1 PM and 3 PM-6 PM).
-- 2. Appointment slot duration and session turnaround buffer time.
-- 3. Blocked dates and holiday calendars with reason annotations.
-- 4. Authoritative consultation pricing (30m, 60m) in INR.
-- 5. Safe backward compatibility with existing preferred_time and pricing columns.

-- Step 1: Add availability_settings JSONB column if not already present
ALTER TABLE public.consultants
ADD COLUMN IF NOT EXISTS availability_settings JSONB DEFAULT NULL;

COMMENT ON COLUMN public.consultants.availability_settings IS
'Structured JSON configuration for consultant availability: weekly schedule, multiple time windows, session buffer minutes, blocked dates, and pricing.';

-- Step 2: Ensure index on consultant pricing and active status for fast catalog filtering
CREATE INDEX IF NOT EXISTS idx_consultants_pricing_active
ON public.consultants (is_active, pricing_30, pricing_60);

-- Step 3: Ensure RLS policies allow authorized Admins (Super Admin, Developer Admin)
-- and consultants managing their own profile to update availability settings and pricing.
DO $$
BEGIN
  -- Verify consultants table has RLS enabled
  ALTER TABLE public.consultants ENABLE ROW LEVEL SECURITY;

  -- Ensure public can read active consultants' availability
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'consultants' AND policyname = 'Public read active consultants availability'
  ) THEN
    CREATE POLICY "Public read active consultants availability"
    ON public.consultants FOR SELECT
    USING (
      is_active = true 
      OR EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role IN ('admin', 'super_admin', 'developer_admin')
      )
      OR user_id = auth.uid()
    );
  END IF;

  -- Ensure Admins and Consultants (for their own record) can update availability & pricing
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'consultants' AND policyname = 'Admins and consultants update availability and pricing'
  ) THEN
    CREATE POLICY "Admins and consultants update availability and pricing"
    ON public.consultants FOR UPDATE
    USING (
      EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role IN ('admin', 'super_admin', 'developer_admin')
      )
      OR user_id = auth.uid()
    );
  END IF;
END $$;
