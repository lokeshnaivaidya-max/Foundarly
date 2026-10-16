import { describe, it, expect, vi } from 'vitest';
import {
  calculateRejoinEligibility,
  validateParticipantAccess,
  parseSessionTimes,
  REJOIN_WINDOW_MS,
  EARLY_JOIN_WINDOW_MS,
} from '@/utils/meetingRejoin';

describe('Meeting Access & Session Resolution Verification', () => {
  const mockBooking = {
    id: 'b1234567-89ab-cdef-0123-456789abcdef',
    user_id: 'user_client_111',
    email: 'client@example.com',
    consultant_id: 'consultant_record_222',
    status: 'confirmed',
    payment_status: 'paid',
    date: '2026-10-15',
    time: '14:00',
    session_duration: 60,
    meeting_room_id: 'foundarly-b1234567-89ab-cdef-0123-456789abcdef',
  };

  const mockConsultant = {
    id: 'consultant_record_222',
    user_id: 'user_consultant_999',
    email: 'consultant@foundarly.com',
  };

  describe('Participant Access Control', () => {
    it('authorizes the client by matching user_id', () => {
      const auth = validateParticipantAccess(
        { id: 'user_client_111', email: 'any@email.com' },
        mockBooking,
        mockConsultant,
        false
      );
      expect(auth.authorized).toBe(true);
      expect(auth.role).toBe('client');
    });

    it('authorizes the client by matching booking email when user_id differs or is null', () => {
      const auth = validateParticipantAccess(
        { id: 'different_id', email: 'client@example.com' },
        mockBooking,
        mockConsultant,
        false
      );
      expect(auth.authorized).toBe(true);
      expect(auth.role).toBe('client');
    });

    it('authorizes the assigned consultant by matching consultant user_id', () => {
      const auth = validateParticipantAccess(
        { id: 'user_consultant_999', email: 'consultant@foundarly.com' },
        mockBooking,
        mockConsultant,
        false
      );
      expect(auth.authorized).toBe(true);
      expect(auth.role).toBe('consultant');
    });

    it('authorizes the assigned consultant by matching consultant email', () => {
      const auth = validateParticipantAccess(
        { id: 'unlinked_user_id', email: 'consultant@foundarly.com' },
        mockBooking,
        mockConsultant,
        false
      );
      expect(auth.authorized).toBe(true);
      expect(auth.role).toBe('consultant');
    });

    it('authorizes the assigned consultant by direct booking.consultant_id matching user id', () => {
      const directBooking = {
        ...mockBooking,
        consultant_id: 'user_consultant_999',
      };
      const auth = validateParticipantAccess(
        { id: 'user_consultant_999', email: 'other@foundarly.com' },
        directBooking,
        null,
        false
      );
      expect(auth.authorized).toBe(true);
      expect(auth.role).toBe('consultant');
    });

    it('authorizes platform admin regardless of booking participant ids', () => {
      const auth = validateParticipantAccess(
        { id: 'admin_user_000', email: 'admin@foundarly.com' },
        mockBooking,
        mockConsultant,
        true
      );
      expect(auth.authorized).toBe(true);
      expect(auth.role).toBe('admin');
    });

    it('rejects an unrelated third-party user', () => {
      const auth = validateParticipantAccess(
        { id: 'stranger_user_444', email: 'stranger@gmail.com' },
        mockBooking,
        mockConsultant,
        false
      );
      expect(auth.authorized).toBe(false);
      expect(auth.code).toBe('UNAUTHORIZED_PARTICIPANT');
    });

    it('rejects unauthenticated user', () => {
      const auth = validateParticipantAccess(
        null as any,
        mockBooking,
        mockConsultant,
        false
      );
      expect(auth.authorized).toBe(false);
      expect(auth.code).toBe('UNAUTHENTICATED');
    });

    it('rejects cancelled bookings', () => {
      const cancelledBooking = { ...mockBooking, status: 'cancelled' };
      const auth = validateParticipantAccess(
        { id: 'user_client_111', email: 'client@example.com' },
        cancelledBooking,
        mockConsultant,
        false
      );
      expect(auth.authorized).toBe(false);
      expect(auth.code).toBe('BOOKING_CANCELLED');
    });

    it('rejects pending unverified bookings', () => {
      const pendingBooking = { ...mockBooking, status: 'pending' };
      const auth = validateParticipantAccess(
        { id: 'user_client_111', email: 'client@example.com' },
        pendingBooking,
        mockConsultant,
        false
      );
      expect(auth.authorized).toBe(false);
      expect(auth.code).toBe('BOOKING_PENDING');
    });
  });

  describe('7-Day Rejoin Lifecycle', () => {
    it('marks session as live during scheduled session window', () => {
      const timing = parseSessionTimes(mockBooking);
      // Scheduled start + 10 minutes
      const liveTime = new Date(timing.scheduledStart.getTime() + 10 * 60 * 1000);
      const eligibility = calculateRejoinEligibility(mockBooking, liveTime);

      expect(eligibility.sessionStatus).toBe('live');
      expect(eligibility.canJoin).toBe(true);
      expect(eligibility.isRejoin).toBe(false);
    });

    it('allows 7-day follow-up rejoin after the session ends', () => {
      const timing = parseSessionTimes(mockBooking);
      // 3 days after session end
      const threeDaysLater = new Date(timing.scheduledEnd.getTime() + 3 * 24 * 60 * 60 * 1000);
      const eligibility = calculateRejoinEligibility(mockBooking, threeDaysLater);

      expect(eligibility.sessionStatus).toBe('rejoin_eligible');
      expect(eligibility.canJoin).toBe(true);
      expect(eligibility.isRejoin).toBe(true);
      expect(eligibility.rejoinDaysRemaining).toBeGreaterThanOrEqual(1);
      expect(eligibility.rejoinDaysRemaining).toBeLessThanOrEqual(4);
    });

    it('expires after 7 days', () => {
      const timing = parseSessionTimes(mockBooking);
      // 7 days and 1 hour after session end
      const expiredTime = new Date(timing.scheduledEnd.getTime() + 7 * 24 * 60 * 60 * 1000 + 3600000);
      const eligibility = calculateRejoinEligibility(mockBooking, expiredTime);

      expect(eligibility.sessionStatus).toBe('expired');
      expect(eligibility.canJoin).toBe(false);
      expect(eligibility.isRejoin).toBe(false);
    });
  });

  describe('Room ID Normalization and Fallback Generation', () => {
    function normalizeRoomId(raw: string): string {
      let clean = (raw || '').trim();
      if (clean.includes('/meeting/')) {
        clean = clean.split('/meeting/').pop() || clean;
      }
      return clean.split('?')[0].split('#')[0].replace(/\/+$/, '').trim();
    }

    it('normalizes full URLs to extract room ID', () => {
      expect(normalizeRoomId('https://foundarlybusinessworld.in/meeting/foundarly-12345')).toBe('foundarly-12345');
      expect(normalizeRoomId('http://localhost:3000/meeting/foundarly-uuid-777?token=abc')).toBe('foundarly-uuid-777');
      expect(normalizeRoomId('/meeting/foundarly-abc123/')).toBe('foundarly-abc123');
      expect(normalizeRoomId('foundarly-abc123#chat')).toBe('foundarly-abc123');
    });

    it('derives canonical effectiveRoomId when meeting_room_id is null in database', () => {
      const bookingWithoutRoomId = {
        id: '12345678-1234-1234-1234-123456789abc',
        meeting_room_id: null,
      };

      const effectiveRoomId = bookingWithoutRoomId.meeting_room_id ||
        (bookingWithoutRoomId.id ? (bookingWithoutRoomId.id.startsWith('foundarly-') ? bookingWithoutRoomId.id : `foundarly-${bookingWithoutRoomId.id}`) : null);

      expect(effectiveRoomId).toBe('foundarly-12345678-1234-1234-1234-123456789abc');
    });
  });
});
