# Database Migration - Correct Order

## The Issue

The `consultant-earnings-system.sql` tried to join with `testimonials.booking_id` which doesn't exist yet.

## Solution

The migration now works WITHOUT ratings. Ratings will show as NULL until you run the review fields migration.

## Migration Steps

### Step 1: Run Consultant Earnings System
```sql
-- Paste in Supabase SQL Editor:
-- Contents of: database/consultant-earnings-system.sql
```

This will work now! Ratings will be NULL.

### Step 2: Link Consultant to User
```sql
-- Option A: Link existing consultant
UPDATE consultants 
SET user_id = auth.uid() 
WHERE name = 'Your Consultant Name';

-- Option B: Create new consultant
INSERT INTO consultants (
  name, title, bio, expertise, 
  pricing_30, pricing_60, user_id, is_active
) VALUES (
  'Your Name', 'Your Title', 'Your bio',
  ARRAY['Expertise1', 'Expertise2'],
  1000, 1800, auth.uid(), true
);
```

### Step 3: Test Dashboard
Navigate to `/consultant-dashboard` - it should work!

### Step 4 (Optional): Enable Ratings
If you want ratings to work, run:
```sql
-- Paste in Supabase SQL Editor:
-- Contents of: database/add-review-fields.sql
```

Then update the view:
```sql
DROP VIEW IF EXISTS consultant_dashboard_stats;

CREATE OR REPLACE VIEW consultant_dashboard_stats AS
SELECT 
  c.id as consultant_id,
  c.user_id,
  c.name as consultant_name,
  COUNT(DISTINCT b.id) as total_bookings,
  COUNT(DISTINCT CASE WHEN b.status = 'completed' THEN b.id END) as completed_sessions,
  COUNT(DISTINCT CASE WHEN b.status = 'confirmed' THEN b.id END) as upcoming_sessions,
  COALESCE(SUM(CASE WHEN b.status = 'completed' THEN b.consultant_earnings END), 0) as total_earnings,
  COALESCE(SUM(CASE WHEN b.status = 'completed' AND b.payout_status = 'pending' THEN b.consultant_earnings END), 0) as pending_earnings,
  COALESCE(SUM(CASE WHEN b.status = 'completed' AND b.payout_status = 'paid' THEN b.consultant_earnings END), 0) as paid_earnings,
  AVG(CASE WHEN t.rating IS NOT NULL THEN t.rating END) as average_rating,
  COUNT(DISTINCT t.id) as total_reviews
FROM consultants c
LEFT JOIN bookings b ON c.id = b.consultant_id
LEFT JOIN testimonials t ON b.id = t.booking_id AND t.status = 'published'
WHERE c.user_id IS NOT NULL
GROUP BY c.id, c.user_id, c.name;
```

## What Works Now

✅ Consultant dashboard  
✅ Earnings tracking  
✅ Payout requests  
✅ Reschedule functionality  
✅ All bookings features  

⚠️ Ratings will show as "N/A" until Step 4 is completed

## Quick Test

```sql
-- Check if migration worked
SELECT * FROM consultant_dashboard_stats WHERE user_id = auth.uid();

-- Should return a row with:
-- - total_bookings, completed_sessions, etc.
-- - average_rating: NULL
-- - total_reviews: 0
```

## Summary

The system is fully functional without ratings. Ratings are optional and can be added later by running `add-review-fields.sql`.

---

**Status**: Migration fixed, ready to run!
