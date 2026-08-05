# Next Steps - Migration Successful! ✅

## Migration Complete!

The database migration ran successfully. Now you need to link your user account to a consultant.

## Step 1: Check Existing Consultants

Run this in Supabase SQL Editor:

```sql
-- See all consultants
SELECT id, name, title, user_id 
FROM consultants 
ORDER BY name;
```

## Step 2: Link Yourself to a Consultant

Choose ONE option:

### Option A: Link to Existing Consultant

```sql
-- Replace 'Consultant Name Here' with actual name from Step 1
UPDATE consultants 
SET user_id = auth.uid() 
WHERE name = 'Consultant Name Here';

-- Verify it worked
SELECT id, name, user_id FROM consultants WHERE user_id = auth.uid();
```

### Option B: Create New Test Consultant

```sql
-- Creates a new consultant linked to your account
INSERT INTO consultants (
  name,
  title,
  bio,
  expertise,
  pricing_30,
  pricing_60,
  user_id,
  is_active
) VALUES (
  'Test Consultant',           -- Change this
  'Professional Consultant',   -- Change this
  'Expert consultant for testing the platform',
  ARRAY['Business', 'Strategy', 'Consulting'],
  1000,  -- 30 min price in cents (₹10)
  1800,  -- 60 min price in cents (₹18)
  auth.uid(),
  true
);

-- Verify it worked
SELECT id, name, user_id FROM consultants WHERE user_id = auth.uid();
```

## Step 3: Verify Dashboard Access

```sql
-- This should now return a row with your stats
SELECT * FROM consultant_dashboard_stats WHERE user_id = auth.uid();
```

Expected result:
```
consultant_id: [uuid]
user_id: [your-user-id]
consultant_name: [your-name]
total_bookings: 0
completed_sessions: 0
upcoming_sessions: 0
total_earnings: 0
pending_earnings: 0
paid_earnings: 0
average_rating: null
total_reviews: 0
```

## Step 4: Test the Dashboard

1. Open your browser
2. Navigate to: `http://localhost:8081/consultant-dashboard`
3. You should see your consultant dashboard!

## Step 5 (Optional): Create Test Booking

To see data in your dashboard:

```sql
-- Get your consultant ID
SELECT id FROM consultants WHERE user_id = auth.uid();

-- Create a test booking (replace 'your-consultant-id' with ID from above)
INSERT INTO bookings (
  user_id,
  consultant_id,
  name,
  email,
  date,
  time,
  status,
  payment_status,
  session_duration,
  session_price,
  meeting_room_id
) VALUES (
  auth.uid(),
  'your-consultant-id',  -- Replace this!
  'Test User',
  'test@example.com',
  CURRENT_DATE + INTERVAL '1 day',
  '10:00',
  'confirmed',
  'paid',
  60,
  1800,
  'foundarly-test-' || gen_random_uuid()
);

-- Mark it as completed to see earnings
UPDATE bookings 
SET status = 'completed'
WHERE consultant_id IN (
  SELECT id FROM consultants WHERE user_id = auth.uid()
)
AND status = 'confirmed';

-- Check dashboard again
SELECT * FROM consultant_dashboard_stats WHERE user_id = auth.uid();
```

## Troubleshooting

### "Not a Consultant" Error on Dashboard

**Check if linked:**
```sql
SELECT * FROM consultants WHERE user_id = auth.uid();
```

If no results, go back to Step 2.

### Dashboard Shows But No Data

This is normal if you have no bookings yet. Use Step 5 to create test data.

### Can't Access Dashboard

Make sure you're logged in and the consultant is linked to YOUR user account.

## What You Can Do Now

✅ Access consultant dashboard at `/consultant-dashboard`  
✅ View your earnings and bookings  
✅ Request payouts  
✅ Join meetings  
✅ Request reschedules  
✅ See your statistics  

## Summary

1. ✅ Migration successful
2. ⏳ Link consultant to user (Step 2)
3. ⏳ Test dashboard (Step 4)
4. ⏳ Create test data (Step 5 - optional)

---

**Current Status**: Migration complete, ready to link consultant!
