# Email Notification System Setup Guide

## Overview
Automated email notification system using Resend API that sends booking confirmation emails to both users and consultants after successful payment.

## Architecture
- **Frontend**: React + TypeScript
- **Backend**: Supabase Edge Functions (Deno)
- **Email Service**: Resend API
- **Trigger**: After Razorpay payment success

## Features Implemented

### ✅ Automated Email Sending
- Sends confirmation email to user
- Sends notification email to consultant
- Triggered automatically after payment success
- Non-blocking (doesn't break booking flow if email fails)

### ✅ Email Content
**User Email:**
- Subject: "✓ Booking Confirmed - Your Consultation is Scheduled"
- Consultant name
- Date & time
- Session duration
- Meeting link with "Join Meeting" button
- Booking ID

**Consultant Email:**
- Subject: "🎉 New Booking Received - Consultation Scheduled"
- Client name & email
- Date & time
- Session duration
- Meeting link with "Join Meeting" button
- Booking ID

### ✅ Professional HTML Templates
- Responsive design
- Branded colors (Foundarly gold/green)
- Clean, modern layout
- Clickable "Join Meeting" button
- Mobile-friendly

## Setup Instructions

### 1. Deploy Supabase Edge Function

```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Login to Supabase
supabase login

# Link your project
supabase link --project-ref tzihsuzxwziirpkvxysr

# Deploy the edge function
supabase functions deploy send-booking-email --no-verify-jwt
```

### 2. Set Environment Variables in Supabase

Go to your Supabase Dashboard → Project Settings → Edge Functions → Secrets

Add these secrets:
```
RESEND_API_KEY=re_gcnxwuHK_26dbVGZiLWyVoFkKdBeU5W9q
SITE_URL=https://yourdomain.com
```

### 3. Update .env File

Already added to `.env`:
```env
RESEND_API_KEY=re_gcnxwuHK_26dbVGZiLWyVoFkKdBeU5W9q
VITE_SITE_URL=http://localhost:5173
```

For production, update `VITE_SITE_URL` to your actual domain.

### 4. Test the System

1. Make a test booking with payment
2. Check console for email sending logs
3. Check your email inbox (user email)
4. Check consultant's email inbox

## Files Created/Modified

### New Files:
- `supabase/functions/send-booking-email/index.ts` - Edge function for sending emails
- `src/services/email.ts` - Client-side email service
- `EMAIL-SYSTEM-SETUP.md` - This documentation

### Modified Files:
- `src/pages/Booking.tsx` - Added email service call after payment
- `.env` - Added Resend API key and site URL

## How It Works

1. **User completes booking** → Razorpay payment initiated
2. **Payment succeeds** → Booking updated to "confirmed"
3. **Meeting ID generated** → Format: `foundarly-{bookingId}`
4. **Email service called** → Invokes Supabase Edge Function
5. **Edge function**:
   - Fetches booking details from database
   - Gets consultant email from auth.users
   - Generates meeting link
   - Sends email to user via Resend API
   - Sends email to consultant via Resend API
6. **Emails delivered** → Both parties receive confirmation

## Meeting Link Format

```
https://yourdomain.com/meeting/foundarly-{bookingId}
```

Example:
```
https://foundarly.com/meeting/foundarly-a7b66267-da90-4ced-b73f-0058aa7a2d30
```

## Error Handling

- Email failures are logged but don't break the booking flow
- If consultant email is not found, only user email is sent
- If Resend API fails, error is logged to console
- Booking remains successful even if emails fail

## Testing Locally

1. Start your dev server:
```bash
npm run dev
```

2. Run Supabase functions locally (optional):
```bash
supabase functions serve send-booking-email --env-file .env
```

3. Make a test booking and check console logs

## Production Checklist

- [ ] Deploy edge function to Supabase
- [ ] Set RESEND_API_KEY in Supabase secrets
- [ ] Set SITE_URL in Supabase secrets (production domain)
- [ ] Update VITE_SITE_URL in production .env
- [ ] Verify Resend domain (for custom from address)
- [ ] Test with real booking
- [ ] Check spam folder if emails not received

## Resend API Configuration

**Current Setup:**
- API Key: `re_gcnxwuHK_26dbVGZiLWyVoFkKdBeU5W9q`
- From Address: `onboarding@resend.dev` (Resend's test domain)

**For Production:**
1. Verify your own domain in Resend dashboard
2. Update `from` address in edge function to use your domain
3. Example: `Foundarly <bookings@foundarly.com>`

## Optional Enhancements (Future)

### Reminder Emails
Add a scheduled function to send reminder emails 10 minutes before meeting:
```typescript
// supabase/functions/send-meeting-reminder/index.ts
// Run via cron job or scheduled task
```

### Add to Calendar
Add `.ics` file attachment to emails for calendar integration

### Email Templates
Create reusable email template components for consistency

### Reschedule Notifications
Send emails when meetings are rescheduled

### Cancellation Emails
Send emails when bookings are cancelled

## Troubleshooting

### Emails not sending
1. Check Supabase function logs: Dashboard → Edge Functions → Logs
2. Verify RESEND_API_KEY is set correctly
3. Check Resend dashboard for delivery status
4. Verify consultant email exists in database

### Wrong meeting link
1. Check SITE_URL environment variable
2. Verify meeting_room_id format in database
3. Check edge function URL generation logic

### Consultant not receiving emails
1. Verify consultant has `user_id` linked
2. Check `email_notifications` preference in consultants table
3. Verify email exists in auth.users table

## Support

For issues or questions:
1. Check Supabase function logs
2. Check Resend dashboard for delivery status
3. Review console logs in browser
4. Check spam/junk folder

## API Reference

### Email Service

```typescript
import { emailService } from '@/services/email';

// Send booking confirmation emails
const result = await emailService.sendBookingConfirmation(bookingId);

if (result.success) {
  console.log('Emails sent successfully');
} else {
  console.error('Email error:', result.error);
}
```

### Edge Function Endpoint

```
POST https://tzihsuzxwziirpkvxysr.supabase.co/functions/v1/send-booking-email

Body:
{
  "bookingId": "uuid-here"
}

Response:
{
  "success": true,
  "userEmail": { "id": "..." },
  "consultantEmail": { "id": "..." }
}
```
