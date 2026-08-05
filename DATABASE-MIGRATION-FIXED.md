# Database Migration - All Issues Fixed ✅

## Issues Found and Fixed

### Issue 1: Column "user_id" does not exist
**Error**: `ERROR: 42703: column "user_id" does not exist`

**Cause**: The `consultants` table didn't have a `user_id` column to link consultants to user accounts.

**Fix**: Added this to the beginning of the migration:
```sql
ALTER TABLE consultants 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
```

### Issue 2: Relation "reviews" does not exist
**Error**: `ERROR: 42P01: relation "reviews" does not exist`

**Cause**: The SQL referenced a `reviews` table that doesn't exist. The system uses `testimonials` instead.

**Fix**: Changed all references from `reviews` to `testimonials`:
```sql
-- Before:
LEFT JOIN reviews r ON b.id = r.booking_id

-- After:
LEFT JOIN testimonials t ON b.id = t.booking_id AND t.status = 'published'
```

## Files Updated

### 1. `database/consultant-earnings-system.sql`
- ✅ Added `user_id` column to consultants
- ✅ Changed `reviews` to `testimonials`
- ✅ Fixed status check ('approved' → 'published')
- ✅ Added comprehensive comments

### 2. New Files Created
- `database/verify-schema.sql` - Pre-migration verification script
- `database/link-consultant-to-user.sql` - Helper for linking consultants
- `CONSULTANT-TROUBLESHOOTING.md` - Complete troubleshooting guide
- `DATABASE-MIGRATION-FIXED.md` - This file

### 3. Updated Documentation
- `CONSULTANT-SETUP-QUICK.md` - Updated setup steps
- `CONSULTANT-SYSTEM-COMPLETE.md` - Updated with fixes

## Correct Migration Order

### Step 1: Verify Schema (Optional)
```sql
-- Run in Supabase SQL Editor
-- Paste contents of: database/verify-schema.sql
```

This checks if all required tables exist.

### Step 2: Run Migration
```sql
-- Run in Supabase SQL Editor
-- Paste contents of: database/consultant-earnings-system.sql
```

This should now run without errors!

### Step 3: Link Consultant to User
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

### Step 4: Verify
```sql
-- Check if you're linked
SELECT c.id, c.name, c.user_id
FROM consultants c
WHERE c.user_id = auth.uid();
```

### Step 5: Test
1. Navigate to `/consultant-dashboard`
2. You should see your dashboard!

## What the Migration Does

### Tables Created
1. **payout_requests** - Consultant withdrawal requests
2. **consultant_earnings** - Earnings history per booking

### Columns Added to consultants
1. **user_id** - Links to auth.users for login
2. **email_notifications** - Email preference
3. **notification_preferences** - Detailed settings

### Columns Added to bookings
1. **consultant_earnings** - Amount consultant earns (85%)
2. **platform_fee** - Platform commission (15%)
3. **payout_status** - pending/requested/processing/paid
4. **reschedule_requested_by** - Who requested reschedule
5. **reschedule_requested_at** - When requested
6. **reschedule_reason** - Why reschedule
7. **reschedule_status** - none/requested/approved/rejected
8. **original_date** - Original booking date
9. **original_time** - Original booking time
10. **reschedule_count** - Number of reschedules

### Views Created
1. **consultant_dashboard_stats** - Aggregated dashboard metrics

### Functions Created
1. **calculate_consultant_earnings()** - Auto-calculates on booking completion

### RLS Policies Created
- Consultants can view their own data
- Admins can view all data
- Proper access control for payouts and earnings

## Database Schema Dependencies

The migration requires these tables to exist:
- ✅ `consultants` (from supabase-setup.sql)
- ✅ `bookings` (from supabase-setup.sql)
- ✅ `testimonials` (from supabase-setup.sql) - for ratings
- ✅ `profiles` (from supabase-setup.sql) - for admin checks
- ✅ `auth.users` (Supabase built-in) - for user linking

## Testing the Migration

### Quick Test
```sql
-- 1. Check tables created
SELECT table_name FROM information_schema.tables 
WHERE table_name IN ('payout_requests', 'consultant_earnings')
AND table_schema = 'public';

-- 2. Check columns added
SELECT column_name FROM information_schema.columns
WHERE table_name = 'consultants' AND column_name = 'user_id';

SELECT column_name FROM information_schema.columns
WHERE table_name = 'bookings' AND column_name = 'consultant_earnings';

-- 3. Check view created
SELECT table_name FROM information_schema.views
WHERE table_name = 'consultant_dashboard_stats';

-- 4. Check function created
SELECT routine_name FROM information_schema.routines
WHERE routine_name = 'calculate_consultant_earnings';
```

### Expected Results
All queries should return results. If any return empty, the migration didn't complete.

## Common Issues After Migration

### "Not a Consultant" Error
**Solution**: Link your user to a consultant
```sql
UPDATE consultants SET user_id = auth.uid() WHERE name = 'Your Name';
```

### Dashboard Shows No Data
**Solution**: Create test booking
```sql
-- See CONSULTANT-TROUBLESHOOTING.md for complete test data script
```

### Earnings Not Calculating
**Solution**: Mark booking as completed
```sql
UPDATE bookings SET status = 'completed' WHERE id = 'booking-id';
```

## Rollback (If Needed)

If something goes wrong, you can rollback:

```sql
-- Drop created objects
DROP VIEW IF EXISTS consultant_dashboard_stats CASCADE;
DROP FUNCTION IF EXISTS calculate_consultant_earnings() CASCADE;
DROP TABLE IF EXISTS consultant_earnings CASCADE;
DROP TABLE IF EXISTS payout_requests CASCADE;

-- Remove added columns from bookings
ALTER TABLE bookings 
DROP COLUMN IF EXISTS consultant_earnings,
DROP COLUMN IF EXISTS platform_fee,
DROP COLUMN IF EXISTS payout_status,
DROP COLUMN IF EXISTS reschedule_requested_by,
DROP COLUMN IF EXISTS reschedule_requested_at,
DROP COLUMN IF EXISTS reschedule_reason,
DROP COLUMN IF EXISTS reschedule_status,
DROP COLUMN IF EXISTS original_date,
DROP COLUMN IF EXISTS original_time,
DROP COLUMN IF EXISTS reschedule_count;

-- Remove added columns from consultants
ALTER TABLE consultants
DROP COLUMN IF EXISTS user_id,
DROP COLUMN IF EXISTS email_notifications,
DROP COLUMN IF EXISTS notification_preferences;
```

## Support

If you still encounter issues:

1. **Check Supabase Logs**: Look for detailed error messages
2. **Run Verification**: Use `database/verify-schema.sql`
3. **Check Documentation**: See `CONSULTANT-TROUBLESHOOTING.md`
4. **Test Queries**: Run the testing queries above

## Success Indicators

You'll know the migration succeeded when:
- ✅ No errors in Supabase SQL Editor
- ✅ All tables and columns exist
- ✅ View returns data
- ✅ Function exists
- ✅ RLS policies active
- ✅ Dashboard loads at `/consultant-dashboard`

---

**Status**: All issues fixed, migration ready to run!
**Last Updated**: After fixing reviews → testimonials issue
