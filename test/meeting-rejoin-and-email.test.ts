import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateRejoinEligibility,
  validateParticipantAccess,
  parseSessionTimes,
  formatRejoinExpiryDateTime,
  getMeetingActionLabel,
  REJOIN_WINDOW_MS,
  EARLY_JOIN_WINDOW_MS,
} from '../src/utils/meetingRejoin.js';
import {
  meetingParticipantStorage,
} from '../src/server/meetingParticipantStorage.js';
import {
  completionEmailStorage,
} from '../src/server/completionEmailStorage.js';
import {
  generateSessionCompletedEmailHTML,
  generateSessionCompletedEmailText,
  EmailSessionCompletedData,
} from '../src/utils/emailTemplates.js';

describe('1. Meeting Session Lifecycle & 7-Day Rejoin Policy', () => {
  const baseBooking = {
    date: '2026-10-20',
    time: '14:00',
    session_duration: 60,
    status: 'confirmed',
    payment_status: 'paid',
  };

  test('Upcoming: before 5-minute pre-call join window', () => {
    // Scheduled start is 14:00 UTC. Test at 13:50 UTC (10 mins before).
    const checkTime = new Date('2026-10-20T13:50:00Z');
    const result = calculateRejoinEligibility(baseBooking, checkTime);

    assert.equal(result.sessionStatus, 'upcoming');
    assert.equal(result.canJoin, false);
    assert.equal(result.isRejoin, false);
  });

  test('Live: within 5-minute pre-call join window and during active call', () => {
    // 3 minutes before scheduled start (13:57 UTC)
    const earlyCheck = new Date('2026-10-20T13:57:00Z');
    const earlyResult = calculateRejoinEligibility(baseBooking, earlyCheck);
    assert.equal(earlyResult.sessionStatus, 'live');
    assert.equal(earlyResult.canJoin, true);

    // During active session (14:30 UTC)
    const midCheck = new Date('2026-10-20T14:30:00Z');
    const midResult = calculateRejoinEligibility(baseBooking, midCheck);
    assert.equal(midResult.sessionStatus, 'live');
    assert.equal(midResult.canJoin, true);
  });

  test('7-Day Rejoin Eligible: strictly valid for 7 days after session completion', () => {
    // Day 1 after session (15:00 UTC on 2026-10-21)
    const day1Check = new Date('2026-10-21T15:00:00Z');
    const day1Result = calculateRejoinEligibility(baseBooking, day1Check);
    assert.equal(day1Result.sessionStatus, 'rejoin_eligible');
    assert.equal(day1Result.canJoin, true);
    assert.equal(day1Result.isRejoin, true);
    assert.equal(day1Result.rejoinDaysRemaining, 6);

    // Day 6 after session (2026-10-26T15:00:00Z)
    const day6Check = new Date('2026-10-26T15:00:00Z');
    const day6Result = calculateRejoinEligibility(baseBooking, day6Check);
    assert.equal(day6Result.sessionStatus, 'rejoin_eligible');
    assert.equal(day6Result.canJoin, true);
    assert.equal(day6Result.isRejoin, true);
    assert.ok(day6Result.rejoinDaysRemaining >= 1);
  });

  test('Expired: after 7 days, rejoin is blocked', () => {
    // Day 8 after session (2026-10-28T16:00:00Z)
    const day8Check = new Date('2026-10-28T16:00:00Z');
    const day8Result = calculateRejoinEligibility(baseBooking, day8Check);
    assert.equal(day8Result.sessionStatus, 'expired');
    assert.equal(day8Result.canJoin, false);
    assert.equal(day8Result.isRejoin, false);
    assert.equal(day8Result.rejoinDaysRemaining, 0);
  });

  test('Cancelled or rejected bookings are never joinable', () => {
    const cancelledBooking = { ...baseBooking, status: 'cancelled' };
    const liveTime = new Date('2026-10-20T14:15:00Z');
    const res = calculateRejoinEligibility(cancelledBooking, liveTime);
    assert.equal(res.canJoin, false);
    assert.equal(res.sessionStatus, 'expired');
  });
});

describe('2. Join vs Rejoin Action Labels & Actual Participant History', () => {
  test('First-time participant sees "Join Meeting", not "Rejoin Meeting"', () => {
    const label = getMeetingActionLabel({
      hasJoined: false,
    });
    assert.equal(label, 'Join Meeting');

    const dashboardLabel = getMeetingActionLabel({
      hasJoined: false,
      variant: 'dashboard',
      daysRemaining: 7,
    });
    assert.equal(dashboardLabel, 'Join Meeting (7d left)');

    const followUpLabel = getMeetingActionLabel({
      hasJoined: false,
      isFollowUp: true,
    });
    assert.equal(followUpLabel, 'Join Confirmed Follow-up Call');
  });

  test('Returning participant sees "Rejoin Meeting" only after having joined', () => {
    const label = getMeetingActionLabel({
      hasJoined: true,
    });
    assert.equal(label, 'Rejoin Meeting');

    const dashboardLabel = getMeetingActionLabel({
      hasJoined: true,
      variant: 'dashboard',
      daysRemaining: 5,
    });
    assert.equal(dashboardLabel, 'Rejoin Meeting (5d left)');

    const followUpLabel = getMeetingActionLabel({
      hasJoined: true,
      isFollowUp: true,
    });
    assert.equal(followUpLabel, 'Rejoin Confirmed Follow-up');
  });

  test('Server participant history isolates client from consultant', () => {
    const bookingId = `test-booking-isolation-${Date.now()}`;
    const clientId = 'client-user-456';
    const clientEmail = 'client@example.com';
    const consultantId = 'consultant-user-789';
    const consultantEmail = 'consultant@example.com';

    // Verify neither has joined initially
    assert.equal(meetingParticipantStorage.hasJoined(bookingId, clientId, 'client'), false);
    assert.equal(meetingParticipantStorage.hasJoined(bookingId, consultantId, 'consultant'), false);

    // Client joins the meeting
    const clientJoinResult = meetingParticipantStorage.recordJoin(bookingId, clientId, 'client', clientEmail);
    assert.equal(clientJoinResult.isFirstJoin, true);

    // Client should now be recorded as joined
    assert.equal(meetingParticipantStorage.hasJoined(bookingId, clientId, 'client'), true);
    assert.equal(meetingParticipantStorage.hasJoined(bookingId, clientEmail, 'client'), true);

    // IMPORTANT: Consultant must still NOT be recorded as joined!
    assert.equal(meetingParticipantStorage.hasJoined(bookingId, consultantId, 'consultant'), false);
    assert.equal(meetingParticipantStorage.hasJoined(bookingId, consultantEmail, 'consultant'), false);

    // Consultant now joins
    const consultantJoinResult = meetingParticipantStorage.recordJoin(bookingId, consultantId, 'consultant', consultantEmail);
    assert.equal(consultantJoinResult.isFirstJoin, true);

    // Now consultant is also recorded as joined
    assert.equal(meetingParticipantStorage.hasJoined(bookingId, consultantId, 'consultant'), true);
  });
});

