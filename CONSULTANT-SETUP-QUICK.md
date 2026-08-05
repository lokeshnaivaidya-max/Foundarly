# Consultant System - Quick Setup Guide

## What Was Built

Complete consultant management system with:
- ✅ Consultant dashboard with earnings tracking
- ✅ Payout request system (bank transfer & UPI)
- ✅ Meeting reschedule functionality (both sides)
- ✅ Consultant can see their bookings
- ✅ Consultant can join meetings
- ✅ Automatic earnings calculation (85% to consultant, 15% platform fee)

## Setup Steps

### 1. Verify Database Schema (Optional but Recommended)

Run this first to check if all required tables exist:
```sql
-- Copy and paste contents of:
database/verify-schema.sql
```

This will check:
- ✅ Required tables exist (consultants, bookings, testimonials)
- ✅ Required columns exist
- ✅ Auth access is working

### 2. Run Database Migration

Open Supabase SQL Editor and run:
```sql
-- Copy and paste contents of:
database/consultant-earnings-system.sql
```

This creates:
- Adds `user_id` field to `consultants` table
- `payout_requests` table
- `consultant_earnings` table
- Adds fields to `bookings` table
- Sets up RLS policies
- Creates earnings calculation trigger
- Creates `consultant_dashboard_stats` view

**Note**: The migration uses `testimonials` table (not `reviews`) for ratings.

### 3. Link Consultant to User Account

**Important**: Consultants need to be linked to user accounts to access the dashboard.

Open Supabase SQL Editor and run ONE of these options:

**Option A: Link existing consultant to your account**
```sql
-- Replace 'Consultant Name' with actual name
UPDATE consultants 
SET user_id = auth.uid() 
WHERE name = 'Consultant Name';
```

**Option B: Create new test consultant**
```sql
INSERT INTO consultants (
  name, title, bio, expertise, 
  pricing_30, pricing_60, user_id, is_active
) VALUES (
  'Test Consultant',
  'Professional Consultant',
  'Expert consultant for testing',
  ARRAY['Business', 'Strategy'],
  1000, 1800, auth.uid(), true
);
```

**Option C: Use helper script**
```sql
-- See database/link-consultant-to-user.sql for more options
```

### 3. Verify Linking

Check if your account is linked:
```sql
SELECT c.id, c.name, c.user_id
FROM consultants c
WHERE c.user_id = auth.uid();
```

If you see a result, you're good to go!

### 4. Test as Consultant

1. **Login** with a consultant account
2. **Navigate** to `/consultant-dashboard`
3. **View** your earnings and bookings
4. **Request Payout**:
   - Click "Request Payout"
   - Enter amount (must be ≤ pending earnings)
   - Choose payment method (Bank Transfer or UPI)
   - Fill in payment details
   - Submit

5. **Join Meeting**:
   - See your upcoming sessions
   - Click "Join Meeting" button
   - Or copy meeting link to share

6. **Request Reschedule**:
   - Click "Reschedule" on a booking
   - Enter reason
   - Propose new date/time
   - Submit (user will be notified)

### 3. Test as User

1. **Login** with a user account
2. **Go to** My Bookings (`/my-bookings`)
3. **Request Reschedule**:
   - Find an upcoming booking
   - Click "Reschedule" button
   - Enter reason and new date/time
   - Submit (consultant will be notified)

## How Earnings Work

### Automatic Calculation
When a session is marked as "completed":
1. System calculates: `Total Price - 15% = Consultant Earnings`
2. Creates entry in `consultant_earnings` table
3. Updates booking with earnings amount
4. Shows in consultant dashboard as "Pending"

### Example:
- Session Price: ₹1,000
- Platform Fee (15%): ₹150
- Consultant Earns (85%): ₹850

### Payout Flow:
1. Consultant sees ₹850 in "Pending Earnings"
2. Clicks "Request Payout"
3. Enters amount (up to ₹850)
4. Provides payment details
5. Admin reviews and approves (to be implemented)
6. Status changes to "Paid"

## Dashboard Features

### Stats Cards
- **Total Earnings**: All-time earnings
- **Pending Payout**: Available to withdraw
- **Upcoming Sessions**: Confirmed bookings
- **Average Rating**: From user reviews

### Bookings Tab
- See all sessions with users
- Join video meetings
- Copy meeting links
- Request reschedules
- View earnings per session

