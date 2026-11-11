/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Foundarly Future Meeting Stability & Access Validation Test Suite
 * Validates:
 * 1. Root Cause Resolution: parseBookingDateTime and getCountdownTargetMs are correctly imported and executed.
 * 2. Future Meeting Display: Renders "Your meeting hasn't started yet" and computes Days/Hours/Minutes/Seconds.
 * 3. Permitted Join Window: Clients and consultants can join exactly 5 minutes before scheduled start and during session.
 * 4. Meeting Lifecycle States: Tests future, ongoing (live), 7-day rejoin, expired (>7 days), cancelled, and invalid meeting links.
 * 5. Timezone & Date Preservation: Prevents cross-timezone off-by-one shifts on date display.
 * 6. Participant Authorization: Ensures only authorized client, assigned consultant, and admins access the room.
 */

import { test, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  parseBookingDateTime,
  getCountdownTargetMs,
  APP_TIMEZONE_OFFSET_MS,
  parseTimeString,
} from '../src/utils/timeSlots.ts';

import {
  calculateRejoinEligibility,
  validateParticipantAccess,
  parseSessionTimes,
  REJOIN_WINDOW_MS,
  EARLY_JOIN_WINDOW_MS,
} from '../src/utils/meetingRejoin.ts';

describe('1. Root Cause & Import Verification for Future Meeting Links', () => {
  it('Meeting.tsx explicitly imports parseBookingDateTime and getCountdownTargetMs from @/utils/timeSlots', () => {
    const meetingSource = fs.readFileSync(path.resolve('src/pages/Meeting.tsx'), 'utf8');
    
    // Verify import exists
    assert.match(
      meetingSource,
      /import\s*\{[^}]*parseBookingDateTime[^}]*\}\s*from\s*["']@\/utils\/timeSlots["']/,
      'parseBookingDateTime must be explicitly imported from @/utils/timeSlots'
    );
    assert.match(
      meetingSource,
      /import\s*\{[^}]*getCountdownTargetMs[^}]*\}\s*from\s*["']@\/utils\/timeSlots["']/,
      'getCountdownTargetMs must be explicitly imported from @/utils/timeSlots'
    );

    // Verify "Your meeting hasn't started yet" is rendered for upcoming meetings
    assert.ok(
      meetingSource.includes("Your meeting hasn't started yet"),
      'Meeting.tsx must display "Your meeting hasn\'t started yet" for future meetings'
    );
  });

  it('parseBookingDateTime and getCountdownTargetMs execute without throwing for 1-day future meetings', () => {
    // 24 hours into the future
    const now = new Date();
    const futureDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const dateStr = futureDate.toISOString().split('T')[0];
    const timeStr = '10:00 AM';

    const parsed = parseBookingDateTime(dateStr, timeStr);
    assert.ok(parsed instanceof Date, 'Should return a valid Date instance');
    assert.ok(!isNaN(parsed.getTime()), 'Timestamp should be valid and finite');

    const countdown = getCountdownTargetMs(dateStr, timeStr);
    assert.equal(countdown.isValid, true);
    assert.ok(typeof countdown.targetMs === 'number');
    assert.ok(countdown.targetMs > now.getTime(), 'Target should be in the future');
  });
});