describe('3. Canonical Room ID Alignment Between Client & Consultant', () => {
  function getCanonicalRoomId(currentRoomId?: string, currentBooking?: any): string {
    if (currentBooking?.meeting_room_id && typeof currentBooking.meeting_room_id === 'string' && currentBooking.meeting_room_id.trim()) {
      return currentBooking.meeting_room_id.trim();
    }
    if (currentBooking?.id) {
      const rawId = String(currentBooking.id).trim();
      return rawId.startsWith('foundarly-') ? rawId : `foundarly-${rawId}`;
    }
    if (currentRoomId) {
      let clean = currentRoomId.trim().replace(/^.*\/meeting\//, '').split('?')[0].split('#')[0].replace(/\/+$/, '');
      return clean.startsWith('foundarly-') ? clean : `foundarly-${clean}`;
    }
    return 'default-room';
  }

  test('Client and consultant resolve to identical room ID regardless of URL variation', () => {
    const rawBookingUuid = 'a7b66267-da90-4ced-b73f-0058aa7a2d30';
    const booking = {
      id: rawBookingUuid,
      meeting_room_id: `foundarly-${rawBookingUuid}`,
    };

    // Client accessed via prefixed URL
    const clientRoom = getCanonicalRoomId(`foundarly-${rawBookingUuid}`, booking);

    // Consultant accessed via raw UUID or direct booking link
    const consultantRoom = getCanonicalRoomId(rawBookingUuid, booking);

    assert.equal(clientRoom, consultantRoom);
    assert.equal(clientRoom, `foundarly-${rawBookingUuid}`);
  });
});

describe('4. Post-Session Completion Email & Deduplication', () => {
  const sampleCompletedData: EmailSessionCompletedData = {
    bookingId: 'test-completed-booking-999',
    userName: 'John Doe',
    userEmail: 'john@example.com',
    consultantName: 'Sarah Smith',
    consultantEmail: 'sarah@example.com',
    recipientRole: 'client',
    recipientName: 'John Doe',
    recipientEmail: 'john@example.com',
    date: '2026-10-20',
    time: '14:00',
    sessionDuration: 60,
    meetingRoomId: 'foundarly-test-completed-booking-999',
    meetingLink: 'https://foundarlybusinessworld.in/meeting/foundarly-test-completed-booking-999',
    rejoinDeadline: '2026-10-27T15:00:00.000Z',
    rejoinExpiryFormatted: 'October 27, 2026 at 3:00 PM UTC',
    rejoinDaysRemaining: 7,
  };

  test('Completion email contains accurate 7-day policy, expiry time, and instructions', () => {
    const html = generateSessionCompletedEmailHTML(sampleCompletedData);
    const text = generateSessionCompletedEmailText(sampleCompletedData);

    // Expiry date and time check
    assert.ok(html.includes('October 27, 2026 at 3:00 PM UTC'));
    assert.ok(text.includes('October 27, 2026 at 3:00 PM UTC'));

    // 7-day follow-up policy check
    assert.ok(html.includes('7-Day Follow-Up Clarification Policy'));
    assert.ok(html.includes('rejoin the exact same meeting room'));
    assert.ok(text.includes('7-DAY FOLLOW-UP CLARIFICATION POLICY'));

    // Instructions check
    assert.ok(html.includes('My Bookings'));
    assert.ok(html.includes('Rejoin Meeting'));
    assert.ok(text.includes('Click "Rejoin Meeting"'));

    // Room ID and meeting link check
    assert.ok(html.includes('foundarly-test-completed-booking-999'));
    assert.ok(html.includes('https://foundarlybusinessworld.in/meeting/foundarly-test-completed-booking-999'));
  });

  test('Idempotency: completionEmailStorage prevents duplicate completion emails', () => {
    const bookingId = `test-idempotent-booking-${Date.now()}`;

    // Before sending
    assert.equal(completionEmailStorage.isSent(bookingId), false);

    // Mark as sent
    completionEmailStorage.markSent(bookingId);

    // Check again
    assert.equal(completionEmailStorage.isSent(bookingId), true);
    assert.equal(completionEmailStorage.isSent(`foundarly-${bookingId}`), true);
  });
});
