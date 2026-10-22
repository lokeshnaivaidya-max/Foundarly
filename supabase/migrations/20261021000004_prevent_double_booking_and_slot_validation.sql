-- Migration: 20261021000004_prevent_double_booking_and_slot_validation.sql
-- Description: Enforces database-level double-booking prevention and indexing for consultation time slots in Foundarly.
-- Timezone Context: All booking dates and times are scheduled in India Standard Time (IST: Asia/Kolkata, UTC+05:30).

-- Step 1: Create a composite index to accelerate date-level availability lookups
CREATE INDEX IF NOT EXISTS idx_bookings_consultant_date_lookup
ON public.bookings (consultant_id, date, status, payment_status);

-- Step 2: Create a unique partial index preventing conflicting concurrent or duplicate bookings
-- for the same consultant on the same date and time.
-- Note:
-- - Only active bookings (not 'cancelled' or 'rejected') reserve a time slot.
-- - Legacy records with 'Flexible' or NULL time are excluded so existing data is unaffected.
CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_no_double_booking
ON public.bookings (consultant_id, date, time)
WHERE (
  consultant_id IS NOT NULL
  AND date IS NOT NULL
  AND time IS NOT NULL
  AND time != 'Flexible'
  AND status NOT IN ('cancelled', 'rejected')
  AND (payment_status IS NULL OR payment_status != 'rejected')
);

COMMENT ON INDEX idx_bookings_no_double_booking IS
'Enforces that a consultant cannot have more than one active booking for the same date and time slot in IST.';
