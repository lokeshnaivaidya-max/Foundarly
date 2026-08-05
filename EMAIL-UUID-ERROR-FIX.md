# Fix UUID Error in Email Function

## The Problem

Error: `Expected parameter to be UUID but is not`

This happens because `booking.consultants.user_id` is NULL or not a valid UUID, and the Edge Function tries to look up the consultant's email from `auth.users`.

## Solution 1: Update Edge Function (RECOMMENDED)

Copy the code from `supabase/functions/send-booking-email/index-fixed.ts` to your Supabase Edge Function.

**Key changes:**
1. Tries to get email from `consultants.email` field first
2. Falls back to `auth.users` only if user_id is valid
3. Gracefully handles missing consultant email
4. Still sends email to user even if consultant email fails

## Solution 2: Add Email Field to Consultants Table

Run this SQL in Supabase SQL Editor:

```sql
-- Add email column to consultants table
ALTER TABLE consultants ADD COLUMN IF NOT EXISTS email TEXT;

-- Update existing consultants with email from auth.users
UPDATE consultants c
SET email = u.email
FROM auth.users u
WHERE c.user_id = u.id
  AND c.email IS NULL
  AND u.email IS NOT NULL;
```

Or run the file: `database/add-consultant-email-field.sql`

## Solution 3: Fix Consultant Data

If your consultants don't have valid `user_id`, you need to either:

### Option A: Link consultants to auth.users
```sql
-- Find consultants without user_id
SELECT id, name, email FROM consultants WHERE user_id IS NULL;

-- Manually link them (replace values)
UPDATE consultants 
SET user_id = 'actual-uuid-from-auth-users'
WHERE id = 'consultant-id';
```

### Option B: Add email directly to consultants
```sql
-- Add email to specific consultant
UPDATE consultants 
SET email = 'consultant@example.com'
WHERE id = 'consultant-id';
```

## Quick Test

After applying the fix:

1. Make sure your Edge Function uses the fixed code
2. Redeploy the function
3. Go to Admin Bookings
4. Click mail icon on a confirmed booking
5. Should see success message (even if consultant email is missing)

## What the Fixed Version Does

1. **Always sends email to user** (booking.email)
2. **Tries to send to consultant** if email is available:
   - First checks `consultants.email` field
   - Falls back to `auth.users` if user_id is valid UUID
   - Skips consultant email if neither is available
3. **Returns success** as long as user email is sent
4. **Logs warnings** instead of crashing when consultant email is missing

## Files Created

- `supabase/functions/send-booking-email/index-fixed.ts` - Fixed Edge Function code
- `database/add-consultant-email-field.sql` - SQL to add email field
- This guide: `EMAIL-UUID-ERROR-FIX.md`

## Verification

After fixing, check the Edge Function logs. You should see:

```
User email sent successfully: { id: "..." }
Using consultant email from consultants table: consultant@example.com
Consultant email sent successfully: { id: "..." }
```

Or if consultant email is missing:

```
User email sent successfully: { id: "..." }
Consultant email not found, will only send to user
Email sent to user only (consultant email not available)
```

Both are success cases!
