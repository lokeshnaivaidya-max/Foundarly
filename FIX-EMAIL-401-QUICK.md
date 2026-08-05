# Quick Fix for Email 401 Error

## The Problem
The Edge Function is returning 401 because it's using `SUPABASE_ANON_KEY` which has limited permissions.

## The Solution (Choose ONE)

### Option 1: Update Edge Function in Supabase Dashboard (EASIEST)

1. Go to: https://supabase.com/dashboard/project/tzihsuzxwziirpkvxysr/functions
2. Click on `send-booking-email` function
3. Click **"Edit function"** or open the code editor
4. Find this line (around line 363):
   ```typescript
   const supabaseClient = createClient(
     Deno.env.get("SUPABASE_URL") ?? "",
     Deno.env.get("SUPABASE_ANON_KEY") ?? ""
   );
   ```

5. Replace it with:
   ```typescript
   const supabaseClient = createClient(
     Deno.env.get("SUPABASE_URL") ?? "",
     Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
     {
       auth: {
         autoRefreshToken: false,
         persistSession: false
       }
     }
   );
   ```

6. Click **"Deploy"** or **"Save"**

### Option 2: Disable JWT Verification

1. Go to: https://supabase.com/dashboard/project/tzihsuzxwziirpkvxysr/functions
2. Click on `send-booking-email` function
3. Look for **Settings** or **Configuration**
4. Find **"Verify JWT"** toggle
5. Turn it **OFF**
6. Save changes

### Option 3: Run SQL (If Options 1 & 2 Don't Work)

Go to SQL Editor and run:

```sql
GRANT SELECT ON bookings TO service_role;
GRANT SELECT ON consultants TO service_role;
```

## Test After Fix

1. Go to Admin Bookings page
2. Find a confirmed booking with meeting room
3. Click the green mail icon
4. Should see "Confirmation emails sent successfully!"

## Files Created

- `database/edge-function-permissions.sql` - SQL to grant permissions
- `supabase/functions/send-booking-email/index-updated.ts` - Updated function code (simplified HTML)
- `EMAIL-FUNCTION-FIX.md` - Detailed troubleshooting guide

## Why This Happens

- `SUPABASE_ANON_KEY` = Limited permissions (for client-side code)
- `SUPABASE_SERVICE_ROLE_KEY` = Full permissions (for server-side code)
- Edge Functions need SERVICE_ROLE_KEY to bypass Row Level Security (RLS)
