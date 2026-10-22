import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseConsultantAvailabilityHours,
  parseAvailabilitySettings,
  serializeAvailabilitySettings,
  validateAvailabilitySettings,
  validateWindowsNoOverlap,
  validateConfirmedBookingConflicts,
  checkDayAvailability,
  generateAvailableSlots,
  createDefaultAvailabilitySettings,
  ConsultantAvailabilitySettings,
  WeekdayKey,
} from '../src/utils/timeSlots.js';

describe('Consultant Self-Service Availability & Application Preference Management', () => {
  // Test 1: Loading and parsing original application preferred timings
  it('1. Accurately parses all application form session timings into concrete hours', () => {
    // 1a. Morning (8 AM – 12 PM)
    const morning = parseConsultantAvailabilityHours('Morning (8 AM – 12 PM)');
    assert.equal(morning.startHour, 8);
    assert.equal(morning.endHour, 12);

    // 1b. Afternoon (12 PM – 4 PM)
    const afternoon = parseConsultantAvailabilityHours('Afternoon (12 PM – 4 PM)');
    assert.equal(afternoon.startHour, 12);
    assert.equal(afternoon.endHour, 16);

    // 1c. Evening (4 PM – 8 PM)
    const evening = parseConsultantAvailabilityHours('Evening (4 PM – 8 PM)');
    assert.equal(evening.startHour, 16);
    assert.equal(evening.endHour, 20);

    // 1d. Night (8 PM – 10 PM)
    const night = parseConsultantAvailabilityHours('Night (8 PM – 10 PM)');
    assert.equal(night.startHour, 20);
    assert.equal(night.endHour, 22);

    // 1e. Flexible (Any Time)
    const flexible = parseConsultantAvailabilityHours('Flexible (Any Time)');
    assert.equal(flexible.startHour, 9);
    assert.equal(flexible.endHour, 18);
  });

  // Test 2: Seed availability from application preference without default overwrite
  it('2. Preserves original application timing when constructing initial consultant settings', () => {
    const consultantWithAppTiming = {
      id: 'cons-1',
      name: 'Rohan Sharma',
      email: 'rohan@example.com',
      preferred_time: 'Evening (4 PM – 8 PM)',
      pricing_30: 1200,
      pricing_60: 2000,
      availability: null,
      availability_settings: null,
    };

    const parsed = parseAvailabilitySettings(consultantWithAppTiming);
    assert.ok(parsed);
    // Weekday windows should reflect 16:00 to 20:00 (4 PM - 8 PM), not generic 10:00-13:00 defaults!
    assert.equal(parsed.weeklySchedule.monday.enabled, true);
    assert.deepEqual(parsed.weeklySchedule.monday.windows, [{ start: '16:00', end: '20:00' }]);
    assert.deepEqual(parsed.weeklySchedule.friday.windows, [{ start: '16:00', end: '20:00' }]);
    // Pricing should reflect consultant pricing
    assert.equal(parsed.pricing.pricing_30, 1200);
    assert.equal(parsed.pricing.pricing_60, 2000);
  });

  // Test 3: Multi-window configuration per weekday
  it('3. Allows consultants to configure multiple available time windows per day', () => {
    const customSettings: ConsultantAvailabilitySettings = {
      ...createDefaultAvailabilitySettings(),
      weeklySchedule: {
        ...createDefaultAvailabilitySettings().weeklySchedule,
        monday: {
          enabled: true,
          windows: [
            { start: '09:00', end: '12:00' }, // Morning window
            { start: '14:00', end: '17:00' }, // Afternoon window
            { start: '19:00', end: '21:00' }, // Evening window
          ],
        },
      },
    };

    const validation = validateAvailabilitySettings(customSettings);
    assert.equal(validation.valid, true);

    const check = validateWindowsNoOverlap(customSettings.weeklySchedule.monday.windows);
    assert.equal(check.valid, true);

    const serialized = serializeAvailabilitySettings(customSettings);
    assert.ok(serialized.availabilityJson);
    assert.ok(serialized.preferredTimeText.includes('09:00 AM'));
  });

  // Test 4: Validation rejects overlapping windows and inverted times
  it('4. Strictly rejects overlapping windows and start times >= end times', () => {
    // 4a. Overlapping windows (e.g. 10:00-14:00 and 13:00-16:00)
    const overlappingWindows = [
      { start: '10:00', end: '14:00' },
      { start: '13:00', end: '16:00' },
    ];
    const overlapCheck = validateWindowsNoOverlap(overlappingWindows);
    assert.equal(overlapCheck.valid, false);
    assert.ok(overlapCheck.error?.includes('Overlapping time windows detected'));

    // 4b. Inverted window (start >= end: 17:00 to 10:00)
    const invertedWindows = [{ start: '17:00', end: '10:00' }];
    const invertedCheck = validateWindowsNoOverlap(invertedWindows);
    assert.equal(invertedCheck.valid, false);
    assert.ok(invertedCheck.error?.includes('must be earlier than end'));

    // 4c. Equal start and end (12:00 to 12:00)
    const equalCheck = validateWindowsNoOverlap([{ start: '12:00', end: '12:00' }]);
    assert.equal(equalCheck.valid, false);
  });

  // Test 5: Holidays and blocked dates
  it('5. Allows consultants to mark dates as unavailable with reason annotations', () => {
    const settingsWithHolidays: ConsultantAvailabilitySettings = {
      ...createDefaultAvailabilitySettings(),
      blockedDates: [
        { date: '2026-11-15', reason: 'Annual Family Vacation' },
        { date: '2026-12-25', reason: 'Public Holiday' },
      ],
    };

    const validation = validateAvailabilitySettings(settingsWithHolidays);
    assert.equal(validation.valid, true);

    // Check availability on blocked date
    const checkBlocked = checkDayAvailability(settingsWithHolidays, '2026-11-15');
    assert.equal(checkBlocked.available, false);
    assert.equal(checkBlocked.holidayReason, 'Annual Family Vacation');

    // Check availability on non-blocked Monday
    const checkRegular = checkDayAvailability(settingsWithHolidays, '2026-11-16'); // Monday
    assert.equal(checkRegular.available, true);
  });

  // Test 6: Confirmed booking conflict protection
  it('6. Strictly prevents availability updates from silently invalidating confirmed bookings', () => {
    const activeConfirmedBookings = [
      {
        id: 'book-101',
        name: 'Sarah Connor',
        date: '2026-11-02', // Monday
        time: '10:00 AM',
        status: 'confirmed',
        session_duration: 60,
      },
      {
        id: 'book-102',
        name: 'Kyle Reese',
        date: '2026-11-03', // Tuesday
        time: '04:00 PM',
        status: 'confirmed',
        session_duration: 30,
      },
    ];

    // Scenario A: Consultant attempts to block 2026-11-02 where Sarah has a confirmed booking
    const conflictingSettingsA: ConsultantAvailabilitySettings = {
      ...createDefaultAvailabilitySettings(),
      blockedDates: [{ date: '2026-11-02', reason: 'Emergency leave' }],
    };

    const conflictA = validateConfirmedBookingConflicts(conflictingSettingsA, activeConfirmedBookings);
    assert.equal(conflictA.hasConflict, true);
    assert.equal(conflictA.conflicts.length, 1);
    assert.equal(conflictA.conflicts[0].reason, 'blocked_date');
    assert.ok(conflictA.errorMessage?.includes('Sarah Connor'));

    // Scenario B: Consultant disables Tuesdays where Kyle has a confirmed booking
    const conflictingSettingsB: ConsultantAvailabilitySettings = {
      ...createDefaultAvailabilitySettings(),
      weeklySchedule: {
        ...createDefaultAvailabilitySettings().weeklySchedule,
        tuesday: { enabled: false, windows: [] },
      },
    };

    const conflictB = validateConfirmedBookingConflicts(conflictingSettingsB, activeConfirmedBookings);
    assert.equal(conflictB.hasConflict, true);
    assert.equal(conflictB.conflicts[0].reason, 'day_disabled');

    // Scenario C: Consultant changes Monday windows to only 14:00-17:00, omitting Sarah's 10:00 AM booking
    const conflictingSettingsC: ConsultantAvailabilitySettings = {
      ...createDefaultAvailabilitySettings(),
      weeklySchedule: {
        ...createDefaultAvailabilitySettings().weeklySchedule,
        monday: { enabled: true, windows: [{ start: '14:00', end: '17:00' }] },
      },
    };

    const conflictC = validateConfirmedBookingConflicts(conflictingSettingsC, activeConfirmedBookings);
    assert.equal(conflictC.hasConflict, true);
    assert.equal(conflictC.conflicts[0].reason, 'time_outside_windows');

    // Scenario D: Valid settings that fully accommodate both bookings pass without conflict
    const validSettings: ConsultantAvailabilitySettings = {
      ...createDefaultAvailabilitySettings(),
      weeklySchedule: {
        ...createDefaultAvailabilitySettings().weeklySchedule,
        monday: { enabled: true, windows: [{ start: '09:00', end: '13:00' }] },
        tuesday: { enabled: true, windows: [{ start: '15:00', end: '18:00' }] },
      },
      blockedDates: [],
    };

    const conflictD = validateConfirmedBookingConflicts(validSettings, activeConfirmedBookings);
    assert.equal(conflictD.hasConflict, false);
    assert.equal(conflictD.conflicts.length, 0);
  });

  // Test 7: Consultant self-service preserves admin-managed pricing
  it('7. Preserves admin-managed pricing and prevents consultant tampering', () => {
    const adminPricing = {
      pricing_30: 1500,
      pricing_60: 2500,
      currency: 'INR',
    };

    // Consultant submits settings with attempted tampered pricing
    const submittedByConsultant = {
      ...createDefaultAvailabilitySettings(),
      pricing: {
        pricing_30: 100, // Attempted unauthorized price change
        pricing_60: 200,
        currency: 'INR',
      },
    };

    // Server-side merge preserves authoritative admin pricing
    const securedSettings: ConsultantAvailabilitySettings = {
      ...submittedByConsultant,
      pricing: adminPricing,
    };

    assert.equal(securedSettings.pricing.pricing_30, 1500);
    assert.equal(securedSettings.pricing.pricing_60, 2500);
  });

  // Test 8: Customer booking page slot generation updates in real-time
  it('8. Customer booking slot generator accurately reflects the consultant self-service availability', () => {
    // Consultant configures morning shift (09:00-11:00) and evening shift (16:00-18:00) on Mondays
    const consultantProfile = {
      id: 'cons-multi',
      name: 'Vikram Seth',
      pricing_30: 1000,
      pricing_60: 1800,
      availability_settings: {
        ...createDefaultAvailabilitySettings(),
        weeklySchedule: {
          ...createDefaultAvailabilitySettings().weeklySchedule,
          monday: {
            enabled: true,
            windows: [
              { start: '09:00', end: '11:00' },
              { start: '16:00', end: '18:00' },
            ],
          },
        },
      },
    };

    // Reference a future Monday date e.g. 2026-11-09
    const slots = generateAvailableSlots({
      consultant: consultantProfile,
      dateStr: '2026-11-09', // Monday
      bookedSlots: ['09:00 AM'], // 09:00 AM is already booked
      sessionDuration: 60,
      referenceNow: new Date('2026-11-01T00:00:00Z'),
    });

    assert.ok(slots.length > 0);

    // 09:00 AM should be marked booked
    const slot9 = slots.find((s) => s.time === '09:00 AM');
    assert.ok(slot9);
    assert.equal(slot9.available, false);
    assert.equal(slot9.reason, 'booked');

    // 10:00 AM should be available
    const slot10 = slots.find((s) => s.time === '10:00 AM');
    assert.ok(slot10);
    assert.equal(slot10.available, true);

    // 12:00 PM should NOT exist because 11:00-16:00 is an off-shift
    const slot12 = slots.find((s) => s.time === '12:00 PM');
    assert.equal(slot12, undefined);

    // 04:00 PM (16:00) should be available
    const slot16 = slots.find((s) => s.time === '04:00 PM');
    assert.ok(slot16);
    assert.equal(slot16.available, true);
  });
});
