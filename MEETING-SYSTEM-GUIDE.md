# Meeting Video Call System - Complete Guide

## Overview
A fully functional video conferencing system integrated into the Foundarly consultant platform, allowing users and consultants to conduct 1-on-1 video sessions directly within the platform.

## Features Implemented

### 1. Dynamic Meeting Routes
- **Route Pattern**: `/meeting/:roomId`
- **Example**: `/meeting/foundarly-98765`
- Meeting ID format: `foundarly-{bookingId}`
- Automatically generated when booking is confirmed

### 2. Access Control
- **Dual Authorization**: Only the booked user OR the consultant can access
- **Validation**: Checks against both `user_id` and `consultant_id` from booking
- **Access Denied Screen**: Professional error page for unauthorized access
- **Database Validation**: Fetches booking details to verify permissions

### 3. Meeting Page UI

#### Top Navigation Bar
- Back button to My Bookings
- Platform branding (Foundarly)
- Consultant info with avatar
- Meeting date, time, and duration
- Live status badge (Upcoming / Live / Completed)

#### Pre-Call Waiting Screen
- Consultant profile card
- Meeting details display
- Meeting ID shown for reference
- Status-based UI:
  - **Upcoming**: Countdown timer + "Join available 5 min before"
  - **Live**: Pulsing "Ready to join" indicator + Join button
  - **Completed**: "Session ended" message + Review link

#### Active Call Screen
- Full-screen Jitsi video container
- Control buttons:
  - Mute/Unmute microphone
  - Start/Stop video
  - Share screen
  - End call (red button)
- Real-time status tracking

#### Post-Call Screen
- "Call Ended" confirmation
- Auto-redirect to review page after 1.5 seconds

### 4. Video Call Integration

#### Jitsi Meet Implementation
```typescript
// Embedded Jitsi with custom config
- Domain: meet.jit.si
- Room name: meeting_room_id from booking
- User display name: From user profile
- Custom branding: "Foundarly"
- Toolbar: Mic, Camera, Screen share, Hangup, Chat, Raise hand, Tile view
```

#### Features Available
- HD video quality
- Audio/video controls
- Screen sharing
- Text chat
- Participant list
- Raise hand
- Tile view / Speaker view
- Full-screen mode

### 5. Time-Based Logic

#### Meeting Status Calculation
```typescript
- Upcoming: Current time < (meeting time - 5 minutes)
- Live: (meeting time - 5 minutes) <= Current time <= (meeting time + duration)
- Completed: Current time > (meeting time + duration)
```

#### Join Window
- Users can join 5 minutes before scheduled time
- Join button disabled until join window opens
- Countdown timer shows time until join window

#### Auto-Refresh
- Status updates every 30 seconds
- Ensures accurate "Live" status detection

### 6. Join Methods

#### Method 1: Direct Link
```
https://yourplatform.com/meeting/foundarly-98765
```
- Click from booking confirmation email
- Click "Join Call" button in My Bookings page
- Bookmark and return later

#### Method 2: Manual Entry
```
1. Navigate to /meeting (no room ID)
2. Enter meeting ID in input field
3. Click "Join Meeting"
4. Redirects to /meeting/:roomId
```

### 7. Post-Call Flow
```
Call Ends → "Call Ended" screen (1.5s) → Redirect to /review/:bookingId
```
- Automatic redirect ensures users leave feedback
- Review page allows rating and written feedback
- Feedback stored in testimonials table

## Backend Requirements

### Database Schema
```sql
-- bookings table must have:
- id (uuid, primary key)
- user_id (uuid, references users)
- consultant_id (uuid, references consultants)
- meeting_room_id (text, unique)
- date (date)
- time (time)
- session_duration (integer, minutes)
- status (text: pending/confirmed/completed/cancelled)

-- consultants table must have:
- id (uuid, primary key)
- user_id (uuid, references users)
- name (text)
- title (text)
```

### API Endpoints Used
```typescript
// Get all bookings (for access validation)
bookingsService.getAll()

// Returns: Array of bookings with consultant details
// Used to find booking by meeting_room_id and validate access
```

