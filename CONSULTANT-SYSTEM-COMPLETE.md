# Consultant System - Complete Implementation

## Overview

Implemented a comprehensive consultant management system with earnings tracking, payout requests, and meeting reschedule functionality.

## Features Implemented

### 1. Consultant Dashboard (`/consultant-dashboard`)
- **Earnings Overview**: Total, pending, and paid earnings
- **Session Statistics**: Upcoming and completed sessions
- **Average Rating**: Based on user reviews
- **Bookings Management**: View all sessions with users
- **Payout Requests**: Request withdrawals with payment details
- **Reschedule Requests**: Request to reschedule sessions

### 2. Earnings System
- **Automatic Calculation**: 15% platform fee, 85% to consultant
- **Earnings Tracking**: Per-session earnings history
- **Payout Status**: Pending, requested, processing, paid
- **Payment Methods**: Bank transfer, UPI

### 3. Payout Request System
- **Request Creation**: Consultants submit payout requests
- **Payment Details**: Bank account or UPI information
- **Admin Approval**: Admins review and process requests
- **Status Tracking**: Pending, approved, rejected, paid

### 4. Reschedule Functionality
- **User-Initiated**: Users can request reschedule from My Bookings
- **Consultant-Initiated**: Consultants can request reschedule from dashboard
- **Approval Flow**: Other party must approve the new date/time
- **Reason Tracking**: Both parties provide reasons
- **Limit Tracking**: Count of reschedules per booking

### 5. Consultant Bookings View
- **See All Sessions**: View bookings from users
- **Join Meetings**: Access video calls
- **Copy Meeting Links**: Share with users
- **Track Earnings**: See earnings per session
- **Manage Schedule**: Request reschedules when needed

## Database Schema

### New Tables

#### `payout_requests`
```sql
- id: UUID (primary key)
- consultant_id: UUID (foreign key to consultants)
- amount: DECIMAL(10,2)
- status: TEXT (pending, approved, rejected, paid)
- payment_method: TEXT (bank_transfer, upi, paypal)
- payment_details: JSONB (account info)
- requested_at: TIMESTAMPTZ
- processed_at: TIMESTAMPTZ
- processed_by: UUID (admin user_id)
- admin_notes: TEXT
```

#### `consultant_earnings`
```sql
- id: UUID (primary key)
- consultant_id: UUID (foreign key)
- booking_id: UUID (foreign key)
- amount: DECIMAL(10,2) (total booking price)
- platform_fee: DECIMAL(10,2) (15%)
- net_amount: DECIMAL(10,2) (85% to consultant)
- earned_at: TIMESTAMPTZ
```

### Updated Tables

#### `bookings` - New Fields
```sql
- consultant_earnings: DECIMAL(10,2)
- platform_fee: DECIMAL(10,2)
- payout_status: TEXT (pending, requested, processing, paid)
- reschedule_requested_by: UUID
- reschedule_requested_at: TIMESTAMPTZ
- reschedule_reason: TEXT
- reschedule_status: TEXT (none, requested, approved, rejected)
- original_date: DATE
- original_time: TIME
- reschedule_count: INTEGER
```

#### `consultants` - New Fields
```sql
- email_notifications: BOOLEAN
- notification_preferences: JSONB
```

### Views

#### `consultant_dashboard_stats`
Aggregated statistics for consultant dashboard:
- Total bookings
- Completed sessions
- Upcoming sessions
- Total earnings
- Pending earnings
- Paid earnings
- Average rating
- Total reviews

## Files Created

### Database
- `database/consultant-earnings-system.sql` - Complete schema

### Services
- `src/services/consultantDashboard.ts` - API service for consultant features

### Pages
- `src/pages/ConsultantDashboard.tsx` - Main consultant dashboard

### Updates
- `src/pages/MyBookings.tsx` - Added reschedule functionality
- `src/App.tsx` - Added consultant dashboard route

## Setup Instructions

### 1. Run Database Migration
```sql
-- Run this in Supabase SQL Editor
\i database/consultant-earnings-system.sql
```

### 2. Test the System

#### As a Consultant:
1. Login with consultant account
2. Navigate to `/consultant-dashboard`
3. View earnings and bookings
4. Request a payout
5. Request to reschedule a session

#### As a User:
1. Login with user account
2. Go to My Bookings
3. Click "Reschedule" on an upcoming booking
4. Fill in reason and proposed new date/time
5. Submit request

### 3. Admin Payout Management
(To be implemented in admin panel)
- View all payout requests
- Approve/reject requests
- Add admin notes
- Mark as paid

## How It Works

### Earnings Flow
```
1. User books session → Payment collected
2. Session completed → Trigger earnings calculation
3. Calculate: Total - 15% platform fee = Consultant earnings
4. Create entry in consultant_earnings table
5. Update booking with consultant_earnings and payout_status
6. Consultant sees pending earnings in dashboard
7. Consultant requests payout
8. Admin approves and processes
9. Mark as paid
```

