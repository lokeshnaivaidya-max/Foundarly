# Fix Email Function 401 Error

The 401 error occurs because the Edge Function requires proper JWT verification. Here are two solutions:

## Solution 1: Disable JWT Verification (Recommended for Testing)

Since you deployed via Supabase Dashboard, you need to update the function settings:

### Steps in Supabase Dashboard:

1. Go to your Supabase project: https://supabase.com/dashboard/project/tzihsuzxwziirpkvxysr
2. Click on **Edge Functions** in the left sidebar
3. Find the `send-booking-email` function
4. Click on the function name to open settings
5. Look for **"Verify JWT"** toggle or setting
6. **Disable JWT verification** (turn it OFF)
7. Save the changes

This allows the function to be called without strict authentication checks.

## Solution 2: Run SQL to Grant Permissions

Run this SQL in your Supabase SQL Editor:

```sql
-- Enable Edge Functions to access bookings and consultants tables
GRANT SELECT ON bookings TO service_role;
GRANT SELECT ON consultants TO service_role;

-- Create policies for service role access
CREATE POLICY IF NOT EXISTS "Allow service role to read all bookings"
ON bookings
FOR SELECT
TO service_role
USING (true);

CREATE POLICY IF NOT EXISTS "Allow service role to read all consultants"
ON consultants
FOR SELECT
TO service_role
USING (true);
```

## Solution 3: Add Authorization Header to Edge Function

If you want to keep JWT verification enabled, update the Edge Function code to verify the JWT token:

Add this at the beginning of the `serve()` function (after CORS check):

```typescript
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    // Verify the JWT token
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    // Rest of your code...
    const { bookingId } = await req.json();
    // ... continue with existing logic
```

## Quick Test

After applying Solution 1 or 2, test the email function by:

1. Go to Admin Bookings page
2. Find a confirmed booking with a meeting room
3. Click the green mail icon to send emails
4. Check browser console for success message

## Troubleshooting

If still getting 401:
- Check that you're logged in as admin
- Clear browser cache and reload
- Check Supabase Edge Function logs for detailed error messages
- Verify the RESEND_API_KEY is set as a secret in Supabase Edge Functions settings

## File Created

The SQL file has been created at: `database/edge-function-permissions.sql`
Run it in your Supabase SQL Editor.
