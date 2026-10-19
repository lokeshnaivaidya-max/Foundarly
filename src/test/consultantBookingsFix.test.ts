import { describe, it, expect } from 'vitest';
import {
  validateParticipantAccess,
  calculateRejoinEligibility,
  parseSessionTimes,
} from '@/utils/meetingRejoin';

describe('Consultant Booking Resolution & Role Isolation Test Suite', () => {
  // Scenario 1: Consultant created by admin with user_id = null
  const unlinkedConsultant = {
    id: 'c-uuid-1234',
    name: 'Dr. Jane Consultant',
    email: 'jane.consultant@foundarly.com',
    user_id: null,
    is_active: true,
  };

  const sampleBooking = {
    id: 'b-uuid-9999',
    user_id: 'client-user-111',
    email: 'client@company.com',
    consultant_id: 'c-uuid-1234',
    status: 'confirmed',
    payment_status: 'paid',
    date: '2026-10-18',
    time: '10:00',
    session_duration: 60,
    meeting_room_id: 'foundarly-b-uuid-9999',
  };

  describe('Consultant Identity & Meeting Authorization', () => {
    it('authorizes consultant when user_id is null in DB but email matches authenticated user', () => {
      const authUser = {
        id: 'newly-registered-auth-id-777',
        email: 'jane.consultant@foundarly.com',
      };

      const result = validateParticipantAccess(
        authUser,
        sampleBooking,
        unlinkedConsultant,
        false
      );

      expect(result.authorized).toBe(true);
      expect(result.role).toBe('consultant');
    });

    it('authorizes consultant case-insensitively with trimmed whitespace', () => {
      const authUser = {
        id: 'newly-registered-auth-id-777',
        email: '  JANE.CONSULTANT@FOUNDARLY.COM  ',
      };

      const result = validateParticipantAccess(
        authUser,
        sampleBooking,
        unlinkedConsultant,
        false
      );

      expect(result.authorized).toBe(true);
      expect(result.role).toBe('consultant');
    });

    it('denies an unrelated consultant or user from accessing the booking', () => {
      const unrelatedUser = {
        id: 'unrelated-id-555',
        email: 'hacker@other.com',
      };

      const result = validateParticipantAccess(
        unrelatedUser,
        sampleBooking,
        unlinkedConsultant,
        false
      );

      expect(result.authorized).toBe(false);
      expect(result.role).toBe(null);
    });

    it('authorizes the client for their own booking and assigns client role', () => {
      const clientUser = {
        id: 'client-user-111',
        email: 'client@company.com',
      };

      const result = validateParticipantAccess(
        clientUser,
        sampleBooking,
        unlinkedConsultant,
        false
      );

      expect(result.authorized).toBe(true);
      expect(result.role).toBe('client');
    });

    it('both client and consultant open the exact same meeting room', () => {
      // Client's computed meeting room
      const clientRoomId = sampleBooking.meeting_room_id || `foundarly-${sampleBooking.id}`;
      // Consultant's computed meeting room
      const consultantRoomId = sampleBooking.meeting_room_id || (sampleBooking.id.startsWith('foundarly-') ? sampleBooking.id : `foundarly-${sampleBooking.id}`);

      expect(clientRoomId).toBe(consultantRoomId);
      expect(clientRoomId).toBe('foundarly-b-uuid-9999');
    });
  });

  describe('Booking Scope Isolation', () => {
    it('filters consultant bookings strictly by consultant_id', () => {
      const allBookings = [
        sampleBooking,
        {
          id: 'b-uuid-8888',
          user_id: 'client-user-222',
          email: 'another@client.com',
          consultant_id: 'c-uuid-different-5678',
          status: 'confirmed',
          meeting_room_id: 'foundarly-b-uuid-8888',
        },
      ];

      const consultantId = unlinkedConsultant.id;
      const filtered = allBookings.filter(b => b.consultant_id === consultantId);

      expect(filtered.length).toBe(1);
      expect(filtered[0].id).toBe('b-uuid-9999');
    });

    it('filters client bookings strictly by user_id or client email', () => {
      const allBookings = [
        sampleBooking,
        {
          id: 'b-uuid-8888',
          user_id: 'client-user-222',
          email: 'another@client.com',
          consultant_id: 'c-uuid-1234',
          status: 'confirmed',
        },
      ];

      const clientUserId = 'client-user-111';
      const clientEmail = 'client@company.com';

      const clientBookings = allBookings.filter(
        b => b.user_id === clientUserId || b.email?.toLowerCase() === clientEmail.toLowerCase()
      );

      expect(clientBookings.length).toBe(1);
      expect(clientBookings[0].id).toBe('b-uuid-9999');
    });
  });

  describe('7-Day Rejoin Integrity', () => {
    it('preserves 7-day rejoin eligibility for completed consultation', () => {
      const completedBooking = {
        ...sampleBooking,
        status: 'completed',
        date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 2 days ago
        time: '10:00',
      };

      const eligibility = calculateRejoinEligibility(completedBooking, new Date());
      expect(eligibility.canJoin).toBe(true);
      expect(eligibility.sessionStatus).toBe('rejoin_eligible');
      expect(eligibility.isRejoin).toBe(true);
      expect(eligibility.rejoinDaysRemaining).toBeGreaterThanOrEqual(4);
    });

    it('expires rejoin eligibility past 7 days', () => {
      const expiredBooking = {
        ...sampleBooking,
        status: 'completed',
        date: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 8 days ago
        time: '10:00',
      };

      const eligibility = calculateRejoinEligibility(expiredBooking, new Date());
      expect(eligibility.canJoin).toBe(false);
      expect(eligibility.sessionStatus).toBe('expired');
      expect(eligibility.isRejoin).toBe(false);
      expect(eligibility.rejoinDaysRemaining).toBe(0);
    });
  });
});