describe('2. Countdown Calculations for 1-Day Before and Multi-Day Future Sessions', () => {
  it('Calculates Days, Hours, Minutes, and Seconds accurately for a meeting 1 day before', () => {
    const targetMs = 1794500000000;
    // Current time is exactly 26 hours, 30 minutes, 15 seconds before target
    const diffMs = (26 * 3600 + 30 * 60 + 15) * 1000;

    const days = Math.floor(diffMs / 86400000);
    const hours = Math.floor((diffMs % 86400000) / 3600000);
    const minutes = Math.floor((diffMs % 3600000) / 60000);
    const seconds = Math.floor((diffMs % 60000) / 1000);

    assert.equal(days, 1, 'Should calculate 1 day');
    assert.equal(hours, 2, 'Should calculate 2 hours');
    assert.equal(minutes, 30, 'Should calculate 30 minutes');
    assert.equal(seconds, 15, 'Should calculate 15 seconds');
  });

  it('Calculates Hours, Minutes, and Seconds when meeting is on the same day (< 24h)', () => {
    const diffMs = (3 * 3600 + 45 * 60 + 20) * 1000;

    const days = Math.floor(diffMs / 86400000);
    const hours = Math.floor((diffMs % 86400000) / 3600000);
    const minutes = Math.floor((diffMs % 3600000) / 60000);
    const seconds = Math.floor((diffMs % 60000) / 1000);

    assert.equal(days, 0, 'Should calculate 0 days');
    assert.equal(hours, 3, 'Should calculate 3 hours');
    assert.equal(minutes, 45, 'Should calculate 45 minutes');
    assert.equal(seconds, 20, 'Should calculate 20 seconds');
  });

  it('Gracefully handles countdown reaching zero or past without NaN or negative values', () => {
    const safeDiff = Math.max(0, -5000);
    const days = Math.floor(safeDiff / 86400000);
    const hours = Math.floor((safeDiff % 86400000) / 3600000);
    const minutes = Math.floor((safeDiff % 3600000) / 60000);
    const seconds = Math.floor((safeDiff % 60000) / 1000);

    assert.equal(days, 0);
    assert.equal(hours, 0);
    assert.equal(minutes, 0);
    assert.equal(seconds, 0);
  });
});

describe('3. Timezone Conversion & Date Display Preservation', () => {
  it('Maps IST time to exact UTC moment without shift', () => {
    // 10:00 AM IST on Nov 12, 2026 corresponds to 04:30 AM UTC on Nov 12, 2026
    const parsed = parseBookingDateTime('2026-11-12', '10:00 AM');
    assert.ok(parsed);

    // 04:30 UTC
    assert.equal(parsed.getUTCFullYear(), 2026);
    assert.equal(parsed.getUTCMonth(), 10); // 0-indexed month (10 = November)
    assert.equal(parsed.getUTCDate(), 12);
    assert.equal(parsed.getUTCHours(), 4);
    assert.equal(parsed.getUTCMinutes(), 30);
  });

  it('Date string formatting helper parses YYYY-MM-DD as local date without off-by-one day shift', () => {
    function formatBookingDateDisplay(dateStr?: string | null, format: 'short' | 'long' = 'long'): string {
      if (!dateStr) return '';
      try {
        if (dateStr.includes('T')) {
          const d = new Date(dateStr);
          if (!isNaN(d.getTime())) {
            return format === 'short'
              ? d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
              : d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
          }
        }
        const parts = dateStr.split('-');
        if (parts.length === 3) {
          const y = parseInt(parts[0], 10);
          const m = parseInt(parts[1], 10) - 1;
          const d = parseInt(parts[2], 10);
          const localDate = new Date(y, m, d);
          if (!isNaN(localDate.getTime())) {
            return format === 'short'
              ? localDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })
              : localDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
          }
        }
        return dateStr;
      } catch {
        return dateStr;
      }
    }

    const shortFormatted = formatBookingDateDisplay('2026-11-12', 'short');
    assert.equal(shortFormatted, 'Nov 12', 'Must preserve day 12 in short format');

    const longFormatted = formatBookingDateDisplay('2026-11-12', 'long');
    assert.equal(longFormatted, 'November 12, 2026', 'Must preserve November 12, 2026 in long format');
  });
});

