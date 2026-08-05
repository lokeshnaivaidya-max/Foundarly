-- Add consultant_id and booking_id to testimonials for proper linkage
ALTER TABLE testimonials ADD COLUMN IF NOT EXISTS consultant_id UUID REFERENCES consultants(id) ON DELETE SET NULL;
ALTER TABLE testimonials ADD COLUMN IF NOT EXISTS booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL;

-- Unique constraint: one review per booking
ALTER TABLE testimonials DROP CONSTRAINT IF EXISTS testimonials_booking_id_unique;
ALTER TABLE testimonials ADD CONSTRAINT testimonials_booking_id_unique UNIQUE (booking_id);

-- Index for fast consultant lookups
CREATE INDEX IF NOT EXISTS idx_testimonials_consultant_id ON testimonials(consultant_id);
CREATE INDEX IF NOT EXISTS idx_testimonials_status ON testimonials(status);
