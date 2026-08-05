# Create New Edge Function - Complete Guide

## Step 1: Create New Edge Function

1. Go to: https://supabase.com/dashboard/project/tzihsuzxwziirpkvxysr/functions
2. Click **"Create a new function"** button
3. Enter function details:
   - **Name**: `send-booking-email`
   - Click **"Create function"**

## Step 2: Paste the Code

1. The code editor will open
2. **DELETE** any template code
3. Open the file `EDGE-FUNCTION-FINAL.ts` in your project
4. **Copy ALL the code** (Ctrl+A, Ctrl+C)
5. **Paste** into the Supabase editor
6. Click **"Deploy"**

## Step 3: Configure Settings

### JWT Verification
- **Turn OFF** "Verify JWT with legacy secret"
- This allows the function to be called from your admin panel

### Add Secrets

1. Go to: https://supabase.com/dashboard/project/tzihsuzxwziirpkvxysr/settings/functions
2. Scroll to **"Secrets"** section
3. Click **"Add new secret"**

**Secret 1:**
- Name: `RESEND_API_KEY`
- Value: `re_gcnxwuHK_26dbVGZiLWyVoFkKdBeU5W9q`
- Click **"Save"**

**Secret 2 (Optional):**
- Name: `SITE_URL`
- Value: `http://localhost:5173` (or your production URL)
- Click **"Save"**

4. After adding secrets, **redeploy the function**:
   - Go back to the function
   - Click **"Deploy"** again (secrets only work after redeployment)

## Step 4: Test the Function

1. Go to your admin panel: http://localhost:5173/admin/bookings
2. Find a confirmed booking with a meeting room
3. Click the green **mail icon**
4. Should see: "Confirmation emails sent successfully!"

## Quick Reference

**Function Name:** `send-booking-email`

**Secrets to Add:**
```
RESEND_API_KEY = re_gcnxwuHK_26dbVGZiLWyVoFkKdBeU5W9q
SITE_URL = http://localhost:5173
```

**JWT Verification:** OFF (disabled)

**Code File:** `EDGE-FUNCTION-FINAL.ts`

## Troubleshooting

### If you get 401 error:
- Make sure "Verify JWT" is turned OFF

### If you get 500 error:
- Check that RESEND_API_KEY secret is added
- Check Edge Function logs for details
- Make sure you redeployed after adding secrets

### If email doesn't send:
- Check the booking has a valid email address
- Check the booking has a meeting_room_id
- Check Resend API key is correct
- View Edge Function logs for error details

## What the Function Does

1. Receives booking ID from admin panel
2. Fetches booking details from database
3. Generates meeting link
4. Sends beautiful HTML email to user with:
   - Booking confirmation
   - Meeting details (date, time, consultant)
   - Join meeting button
   - Meeting link
5. Returns success message

## Notes

- Only sends email to USER (not consultant)
- Uses SERVICE_ROLE_KEY for database access
- No UUID errors (doesn't look up consultants)
- Simple and reliable
- Beautiful HTML email template included
