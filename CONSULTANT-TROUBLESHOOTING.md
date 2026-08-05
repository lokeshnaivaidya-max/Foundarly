# Consultant System Troubleshooting

## Database Migration Errors

### Error: "column user_id does not exist"

**Cause**: The `consultants` table doesn't have a `user_id` column yet.

**Solution**: Run the migration again. The updated SQL now adds this column:
```sql
-- This is now included in consultant-earnings-system.sql
ALTER TABLE consultants 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
```

### Error: "relation consultant_dashboard_stats already exists"

**Cause**: You're running the migration twice.

**Solution**: Drop the view first:
```sql
DROP VIEW IF EXISTS consultant_dashboard_stats CASCADE;
```
Then run the migration again.

## Dashboard Access Issues

### "Not a Consultant" Error

**Cause**: Your user account is not linked to a consultant record.

**Check if you're linked:**
```sql
SELECT c.* 
FROM consultants c 
WHERE c.user_id = auth.uid();
```

**If no results:**

**Option 1: Link to existing consultant**
```sql
-- Find consultants
SELECT id, name FROM consultants;

-- Link yourself to one
UPDATE consultants 
SET user_id = auth.uid() 
WHERE id = 'consultant-id-from-above';
```

**Option 2: Create new consultant for yourself**
```sql
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
  'Your Name',
  'Your Title',
  'Your bio here',
  ARRAY['Expertise1', 'Expertise2'],
  1000,  -- 30 min price
  1800,  -- 60 min price
  auth.uid(),
  true
);
```

### Dashboard Shows No Data

**Cause**: No bookings linked to your consultant ID.

**Check bookings:**
```sql
SELECT b.* 
FROM bookings b
JOIN consultants c ON b.consultant_id = c.id
WHERE c.user_id = auth.uid();
```

**Create test booking:**
```sql
-- First, get your consultant ID
SELECT id FROM consultants WHERE user_id = auth.uid();

-- Then create a test booking
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
  'your-consultant-id-here',
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
```

## Earnings Issues

### No Earnings Showing

**Cause**: Bookings must be "completed" status for earnings to calculate.

**Check booking status:**
```sql
SELECT id, status, consultant_earnings 
FROM bookings 
WHERE consultant_id IN (
  SELECT id FROM consultants WHERE user_id = auth.uid()
);
```

**Mark booking as completed (for testing):**
```sql
UPDATE bookings 
SET status = 'completed'
WHERE id = 'booking-id-here';
```

**Manually trigger earnings calculation:**
```sql
-- The trigger should run automatically, but you can check:
SELECT * FROM consultant_earnings 
WHERE consultant_id IN (
  SELECT id FROM consultants WHERE user_id = auth.uid()
);
```

### Earnings Calculation Wrong

**Check the calculation:**
```sql
SELECT 
  b.id,
  b.session_price as total,
  b.platform_fee as fee,
  b.consultant_earnings as earnings,
  (b.session_price * 0.15) as expected_fee,
  (b.session_price * 0.85) as expected_earnings
FROM bookings b
WHERE b.status = 'completed'
AND b.consultant_id IN (
  SELECT id FROM consultants WHERE user_id = auth.uid()
);
```

**Expected**: 
- Platform fee = 15% of total
- Consultant earnings = 85% of total

## Payout Request Issues

### "Insufficient pending earnings"

**Cause**: Requested amount exceeds available pending earnings.

**Check pending earnings:**
```sql
SELECT 
  SUM(consultant_earnings) as pending
FROM bookings
WHERE status = 'completed'
AND payout_status = 'pending'
AND consultant_id IN (
  SELECT id FROM consultants WHERE user_id = auth.uid()
);
```

**Solution**: Request amount ≤ pending earnings.

### Payout Request Not Saving

**Check RLS policies:**
```sql
-- Verify you can insert
SELECT * FROM payout_requests 
WHERE consultant_id IN (
  SELECT id FROM consultants WHERE user_id = auth.uid()
);
```

**Test insert:**
```sql
INSERT INTO payout_requests (
  consultant_id,
  amount,
  payment_method,
  payment_details,
  status
) VALUES (
  (SELECT id FROM consultants WHERE user_id = auth.uid()),
  100,
  'bank_transfer',
  '{"accountName": "Test", "accountNumber": "123"}'::jsonb,
  'pending'
);
```

## Reschedule Issues

### Reschedule Button Not Showing

**Cause**: Booking must be "confirmed" and upcoming.

**Check booking:**
```sql
SELECT 
  id,
  status,
  date,
  time,
  reschedule_status
FROM bookings
WHERE id = 'booking-id-here';
```

**Requirements**:
- status = 'confirmed'
- date >= today
- reschedule_status = 'none' OR 'rejected'

