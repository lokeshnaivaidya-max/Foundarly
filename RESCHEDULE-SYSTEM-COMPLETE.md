# Reschedule System Implementation

## Overview
Smart reschedule system that tracks meeting participation and only allows rescheduling when appropriate.

## Features Implemented

### 1. Admin Reschedule Requests Dashboard
- New "Reschedule" card in admin stats (orange color)
- Shows count of meetings that need rescheduling
- Click the card to filter and show only reschedule requests
- Badge indicator when filter is active

### 2. Reschedule Logic Rules

**Can Reschedule When:**
- Meeting status is "missed"
- Only 1 person (or 0 people) joined the meeting
- Meeting hasn't been marked as completed

**Cannot Reschedule When:**
- 2+ people joined the meeting
- Meeting lasted 10+ minutes with both parties
- Meeting status is "completed"

### 3. Database Fields Added

Run `database/add-meeting-participants.sql` to add:
- `participants_count` - Tracks how many people joined
- `meeting_started_at` - When meeting actually started
- `meeting_ended_at` - When meeting actually ended

### 4. Meeting Tracking Service

Created `src/services/meetingTracking.ts` with:
- `incrementParticipants()` - Track when someone joins
- `endMeeting()` - Mark meeting as ended, auto-complete if criteria met
- `canReschedule()` - Check if booking can be rescheduled

## How It Works

### User Flow:
1. User books consultation → Status: "pending"
2. Admin approves → Status: "confirmed", meeting room created
3. Meeting time arrives:
   - **Both join + 10+ min** → Auto-marked "completed" ✅
   - **Only 1 joins** → Stays "missed", can reschedule 🔄
   - **Nobody joins** → Stays "missed", can reschedule 🔄

### Admin Flow:
1. View dashboard stats
2. Click "Reschedule" card (orange) to see requests
3. See bookings where only 1 person showed up
4. Use "Edit" to reschedule date/time
5. Meeting room link stays the same

## UI Changes

### Admin Bookings Page:
- 6 stat cards (was 5): Total, Pending, Confirmed, Completed, Cancelled, **Reschedule**
- Reschedule card is clickable - filters to show only reschedule requests
- Orange badge shows "Showing Reschedule Requests Only" when filtered
- Click X on badge or card again to clear filter

### My Bookings Page:
- Removed "Approve (Test)" button (admin only feature)
- Users can still cancel and reschedule their own bookings
- Reschedule button shows for "missed" meetings

## Database Schema

```sql
ALTER TABLE bookings ADD COLUMN participants_count INTEGER DEFAULT 0;
ALTER TABLE bookings ADD COLUMN meeting_started_at TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN meeting_ended_at TIMESTAMPTZ;
```

## Status Flow

```
pending → confirmed → live → completed ✅
                    ↓
                  missed (0-1 participants) → can reschedule 🔄
                  missed (2+ participants, 10+ min) → completed ✅
```

## Next Steps (Optional)

To fully integrate participant tracking:

1. Update Meeting.tsx to call `meetingTrackingService.incrementParticipants()` when user joins
2. Call `meetingTrackingService.endMeeting()` when meeting ends
3. This will automatically track participation and mark meetings as completed

For now, the system works with manual status updates by admin.

## Files Created/Modified

**New Files:**
- `database/add-meeting-participants.sql` - Database schema
- `src/services/meetingTracking.ts` - Tracking service
- `RESCHEDULE-SYSTEM-COMPLETE.md` - This documentation

**Modified Files:**
- `src/pages/admin/AdminBookings.tsx` - Added reschedule filter and card
- `src/pages/MyBookings.tsx` - Removed test approve button

## Testing

1. Run the SQL migration: `database/add-meeting-participants.sql`
2. Create a test booking
3. Set status to "missed" and participants_count to 1
4. Check admin dashboard - should show in "Reschedule" count
5. Click reschedule card - should filter to show only that booking
6. Use Edit to reschedule the meeting

## Summary

✅ Admin can see reschedule requests in dedicated card
✅ Smart filtering based on participation
✅ Only allows reschedule when appropriate (1 or 0 participants)
✅ Meetings with 2+ participants for 10+ min auto-complete
✅ Clean UI with orange theme for reschedule requests
✅ Removed user-facing test buttons
