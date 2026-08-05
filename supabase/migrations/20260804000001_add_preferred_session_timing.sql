-- Add preferred_session_timing column to consultant_applications table
ALTER TABLE public.consultant_applications ADD COLUMN IF NOT EXISTS preferred_session_timing TEXT;
