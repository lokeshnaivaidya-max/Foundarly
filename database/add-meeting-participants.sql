-- Add field to track meeting participants
-- This helps determine if meeting was attended and by how many people

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS participants_count INTEGER DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS meeting_started_at TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS meeting_ended_at TIMESTAMPTZ;

COMMENT ON COLUMN bookings.participants_count IS 'Number of participants who joined the meeting';
COMMENT ON COLUMN bookings.meeting_started_at IS 'When the meeting actually started';
COMMENT ON COLUMN bookings.meeting_ended_at IS 'When the meeting actually ended';

-- Show updated schema
SELECT 
    column_name, 
    data_type, 
    column_default,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'bookings' 
AND column_name IN ('participants_count', 'meeting_started_at', 'meeting_ended_at')
ORDER BY ordinal_position;