### Reschedule Request Not Saving

**Check fields exist:**
```sql
SELECT 
  column_name 
FROM information_schema.columns 
WHERE table_name = 'bookings' 
AND column_name LIKE 'reschedule%';
```

**Should see**:
- reschedule_requested_by
- reschedule_requested_at
- reschedule_reason
- reschedule_status
- original_date
- original_time
- reschedule_count

**If missing, run migration again.**

## Permission Issues

### "permission denied for table"

**Cause**: RLS policies not set up correctly.

**Check RLS is enabled:**
```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('payout_requests', 'consultant_earnings', 'bookings');
```

**Check your role:**
```sql
SELECT 
  p.role,
  u.email
FROM profiles p
JOIN auth.users u ON p.id = u.id
WHERE p.id = auth.uid();
```

**Temporarily disable RLS (testing only):**
```sql
ALTER TABLE payout_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE consultant_earnings DISABLE ROW LEVEL SECURITY;
-- Remember to re-enable after testing!
```

## Data Verification

### Check Complete Setup

Run this comprehensive check:

```sql
-- 1. Check if you're a consultant
SELECT 'Consultant Check' as test, 
  CASE WHEN EXISTS (
    SELECT 1 FROM consultants WHERE user_id = auth.uid()
  ) THEN '✅ You are a consultant' 
  ELSE '❌ Not linked to consultant' END as result;

-- 2. Check bookings
SELECT 'Bookings Check' as test,
  COUNT(*)::text || ' bookings found' as result
FROM bookings b
JOIN consultants c ON b.consultant_id = c.id
WHERE c.user_id = auth.uid();

-- 3. Check earnings
SELECT 'Earnings Check' as test,
  COALESCE(SUM(consultant_earnings), 0)::text || ' total earnings' as result
FROM bookings b
JOIN consultants c ON b.consultant_id = c.id
WHERE c.user_id = auth.uid()
AND b.status = 'completed';

-- 4. Check payout requests
SELECT 'Payout Requests Check' as test,
  COUNT(*)::text || ' payout requests' as result
FROM payout_requests pr
JOIN consultants c ON pr.consultant_id = c.id
WHERE c.user_id = auth.uid();

-- 5. Check dashboard view
SELECT 'Dashboard View Check' as test,
  CASE WHEN EXISTS (
    SELECT 1 FROM consultant_dashboard_stats WHERE user_id = auth.uid()
  ) THEN '✅ Dashboard data available'
  ELSE '❌ No dashboard data' END as result;
```

## Quick Fixes

### Reset Everything (Testing Only)

```sql
-- WARNING: This deletes all data!

-- Delete payout requests
DELETE FROM payout_requests 
WHERE consultant_id IN (
  SELECT id FROM consultants WHERE user_id = auth.uid()
);

-- Delete earnings
DELETE FROM consultant_earnings
WHERE consultant_id IN (
  SELECT id FROM consultants WHERE user_id = auth.uid()
);

-- Reset bookings
UPDATE bookings 
SET 
  consultant_earnings = 0,
  platform_fee = 0,
  payout_status = 'pending',
  reschedule_status = 'none'
WHERE consultant_id IN (
  SELECT id FROM consultants WHERE user_id = auth.uid()
);
```

### Create Complete Test Data

```sql
-- 1. Ensure you're a consultant
INSERT INTO consultants (name, title, bio, expertise, pricing_30, pricing_60, user_id, is_active)
VALUES ('Test Consultant', 'Test', 'Testing', ARRAY['Test'], 1000, 1800, auth.uid(), true)
ON CONFLICT (user_id) DO NOTHING;

-- 2. Create test booking
INSERT INTO bookings (
  user_id, consultant_id, name, email, date, time,
  status, payment_status, session_duration, session_price, meeting_room_id
)
SELECT 
  auth.uid(),
  c.id,
  'Test User',
  'test@example.com',
  CURRENT_DATE + 1,
  '10:00',
  'completed',
  'paid',
  60,
  1800,
  'foundarly-test-' || gen_random_uuid()
FROM consultants c
WHERE c.user_id = auth.uid();

-- 3. Verify
SELECT * FROM consultant_dashboard_stats WHERE user_id = auth.uid();
```

## Still Having Issues?

1. **Check browser console** for JavaScript errors
2. **Check Supabase logs** for database errors
3. **Verify environment variables** in `.env`
4. **Clear browser cache** and reload
5. **Try incognito mode** to rule out extensions
6. **Check network tab** for failed API calls

## Getting Help

When reporting issues, include:
- Error message (exact text)
- SQL query that failed (if applicable)
- Browser console logs
- Steps to reproduce
- Your user role (admin/consultant/user)

---

**Most Common Issue**: Not linking consultant to user account. Always run the linking step!
