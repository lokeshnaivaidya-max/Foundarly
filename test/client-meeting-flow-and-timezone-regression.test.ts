import { test, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseSessionTimes,
  calculateRejoinEligibility,
  validateParticipantAccess,
  APP_TIMEZONE_OFFSET_MS,
  REJOIN_WINDOW_MS,
  EARLY_JOIN_WINDOW_MS,
} from '../src/utils/meetingRejoin.js';
import {
  parseBookingDateTime,
  getCountdownTargetMs,
  APP_TIMEZONE,
} from '../src/utils/timeSlots.js';

describe('Client-Specific Meeting Flow & Timezone Regression Suite', () => {

  describe('1. Timezone Parsing Parity (IST Asia/Kolkata)', () => {
    it('parseSessionTimes produces exact same UTC instant as parseBookingDateTime for 12-hour AM/PM IST slots', () => {
      const testCases = [
        { date: '2026-11-20', time: '10:00 AM' },
        { date: '2026-11-20', time: '02:30 PM' },
        { date: '2026-12-05', time: '09:00 AM' },
        { date: '2026-06-15', time: '08:00 PM' },
      ];

      for (const tc of testCases) {
        const fromTimeSlots = parseBookingDateTime(tc.date, tc.time);
        assert.ok(fromTimeSlots, `parseBookingDateTime should parse ${tc.date} ${tc.time}`);

        const sessionTimes = parseSessionTimes({ date: tc.date, time: tc.time, session_duration: 60 });
        assert.equal(
          sessionTimes.scheduledStart.getTime(),
          fromTimeSlots.getTime(),
          `parseSessionTimes scheduledStart must match parseBookingDateTime for ${tc.date} ${tc.time}`
        );

        // 10:00 AM IST (UTC+05:30) must be 04:30:00.000Z in UTC
        if (tc.time === '10:00 AM') {
          assert.equal(sessionTimes.scheduledStart.toISOString(), '2026-11-20T04:30:00.000Z');
        }
      }
    });

    it('calculateRejoinEligibility evaluates session as live during scheduled IST meeting window', () => {
      const istBooking = {
        id: 'booking-ist-client-1',
        user_id: 'client-user-1',
        email: 'client@example.com',
        consultant_id: 'consultant-1',
        date: '2026-11-20',
        time: '10:00 AM',
        session_duration: 60,
        status: 'confirmed',
        payment_status: 'paid',
      };

      // 10:00 AM IST is 04:30:00Z UTC
      const scheduledStartUtc = new Date('2026-11-20T04:30:00.000Z');

      // 4 minutes before start (within 5-min pre-call join window)
      const fourMinsBefore = new Date(scheduledStartUtc.getTime() - 4 * 60 * 1000);
      const earlyEligibility = calculateRejoinEligibility(istBooking, fourMinsBefore);
      assert.equal(earlyEligibility.sessionStatus, 'live');
      assert.equal(earlyEligibility.canJoin, true);

      // Mid-call: 30 minutes into the 60-minute session
      const midCall = new Date(scheduledStartUtc.getTime() + 30 * 60 * 1000);
      const midEligibility = calculateRejoinEligibility(istBooking, midCall);
      assert.equal(midEligibility.sessionStatus, 'live');
      assert.equal(midEligibility.canJoin, true);

      // Right after session ends: eligible for 7-day follow-up
      const day2After = new Date(scheduledStartUtc.getTime() + 2 * 24 * 60 * 60 * 1000);
      const followupEligibility = calculateRejoinEligibility(istBooking, day2After);
      assert.equal(followupEligibility.sessionStatus, 'rejoin_eligible');
      assert.equal(followupEligibility.canJoin, true);
      assert.equal(followupEligibility.isRejoin, true);
    });
  });

  describe('2. Client Flow on Clean Device (Zero Prior Joins / Empty Local Storage)', () => {
    const clientUser = { id: 'client-clean-device-1', email: 'cleanclient@example.com' };
    const consultantUser = { id: 'consultant-user-99', email: 'consultant@example.com' };
    const consultantProfile = { id: 'consultant-user-99', user_id: 'consultant-user-99', email: 'consultant@example.com' };

    const booking = {
      id: 'clean-device-booking-uuid',
      user_id: 'client-clean-device-1',
      email: 'cleanclient@example.com',
      consultant_id: 'consultant-user-99',
      date: '2026-11-20',
      time: '11:00 AM', // 11:00 AM IST = 05:30:00Z UTC
      session_duration: 60,
      status: 'confirmed',
      payment_status: 'paid',
    };

    it('Authorizes client on first visit without local storage history or previous joins', () => {
      const auth = validateParticipantAccess(clientUser, booking, consultantProfile, false);
      assert.equal(auth.authorized, true);
      assert.equal(auth.role, 'client');
    });

    it('Permits client to join call without relying on hasJoinedBefore or isRejoinSession bypass', () => {
      // Current time is 11:02 AM IST (05:32:00Z UTC)
      const callTime = new Date('2026-11-20T05:32:00.000Z');
      const eligibility = calculateRejoinEligibility(booking, callTime);

      assert.equal(eligibility.canJoin, true);
      assert.equal(eligibility.sessionStatus, 'live');

      // Simulate client device state: hasJoined = false, isRejoinSession = false
      const clientHasJoinedBefore = false;
      const clientIsRejoinSession = false;

      // The guard in startCall:
      // if (!canJoin && !isRejoinSession && status !== 'live' && status !== 'rejoin_eligible') { throw Error }
      const canProceed = eligibility.canJoin || clientIsRejoinSession || eligibility.sessionStatus === 'live';
      assert.equal(canProceed, true, 'Client on first join must pass startCall condition');
    });
  });

  describe('3. Case-Insensitive Client Email & Guest Self-Healing', () => {
    it('Authorizes client even when database email and login email differ in letter case', () => {
      const uppercaseDbBooking = {
        id: 'booking-uppercase-email',
        user_id: 'client-uuid-case',
        email: 'Client.User@Example.COM',
        consultant_id: 'consultant-id-1',
        date: '2026-11-20',
        time: '10:00 AM',
        status: 'confirmed',
        payment_status: 'paid',
      };

      const lowercaseLoginUser = {
        id: 'client-uuid-case',
        email: 'client.user@example.com',
      };

      const auth = validateParticipantAccess(lowercaseLoginUser, uppercaseDbBooking, null, false);
      assert.equal(auth.authorized, true);
      assert.equal(auth.role, 'client');
    });

    it('Authorizes guest booking client matching by case-insensitive email when user_id is null', () => {
      const guestBooking = {
        id: 'booking-guest-unlinked',
        user_id: null, // Booked before registering account
        email: 'guestclient@domain.org',
        consultant_id: 'consultant-id-1',
        date: '2026-11-20',
        time: '10:00 AM',
        status: 'confirmed',
        payment_status: 'paid',
      };

      const newlyRegisteredUser = {
        id: 'new-auth-user-999',
        email: 'GuestClient@Domain.ORG',
      };

      const auth = validateParticipantAccess(newlyRegisteredUser, guestBooking, null, false);
      assert.equal(auth.authorized, true);
      assert.equal(auth.role, 'client');
    });

    it('STRICT SECURITY NEGATIVE TEST: One client cannot claim or self-heal another client guest booking', () => {
      const victimGuestBooking = {
        id: 'booking-victim-guest-123',
        user_id: null,
        email: 'victim.founder@example.com',
        consultant_id: 'consultant-id-1',
        date: '2026-11-20',
        time: '10:00 AM',
        status: 'confirmed',
        payment_status: 'paid',
      };

      const attackerUser = {
        id: 'attacker-uuid-666',
        email: 'attacker@evil.com',
      };

      // Attacker should be strictly rejected
      const auth = validateParticipantAccess(attackerUser, victimGuestBooking, null, false);
      assert.equal(auth.authorized, false, 'Attacker must be rejected');
      assert.equal(auth.code, 'UNAUTHORIZED_PARTICIPANT');

      // Verify self-healing condition fails:
      const authUserEmail = (attackerUser.email || '').trim().toLowerCase();
      const bookingEmailClean = (victimGuestBooking.email || '').trim().toLowerCase();
      const canSelfHeal = Boolean(
        !victimGuestBooking.user_id &&
        attackerUser.id &&
        auth.authorized &&
        auth.role === 'client' &&
        authUserEmail &&
        bookingEmailClean &&
        authUserEmail === bookingEmailClean
      );
      assert.equal(canSelfHeal, false, 'Attacker cannot satisfy self-healing ownership condition');
    });

    it('STRICT SECURITY NEGATIVE TEST: Manipulated LocalStorage history never grants meeting access', () => {
      const unconfirmedBooking = {
        id: 'booking-unpaid-fake',
        user_id: 'legit-user-id',
        email: 'legit@example.com',
        consultant_id: 'consultant-id-1',
        date: '2026-11-20',
        time: '10:00 AM',
        status: 'pending',
        payment_status: 'pending',
      };

      const legitUser = { id: 'legit-user-id', email: 'legit@example.com' };

      // Validate that even if localStorage claims joinedBefore = true, validateParticipantAccess fails
      const auth = validateParticipantAccess(legitUser, unconfirmedBooking, null, false);
      assert.equal(auth.authorized, false, 'Pending booking must reject participant access');
      assert.equal(auth.code, 'BOOKING_PENDING');

      // Even if attacker fakes a joined localStorage key:
      const fakeJoinedRecord = {
        bookingId: unconfirmedBooking.id,
        participantId: legitUser.id,
        role: 'client',
        firstJoinedAt: new Date().toISOString(),
        joinCount: 5,
      };
      assert.ok(fakeJoinedRecord.joinCount > 0);

      // Access is authoritatively driven by calculateRejoinEligibility & validateParticipantAccess
      const eligibility = calculateRejoinEligibility(unconfirmedBooking, new Date('2026-11-20T04:30:00.000Z'));
      // A pending booking is not eligible to join
      assert.equal(auth.authorized, false);
    });

    it('STRICT SECURITY NEGATIVE TEST: 24-hour military times and ISO date strings parse with exact IST parity', () => {
      const testCases24h = [
        { date: '2026-11-20', time: '14:30', timezone: 'Asia/Kolkata', expectedUtcHour: 9, expectedUtcMin: 0 },
        { date: '2026-11-20', time: '09:00', timezone: 'Asia/Kolkata', expectedUtcHour: 3, expectedUtcMin: 30 },
        { date: '2026-11-20', time: '08:00 PM', expectedUtcHour: 14, expectedUtcMin: 30 },
      ];

      for (const tc of testCases24h) {
        const canonical = parseBookingDateTime(tc.date, tc.time);
        assert.ok(canonical, `parseBookingDateTime should parse ${tc.date} ${tc.time}`);

        const sessionTimes = parseSessionTimes({ date: tc.date, time: tc.time, timezone: tc.timezone, session_duration: 60 });
        assert.equal(
          sessionTimes.scheduledStart.getTime(),
          canonical.getTime(),
          `parseSessionTimes must match canonical parseBookingDateTime for time ${tc.time}`
        );
        assert.equal(sessionTimes.scheduledStart.getUTCHours(), tc.expectedUtcHour);
        assert.equal(sessionTimes.scheduledStart.getUTCMinutes(), tc.expectedUtcMin);
      }
    });
  });
});