### Meeting Room ID Generation
```typescript
// On booking confirmation:
meeting_room_id = `foundarly-${booking.id}`

// Example: foundarly-a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

## Security Features

### 1. Authentication Required
- Redirects to `/login` if user not authenticated
- Uses AuthContext to verify user session

### 2. Authorization Check
```typescript
// User has access if:
booking.user_id === currentUser.id  // Booked user
OR
booking.consultants.user_id === currentUser.id  // Consultant
```

### 3. Meeting Not Found
- Shows access denied if meeting_room_id doesn't exist
- Prevents enumeration attacks

### 4. Expired Meetings
- Completed meetings show "Session ended" message
- Join button disabled after meeting time + duration

## User Experience Flow

### For Booked User
```
1. Book consultation → Payment → Booking confirmed
2. Receive meeting_room_id: foundarly-xxxxx
3. Navigate to My Bookings
4. See "Join Call" button (5 min before meeting)
5. Click → Redirected to /meeting/foundarly-xxxxx
6. Wait in lobby (if early) or Join immediately
7. Video call starts in-page
8. End call → Redirect to review page
9. Submit rating and feedback
```

### For Consultant
```
1. Receive booking notification
2. Check Admin Dashboard or My Bookings
3. Click meeting link or enter meeting ID
4. Access validated (consultant_id matches)
5. Join call and conduct session
6. End call → Can view booking details
```

## Technical Implementation

### Key Technologies
- **React + TypeScript**: Frontend framework
- **Jitsi Meet External API**: Video conferencing
- **React Router**: Dynamic routing
- **Framer Motion**: Animations
- **Supabase**: Backend database
- **Sonner**: Toast notifications

### State Management
```typescript
- booking: Current booking details
- loading: Initial data fetch
- accessDenied: Authorization failure
- callStarted: Video call active
- callEnded: Call terminated
- status: upcoming | live | completed
- muted: Microphone state
- videoOff: Camera state
```

### Performance Optimizations
- Lazy load Jitsi script (only when needed)
- Cleanup Jitsi instance on unmount
- Debounced status checks (30s interval)
- Conditional rendering based on state

## Customization Options

### Branding
```typescript
// In Jitsi config:
interfaceConfigOverwrite: {
  APP_NAME: "Foundarly",  // Change to your brand
  DEFAULT_BACKGROUND: "#0a0a0a",  // Your theme color
  SHOW_JITSI_WATERMARK: false,
  SHOW_BRAND_WATERMARK: false,
}
```

### Meeting Duration
```typescript
// Stored in booking.session_duration (minutes)
// Common values: 30, 60, 90, 120
```

### Join Window
```typescript
// Currently: 5 minutes before meeting
// To change: Modify in getMeetingStatus function
const joinWindow = new Date(start.getTime() - 5 * 60 * 1000);
// Change 5 to desired minutes
```

## Troubleshooting

### Issue: "Access Denied" for valid user
**Solution**: Check that consultant has `user_id` field populated in consultants table

### Issue: Video not loading
**Solution**: 
1. Check browser console for Jitsi script errors
2. Verify meet.jit.si is accessible
3. Check browser permissions for camera/mic

### Issue: Join button not appearing
**Solution**: 
1. Verify system time is correct
2. Check booking date/time format
3. Ensure status calculation logic is correct

### Issue: Meeting ID not found
**Solution**:
1. Verify meeting_room_id is set in booking
2. Check booking status is "confirmed"
3. Ensure RLS policies allow reading bookings

## Future Enhancements

### Potential Features
- [ ] Recording functionality
- [ ] Waiting room for consultants
- [ ] Pre-call device testing
- [ ] Meeting notes/whiteboard
- [ ] File sharing during call
- [ ] Calendar integration
- [ ] Email reminders (15 min before)
- [ ] SMS notifications
- [ ] Virtual backgrounds
- [ ] Breakout rooms (for group sessions)

### Analytics to Track
- Average call duration
- Join time (early/late/on-time)
- Technical issues reported
- User satisfaction scores
- Device/browser usage

## Support & Maintenance

### Regular Checks
- Monitor Jitsi API updates
- Test on major browsers (Chrome, Firefox, Safari, Edge)
- Verify mobile responsiveness
- Check database query performance
- Review error logs

### User Support
- Provide meeting ID in booking confirmation email
- Include troubleshooting guide link
- Offer test meeting option
- Support chat during business hours

## Conclusion

The meeting system is production-ready with:
✅ Secure access control
✅ Professional UI/UX
✅ Embedded video calls
✅ Time-based logic
✅ Multiple join methods
✅ Post-call review flow
✅ Mobile responsive
✅ Error handling

Users can seamlessly book → join → complete → review consultations entirely within your platform.
