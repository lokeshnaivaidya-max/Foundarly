-- Enable Edge Functions to access bookings and consultants tables
-- This allows the send-booking-email function to read booking data

-- Grant service role access to bookings table
GRANT SELECT ON bookings TO service_role;
GRANT SELECT ON consultants TO service_role;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Allow service role to read all bookings" ON bookings;
DROP POLICY IF EXISTS "Allow service role to read all consultants" ON consultants;

-- Create policies to allow service role to read all data
-- (Edge functions run with service_role, so this bypasses RLS)
CREATE POLICY "Allow service role to read all bookings"
ON bookings
FOR SELECT
TO service_role
USING (true);

CREATE POLICY "Allow service role to read all consultants"
ON consultants
FOR SELECT
TO service_role
USING (true);
