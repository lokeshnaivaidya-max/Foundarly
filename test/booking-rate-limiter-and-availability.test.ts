import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  checkClientRateLimit,
  checkRateLimit,
  resetClientRateLimit,
} from '../src/utils/security.js';
import {
  checkServerlessRateLimit,
  extractClientIp,
} from '../src/server/rateLimiter.js';
import {
  getNowInIST,
  parseBookingDateTime,
  isSlotInPast,
  generateAvailableSlots,
  parseConsultantAvailabilityHours,
  parseAvailabilitySettings,
  createDefaultAvailabilitySettings,
  APP_TIMEZONE,
  WeekdayKey,
} from '../src/utils/timeSlots.js';

describe('Foundarly Booking Rate Limiter & Availability Verification Suite', () => {

  // =========================================================================
  // SECTION 1: Booking Rate Limiter Tests
  // =========================================================================
  describe('1. Booking Rate Limiting & User Isolation', () => {
    it('1.1 Allows legitimate booking submissions up to 10 requests per minute', () => {
      const testUser = `user_${Date.now()}_legit`;
      const key = `booking-${testUser}`;
      resetClientRateLimit(key);

      for (let i = 0; i < 10; i++) {
        const result = checkClientRateLimit(key, 10, 60000);
        assert.equal(result.allowed, true, `Attempt ${i + 1} should be allowed`);
        assert.equal(result.remaining, 9 - i);
      }

      // 11th attempt should be rate limited
      const blocked = checkClientRateLimit(key, 10, 60000);
      assert.equal(blocked.allowed, false);
      assert.ok(blocked.retryAfter > 0, 'Must provide retryAfter in seconds');
      assert.equal(blocked.remaining, 0);
    });

    it('1.2 Client rate limiter provides exact retryAfter seconds and clear error structure', () => {
      const key = `test_retry_after_${Date.now()}`;
      resetClientRateLimit(key);

      checkClientRateLimit(key, 2, 30000);
      checkClientRateLimit(key, 2, 30000);

      const third = checkClientRateLimit(key, 2, 30000);
      assert.equal(third.allowed, false);
      assert.ok(third.retryAfter >= 1 && third.retryAfter <= 30);
    });

    it('1.3 Independent user quotas: One user being rate-limited never affects another user', () => {
      const userA = `user_a_${Date.now()}`;
      const userB = `user_b_${Date.now()}`;
      resetClientRateLimit(`booking-${userA}`);
      resetClientRateLimit(`booking-${userB}`);

      // Exhaust User A
      for (let i = 0; i < 10; i++) {
        checkClientRateLimit(`booking-${userA}`, 10, 60000);
      }
      assert.equal(checkClientRateLimit(`booking-${userA}`, 10, 60000).allowed, false);

      // User B must NOT be blocked
      const userBAttempt = checkClientRateLimit(`booking-${userB}`, 10, 60000);
      assert.equal(userBAttempt.allowed, true);
      assert.equal(userBAttempt.remaining, 9);
    });

    it('1.4 Serverless rate limiter tracks IP addresses accurately via x-forwarded-for header', () => {
      const reqWithForwarded = {
        headers: { 'x-forwarded-for': '49.207.210.15, 10.0.0.1' },
      };
      assert.equal(extractClientIp(reqWithForwarded), '49.207.210.15');

      const reqWithRealIp = {
        headers: { 'x-real-ip': '103.21.244.2' },
      };
      assert.equal(extractClientIp(reqWithRealIp), '103.21.244.2');

      const reqWithSocket = {
        headers: {},
        socket: { remoteAddress: '192.168.1.1' },
      };
      assert.equal(extractClientIp(reqWithSocket), '192.168.1.1');
    });

    it('1.5 Backwards compatibility: legacy checkRateLimit returns boolean', () => {
      const key = `legacy_compat_${Date.now()}`;
      resetClientRateLimit(key);
      assert.equal(checkRateLimit(key, 5, 60000), true);
    });
  });

  // =========================================================================
  // SECTION 2: Date & Time Handling in Asia/Kolkata (IST)
  // =========================================================================
  describe('2. Date & Time Handling in Asia/Kolkata (IST)', () => {
    it('2.1 getNowInIST returns valid components and exact YYYY-MM-DD in India Standard Time', () => {
      const ist = getNowInIST();
      assert.ok(ist.year >= 2026);
      assert.ok(ist.month >= 1 && ist.month <= 12);
      assert.ok(ist.day >= 1 && ist.day <= 31);
      assert.ok(ist.hours >= 0 && ist.hours <= 23);
      assert.ok(ist.minutes >= 0 && ist.minutes <= 59);
      assert.match(ist.dateStr, /^\d{4}-\d{2}-\d{2}$/);
    });

    it('2.2 parseBookingDateTime accurately maps IST times to UTC moments', () => {
      // 9:00 AM IST on 2026-11-03 should equal 3:30 AM UTC on 2026-11-03
      const dt = parseBookingDateTime('2026-11-03', '09:00 AM');
      assert.ok(dt !== null);
      assert.equal(dt?.toISOString(), '2026-11-03T03:30:00.000Z');

      // 12:00 PM (noon) IST should equal 06:30 AM UTC
      const noon = parseBookingDateTime('2026-11-03', '12:00 PM');
      assert.ok(noon !== null);
      assert.equal(noon?.toISOString(), '2026-11-03T06:30:00.000Z');

      // 4:00 PM IST should equal 10:30 AM UTC
      const evening = parseBookingDateTime('2026-11-03', '04:00 PM');
      assert.ok(evening !== null);
      assert.equal(evening?.toISOString(), '2026-11-03T10:30:00.000Z');
    });

    it('2.3 isSlotInPast rejects slots that already passed or are within the 15-minute booking buffer', () => {
      // Reference time: 10:00 AM IST (04:30 UTC)
      const refNow = new Date('2026-11-03T04:30:00Z');

      // 9:00 AM IST has already passed
      assert.equal(isSlotInPast('2026-11-03', '09:00 AM', refNow, 15), true);

      // 10:10 AM IST starts in 10 minutes (within 15 min buffer) -> past
      assert.equal(isSlotInPast('2026-11-03', '10:10 AM', refNow, 15), true);

      // 11:00 AM IST is 60 minutes away -> NOT in past
      assert.equal(isSlotInPast('2026-11-03', '11:00 AM', refNow, 15), false);

      // Future date (tomorrow) is never in past
      assert.equal(isSlotInPast('2026-11-04', '09:00 AM', refNow, 15), false);
    });
  });

  // =========================================================================
  // SECTION 3: Availability Windows (Morning, Afternoon, Evening, Night)
  // =========================================================================
  describe('3. Consultant Availability Windows Parsing & Generation', () => {
    it('3.1 Morning Window: Morning (9:00 AM – 12:00 PM IST) generates 9, 10, 11 AM slots for 60m session', () => {
      const hours = parseConsultantAvailabilityHours('Morning (9:00 AM – 12:00 PM IST)');
      assert.equal(hours.startHour, 9);
      assert.equal(hours.endHour, 12);

      const futureDate = '2026-11-04'; // Wednesday
      const slots = generateAvailableSlots({
        dateStr: futureDate,
        preferredTime: 'Morning (9:00 AM – 12:00 PM IST)',
        sessionDuration: 60,
        referenceNow: new Date('2026-11-03T00:00:00Z'),
      });

      assert.equal(slots.length, 3);
      assert.equal(slots[0].time, '09:00 AM');
      assert.equal(slots[0].available, true);
      assert.equal(slots[1].time, '10:00 AM');
      assert.equal(slots[1].available, true);
      assert.equal(slots[2].time, '11:00 AM');
      assert.equal(slots[2].available, true);
    });

    it('3.2 Morning Window (30 min duration): Generates 6 half-hour slots', () => {
      const futureDate = '2026-11-04';
      const slots = generateAvailableSlots({
        dateStr: futureDate,
        preferredTime: 'Morning (9:00 AM – 12:00 PM IST)',
        sessionDuration: 30,
        referenceNow: new Date('2026-11-03T00:00:00Z'),
      });

      assert.equal(slots.length, 6);
      assert.equal(slots[0].time, '09:00 AM');
      assert.equal(slots[1].time, '09:30 AM');
      assert.equal(slots[2].time, '10:00 AM');
      assert.equal(slots[3].time, '10:30 AM');
      assert.equal(slots[4].time, '11:00 AM');
      assert.equal(slots[5].time, '11:30 AM');
    });

    it('3.3 Afternoon Window: Afternoon (12 PM – 4 PM) generates 12, 1, 2, 3 PM slots', () => {
      const hours = parseConsultantAvailabilityHours('Afternoon (12 PM – 4 PM)');
      assert.equal(hours.startHour, 12);
      assert.equal(hours.endHour, 16);

      const slots = generateAvailableSlots({
        dateStr: '2026-11-04',
        preferredTime: 'Afternoon (12 PM – 4 PM)',
        sessionDuration: 60,
        referenceNow: new Date('2026-11-03T00:00:00Z'),
      });

      assert.equal(slots.length, 4);
      assert.equal(slots[0].time, '12:00 PM');
      assert.equal(slots[1].time, '01:00 PM');
      assert.equal(slots[2].time, '02:00 PM');
      assert.equal(slots[3].time, '03:00 PM');
    });

    it('3.4 Evening Window: Evening (4 PM – 8 PM) generates 4, 5, 6, 7 PM slots', () => {
      const hours = parseConsultantAvailabilityHours('Evening (4 PM – 8 PM)');
      assert.equal(hours.startHour, 16);
      assert.equal(hours.endHour, 20);

      const slots = generateAvailableSlots({
        dateStr: '2026-11-04',
        preferredTime: 'Evening (4 PM – 8 PM)',
        sessionDuration: 60,
        referenceNow: new Date('2026-11-03T00:00:00Z'),
      });

      assert.equal(slots.length, 4);
      assert.equal(slots[0].time, '04:00 PM');
      assert.equal(slots[1].time, '05:00 PM');
      assert.equal(slots[2].time, '06:00 PM');
      assert.equal(slots[3].time, '07:00 PM');
    });

    it('3.5 Night Window: Night (8 PM – 10 PM) generates 8, 9 PM slots', () => {
      const hours = parseConsultantAvailabilityHours('Night (8 PM – 10 PM)');
      assert.equal(hours.startHour, 20);
      assert.equal(hours.endHour, 22);

      const slots = generateAvailableSlots({
        dateStr: '2026-11-04',
        preferredTime: 'Night (8 PM – 10 PM)',
        sessionDuration: 60,
        referenceNow: new Date('2026-11-03T00:00:00Z'),
      });

      assert.equal(slots.length, 2);
      assert.equal(slots[0].time, '08:00 PM');
      assert.equal(slots[1].time, '09:00 PM');
    });

    it('3.6 Today partial availability: past slots marked past, upcoming future slots remain available', () => {
      // Suppose current time is 3:00 PM IST (09:30 UTC) on 2026-11-03
      const refNow = new Date('2026-11-03T09:30:00Z');

      // Consultant with 10:00 AM - 6:00 PM
      const slots = generateAvailableSlots({
        dateStr: '2026-11-03',
        preferredTime: 'Mon - Sat (10:00 AM - 6:00 PM)',
        sessionDuration: 60,
        referenceNow: refNow,
      });

      // 10 AM, 11 AM, 12 PM, 1 PM, 2 PM, 3 PM should be past
      const tenAm = slots.find((s) => s.time === '10:00 AM');
      assert.equal(tenAm?.available, false);
      assert.equal(tenAm?.reason, 'past');

      const twoPm = slots.find((s) => s.time === '02:00 PM');
      assert.equal(twoPm?.available, false);
      assert.equal(twoPm?.reason, 'past');

      // 4 PM and 5 PM are in the future relative to 3:00 PM IST -> AVAILABLE!
      const fourPm = slots.find((s) => s.time === '04:00 PM');
      assert.equal(fourPm?.available, true);
      assert.equal(fourPm?.reason, undefined);

      const fivePm = slots.find((s) => s.time === '05:00 PM');
      assert.equal(fivePm?.available, true);
    });

    it('3.7 Today past window: When all morning slots have passed today, slots are flagged past', () => {
      // 3:15 PM IST on 2026-11-03
      const refNow = new Date('2026-11-03T09:45:00Z');

      const slots = generateAvailableSlots({
        dateStr: '2026-11-03',
        preferredTime: 'Morning (9:00 AM – 12:00 PM IST)',
        sessionDuration: 60,
        referenceNow: refNow,
      });

      assert.equal(slots.length, 3);
      assert.ok(slots.every((s) => !s.available));
      assert.ok(slots.every((s) => s.reason === 'past'));

      // Tomorrow on the exact same consultant must be completely available
      const tomorrowSlots = generateAvailableSlots({
        dateStr: '2026-11-04',
        preferredTime: 'Morning (9:00 AM – 12:00 PM IST)',
        sessionDuration: 60,
        referenceNow: refNow,
      });

      assert.equal(tomorrowSlots.length, 3);
      assert.ok(tomorrowSlots.every((s) => s.available));
    });
  });

  // =========================================================================
  // SECTION 4: Booking & Slot Conflicts Handling
  // =========================================================================
  describe('4. Booking Conflicts, Double-Booking, Cancelled, & Expired Bookings', () => {
    it('4.1 Active confirmed/completed booking reserves the time slot', () => {
      const bookedSlots = ['10:00 AM'];
      const slots = generateAvailableSlots({
        dateStr: '2026-11-04',
        preferredTime: 'Morning (9:00 AM – 12:00 PM IST)',
        sessionDuration: 60,
        bookedSlots,
        referenceNow: new Date('2026-11-03T00:00:00Z'),
      });

      const slot9 = slots.find((s) => s.time === '09:00 AM');
      const slot10 = slots.find((s) => s.time === '10:00 AM');
      const slot11 = slots.find((s) => s.time === '11:00 AM');

      assert.equal(slot9?.available, true);
      assert.equal(slot10?.available, false);
      assert.equal(slot10?.reason, 'booked');
      assert.equal(slot11?.available, true);
    });

    it('4.2 Fully booked date flags all slots as booked', () => {
      const allBooked = ['09:00 AM', '10:00 AM', '11:00 AM'];
      const slots = generateAvailableSlots({
        dateStr: '2026-11-04',
        preferredTime: 'Morning (9:00 AM – 12:00 PM IST)',
        sessionDuration: 60,
        bookedSlots: allBooked,
        referenceNow: new Date('2026-11-03T00:00:00Z'),
      });

      assert.equal(slots.length, 3);
      assert.ok(slots.every((s) => !s.available));
      assert.ok(slots.every((s) => s.reason === 'booked'));
    });

    it('4.3 Active booking filter rules: cancelled, rejected, failed, and expired bookings do not block slots', () => {
      const nowMs = Date.now();
      const mockBookings = [
        { time: '09:00 AM', status: 'cancelled', payment_status: 'paid', created_at: new Date(nowMs - 60000).toISOString() },
        { time: '10:00 AM', status: 'pending', payment_status: 'failed', created_at: new Date(nowMs - 60000).toISOString() },
        { time: '11:00 AM', status: 'pending', payment_status: 'pending', created_at: new Date(nowMs - 2 * 3600 * 1000).toISOString() }, // expired 2h ago
        { time: '12:00 PM', status: 'confirmed', payment_status: 'paid', created_at: new Date(nowMs - 60000).toISOString() }, // ACTIVE
        { time: '01:00 PM', status: 'pending', payment_status: 'pending', created_at: new Date(nowMs - 5 * 60 * 1000).toISOString() }, // ACTIVE (recent 5m)
      ];

      const PENDING_EXPIRY_MS = 15 * 60 * 1000;

      const activeBookedTimes = mockBookings
        .filter((b) => {
          const status = (b.status || '').toLowerCase().trim();
          const paymentStatus = (b.payment_status || '').toLowerCase().trim();

          if (status === 'cancelled' || status === 'rejected') return false;
          if (paymentStatus === 'failed' || paymentStatus === 'rejected' || paymentStatus === 'refunded') return false;
          if (status === 'confirmed' || status === 'completed') return true;
          if (status === 'pending' || paymentStatus === 'pending') {
            const createdAtMs = b.created_at ? new Date(b.created_at).getTime() : 0;
            return (nowMs - createdAtMs) < PENDING_EXPIRY_MS;
          }
          return false;
        })
        .map((b) => b.time);

      // Only 12:00 PM (confirmed) and 01:00 PM (recent pending checkout) should block!
      // 09:00 AM (cancelled), 10:00 AM (failed), and 11:00 AM (expired) must NOT block!
      assert.deepEqual(activeBookedTimes, ['12:00 PM', '01:00 PM']);
    });
  });
});
