# Fix Email 500 Error - Checklist

The 500 error means the Edge Function is crashing. Here's what to check:

## Step 1: Check Edge Function Logs

1. Go to: https://supabase.com/dashboard/project/tzihsuzxwziirpkvxysr/functions/send-booking-email
2. Click on **"Logs"** tab
3. Look for the actual error message
4. Common errors:
   - "RESEND_API_KEY is not defined"
   - "Booking not found"
   - "Failed to send email"

## Step 2: Add RESEND_API_KEY Secret

The Edge Function needs the Resend API key as a secret:

1. Go to: https://supabase.com/dashboard/project/tzihsuzxwziirpkvxysr/settings/functions
2. Scroll to **"Secrets"** section
3. Click **"Add new secret"**
4. Name: `RESEND_API_KEY`
5. Value: `re_gcnxwuHK_26dbVGZiLWyVoFkKdBeU5W9q`
6. Click **"Save"**
7. **Redeploy the function** (secrets only apply after redeployment)

## Step 3: Add SITE_URL Secret (Optional)

1. In the same Secrets section
2. Add another secret:
   - Name: `SITE_URL`
   - Value: `https://your-domain.com` (or `http://localhost:5173` for testing)
3. Save and redeploy

## Step 4: Verify Edge Function Code

Make sure your Edge Function has this change (line ~363):

**BEFORE (Wrong):**
```typescript
const supabaseClient = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_ANON_KEY") ?? ""
);
```

**AFTER (Correct):**
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

## Step 5: Test Again

1. Refresh your admin page
2. Click the mail icon on a confirmed booking
3. Check browser console for the actual error message
4. The toast will now show the real error from the Edge Function

## Common Issues & Solutions

### "RESEND_API_KEY is not defined"
- Add the secret in Supabase dashboard (Step 2)
- Redeploy the function after adding secrets

### "Booking not found"
- Make sure the booking has a `meeting_room_id`
- Check that the booking exists in the database
- Verify the consultant is linked properly

### "Failed to send email: 403"
- Resend API key is invalid
- Verify the key: `re_gcnxwuHK_26dbVGZiLWyVoFkKdBeU5W9q`
- Check Resend dashboard for API limits

### "Cannot read property 'name' of null"
- The consultant data is missing
- Check that the booking has a valid `consultant_id`
- Verify the consultant exists in the `consultants` table

## Quick Debug

Add this to your Edge Function to see what's happening:

```typescript
console.log("Booking ID:", bookingId);
console.log("Booking data:", booking);
console.log("Consultant email:", consultantEmail);
console.log("RESEND_API_KEY exists:", !!RESEND_API_KEY);
```

Then check the logs in Supabase dashboard.

## Alternative: Manual Email Testing

If you want to test without fixing the Edge Function:

1. Copy the meeting link manually
2. Send it via your own email
3. The system works fine without automated emails
4. Admin can always share links manually

## Files Updated

- `src/services/email.ts` - Now shows actual error messages
- `src/pages/admin/AdminBookings.tsx` - Displays error in toast
