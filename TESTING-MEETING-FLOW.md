# Testing Meeting Flow - Quick Guide

## 🧪 How to Test the Meeting System

### Step 1: Create a Test Booking

1. **Go to Booking Page**
   ```
   http://localhost:5173/booking
   ```

2. **Fill out the form:**
   - Select a consultant
   - Choose a date (today or tomorrow)
   - Choose a time (set it to current time + 10 minutes for testing)
   - Select duration (30 or 60 minutes)
   - Fill in your details
   - Add a message (optional)

3. **Submit the form**
   - You'll see the payment modal
   - You can close it (don't need to pay for testing)

### Step 2: Approve the Booking (NEW TESTING FEATURE!)

1. **Go to My Bookings**
   ```
   http://localhost:5173/my-bookings
   ```

2. **Find your pending booking**
   - It will show "Payment incomplete" badge
   - You'll see three buttons:
     - "Complete Payment" (normal flow)
     - **"Approve (Test)"** ← NEW TESTING BUTTON
     - "Cancel"

3. **Click "Approve (Test)" button**
   - This will:
     - ✅ Mark payment as "paid"
     - ✅ Mark status as "confirmed"
     - ✅ Generate meeting room ID: `foundarly-{bookingId}`
   - Toast notification: "Booking approved! Meeting room created."

### Step 3: Test Meeting Access

Now you have 3 ways to test:

#### Method 1: Direct Join Button
```
1. Stay on My Bookings page
2. Find your approved booking
3. If meeting time is within 5 minutes, you'll see "Join Call" button
4. Click it → Opens meeting page
```

#### Method 2: Manual Meeting ID Entry
```
1. On My Bookings page, click "Join with Meeting ID" button
2. Enter the meeting ID (shown on your booking card)
3. Click "Join Meeting"
4. Opens meeting page
```

#### Method 3: Direct URL
```
1. Copy the meeting room ID from your booking
2. Go to: http://localhost:5173/meeting/foundarly-xxxxx
3. Opens meeting page
```

### Step 4: Test Meeting Page Features

#### Pre-Call Screen
- [ ] See consultant name and details
- [ ] See meeting date, time, duration
- [ ] See meeting ID displayed
- [ ] See shareable meeting link with copy button
- [ ] Click "Copy" button → Link copied to clipboard

#### Time-Based Behavior

**If meeting time is in future (>5 min):**
- [ ] See countdown timer
- [ ] See "Join button will appear 5 minutes before"
- [ ] Join button is disabled

**If meeting time is within 5 minutes:**
- [ ] See "Session is ready to join" message
- [ ] See pulsing green indicator
- [ ] "Join Video Call" button is enabled
- [ ] Click button → Jitsi loads

**If meeting time has passed:**
- [ ] See "This session has ended"
- [ ] See "Leave a Review" button

#### During Call
- [ ] Video container loads
- [ ] Jitsi interface appears
- [ ] Test controls:
  - [ ] Mute/Unmute microphone
  - [ ] Start/Stop video
  - [ ] Share screen
  - [ ] End call button

#### After Call
- [ ] Click "End Call"
- [ ] See "Call Ended" screen
- [ ] Auto-redirect to review page (1.5 seconds)

### Step 5: Test Access Control

#### Test Unauthorized Access
```
1. Copy your meeting room ID
2. Log out
3. Log in as a different user
4. Try to access: /meeting/foundarly-xxxxx
5. Should see "Access Denied" screen
```

#### Test Consultant Access
```
1. Log in as the consultant (if you have consultant account)
2. Go to My Bookings or Admin Bookings
3. Find the booking
4. Click "Join Call" or enter meeting ID
5. Should have access (consultant can join their own meetings)
```

---

## 🎯 Complete Testing Checklist

### Booking Creation
- [ ] Create booking through booking form
- [ ] Booking appears in My Bookings with "pending" status
- [ ] "Approve (Test)" button is visible

### Approval Flow
- [ ] Click "Approve (Test)" button
- [ ] Toast shows success message
- [ ] Booking status changes to "confirmed"
- [ ] Payment status changes to "paid"
- [ ] Meeting room ID is generated
- [ ] Meeting room ID is visible on booking card

### Meeting Access
- [ ] "Join Call" button appears (if within time window)
- [ ] "Join with Meeting ID" button works
- [ ] Manual ID entry dialog opens
- [ ] Can enter meeting ID and join
- [ ] Direct URL access works

### Meeting Page
- [ ] Consultant info displays correctly
- [ ] Meeting details are accurate
- [ ] Status badge shows correct state
- [ ] Meeting ID is displayed
- [ ] Meeting link is displayed
- [ ] Copy button works
- [ ] Countdown timer works (if early)
- [ ] Join button appears at right time
- [ ] Jitsi loads when joining
- [ ] Video controls work
- [ ] End call works
- [ ] Redirect to review works

### Access Control
- [ ] Booked user can access
- [ ] Consultant can access
- [ ] Other users see "Access Denied"
- [ ] Invalid meeting ID shows error

### Edge Cases
- [ ] Refresh page during call (should maintain state)
- [ ] Back button works
- [ ] Multiple tabs (test if needed)
- [ ] Mobile responsive (test on phone)

---

## 🐛 Common Issues & Solutions

### Issue: "Approve (Test)" button not showing
**Solution**: Make sure booking has:
- `status: "pending"`
- `payment_status: "pending"`

### Issue: "Join Call" button not appearing
**Solution**: Check:
1. Booking is confirmed (`status: "confirmed"`)
2. Meeting room ID exists
3. Current time is within join window (5 min before to end time)

### Issue: "Access Denied" on meeting page
**Solution**: 
1. Make sure you're logged in as the user who booked
2. Or logged in as the consultant
3. Check meeting room ID is correct

### Issue: Jitsi not loading
**Solution**:
1. Check browser console for errors
2. Verify internet connection
3. Try different browser (Chrome recommended)
4. Check if meet.jit.si is accessible

### Issue: Meeting time logic not working
**Solution**:
1. Set meeting time to current time + 10 minutes
2. Wait until 5 minutes before
3. Refresh page to update status

---

## 🚀 Quick Test Script

**5-Minute Complete Test:**

```bash
# 1. Create booking (2 min)
- Go to /booking
- Fill form with time = now + 10 minutes
- Submit

# 2. Approve booking (30 sec)
- Go to /my-bookings
- Click "Approve (Test)"
- Verify meeting room ID appears

# 3. Test access (1 min)
- Click "Join with Meeting ID"
- Enter meeting ID
- Verify meeting page loads

# 4. Test meeting page (1 min)
- Check all details display
- Copy meeting link
- Verify countdown/join button

# 5. Test call (30 sec)
- Click "Join Video Call" (if time is right)
- Verify Jitsi loads
- Test mute/video controls
- End call
```

---

## 📝 Testing Notes

### What the "Approve (Test)" Button Does:

```typescript
// Updates booking with:
{
  payment_status: "paid",
  status: "confirmed",
  meeting_room_id: `foundarly-${bookingId}`
}
```

This simulates what happens after successful Razorpay payment, allowing you to test the meeting flow without actual payment processing.

### When to Use:

- ✅ Development testing
- ✅ Demo presentations
- ✅ QA testing
- ✅ Feature validation

### When NOT to Use:

- ❌ Production environment
- ❌ Real customer bookings
- ❌ Financial reporting

---

## 🎉 Success Criteria

Your meeting system is working correctly when:

- ✅ Can create and approve test bookings
- ✅ Meeting room ID is generated
- ✅ Can access meeting page via multiple methods
- ✅ Time-based logic works correctly
- ✅ Video call loads and works
- ✅ Access control prevents unauthorized access
- ✅ Post-call redirect to review works

---

## 🔄 Reset Test Data

If you want to clean up test bookings:

```sql
-- In Supabase SQL Editor:
DELETE FROM bookings WHERE status = 'pending' OR status = 'cancelled';
```

Or manually delete from My Bookings page using the "Remove" button on cancelled bookings.

---

**Happy Testing! 🚀**

If you encounter any issues, check the browser console for error messages and refer to the troubleshooting section above.