### Reschedule Flow
```
User/Consultant Side:
1. Click "Reschedule" button
2. Enter reason and proposed new date/time
3. Submit request
4. Status: "reschedule_requested"

Other Party Side:
1. See reschedule request notification
2. Review reason and proposed time
3. Approve or reject
4. If approved: Booking date/time updated
5. If rejected: Original date/time remains
```

## API Methods

### Consultant Dashboard Service

```typescript
// Get dashboard stats
getDashboardStats(userId: string): Promise<DashboardStats>

// Get consultant's bookings
getConsultantBookings(userId: string): Promise<ConsultantBooking[]>

// Get earnings history
getEarningsHistory(userId: string): Promise<EarningsHistory[]>

// Create payout request
createPayoutRequest(
  userId: string,
  amount: number,
  paymentMethod: string,
  paymentDetails: any
): Promise<{success: boolean, error?: string}>

// Get payout requests
getPayoutRequests(userId: string): Promise<PayoutRequest[]>

// Request reschedule
requestReschedule(
  bookingId: string,
  userId: string,
  reason: string,
  newDate: string,
  newTime: string
): Promise<{success: boolean, error?: string}>

// Approve reschedule
approveReschedule(
  bookingId: string,
  newDate: string,
  newTime: string
): Promise<{success: boolean, error?: string}>

// Reject reschedule
rejectReschedule(
  bookingId: string
): Promise<{success: boolean, error?: string}>
```

## UI Components

### Consultant Dashboard
- **Stats Cards**: Earnings, sessions, ratings
- **Payout Request Button**: Quick access to request withdrawal
- **Tabs**: Bookings, Payouts, Earnings
- **Booking Cards**: Session details with actions
- **Payout Dialog**: Form for payment details
- **Reschedule Dialog**: Form for reschedule request

### My Bookings (User)
- **Reschedule Button**: On upcoming bookings
- **Reschedule Dialog**: Reason and new date/time picker
- **Status Badges**: Show reschedule status

## Security & Permissions

### Row Level Security (RLS)
- Consultants can only view their own data
- Users can only view their own bookings
- Admins can view all data
- Payout requests protected by consultant ownership

### Access Control
- Consultant dashboard requires consultant role
- Payout requests require pending earnings
- Reschedule requires booking ownership

## Platform Fee Configuration

Currently set to 15% (configurable in database function):

```sql
platform_fee_percent DECIMAL(5,2) := 0.15; -- 15% platform fee
```

To change:
1. Update `calculate_consultant_earnings()` function
2. Modify the `platform_fee_percent` variable

## Testing Checklist

### Consultant Dashboard
- [ ] View dashboard stats
- [ ] See all bookings
- [ ] Join meeting from dashboard
- [ ] Copy meeting link
- [ ] Request payout with bank details
- [ ] Request payout with UPI
- [ ] View payout request status
- [ ] Request reschedule
- [ ] View earnings history

### User Reschedule
- [ ] Click reschedule on booking
- [ ] Fill reason and new date/time
- [ ] Submit request
- [ ] See reschedule status badge

### Earnings Calculation
- [ ] Complete a session
- [ ] Check earnings calculated correctly (85%)
- [ ] Verify platform fee (15%)
- [ ] Confirm entry in earnings history

### Payout Flow
- [ ] Request payout
- [ ] Verify amount validation
- [ ] Check payment details saved
- [ ] Admin can see request (to be implemented)

## Next Steps

### Admin Payout Management Page
Create `src/pages/admin/AdminPayouts.tsx`:
- List all payout requests
- Filter by status
- Approve/reject requests
- Add admin notes
- Mark as paid
- View consultant details

### Email Notifications
- Notify consultant of new booking
- Notify about reschedule requests
- Notify about payout status
- Notify user about reschedule approval/rejection

### Analytics
- Consultant performance metrics
- Earnings trends
- Popular time slots
- Cancellation rates

### Advanced Features
- Automatic payouts (scheduled)
- Multiple payment methods
- Tax documentation
- Invoice generation
- Earnings reports (PDF/CSV)

## Troubleshooting

### "Not a Consultant" Error
- User needs to be approved consultant
- Check `consultants` table has entry for user_id
- Verify consultant status is active

### Earnings Not Calculating
- Check booking status is "completed"
- Verify trigger is enabled
- Check pricing table has consultant pricing
- Review function logs in Supabase

### Payout Request Fails
- Verify pending earnings > requested amount
- Check consultant_id exists
- Ensure payment details are valid JSON
- Review RLS policies

### Reschedule Not Working
- Check booking status is "confirmed"
- Verify user has permission
- Ensure date is in future
- Check reschedule_status field exists

## Support

For issues or questions:
1. Check database logs in Supabase
2. Review browser console for errors
3. Verify RLS policies are correct
4. Test with different user roles

---

**Status**: Core system complete, ready for testing
**Next**: Admin payout management page
