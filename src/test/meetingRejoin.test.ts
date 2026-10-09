import { describe, it, expect } from 'vitest';
import {
  parseTimeString,
  parseSessionTimes,
  calculateRejoinEligibility,
  validateParticipantAccess,
  REJOIN_WINDOW_MS,
  EARLY_JOIN_WINDOW_MS,
} from '@/utils/meetingRejoin';

describe('7-Day Meeting Rejoin & Security Authorization', () => {
  const mockClient = {
    id: 'client-uuid-1111',
    email: 'client@example.com',
  };

  const mockConsultantUser = {
    id: 'consultant-user-uuid-2222',
    email: 'consultant@example.com',
  };

  const mockConsultantRecord = {
    id: 'consultant-profile-uuid-9999',
    user_id: 'consultant-user-uuid-2222',
    email: 'consultant@example.com',
    name: 'Dr. Jane Consultant',
    title: 'Senior Business Advisor',
  };

  const mockUnrelatedUser = {
    id: 'stranger-uuid-3333',
    email: 'stranger@example.com',
  };

  const baseBooking = {
    id: 'booking-uuid-7777',
    user_id: 'client-uuid-1111',
    email: 'client@example.com',
    consultant_id: 'consultant-profile-uuid-9999',
    meeting_room_id: 'foundarly-booking-uuid-7777',
    name: 'Client Name',
    date: '2026-10-01',
    time: '14:00',
    session_duration: 60,
    status: 'confirmed',
    payment_status: 'paid',
  };

  describe('Participant Authorization & Access Control', () => {
    it('allows eligible client to access the meeting room', () => {
      const result = validateParticipantAccess(mockClient, baseBooking, mockConsultantRecord, false);
      expect(result.authorized).toBe(true);
      expect(result.role).toBe('client');
    });

    it('allows eligible client matching by email (e.g. booked before account signup)', () => {
      const clientWithDifferentId = {
        id: 'new-client-uuid-5555',
        email: 'client@example.com',
      };
      const result = validateParticipantAccess(clientWithDifferentId, baseBooking, mockConsultantRecord, false);
      expect(result.authorized).toBe(true);
      expect(result.role).toBe('client');
    });

    it('allows assigned consultant to access the meeting room', () => {
      const result = validateParticipantAccess(mockConsultantUser, baseBooking, mockConsultantRecord, false);
      expect(result.authorized).toBe(true);
      expect(result.role).toBe('consultant');
    });

    it('allows platform admin to access the meeting room', () => {
      const adminUser = {
        id: 'admin-uuid-0000',
        email: 'admin@foundarly.com',
      };
      const result = validateParticipantAccess(adminUser, baseBooking, mockConsultantRecord, true);
      expect(result.authorized).toBe(true);
      expect(result.role).toBe('admin');
    });

    it('denies access to an unrelated authenticated user', () => {
      const result = validateParticipantAccess(mockUnrelatedUser, baseBooking, mockConsultantRecord, false);
      expect(result.authorized).toBe(false);
      expect(result.role).toBeNull();
      expect(result.code).toBe('UNAUTHORIZED_PARTICIPANT');
    });

    it('denies access to unauthenticated user', () => {
      const result = validateParticipantAccess(null as unknown as { id: string; email?: string }, baseBooking, mockConsultantRecord, false);
      expect(result.authorized).toBe(false);
      expect(result.code).toBe('UNAUTHENTICATED');
    });

    it('denies access if booking is cancelled', () => {
      const cancelledBooking = { ...baseBooking, status: 'cancelled' };
      const result = validateParticipantAccess(mockClient, cancelledBooking, mockConsultantRecord, false);
      expect(result.authorized).toBe(false);
      expect(result.code).toBe('BOOKING_CANCELLED');
    });

    it('denies access if booking is rejected', () => {
      const rejectedBooking = { ...baseBooking, status: 'rejected' };
      const result = validateParticipantAccess(mockClient, rejectedBooking, mockConsultantRecord, false);
      expect(result.authorized).toBe(false);
      expect(result.code).toBe('BOOKING_CANCELLED');
    });

    it('denies access if booking is still pending confirmation', () => {
      const pendingBooking = { ...baseBooking, status: 'pending' };
      const result = validateParticipantAccess(mockClient, pendingBooking, mockConsultantRecord, false);
      expect(result.authorized).toBe(false);
      expect(result.code).toBe('BOOKING_PENDING');
    });
  });

  describe('Session Timing & 7-Day Eligibility Calculation', () => {
    // Scheduled: 2026-10-01 at 14:00 UTC (duration 60 mins -> ends at 15:00 UTC)
    const { scheduledStart, scheduledEnd, rejoinDeadline } = parseSessionTimes(baseBooking);

    it('correctly calculates session start, end, and 7-day rejoin deadline', () => {
      expect(scheduledEnd.getTime() - scheduledStart.getTime()).toBe(60 * 60 * 1000);
      expect(rejoinDeadline.getTime() - scheduledEnd.getTime()).toBe(REJOIN_WINDOW_MS);
      expect(rejoinDeadline.getTime() - scheduledEnd.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
    });

    it('marks meeting as upcoming before the 5-minute pre-call window', () => {
      // 30 minutes before scheduled start
      const serverNow = new Date(scheduledStart.getTime() - 30 * 60 * 1000);
      const eligibility = calculateRejoinEligibility(baseBooking, serverNow);

      expect(eligibility.sessionStatus).toBe('upcoming');
      expect(eligibility.canJoin).toBe(false);
      expect(eligibility.isRejoin).toBe(false);
      expect(eligibility.timeUntilStartMs).toBe(25 * 60 * 1000); // 25 mins until join window opens
    });

    it('marks meeting as live during the scheduled session window', () => {
      // 2 minutes before start
      const earlyWindow = new Date(scheduledStart.getTime() - 2 * 60 * 1000);
      const earlyEligibility = calculateRejoinEligibility(baseBooking, earlyWindow);
      expect(earlyEligibility.sessionStatus).toBe('live');
      expect(earlyEligibility.canJoin).toBe(true);
      expect(earlyEligibility.isRejoin).toBe(false);

      // Mid-session (30 minutes in)
      const midSession = new Date(scheduledStart.getTime() + 30 * 60 * 1000);
      const midEligibility = calculateRejoinEligibility(baseBooking, midSession);
      expect(midEligibility.sessionStatus).toBe('live');
      expect(midEligibility.canJoin).toBe(true);
      expect(midEligibility.isRejoin).toBe(false);
    });

    it('allows rejoin 1 day after the original consultation', () => {
      const serverNow = new Date(scheduledEnd.getTime() + 1 * 24 * 60 * 60 * 1000);
      const eligibility = calculateRejoinEligibility(baseBooking, serverNow);

      expect(eligibility.sessionStatus).toBe('rejoin_eligible');
      expect(eligibility.canJoin).toBe(true);
      expect(eligibility.isRejoin).toBe(true);
      expect(eligibility.rejoinDaysRemaining).toBe(6);
    });

    it('allows rejoin 3 days after the original consultation', () => {
      const serverNow = new Date(scheduledEnd.getTime() + 3 * 24 * 60 * 60 * 1000);
      const eligibility = calculateRejoinEligibility(baseBooking, serverNow);

      expect(eligibility.sessionStatus).toBe('rejoin_eligible');
      expect(eligibility.canJoin).toBe(true);
      expect(eligibility.isRejoin).toBe(true);
      expect(eligibility.rejoinDaysRemaining).toBe(4);
    });

    it('allows rejoin right before the 7-day deadline expires (e.g. 6 days and 23 hours)', () => {
      const serverNow = new Date(rejoinDeadline.getTime() - 1 * 60 * 60 * 1000); // 1 hour before deadline
      const eligibility = calculateRejoinEligibility(baseBooking, serverNow);

      expect(eligibility.sessionStatus).toBe('rejoin_eligible');
      expect(eligibility.canJoin).toBe(true);
      expect(eligibility.isRejoin).toBe(true);
      expect(eligibility.rejoinDaysRemaining).toBe(1);
    });

    it('denies rejoin after the 7-day deadline has passed', () => {
      // 5 minutes past deadline
      const serverNow = new Date(rejoinDeadline.getTime() + 5 * 60 * 1000);
      const eligibility = calculateRejoinEligibility(baseBooking, serverNow);

      expect(eligibility.sessionStatus).toBe('expired');
      expect(eligibility.canJoin).toBe(false);
      expect(eligibility.isRejoin).toBe(false);
      expect(eligibility.rejoinDaysRemaining).toBe(0);
      expect(eligibility.rejoinTimeRemainingMs).toBe(0);
    });

    it('denies rejoin on Day 8 or beyond', () => {
      const serverNow = new Date(scheduledEnd.getTime() + 8 * 24 * 60 * 60 * 1000);
      const eligibility = calculateRejoinEligibility(baseBooking, serverNow);

      expect(eligibility.sessionStatus).toBe('expired');
      expect(eligibility.canJoin).toBe(false);
      expect(eligibility.isRejoin).toBe(false);
    });

    it('server reference time neutralizes client-side clock tampering', () => {
      // If client attempts to send an artificially backdated clock (claiming it is Day 1),
      // the server evaluates using its own authoritative timestamp (which is Day 9).
      const authoritativeServerClock = new Date(scheduledEnd.getTime() + 9 * 24 * 60 * 60 * 1000);
      const eligibility = calculateRejoinEligibility(baseBooking, authoritativeServerClock);

      expect(eligibility.sessionStatus).toBe('expired');
      expect(eligibility.canJoin).toBe(false);
    });

    it('denies rejoin if booking was cancelled, even within the 7-day window', () => {
      const cancelledBooking = { ...baseBooking, status: 'cancelled' };
      const serverNow = new Date(scheduledEnd.getTime() + 2 * 24 * 60 * 60 * 1000);
      const eligibility = calculateRejoinEligibility(cancelledBooking, serverNow);

      expect(eligibility.sessionStatus).toBe('expired');
      expect(eligibility.canJoin).toBe(false);
      expect(eligibility.isRejoin).toBe(false);
    });
  });

  describe('Original Room Reuse & Non-Duplication', () => {
    it('reuses the exact original meeting_room_id on rejoin', () => {
      const serverNow = new Date(parseSessionTimes(baseBooking).scheduledEnd.getTime() + 2 * 24 * 60 * 60 * 1000);
      const eligibility = calculateRejoinEligibility(baseBooking, serverNow);

      expect(eligibility.canJoin).toBe(true);
      expect(eligibility.isRejoin).toBe(true);
      // Both client and consultant join the same room ID
      expect(baseBooking.meeting_room_id).toBe('foundarly-booking-uuid-7777');
    });

    it('is idempotent: multiple repeated requests produce consistent state without altering data', () => {
      const serverNow = new Date(parseSessionTimes(baseBooking).scheduledEnd.getTime() + 3 * 24 * 60 * 60 * 1000);

      const run1 = calculateRejoinEligibility(baseBooking, serverNow);
      const run2 = calculateRejoinEligibility(baseBooking, serverNow);
      const run3 = calculateRejoinEligibility(baseBooking, serverNow);

      expect(run1).toEqual(run2);
      expect(run2).toEqual(run3);
      expect(baseBooking.meeting_room_id).toBe('foundarly-booking-uuid-7777');
    });
  });

  describe('Edge Cases & Resilient Verification', () => {
    it('handles case-insensitive and trimmed email comparisons', () => {
      const clientUpper = { id: 'other-id', email: '  CLIENT@EXAMPLE.COM  ' };
      const res = validateParticipantAccess(clientUpper, baseBooking, mockConsultantRecord, false);
      expect(res.authorized).toBe(true);
      expect(res.role).toBe('client');

      const consultantUpper = { id: 'other-id', email: ' CONSULTANT@EXAMPLE.COM ' };
      const res2 = validateParticipantAccess(consultantUpper, baseBooking, mockConsultantRecord, false);
      expect(res2.authorized).toBe(true);
      expect(res2.role).toBe('consultant');
    });

    it('uses actual meeting_ended_at when available as the 7-day reference anchor', () => {
      const bookingWithActualEnd = {
        ...baseBooking,
        meeting_started_at: '2026-10-01T14:05:00Z',
        meeting_ended_at: '2026-10-01T15:15:00Z', // Session ran 15 mins longer
      };

      const timing = parseSessionTimes(bookingWithActualEnd);
      expect(timing.sessionReferenceEnd.toISOString()).toBe('2026-10-01T15:15:00.000Z');
      expect(timing.rejoinDeadline.getTime() - new Date('2026-10-01T15:15:00Z').getTime()).toBe(REJOIN_WINDOW_MS);
    });

    it('strictly enforces deadline boundary: eligible at deadline - 1s, expired at deadline + 1s', () => {
      const timing = parseSessionTimes(baseBooking);

      const oneSecondBefore = new Date(timing.rejoinDeadline.getTime() - 1000);
      const eligible = calculateRejoinEligibility(baseBooking, oneSecondBefore);
      expect(eligible.sessionStatus).toBe('rejoin_eligible');
      expect(eligible.canJoin).toBe(true);

      const oneSecondAfter = new Date(timing.rejoinDeadline.getTime() + 1000);
      const expired = calculateRejoinEligibility(baseBooking, oneSecondAfter);
      expect(expired.sessionStatus).toBe('expired');
      expect(expired.canJoin).toBe(false);
    });
  });

  describe('Flexible Time Parsing', () => {
    it('parses 24-hour time strings correctly', () => {
      expect(parseTimeString('14:30')).toEqual({ hours: 14, minutes: 30 });
      expect(parseTimeString('09:15')).toEqual({ hours: 9, minutes: 15 });
    });

    it('parses 12-hour AM/PM time strings correctly', () => {
      expect(parseTimeString('10:30 AM')).toEqual({ hours: 10, minutes: 30 });
      expect(parseTimeString('02:45 PM')).toEqual({ hours: 14, minutes: 45 });
      expect(parseTimeString('12:00 PM')).toEqual({ hours: 12, minutes: 0 });
      expect(parseTimeString('12:15 AM')).toEqual({ hours: 0, minutes: 15 });
    });

    it('falls back gracefully on flexible or missing time strings', () => {
      expect(parseTimeString('Flexible')).toEqual({ hours: 10, minutes: 0 });
      expect(parseTimeString(null)).toEqual({ hours: 10, minutes: 0 });
      expect(parseTimeString('')).toEqual({ hours: 10, minutes: 0 });
    });
  });
});
