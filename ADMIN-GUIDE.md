# Admin Panel Guide - Simplified System

## Overview
Your consultant booking platform is now simplified with admin-controlled workflow. No consultant dashboard needed - admin manages everything!

## Admin Workflow

### 1. User Books a Consultant
- User selects consultant from website
- Completes payment via Razorpay
- Booking appears in Admin Panel with status "pending"

### 2. Admin Reviews Booking
**Go to: Admin → Manage Bookings**

You'll see all bookings with:
- Client name and email
- Consultant selected
- Date and time
- Payment status
- Meeting room ID (if generated)

### 3. Admin Approves Booking

**Option A: Quick Approve (for testing)**
- Click "Approve (Test)" button
- Automatically sets status to "confirmed"
- Auto-generates meeting room ID
- Ready to use!

**Option B: Edit Booking**
1. Click "Edit" button on any booking
2. Update fields:
   - **Booking Status**: Change to "Confirmed"
   - **Payment Status**: Set to "Paid"
   - **Meeting Room ID**: Click "Auto" to generate
   - **Reschedule**: Change date/time if needed
3. Click "Save Changes"

### 4. Share Meeting Link

**Copy Meeting Link:**
1. Find the booking in the table
2. Click the 📋 Copy button next to meeting room ID
3. Share link with consultant via email/WhatsApp/etc.

**Open Meeting:**
- Click the 🔗 Open button to test the meeting
- Meeting opens in new tab

### 5. Reschedule Booking

**To reschedule a meeting:**
1. Click "Edit" on the booking
2. Scroll to "Reschedule Meeting" section
3. Select new date and time
4. Click "Save Changes"
5. Manually notify client and consultant of new time

## Admin Panel Features

### Manage Bookings Page

**Statistics Dashboard:**
- Total bookings
- Pending bookings
- Confirmed bookings
- Completed bookings
- Cancelled bookings

**Search & Filter:**
- Search by client name, email, or consultant
- Filter by status (All, Pending, Confirmed, Completed, Cancelled)

**Booking Actions:**
- ✏️ **Edit** - Update status, payment, reschedule
- 🗑️ **Delete** - Remove booking
- 📋 **Copy Link** - Copy meeting URL
- 🔗 **Open** - Test meeting in new tab

### Meeting Link Format

```
https://yourdomain.com/meeting/foundarly-{bookingId}
```

Example:
```
https://foundarly.com/meeting/foundarly-a7b66267-da90-4ced-b73f-0058aa7a2d30
```

## Step-by-Step: Approve a Booking

1. **Login as Admin**
   - Go to `/login`
   - Use admin credentials

2. **Navigate to Bookings**
   - Click "Manage Bookings" in sidebar
   - See all pending bookings

3. **Review Booking Details**
   - Check client information
   - Verify consultant selection
   - Confirm date/time/duration

4. **Approve Booking**
   - Click "Edit" button
   - Set Status: "Confirmed"
   - Set Payment: "Paid"
   - Click "Auto" for meeting room (or it auto-generates)
   - Click "Save Changes"

5. **Copy Meeting Link**
   - Click 📋 Copy but