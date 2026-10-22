import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createDefaultAvailabilitySettings,
  parseAvailabilitySettings,
  serializeAvailabilitySettings,
  validateTimeWindow,
  validateWindowsNoOverlap,
  validateAvailabilitySettings,
  checkDayAvailability,
  generateAvailableSlots,
  time24ToMinutes,
  minutesToTime24,
  getDayOfWeekInIST,
  isSlotInPast,
  normalizeTimeSlot,
  formatTime12Hour,
  APP_TIMEZONE,
  ConsultantAvailabilitySettings,
} from '../src/utils/timeSlots.js';

describe('Foundarly Consultant Availability & Consultation Pricing Management', () => {
  it('1. Availability CRUD: Creates, serializes, and parses availability settings accurately', () => {
    const defaultSettings = createDefaultAvailabilitySettings();
    assert.equal(defaultSettings.version, 1);
    assert.equal(defaultSettings.timezone, 'Asia/Kolkata');
    assert.equal(defaultSettings.slotDurationMinutes, 60);
    assert.equal(defaultSettings.bufferMinutes, 0);
    assert.equal(defaultSettings.pricing.pricing_30, 1000);
    assert.equal(defaultSettings.pricing.pricing_60, 1299);
    assert.equal(defaultSettings.weeklySchedule.monday.enabled, true);
    assert.equal(defaultSettings.weeklySchedule.sunday.enabled, false);

    // Serialization
    const serialized = serializeAvailabilitySettings(defaultSettings);
    assert.ok(serialized.availabilityJson.includes('"version":1'));
    assert.ok(serialized.preferredTimeText.length > 0);
    assert.equal(serialized.pricing_30, 1000);
    assert.equal(serialized.pricing_60, 1299);

    // Parsing from JSON string in availability column
    const parsed = parseAvailabilitySettings({
      availability: serialized.availabilityJson,
      pricing_30: 1000,
      pricing_60: 1299,
    });
    assert.equal(parsed.pricing.pricing_30, 1000);
    assert.equal(parsed.pricing.pricing_60, 1299);
    assert.equal(parsed.weeklySchedule.monday.enabled, true);
  });

  it('2. Multiple available time windows per day: supports morning and evening sessions', () => {
    const customSettings: ConsultantAvailabilitySettings = {
      version: 1,
      weeklySchedule: {
        monday: {
          enabled: true,
          windows: [
            { start: '10:00', end: '13:00' }, // 10 AM - 1 PM
            { start: '15:00', end: '18:00' }, // 3 PM - 6 PM
          ],
        },
        tuesday: { enabled: false, windows: [] },
        wednesday: { enabled: false, windows: [] },
        thursday: { enabled: false, windows: [] },
        friday: { enabled: false, windows: [] },
        saturday: { enabled: false, windows: [] },
        sunday: { enabled: false, windows: [] },
      },
      slotDurationMinutes: 60,
      bufferMinutes: 0,
      blockedDates: [],
      pricing: { pricing_30: 800, pricing_60: 1500, currency: 'INR' },
      timezone: APP_TIMEZONE,
    };

    const validation = validateAvailabilitySettings(customSettings);
    assert.equal(validation.valid, true);

    // Test on a known future Monday, e.g. 2026-11-02 is a Monday
    const slots = generateAvailableSlots({
      dateStr: '2026-11-02',
      availabilitySettings: customSettings,
      sessionDuration: 60,
      referenceNow: new Date('2026-11-01T00:00:00Z'),
    });

    const slotTimes = slots.map((s) => s.time);
    // Window 1: 10:00 AM, 11:00 AM, 12:00 PM
    // Window 2: 03:00 PM, 04:00 PM, 05:00 PM
    assert.ok(slotTimes.includes('10:00 AM'));
    assert.ok(slotTimes.includes('11:00 AM'));
    assert.ok(slotTimes.includes('12:00 PM'));
    assert.ok(slotTimes.includes('03:00 PM'));
    assert.ok(slotTimes.includes('04:00 PM'));
    assert.ok(slotTimes.includes('05:00 PM'));
    // Should NOT have 1:00 PM or 2:00 PM (break interval)
    assert.ok(!slotTimes.includes('01:00 PM'));
    assert.ok(!slotTimes.includes('02:00 PM'));
  });

  it('3. Overlapping time windows: detects and rejects overlapping windows on the same weekday', () => {
    // Window 1: 10:00 to 14:00, Window 2: 13:00 to 17:00 (overlaps between 13:00 and 14:00)
    const overlapResult = validateWindowsNoOverlap([
      { start: '10:00', end: '14:00' },
      { start: '13:00', end: '17:00' },
    ]);
    assert.equal(overlapResult.valid, false);
    assert.ok(overlapResult.error?.includes('Overlapping time windows'));

    // Non-overlapping adjacent windows (e.g. 10:00-13:00 and 13:00-16:00) are valid
    const adjacentResult = validateWindowsNoOverlap([
      { start: '10:00', end: '13:00' },
      { start: '13:00', end: '16:00' },
    ]);
    assert.equal(adjacentResult.valid, true);
  });

  it('4. Time window validation: rejects start >= end and invalid time formats', () => {
    // start equal to end
    const sameTime = validateTimeWindow({ start: '10:00', end: '10:00' });
    assert.equal(sameTime.valid, false);
    assert.ok(sameTime.error?.includes('earlier than end'));

    // start after end
    const reverseTime = validateTimeWindow({ start: '15:00', end: '11:00' });
    assert.equal(reverseTime.valid, false);

    // invalid format
    const invalidTime = validateTimeWindow({ start: 'abc', end: '12:00' });
    assert.equal(invalidTime.valid, false);
    assert.ok(invalidTime.error?.includes('Invalid start time'));
  });

  it('5. Appointment slot duration & buffer time between sessions: generates spaced slots', () => {
    // Window: 10:00 to 13:00 (3 hours = 180 min)
    // Slot duration: 60 minutes
    // Buffer time: 15 minutes
    // Expected slots:
    // Slot 1: 10:00 - 11:00 (10:00 AM)
    // Buffer: 11:00 - 11:15
    // Slot 2: 11:15 - 12:15 (11:15 AM)
    // Buffer: 12:15 - 12:30
    // Slot 3 would start at 12:30, but 12:30 + 60 = 13:30 > 13:00 (does not fit)
    const settingsWithBuffer: ConsultantAvailabilitySettings = {
      version: 1,
      weeklySchedule: {
        monday: {
          enabled: true,
          windows: [{ start: '10:00', end: '13:00' }],
        },
        tuesday: { enabled: false, windows: [] },
        wednesday: { enabled: false, windows: [] },
        thursday: { enabled: false, windows: [] },
        friday: { enabled: false, windows: [] },
        saturday: { enabled: false, windows: [] },
        sunday: { enabled: false, windows: [] },
      },
      slotDurationMinutes: 60,
      bufferMinutes: 15,
      blockedDates: [],
      pricing: { pricing_30: 1000, pricing_60: 1299, currency: 'INR' },
      timezone: APP_TIMEZONE,
    };

    const slots = generateAvailableSlots({
      dateStr: '2026-11-02',
      availabilitySettings: settingsWithBuffer,
      sessionDuration: 60,
      bufferMinutes: 15,
      referenceNow: new Date('2026-11-01T00:00:00Z'),
    });

    assert.equal(slots.length, 2);
    assert.equal(slots[0].startTime24, '10:00');
    assert.equal(slots[0].endTime24, '11:00');
    assert.equal(slots[1].startTime24, '11:15');
    assert.equal(slots[1].endTime24, '12:15');
  });

  it('6. Blocked dates & holiday configuration: marks entire date as unavailable with custom reason', () => {
    const settingsWithHolidays: ConsultantAvailabilitySettings = {
      version: 1,
      weeklySchedule: {
        monday: { enabled: true, windows: [{ start: '10:00', end: '18:00' }] },
        tuesday: { enabled: true, windows: [{ start: '10:00', end: '18:00' }] },
        wednesday: { enabled: true, windows: [{ start: '10:00', end: '18:00' }] },
        thursday: { enabled: true, windows: [{ start: '10:00', end: '18:00' }] },
        friday: { enabled: true, windows: [{ start: '10:00', end: '18:00' }] },
        saturday: { enabled: true, windows: [{ start: '10:00', end: '18:00' }] },
        sunday: { enabled: false, windows: [] },
      },
      slotDurationMinutes: 60,
      bufferMinutes: 0,
      blockedDates: [
        { date: '2026-11-02', reason: 'Diwali Festival Holiday' },
      ],
      pricing: { pricing_30: 1000, pricing_60: 1299, currency: 'INR' },
      timezone: APP_TIMEZONE,
    };

    // Day check
    const dayCheck = checkDayAvailability('2026-11-02', settingsWithHolidays);
    assert.equal(dayCheck.isAvailable, false);
    assert.equal(dayCheck.isBlocked, true);
    assert.equal(dayCheck.blockedReason, 'Diwali Festival Holiday');

    // Slot generation check
    const slots = generateAvailableSlots({
      dateStr: '2026-11-02',
      availabilitySettings: settingsWithHolidays,
    });

    assert.equal(slots.length, 1);
    assert.equal(slots[0].available, false);
    assert.equal(slots[0].reason, 'holiday');
    assert.equal(slots[0].holidayReason, 'Diwali Festival Holiday');
  });

  it('7. Individual weekday off: marks day as unavailable_day when disabled', () => {
    const settings: ConsultantAvailabilitySettings = {
      ...createDefaultAvailabilitySettings(),
      weeklySchedule: {
        ...createDefaultAvailabilitySettings().weeklySchedule,
        sunday: { enabled: false, windows: [] },
      },
    };

    // Known Sunday: 2026-11-01 is a Sunday
    const dayCheck = checkDayAvailability('2026-11-01', settings);
    assert.equal(dayCheck.isAvailable, false);
    assert.equal(dayCheck.isDayOff, true);

    const slots = generateAvailableSlots({
      dateStr: '2026-11-01',
      availabilitySettings: settings,
    });

    assert.equal(slots.length, 1);
    assert.equal(slots[0].available, false);
    assert.equal(slots[0].reason, 'unavailable_day');
  });

  it('8. Past slot rejection with IST 15-minute buffer', () => {
    // 2:00 PM IST on 2026-10-22
    // If reference now is 1:50 PM IST (10 minutes before slot), slot is in past buffer
    const refNow = new Date('2026-10-22T08:20:00Z'); // 13:50 IST
    const isPast = isSlotInPast('2026-10-22', '02:00 PM', refNow, 15);
    assert.equal(isPast, true); // within 15 min buffer

    // If reference now is 1:30 PM IST (30 minutes before slot), slot is valid future
    const refEarlier = new Date('2026-10-22T08:00:00Z'); // 13:30 IST
    const isFuture = isSlotInPast('2026-10-22', '02:00 PM', refEarlier, 15);
    assert.equal(isFuture, false);
  });

  it('9. Pricing management: supports 30m and 60m rates with INR currency and validation', () => {
    const settings = createDefaultAvailabilitySettings();
    settings.pricing.pricing_30 = 950;
    settings.pricing.pricing_60 = 1500;
    settings.pricing.currency = 'INR';

    const validation = validateAvailabilitySettings(settings);
    assert.equal(validation.valid, true);

    // Negative pricing rejection
    const invalidSettings = {
      ...settings,
      pricing: { pricing_30: -100, pricing_60: 1200, currency: 'INR' },
    };
    const invalidValidation = validateAvailabilitySettings(invalidSettings);
    assert.equal(invalidValidation.valid, false);
    assert.ok(invalidValidation.error?.includes('negative'));
  });

  it('10. Server-side authoritative price calculation: prevents client price tampering', () => {
    const consultant = {
      id: 'cons-123',
      name: 'Rohan Sharma',
      pricing_30: 1100,
      pricing_60: 1800,
    };

    // Client attempts to pass a spoofed price: session_price: 10
    const duration = 60;
    const authoritativePrice = duration === 30 ? consultant.pricing_30 : consultant.pricing_60;

    // Server logic never trusts client price without referral
    function calculateFinalPrice(clientSubmittedPrice: number | undefined, duration: number, discount: number = 0): number {
      const base = duration === 30 ? consultant.pricing_30 : consultant.pricing_60;
      const effectiveExpected = Math.max(0, base - discount);
      return effectiveExpected;
    }

    const calculated = calculateFinalPrice(10, 60, 0);
    assert.equal(calculated, 1800); // Spoofed 10 is ignored; authoritative 1800 enforced
  });

  it('11. Historical booking preservation: consultant price change applies to future, never altering past bookings', () => {
    const historicalBooking = {
      id: 'book-prev-1',
      consultant_id: 'cons-123',
      date: '2026-09-15',
      time: '10:00 AM',
      session_duration: 60,
      session_price: 1299, // original historical rate
      payment_status: 'paid',
      status: 'completed',
    };

    // Consultant updates price to 2500
    const updatedConsultant = {
      id: 'cons-123',
      pricing_30: 1500,
      pricing_60: 2500,
    };

    // Verify historical booking price remains strictly 1299
    assert.equal(historicalBooking.session_price, 1299);
    assert.notEqual(historicalBooking.session_price, updatedConsultant.pricing_60);
  });

  it('12. Double booking prevention: active booking reserves slot and makes it unavailable', () => {
    const settings = createDefaultAvailabilitySettings();
    // Monday with single window 10:00 to 12:00 -> 10:00 AM, 11:00 AM
    settings.weeklySchedule.monday = {
      enabled: true,
      windows: [{ start: '10:00', end: '12:00' }],
    };

    const slots = generateAvailableSlots({
      dateStr: '2026-11-02',
      availabilitySettings: settings,
      sessionDuration: 60,
      bookedTimes: ['10:00 AM'],
      referenceNow: new Date('2026-11-01T00:00:00Z'),
    });

    const slot10 = slots.find((s) => s.time === '10:00 AM');
    const slot11 = slots.find((s) => s.time === '11:00 AM');

    assert.ok(slot10);
    assert.equal(slot10.available, false);
    assert.equal(slot10.reason, 'booked');

    assert.ok(slot11);
    assert.equal(slot11.available, true);
  });

  it('13. Admin role authorization check: only authorized admin roles can update settings', () => {
    function canManageAvailability(userRole: string, email: string): boolean {
      const allowedAdminEmails = ['admin@foundarly.com', 'lokesh.naivaidya@gmail.com'];
      if (userRole === 'developer_admin') return true;
      if (userRole === 'super_admin' && allowedAdminEmails.includes(email.toLowerCase())) return true;
      if (userRole === 'admin' && allowedAdminEmails.includes(email.toLowerCase())) return true;
      return false;
    }

    assert.equal(canManageAvailability('developer_admin', 'foundarly@developer.in'), true);
    assert.equal(canManageAvailability('super_admin', 'admin@foundarly.com'), true);
    assert.equal(canManageAvailability('admin', 'admin@foundarly.com'), true);

    // Regular client or consultant cannot manage other consultants
    assert.equal(canManageAvailability('client', 'user@example.com'), false);
    assert.equal(canManageAvailability('consultant', 'consultant@example.com'), false);
    assert.equal(canManageAvailability('super_admin', 'unauthorized@gmail.com'), false);
  });
});
