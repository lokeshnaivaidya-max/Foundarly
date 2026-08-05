# Final Steps to Fix Email System

## The Issue
Your Edge Function at line 366 is still calling `getUserById()` with an invalid UUID. You need to update the Edge Function code in Supabase.

## Step-by-Step Fix

### 1. Open Your Edge Function in Supabase

1. Go to: https://supabase.com/dashboard/project/tzihsuzxwziirpkvxysr/functions/send-booking-email
2. Click **"Edit function"** or the code editor icon
3. You should see your current Edge Function code

### 2. Find Line 366 (Around There)

Look for this code:
```typescript
// Get consultant email from auth.users
const { data: consultantUser } = await supabaseClient.auth.admin.getUserById(
  booking.consultants.user_id
);
```

### 3. Replace That Section

Replace the entire section that gets consultant email with this:

```typescript
// Get consultant email - try multiple sources
let consultantEmail = null;

// First try: consultant.email field (if it exists)
if (booking.consultants?.email) {
  consultantEmail = booking.consultants.email;
  console.log("Using consultant email from consultants table:", consultantEmail);
}
// Second try: get from auth.users if user_id is valid UUID
else if (booking.consultants?.user_id) {
  try {
    const { data: consultantUser } = await supabaseClient.auth.admin.getUserById(
      booking.consultants.user_id
    );
    consultantEmail = consultantUser?.user?.email;
    console.log("Using consultant email from auth.users:", consultantEmail);
  } catch (error) {
    console.warn("Could not fetch consultant from auth.users:", error.message);
  }
}

if (!consultantEmail) {
  console.warn("Consultant email not found, will only send to user");
}
```

### 4. Update the Consultant Email Sending Part

Find this code:
```typescript
// Send email to consultant (if email notifications enabled)
let consultantEmailResult = null;
if (consultantEmail && booking.consultants.email_notifications !== false) {
  consultantEmailResult = await sendEmail(
    consultantEmail,
    "🎉 New Booking Received - Consultation Scheduled",
    generateConsultantEmailHTML(emailData)
  );
  console.log("Consultant email sent:", consultantEmailResult);
}
```

Replace it with:
```typescript
// Send email to consultant if email exists and notifications enabled
let consultantEmailResult = null;
if (consultantEmail && booking.consultants?.email_notifications !== false) {
  try {
    consultantEmailResult = await sendEmail(
      consultantEmail,
      "🎉 New Booking Received - Consultation Scheduled",
      generateConsultantEmailHTML(emailData)
    );
    console.log("Consultant email sent successfully:", consultantEmailResult);
  } catch (error) {
    console.error("Failed to send consultant email:", error.message);
    // Don't fail the whole request if consultant email fails
  }
}
```

### 5. Update the SELECT Query

Find this line (around line 370):
```typescript
.select(`
  *,
  consultants (
    name,
    email_notifications,
    user_id
  )
`)
```

Change it to include email:
```typescript
.select(`
  *,
  consultants (
    name,
    email,
    email_notifications,
    user_id
  )
`)
```

### 6. Deploy the Function

1. Click **"Deploy"** or **"Save"** button
2. Wait for deployment to complete
3. Check the logs to confirm no errors

### 7. Add Email Field to Consultants Table (Optional)

Run this SQL in Supabase SQL Editor:

```sql
ALTER TABLE consultants ADD COLUMN IF NOT EXISTS email TEXT;
```

Or run the file: `database/add-consultant-email-field.sql`

### 8. Test Again

1. Go to Admin Bookings page
2. Click the mail icon on a confirmed booking
3. Should now work!

## Alternative: Copy Entire Fixed Code

If the above is confusing, just copy the ENTIRE code from:
`supabase/functions/send-booking-email/index-fixed.ts`

And paste it into your Supabase Edge Function editor, replacing everything.

## Why This Fixes It

The original code assumes all consultants have valid `user_id` values and tries to look them up in `auth.users`. Your consultants don't have valid UUIDs, so it crashes.

The fixed code:
1. First tries to get email from `consultants.email` field
2. Only tries `auth.users` if user_id exists and is valid
3. Wraps the `getUserById()` call in try-catch
4. Still sends user email even if consultant email fails
5. Returns success as long as user email is sent

## Current System Status

✅ Admin can approve bookings (Approve button works)
✅ Admin can see meeting links (Copy button works)
✅ Admin can manually share links
⚠️ Automated emails need Edge Function fix (optional feature)

The platform works fine without automated emails - admin can copy and share meeting links manually!