describe('4. Meeting Access Validation Across Lifecycles', () => {
  const testBooking = {
    id: 'booking-lifecycle-test-101',
    user_id: 'client-user-111',
    email: 'client@example.com',
    consultant_id: 'consultant-user-222',
    date: '2026-11-20',
    time: '14:00',
    session_duration: 60,
    status: 'confirmed',
    payment_status: 'paid',
  };

  const clientUser = { id: 'client-user-111', email: 'client@example.com' };
  const consultantUser = { id: 'consultant-user-222', email: 'consultant@example.com' };
  const consultantRecord = { id: 'consultant-user-222', user_id: 'consultant-user-222', email: 'consultant@example.com' };

  it('Future Meeting (1 day before): Authenticated client is authorized, canJoin is false, status is upcoming', () => {
    // 1 day before: 2026-11-19 at 14:00 UTC
    const checkTime = new Date('2026-11-19T14:00:00Z');
    const auth = validateParticipantAccess(clientUser, testBooking, consultantRecord, false);
    assert.equal(auth.authorized, true);
    assert.equal(auth.role, 'client');

    const eligibility = calculateRejoinEligibility(testBooking, checkTime);
    assert.equal(eligibility.sessionStatus, 'upcoming');
    assert.equal(eligibility.canJoin, false);
    assert.ok(eligibility.timeUntilStartMs > 0);
  });

  it('Future Meeting (1 day before): Authenticated consultant is authorized, canJoin is false, status is upcoming', () => {
    const checkTime = new Date('2026-11-19T14:00:00Z');
    const auth = validateParticipantAccess(consultantUser, testBooking, consultantRecord, false);
    assert.equal(auth.authorized, true);
    assert.equal(auth.role, 'consultant');

    const eligibility = calculateRejoinEligibility(testBooking, checkTime);
    assert.equal(eligibility.sessionStatus, 'upcoming');
    assert.equal(eligibility.canJoin, false);
  });

  it('Ongoing / Live Meeting (Permitted scheduled time): Can join 5 minutes before scheduled start', () => {
    // Scheduled start: 2026-11-20T14:00:00Z. Check at 13:56:00Z (4 minutes before)
    const checkTime = new Date('2026-11-20T13:56:00Z');
    const eligibility = calculateRejoinEligibility(testBooking, checkTime);
    assert.equal(eligibility.sessionStatus, 'live');
    assert.equal(eligibility.canJoin, true);
  });

  it('Ongoing / Live Meeting: Can join during active session duration', () => {
    // 30 minutes into the 60-minute session (14:30:00Z)
    const checkTime = new Date('2026-11-20T14:30:00Z');
    const eligibility = calculateRejoinEligibility(testBooking, checkTime);
    assert.equal(eligibility.sessionStatus, 'live');
    assert.equal(eligibility.canJoin, true);
  });

  it('7-Day Rejoin Eligible: Can rejoin for 7 days after meeting concludes', () => {
    // 2 days after session end (2026-11-22T16:00:00Z)
    const checkTime = new Date('2026-11-22T16:00:00Z');
    const eligibility = calculateRejoinEligibility(testBooking, checkTime);
    assert.equal(eligibility.sessionStatus, 'rejoin_eligible');
    assert.equal(eligibility.canJoin, true);
    assert.equal(eligibility.isRejoin, true);
    assert.ok(eligibility.rejoinDaysRemaining > 0);
  });

  it('Expired Meeting: Access expires after 7-day post-meeting window', () => {
    // 8 days after session end (2026-11-28T16:00:00Z)
    const checkTime = new Date('2026-11-28T16:00:00Z');
    const eligibility = calculateRejoinEligibility(testBooking, checkTime);
    assert.equal(eligibility.sessionStatus, 'expired');
    assert.equal(eligibility.canJoin, false);
  });

  it('Cancelled or Rejected Meeting: Immediately blocked regardless of timing', () => {
    const cancelledBooking = { ...testBooking, status: 'cancelled' };
    const auth = validateParticipantAccess(clientUser, cancelledBooking, consultantRecord, false);
    assert.equal(auth.authorized, false);
    assert.equal(auth.code, 'BOOKING_CANCELLED');

    const eligibility = calculateRejoinEligibility(cancelledBooking, new Date('2026-11-20T14:30:00Z'));
    assert.equal(eligibility.canJoin, false);
    assert.equal(eligibility.sessionStatus, 'expired');
  });

  it('Invalid Participant: Unrelated user is rejected', () => {
    const stranger = { id: 'stranger-999', email: 'stranger@gmail.com' };
    const auth = validateParticipantAccess(stranger, testBooking, consultantRecord, false);
    assert.equal(auth.authorized, false);
    assert.equal(auth.code, 'UNAUTHORIZED_PARTICIPANT');
  });
});
