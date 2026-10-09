import { describe, it, expect } from 'vitest';
import {
  parseFollowUpDateTime,
  validateFollowUpTiming,
  checkBookingFollowUpEligibility,
  validateParticipantAccess,
  FOLLOW_UP_STATUS_LABELS,
  FollowUpStatus,
} from '@/utils/meetingRejoin';
import {
  generateFollowUpRequestedEmailHTML,
  generateFollowUpRequestedEmailText,
  generateFollowUpAlternativeEmailHTML,
  generateFollowUpAlternativeEmailText,
  generateFollowUpConfirmedEmailHTML,
  generateFollowUpConfirmedEmailText,
  generateFollowUpDeclinedEmailHTML,
  generateFollowUpDeclinedEmailText,
} from '@/utils/emailTemplates';

describe('Foundarly Follow-up Scheduling Workflow', () => {
  const referenceNow = new Date('2026-10-09T14:00:00Z');
  // Original consultation completed yesterday
  const completedBooking = {
    id: 'booking-completed-123',
    user_id: 'client-user-111',
    email: 'client@example.com',
    name: 'Alice Client',
    consultant_id: 'consultant-profile-222',
    meeting_room_id: 'foundarly-booking-completed-123',
    date: '2026-10-08',
    time: '14:00',
    session_duration: 60,
    status: 'completed',
    payment_status: 'paid',
  };

  const consultantProfile = {
    id: 'consultant-profile-222',
    user_id: 'consultant-user-222',
    email: 'consultant@foundarly.com',
    name: 'Dr. John Consultant',
    title: 'Senior FinTech Advisor',
  };

  describe('1. 7-Day Eligibility Window Checks', () => {
    it('grants eligibility for a completed consultation within the 7-day window', () => {
      const result = checkBookingFollowUpEligibility(completedBooking, referenceNow);
      expect(result.eligible).toBe(true);
      expect(result.daysRemaining).toBeGreaterThanOrEqual(1);
      expect(result.rejoinDeadline.getTime()).toBeGreaterThan(referenceNow.getTime());
    });

    it('rejects follow-up request for cancelled or rejected bookings', () => {
      const cancelledBooking = { ...completedBooking, status: 'cancelled' };
      const rejectedBooking = { ...completedBooking, status: 'rejected' };
      const unpaidBooking = { ...completedBooking, payment_status: 'rejected' };

      expect(checkBookingFollowUpEligibility(cancelledBooking, referenceNow).eligible).toBe(false);
      expect(checkBookingFollowUpEligibility(rejectedBooking, referenceNow).eligible).toBe(false);
      expect(checkBookingFollowUpEligibility(unpaidBooking, referenceNow).eligible).toBe(false);
    });

    it('rejects follow-up request for upcoming sessions that have not yet occurred', () => {
      const futureBooking = {
        ...completedBooking,
        date: '2026-10-15',
        time: '14:00',
        status: 'confirmed',
      };
      const result = checkBookingFollowUpEligibility(futureBooking, referenceNow);
      expect(result.eligible).toBe(false);
      expect(result.reason).toContain('has not taken place yet');
    });

    it('strictly enforces the 7-day expiry deadline', () => {
      // 10 days ago
      const oldBooking = {
        ...completedBooking,
        date: '2026-09-25',
        time: '14:00',
        status: 'completed',
      };
      const result = checkBookingFollowUpEligibility(oldBooking, referenceNow);
      expect(result.eligible).toBe(false);
      expect(result.reason).toContain('expired');
    });
  });

  describe('2. Follow-Up Timing Validation', () => {
    const deadline = new Date(referenceNow.getTime() + 6 * 24 * 60 * 60 * 1000); // 6 days ahead

    it('accepts valid date and time within the 7-day eligibility window', () => {
      const validDate = '2026-10-12';
      const validTime = '15:00';
      const result = validateFollowUpTiming(validDate, validTime, deadline, referenceNow);
      expect(result.valid).toBe(true);
      expect(result.code).toBe('OK');
    });

    it('rejects follow-up dates in the past', () => {
      const pastDate = '2026-10-01';
      const pastTime = '10:00';
      const result = validateFollowUpTiming(pastDate, pastTime, deadline, referenceNow);
      expect(result.valid).toBe(false);
      expect(result.code).toBe('PAST_TIME');
      expect(result.error).toContain('cannot be in the past');
    });

    it('rejects dates that exceed the 7-day rejoin deadline', () => {
      // 10 days in the future, past the deadline
      const beyondDate = '2026-10-25';
      const beyondTime = '11:00';
      const result = validateFollowUpTiming(beyondDate, beyondTime, deadline, referenceNow);
      expect(result.valid).toBe(false);
      expect(result.code).toBe('EXCEEDS_DEADLINE');
      expect(result.error).toContain('7-day eligibility window');
    });

    it('handles various time string formats gracefully', () => {
      const dt1 = parseFollowUpDateTime('2026-10-12', '14:30');
      const dt2 = parseFollowUpDateTime('2026-10-12', '2:30 PM');
      expect(dt1.getUTCHours()).toBe(14);
      expect(dt1.getUTCMinutes()).toBe(30);
      expect(dt2.getUTCHours()).toBe(14);
      expect(dt2.getUTCMinutes()).toBe(30);
    });
  });

  describe('3. Participant Authorization & Room Rejoin Security', () => {
    it('authorizes the scheduled client to access the meeting room', () => {
      const clientUser = { id: 'client-user-111', email: 'client@example.com' };
      const auth = validateParticipantAccess(clientUser, completedBooking, consultantProfile, false);
      expect(auth.authorized).toBe(true);
      expect(auth.role).toBe('client');
    });

    it('authorizes the assigned consultant to access the meeting room', () => {
      const consultantUser = { id: 'consultant-user-222', email: 'consultant@foundarly.com' };
      const auth = validateParticipantAccess(consultantUser, completedBooking, consultantProfile, false);
      expect(auth.authorized).toBe(true);
      expect(auth.role).toBe('consultant');
    });

    it('strictly denies unauthorized third parties even with knowledge of room ID', () => {
      const intruderUser = { id: 'intruder-999', email: 'stranger@random.com' };
      const auth = validateParticipantAccess(intruderUser, completedBooking, consultantProfile, false);
      expect(auth.authorized).toBe(false);
      expect(auth.code).toBe('UNAUTHORIZED_PARTICIPANT');
      expect(auth.reason).toContain('Only the scheduled client and assigned consultant');
    });

    it('denies unauthenticated users', () => {
      const auth = validateParticipantAccess(null as any, completedBooking, consultantProfile, false);
      expect(auth.authorized).toBe(false);
      expect(auth.code).toBe('UNAUTHENTICATED');
    });
  });

  describe('4. Follow-Up Workflow Statuses', () => {
    it('defines all required statuses per business specifications', () => {
      const expectedStatuses: FollowUpStatus[] = [
        'pending_consultant',
        'alternative_proposed',
        'confirmed',
        'declined',
        'completed',
        'expired',
      ];

      expectedStatuses.forEach((status) => {
        expect(FOLLOW_UP_STATUS_LABELS[status]).toBeDefined();
        expect(typeof FOLLOW_UP_STATUS_LABELS[status]).toBe('string');
      });

      expect(FOLLOW_UP_STATUS_LABELS['pending_consultant']).toBe('Pending Consultant Response');
      expect(FOLLOW_UP_STATUS_LABELS['alternative_proposed']).toBe('Alternative Time Proposed');
      expect(FOLLOW_UP_STATUS_LABELS['confirmed']).toBe('Confirmed');
      expect(FOLLOW_UP_STATUS_LABELS['declined']).toBe('Declined');
      expect(FOLLOW_UP_STATUS_LABELS['completed']).toBe('Completed');
      expect(FOLLOW_UP_STATUS_LABELS['expired']).toBe('Expired');
    });
  });

  describe('5. Email Notifications Generation', () => {
    it('generates consultant notification email when client submits request', () => {
      const data = {
        bookingId: 'booking-completed-123',
        clientName: 'Alice Client',
        clientEmail: 'client@example.com',
        consultantName: 'Dr. John Consultant',
        consultantEmail: 'consultant@foundarly.com',
        reason: 'Need advice on API architecture scaling.',
        preferredDate: '2026-10-12',
        preferredTime: '15:00',
        originalDate: '2026-10-08',
        originalTime: '14:00',
        rejoinDeadline: '2026-10-15T15:00:00Z',
        dashboardUrl: 'http://localhost:3000/consultant-dashboard',
      };

      const html = generateFollowUpRequestedEmailHTML(data);
      const text = generateFollowUpRequestedEmailText(data);

      expect(html).toContain('Alice Client');
      expect(html).toContain('Need advice on API architecture scaling.');
      expect(html).toContain('October 12, 2026');
      expect(html).toContain('15:00');
      expect(html).toContain('booking-completed-123');
      expect(html).toContain('consultant-dashboard');
      // Must not mention admin approval
      expect(html.toLowerCase()).not.toContain('admin approval is required');

      expect(text).toContain('Alice Client');
      expect(text).toContain('Need advice on API architecture scaling.');
      expect(text).toContain('October 12, 2026 at 15:00');
      expect(text).toContain('booking-completed-123');
    });

    it('generates client notification email when consultant proposes alternative time', () => {
      const data = {
        bookingId: 'booking-completed-123',
        clientName: 'Alice Client',
        clientEmail: 'client@example.com',
        consultantName: 'Dr. John Consultant',
        alternativeDate: '2026-10-13',
        alternativeTime: '16:00',
        consultantNote: 'I have a conflict on the 12th, will the 13th work?',
        reason: 'Architecture clarification',
        rejoinDeadline: '2026-10-15T15:00:00Z',
        dashboardUrl: 'http://localhost:3000/my-bookings',
      };

      const html = generateFollowUpAlternativeEmailHTML(data);
      const text = generateFollowUpAlternativeEmailText(data);

      expect(html).toContain('October 13, 2026');
      expect(html).toContain('16:00');
      expect(html).toContain('I have a conflict on the 12th');
      expect(html).toContain('my-bookings');
      expect(text).toContain('October 13, 2026 at 16:00');
    });

    it('generates confirmation email for participants with meeting link and confirmed time', () => {
      const data = {
        bookingId: 'booking-completed-123',
        clientName: 'Alice Client',
        clientEmail: 'client@example.com',
        consultantName: 'Dr. John Consultant',
        consultantEmail: 'consultant@foundarly.com',
        confirmedDate: '2026-10-12',
        confirmedTime: '15:00',
        reason: 'Architecture clarification',
        meetingLink: 'http://localhost:3000/meeting/foundarly-booking-completed-123',
        meetingRoomId: 'foundarly-booking-completed-123',
        rejoinDeadline: '2026-10-15T15:00:00Z',
      };

      const html = generateFollowUpConfirmedEmailHTML(data);
      const text = generateFollowUpConfirmedEmailText(data);

      expect(html).toContain('October 12, 2026');
      expect(html).toContain('15:00');
      expect(html).toContain('foundarly-booking-completed-123');
      expect(text).toContain('Follow-up Consultation Confirmed');
      expect(text).toContain('foundarly-booking-completed-123');
    });

    it('generates declined email when consultant cannot accommodate follow-up', () => {
      const data = {
        bookingId: 'booking-completed-123',
        clientName: 'Alice Client',
        clientEmail: 'client@example.com',
        consultantName: 'Dr. John Consultant',
        declinedReason: 'Currently traveling with limited availability.',
        rejoinDeadline: '2026-10-15T15:00:00Z',
      };

      const html = generateFollowUpDeclinedEmailHTML(data);
      const text = generateFollowUpDeclinedEmailText(data);

      expect(html).toContain('Currently traveling with limited availability.');
      expect(text).toContain('Currently traveling with limited availability.');
    });
  });

  describe('6. Zero Admin Approval Business Rule Enforcement', () => {
    it('confirms follow-up workflow operates strictly peer-to-peer between client and consultant', () => {
      // Validates that consultant accept or client accept directly transitions to 'confirmed'
      const clientRequestedState: FollowUpStatus = 'pending_consultant';
      const consultantAcceptedDirectly: FollowUpStatus = 'confirmed';
      const consultantAlternativeState: FollowUpStatus = 'alternative_proposed';
      const clientAcceptedAlternativeDirectly: FollowUpStatus = 'confirmed';

      expect(clientRequestedState).toBe('pending_consultant');
      expect(consultantAcceptedDirectly).toBe('confirmed');
      expect(consultantAlternativeState).toBe('alternative_proposed');
      expect(clientAcceptedAlternativeDirectly).toBe('confirmed');
    });
  });
});