### Payouts Tab
- View all payout requests
- See status (pending, approved, rejected, paid)
- View admin notes

### Earnings Tab
- Total earned, pending, paid
- Recent earnings history
- Per-session breakdown

## Reschedule Feature

### User Requests Reschedule:
1. User clicks "Reschedule" in My Bookings
2. Enters reason and new date/time
3. Consultant sees request in dashboard
4. Consultant approves or rejects
5. If approved: Booking updated
6. If rejected: Original time remains

### Consultant Requests Reschedule:
1. Consultant clicks "Reschedule" in dashboard
2. Enters reason and new date/time
3. User sees request in My Bookings
4. User approves or rejects
5. Same approval flow

## Payment Methods

### Bank Transfer
Required fields:
- Account Name
- Account Number
- Bank Name
- IFSC Code

### UPI
Required field:
- UPI ID (e.g., yourname@upi)

## Access Control

### Who Can Access What:
- **Consultant Dashboard**: Only approved consultants
- **My Bookings**: All logged-in users
- **Payout Requests**: Only the consultant who created them
- **Earnings Data**: Only the consultant who earned it
- **Admin Panel**: Only admins (to be implemented)

## Testing Checklist

### Basic Flow
- [ ] Consultant logs in
- [ ] Sees dashboard with stats
- [ ] Views bookings list
- [ ] Joins a meeting
- [ ] Requests a payout
- [ ] Requests a reschedule

### User Flow
- [ ] User logs in
- [ ] Goes to My Bookings
- [ ] Sees reschedule button
- [ ] Requests reschedule
- [ ] Sees status badge

### Earnings Flow
- [ ] Complete a test session
- [ ] Check earnings calculated
- [ ] Verify 85/15 split
- [ ] See in dashboard
- [ ] Request payout

## Common Issues

### "Not a Consultant" Error
**Solution**: User needs to be linked to a consultant in the database

**Check if linked:**
```sql
SELECT * FROM consultants WHERE user_id = auth.uid();
```

**If no result, link yourself:**
```sql
-- Option 1: Link to existing consultant
UPDATE consultants 
SET user_id = auth.uid() 
WHERE name = 'Your Consultant Name';

-- Option 2: Create new consultant
INSERT INTO consultants (
  name, title, bio, expertise, 
  pricing_30, pricing_60, user_id, is_active
) VALUES (
  'Your Name', 'Your Title', 'Your bio',
  ARRAY['Your', 'Expertise'],
  1000, 1800, auth.uid(), true
);
```

### No Earnings Showing
**Solution**: Booking must be "completed" status
```sql
-- Update booking to completed (for testing)
UPDATE bookings 
SET status = 'completed' 
WHERE id = 'booking-id-here';
```

### Payout Request Fails
**Solution**: Check pending earnings
- Amount must be ≤ pending earnings
- Pending earnings = completed sessions not yet paid out

### Reschedule Button Not Showing
**Solution**: Check booking status
- Must be "confirmed" status
- Must be upcoming (not past)
- Must not have pending reschedule request

## Next Steps

### For Production:
1. **Admin Payout Page**: Create admin interface to approve payouts
2. **Email Notifications**: Notify about bookings, reschedules, payouts
3. **Consultant Onboarding**: Guide new consultants through setup
4. **Payment Integration**: Automate payouts via payment gateway
5. **Tax Documents**: Generate invoices and tax forms

### Optional Enhancements:
- Bulk payout processing
- Earnings analytics/charts
- Automatic payout scheduling
- Multiple bank accounts
- Payout history export (CSV/PDF)
- Consultant performance metrics

## File Reference

### Database
- `database/consultant-earnings-system.sql` - Schema and migrations

### Services
- `src/services/consultantDashboard.ts` - API methods

### Pages
- `src/pages/ConsultantDashboard.tsx` - Consultant dashboard
- `src/pages/MyBookings.tsx` - User bookings (with reschedule)

### Routes
- `/consultant-dashboard` - Consultant dashboard
- `/my-bookings` - User bookings

## Support

If something doesn't work:
1. Check browser console for errors
2. Check Supabase logs
3. Verify database migration ran successfully
4. Ensure RLS policies are active
5. Test with different user roles

---

**Ready to use!** Run the database migration and start testing.
