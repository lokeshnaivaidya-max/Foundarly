import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseTimeString,
  parseBookingDateTime,
  formatISTISOString,
  parseConsultantAvailabilityHours,
  generateAvailableSlots,
  isSlotInPast,
  getCountdownTargetMs,
  APP_TIMEZONE,
  APP_TIMEZONE_OFFSET_MINUTES,
  getNowInIST,
} from '../src/utils/timeSlots.js';

describe('Foundarly Consultation Time Slot & Scheduling System', () => {
  it('1. Correctly identifies timezone configuration as India Standard Time (IST)', () => {
    assert.equal(APP_TIMEZONE, 'Asia/Kolkata');
    assert.equal(APP_TIMEZONE_OFFSET_MINUTES, 330);

    const nowIST = getNowInIST();
    assert.ok(nowIST.dateStr.match(/^\d{4}-\d{2}-\d{2}$/));
    assert.ok(nowIST.hours >= 0 && nowIST.hours <= 23);
    assert.ok(nowIST.minutes >= 0 && nowIST.minutes <= 59);
  });

  it('2. Parses 12-hour AM/PM and 24-hour time strings correctly, and handles Flexible/legacy gracefully', () => {
    assert.deepEqual(parseTimeString('09:00 AM'), { hours: 9, minutes: 0 });
    assert.deepEqual(parseTimeString('12:00 PM'), { hours: 12, minutes: 0 });
    assert.deepEqual(parseTimeString('02:30 PM'), { hours: 14, minutes: 30 });
    assert.deepEqual(parseTimeString('12:00 AM'), { hours: 0, minutes: 0 });
    assert.deepEqual(parseTimeString('11:45 PM'), { hours: 23, minutes: 45 });
    assert.deepEqual(parseTimeString('15:30'), { hours: 15, minutes: 30 });
    assert.deepEqual(parseTimeString('08:15:00'), { hours: 8, minutes: 15 });

    // Legacy or invalid values return null
    assert.equal(parseTimeString('Flexible'), null);
    assert.equal(parseTimeString(''), null);
    assert.equal(parseTimeString(null), null);
    assert.equal(parseTimeString(undefined), null);
    assert.equal(parseTimeString('invalid-time'), null);
  });

  it('3. Parses consultant availability keywords and range formats', () => {
    // Keyword presets
    const morning = parseConsultantAvailabilityHours('Morning');
    assert.equal(morning.startHour, 9);
    assert.equal(morning.endHour, 13);

    const afternoon = parseConsultantAvailabilityHours('Afternoon');
    assert.equal(afternoon.startHour, 13);
    assert.equal(afternoon.endHour, 17);

    const evening = parseConsultantAvailabilityHours('Evening');
    assert.equal(evening.startHour, 17);
    assert.equal(evening.endHour, 21);

    const flexible = parseConsultantAvailabilityHours('Flexible');
    assert.equal(flexible.startHour, 9);
    assert.equal(flexible.endHour, 18);

    // Custom time range e.g. "10:00 AM - 04:00 PM"
    const customRange = parseConsultantAvailabilityHours('10:00 AM - 04:00 PM');
    assert.equal(customRange.startHour, 10);
    assert.equal(customRange.endHour, 16);
  });

  it('4. Generates discrete 60-minute time slots within availability window', () => {
    const slots = generateAvailableSlots({
      consultantPreferredTime: 'Morning', // 9:00 AM to 1:00 PM
      dateStr: '2099-01-01', // Far future so none are past
      sessionDuration: 60,
      bookedTimes: [],
    });

    assert.equal(slots.length, 4);
    assert.equal(slots[0].time, '09:00 AM');
    assert.equal(slots[0].startTime24, '09:00');
    assert.equal(slots[0].endTime24, '10:00');
    assert.equal(slots[0].available, true);

    assert.equal(slots[1].time, '10:00 AM');
    assert.equal(slots[2].time, '11:00 AM');
    assert.equal(slots[3].time, '12:00 PM');
    assert.equal(slots[3].endTime24, '13:00');
  });

  it('5. Generates 30-minute time slots with correct step and boundary for 30-min sessions', () => {
    const slots = generateAvailableSlots({
      consultantPreferredTime: '02:00 PM - 04:00 PM',
      dateStr: '2099-01-01',
      sessionDuration: 30,
      bookedTimes: [],
    });

    assert.equal(slots.length, 4);
    assert.equal(slots[0].time, '02:00 PM');
    assert.equal(slots[0].endTime24, '14:30');
    assert.equal(slots[1].time, '02:30 PM');
    assert.equal(slots[2].time, '03:00 PM');
    assert.equal(slots[3].time, '03:30 PM');
    assert.equal(slots[3].endTime24, '16:00'); // 3:30 PM + 30 mins = 4:00 PM (16:00)
  });

  it('6. Marks already-booked slots as unavailable with reason "booked"', () => {
    const slots = generateAvailableSlots({
      consultantPreferredTime: 'Morning',
      dateStr: '2099-01-01',
      sessionDuration: 60,
      bookedTimes: ['10:00 AM', '12:00 PM'],
    });

    const slot9am = slots.find((s) => s.time === '09:00 AM');
    const slot10am = slots.find((s) => s.time === '10:00 AM');
    const slot11am = slots.find((s) => s.time === '11:00 AM');
    const slot12pm = slots.find((s) => s.time === '12:00 PM');

    assert.equal(slot9am?.available, true);
    assert.equal(slot10am?.available, false);
    assert.equal(slot10am?.reason, 'booked');
    assert.equal(slot11am?.available, true);
    assert.equal(slot12pm?.available, false);
    assert.equal(slot12pm?.reason, 'booked');
  });

  it('7. Excludes past slots with buffer for today in IST and blocks past dates', () => {
    const pastDateStr = '2020-01-01';
    assert.equal(isSlotInPast(pastDateStr, '10:00 AM'), true);

    const futureDateStr = '2099-01-01';
    assert.equal(isSlotInPast(futureDateStr, '10:00 AM'), false);

    // Slots generated for a past date are all marked unavailable with reason 'past'
    const pastSlots = generateAvailableSlots({
      consultantPreferredTime: 'Morning',
      dateStr: pastDateStr,
      sessionDuration: 60,
      bookedTimes: [],
    });
    assert.ok(pastSlots.every((s) => !s.available && s.reason === 'past'));
  });

  it('8. Accurately converts IST date & time to UTC Date and explicit IST ISO string', () => {
    const parsed = parseBookingDateTime('2026-10-22', '10:00 AM');
    assert.ok(parsed instanceof Date);
    assert.ok(!isNaN(parsed.getTime()));

    // 10:00 AM IST (UTC+05:30) is 04:30 AM UTC
    assert.equal(parsed.getUTCHours(), 4);
    assert.equal(parsed.getUTCMinutes(), 30);
    assert.equal(parsed.getUTCDate(), 22);

    const istIso = formatISTISOString(parsed);
    assert.equal(istIso, '2026-10-22T10:00:00+05:30');

    // Evening slot: 06:30 PM IST is 13:00 UTC
    const eveningParsed = parseBookingDateTime('2026-10-22', '06:30 PM');
    assert.ok(eveningParsed);
    assert.equal(eveningParsed.getUTCHours(), 13);
    assert.equal(eveningParsed.getUTCMinutes(), 0);
  });

  it('9. Double-booking check filters: cancelled/rejected bookings do NOT reserve the slot', () => {
    interface MockBooking {
      id: string;
      consultant_id: string;
      date: string;
      time: string;
      status: string;
      payment_status?: string;
    }

    const bookings: MockBooking[] = [
      {
        id: 'b1',
        consultant_id: 'c-1',
        date: '2026-11-10',
        time: '11:00 AM',
        status: 'cancelled',
        payment_status: 'refunded',
      },
      {
        id: 'b2',
        consultant_id: 'c-1',
        date: '2026-11-10',
        time: '02:00 PM',
        status: 'rejected',
        payment_status: 'rejected',
      },
      {
        id: 'b3',
        consultant_id: 'c-1',
        date: '2026-11-10',
        time: '04:00 PM',
        status: 'confirmed',
        payment_status: 'verified',
      },
    ];

    const activeBookings = bookings.filter(
      (b) => !['cancelled', 'rejected'].includes(b.status) && b.payment_status !== 'rejected'
    );

    assert.equal(activeBookings.length, 1);
    assert.equal(activeBookings[0].time, '04:00 PM');

    // Generating slots with activeBookings ensures 11:00 AM and 02:00 PM remain available
    const slots = generateAvailableSlots({
      consultantPreferredTime: 'Flexible',
      dateStr: '2026-11-10',
      sessionDuration: 60,
      bookedTimes: activeBookings.map((b) => b.time),
    });

    const slot11 = slots.find((s) => s.time === '11:00 AM');
    const slot14 = slots.find((s) => s.time === '02:00 PM');
    const slot16 = slots.find((s) => s.time === '04:00 PM');

    assert.equal(slot11?.available, true);
    assert.equal(slot14?.available, true);
    assert.equal(slot16?.available, false);
    assert.equal(slot16?.reason, 'booked');
  });

  it('10. Meeting countdown target calculation NEVER produces NaN, even with legacy "Flexible" times', () => {
    // Valid scheduled consultation
    const validTarget = getCountdownTargetMs('2026-10-22', '10:00 AM');
    assert.equal(validTarget.isValid, true);
    assert.ok(typeof validTarget.targetMs === 'number');
    assert.ok(!isNaN(validTarget.targetMs));

    // Target is exactly 5 minutes before scheduled start (10:00 AM IST)
    const expectedStart = parseBookingDateTime('2026-10-22', '10:00 AM')!.getTime();
    assert.equal(validTarget.targetMs, expectedStart - 5 * 60 * 1000);

    // Legacy booking with "Flexible" time
    const legacyTarget = getCountdownTargetMs('2026-10-22', 'Flexible');
    assert.equal(legacyTarget.isValid, false);
    assert.equal(legacyTarget.targetMs, null);

    // Legacy booking with undefined or null time
    const missingTimeTarget = getCountdownTargetMs('2026-10-22', null);
    assert.equal(missingTimeTarget.isValid, false);
    assert.equal(missingTimeTarget.targetMs, null);

    // Invalid date string
    const invalidDateTarget = getCountdownTargetMs('invalid-date', '10:00 AM');
    assert.equal(invalidDateTarget.isValid, false);
    assert.equal(invalidDateTarget.targetMs, null);
  });
});
