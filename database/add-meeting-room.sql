-- Add meeting_room_id to bookings table
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS meeting_room_id TEXT;

-- Generate meeting room IDs for existing confirmed bookings
UPDATE bookings
SET meeting_room_id = 'foundarly-' || id
WHERE meeting_room_id IS NULL AND status IN ('confirmed', 'completed');
