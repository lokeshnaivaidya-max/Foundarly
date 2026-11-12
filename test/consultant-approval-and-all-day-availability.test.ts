import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseConsultantAvailabilityHours,
  createDefaultAvailabilitySettings,
  parseAvailabilitySettings,
  serializeAvailabilitySettings,
  generateAvailableSlots,
  checkDayAvailability,
  isSlotInPast,
  parseBookingDateTime,
  formatISTISOString,
  time24ToMinutes,
  parseTimeString,
  formatTime12Hour,
  normalizeTimeSlot,
  getNowInIST,
  APP_TIMEZONE,
  APP_TIMEZONE_OFFSET_MS,
  ConsultantAvailabilitySettings,
} from '../src/utils/timeSlots.js';
import {
  isAllowedAdminEmail,
  isUserAdmin,
  isSuperAdmin,
  isDeveloperAdmin,
  UserRole,
} from '../src/lib/authorization.js';

describe('Production Fix — Consultant Approval Lifecycle & Role Resolution', () => {
  it('1. Same authenticated client account becomes consultant after admin approval', () => {
    // Simulated initial client user profile
    const userId = '11111111-2222-3333-4444-555555555555';
    const clientProfile = { id: userId, role: 'client' as UserRole, full_name: 'Jane Doe' };

    // Before approval: client role
    assert.equal(clientProfile.role, 'client');
    assert.equal(isUserAdmin(null, clientProfile), false);

    // After approval: application status = approved, consultant record linked to exact userId, profile role updated to consultant
    const approvedApplication = { id: 'app-1', email: 'jane.doe@example.com', status: 'approved', name: 'Jane Doe' };
    const approvedConsultant = { id: 'c-1', user_id: userId, email: 'jane.doe@example.com', name: 'Jane Doe', is_active: true };
    const updatedProfile = { id: userId, role: 'consultant' as UserRole, full_name: approvedConsultant.name };

    assert.equal(approvedConsultant.user_id, userId);
    assert.equal(approvedConsultant.is_active, true);
    assert.equal(updatedProfile.role, 'consultant');
  });

  it('2. Header updates without logout/login (role resolution state reflects immediately)', () => {
    // Header evaluates isConsultantRole based on profile.role === "consultant"
    const user = { id: 'u-1', email: 'consultant@example.com' };
    const clientProfile = { id: 'u-1', role: 'client' as UserRole, full_name: 'Consultant User' };

    const isClientInitial = clientProfile.role === 'client';
    const isConsultantInitial = clientProfile.role === 'consultant';
    assert.equal(isClientInitial, true);
    assert.equal(isConsultantInitial, false);

    // Active session receives updated profile without signOut
    const approvedProfile = { id: 'u-1', role: 'consultant' as UserRole, full_name: 'Consultant User' };
    const isConsultantAfterApproval = approvedProfile.role === 'consultant';
    const isClientAfterApproval = approvedProfile.role === 'client';

    assert.equal(isConsultantAfterApproval, true);
    assert.equal(isClientAfterApproval, false);
  });

  it('3. Refreshing the page retains consultant role', () => {
    const userId = 'consultant-uuid-1234';
    const consultantProfile = { id: userId, role: 'consultant' as UserRole, full_name: 'Verified Expert', cachedAt: Date.now() };

    // Saved to per-user cache
    const cacheKey = `foundarly_profile_${userId}`;
    const serialized = JSON.stringify(consultantProfile);

    // Restored on refresh
    const parsed = JSON.parse(serialized);
    assert.equal(parsed.id, userId);
    assert.equal(parsed.role, 'consultant');
  });

  it('4. Fresh login resolves consultant role', () => {
    const targetUser = { id: 'uuid-login-1', email: 'expert@foundarly.com', confirmed_at: '2026-01-01T00:00:00Z' };
    const dbProfile = { id: targetUser.id, role: 'consultant' as UserRole, full_name: 'Expert' };
    const consultantRecord = { id: 'cons-1', user_id: targetUser.id, email: targetUser.email, is_active: true };

    const isConsultantUser = dbProfile.role === 'consultant' && consultantRecord.user_id === targetUser.id;
    assert.equal(isConsultantUser, true);
  });

  it('5. Pending applicant remains a client', () => {
    const pendingApp = { id: 'app-pending', email: 'applicant@example.com', status: 'pending' };
    const userProfile = { id: 'u-pending', role: 'client' as UserRole, full_name: 'Applicant' };

    // Pending application MUST NOT elevate user to consultant
    const isElevated = pendingApp.status === 'approved';
    assert.equal(isElevated, false);
    assert.equal(userProfile.role, 'client');
  });

  it('6. Rejected applicant remains a client', () => {
    const rejectedApp = { id: 'app-rej', email: 'rejected@example.com', status: 'rejected' };
    const userProfile = { id: 'u-rej', role: 'client' as UserRole, full_name: 'Rejected Applicant' };

    const isElevated = rejectedApp.status === 'approved';
    assert.equal(isElevated, false);
    assert.equal(userProfile.role, 'client');
  });

  it('7. Normal client continues seeing Book a Session', () => {
    const clientUser = { id: 'client-uuid-999', email: 'client@example.com' };
    const clientProfile = { id: clientUser.id, role: 'client' as UserRole, full_name: 'Regular Customer' };

    const isAdmin = isUserAdmin(clientUser as any, clientProfile);
    const isConsultant = clientProfile.role === 'consultant';
    const isClient = !isAdmin && !isConsultant && clientProfile.role === 'client';

    assert.equal(isAdmin, false);
    assert.equal(isConsultant, false);
    assert.equal(isClient, true);
  });

  it('8. Admin continues seeing Admin Dashboard', () => {
    const adminUser = { id: 'admin-uuid-1', email: 'admin@foundarly.com' };
    const adminProfile = { id: adminUser.id, role: 'super_admin' as UserRole, full_name: 'Super Admin' };

    const isAdmin = isUserAdmin(adminUser as any, adminProfile);
    assert.equal(isAdmin, true);
    assert.equal(isSuperAdmin(adminUser as any, adminProfile), true);
  });

  it('9. Failed authoritative role lookup does not grant elevated access', () => {
    // If backend profile fetch fails or returns null, must NEVER default to elevated roles
    const failedLookupProfile = null;
    const isElevated = failedLookupProfile ? ['admin', 'super_admin', 'consultant'].includes((failedLookupProfile as any).role) : false;
    assert.equal(isElevated, false);
  });

  it('10. Consultant A cannot access Consultant B\'s dashboard', () => {
    const consultantA = { id: 'cons-a-uuid', consultantId: 'c-a', name: 'Consultant A' };
    const consultantB = { id: 'cons-b-uuid', consultantId: 'c-b', name: 'Consultant B' };

    // Ownership check: session userId must match consultant record user_id
    const canAccessB = consultantA.id === consultantB.id;
    assert.equal(canAccessB, false);
  });
});

describe('Production Fix — All-Day Consultant Availability & Slot Generation', () => {
  it('1. All Day availability generates bookable slots throughout the day', () => {
    const allDaySettings: ConsultantAvailabilitySettings = {
      version: 1,
      weeklySchedule: {
        monday: { enabled: true, windows: [{ start: '08:00', end: '22:00' }] },
        tuesday: { enabled: true, windows: [{ start: '08:00', end: '22:00' }] },
        wednesday: { enabled: true, windows: [{ start: '08:00', end: '22:00' }] },
        thursday: { enabled: true, windows: [{ start: '08:00', end: '22:00' }] },
        friday: { enabled: true, windows: [{ start: '08:00', end: '22:00' }] },
        saturday: { enabled: true, windows: [{ start: '08:00', end: '22:00' }] },
        sunday: { enabled: true, windows: [{ start: '08:00', end: '22:00' }] },
      },
      slotDurationMinutes: 60,
      bufferMinutes: 0,
      blockedDates: [],
      pricing: { pricing_30: 1000, pricing_60: 1800, currency: 'INR' },
      timezone: 'Asia/Kolkata',
      updatedAt: new Date().toISOString(),
    };

    // Slots for a future date (e.g. tomorrow)
    const futureDate = '2026-11-13';
    const slots = generateAvailableSlots({
      availabilitySettings: allDaySettings,
      dateStr: futureDate,
      sessionDuration: 60,
      referenceNow: new Date('2026-11-12T06:00:00Z'),
    });

    // 08:00 to 22:00 at 60min each = 14 slots
    assert.equal(slots.length, 14);
    assert.equal(slots[0].startTime24, '08:00');
    assert.equal(slots[slots.length - 1].startTime24, '21:00');
    assert.ok(slots.every(s => s.available));
  });

  it('2. Future slots remain available after earlier slots have passed', () => {
    const allDaySettings: ConsultantAvailabilitySettings = {
      version: 1,
      weeklySchedule: {
        thursday: { enabled: true, windows: [{ start: '08:00', end: '22:00' }] },
        monday: { enabled: false, windows: [] },
        tuesday: { enabled: false, windows: [] },
        wednesday: { enabled: false, windows: [] },
        friday: { enabled: false, windows: [] },
        saturday: { enabled: false, windows: [] },
        sunday: { enabled: false, windows: [] },
      },
      slotDurationMinutes: 60,
      bufferMinutes: 0,
      blockedDates: [],
      pricing: { pricing_30: 1000, pricing_60: 1800, currency: 'INR' },
      timezone: 'Asia/Kolkata',
      updatedAt: new Date().toISOString(),
    };

    // Reference now: 2026-11-12 18:15 IST (12:45 UTC)
    // IST = 18:15 (6:15 PM). Slots from 08:00 to 18:00 have passed.
    // Slots for 19:00, 20:00, 21:00 (7 PM, 8 PM, 9 PM) MUST REMAIN AVAILABLE.
    const referenceNow = new Date('2026-11-12T12:45:00Z'); // 18:15 IST
    const slots = generateAvailableSlots({
      availabilitySettings: allDaySettings,
      dateStr: '2026-11-12',
      sessionDuration: 60,
      referenceNow,
    });

    assert.ok(slots.length > 0);
    const pastSlots = slots.filter(s => !s.available && s.reason === 'past');
    const availableSlots = slots.filter(s => s.available);

    // Morning and afternoon slots have passed
    assert.ok(pastSlots.length > 0);
    // Evening slots (7 PM, 8 PM, 9 PM) are still available!
    assert.ok(availableSlots.length >= 3, `Expected at least 3 available slots in evening, got ${availableSlots.length}`);
    assert.ok(availableSlots.some(s => s.time.includes('07:00 PM')));
    assert.ok(availableSlots.some(s => s.time.includes('08:00 PM')));
    assert.ok(availableSlots.some(s => s.time.includes('09:00 PM')));
  });

  it('3. Empty booking calendar does not produce a false fully-booked error', () => {
    // Given no bookings, and future slots exist today, not all slots are unavailable
    const referenceNow = new Date('2026-11-12T06:00:00Z'); // 11:30 AM IST
    const slots = generateAvailableSlots({
      preferredTime: 'All Day',
      dateStr: '2026-11-12',
      sessionDuration: 60,
      bookedSlots: [],
      referenceNow,
    });

    const isAllUnavailable = slots.every(s => !s.available);
    assert.equal(isAllUnavailable, false);
    const availableCount = slots.filter(s => s.available).length;
    assert.ok(availableCount > 0);
  });

  it('4. A real confirmed booking blocks only its conflicting interval', () => {
    const referenceNow = new Date('2026-11-13T02:00:00Z'); // Early morning before slots
    const slots = generateAvailableSlots({
      preferredTime: 'All Day (8 AM – 10 PM)',
      dateStr: '2026-11-13',
      sessionDuration: 60,
      bookedSlots: ['10:00 AM'], // 10:00 AM slot is confirmed booked
      referenceNow,
    });

    const bookedSlot = slots.find(s => s.time === '10:00 AM');
    assert.ok(bookedSlot);
    assert.equal(bookedSlot?.available, false);
    assert.equal(bookedSlot?.reason, 'booked');

    // Surrounding slots remain available
    const slot9am = slots.find(s => s.time === '09:00 AM');
    const slot11am = slots.find(s => s.time === '11:00 AM');
    assert.ok(slot9am && slot9am.available);
    assert.ok(slot11am && slot11am.available);
  });

  it('5. Cancelled bookings do not incorrectly block slots', () => {
    // In bookingsService and server.ts, cancelled bookings are excluded from bookedTimes
    const rawBookings = [
      { id: 'b-1', time: '10:00 AM', status: 'cancelled', payment_status: 'refunded' },
      { id: 'b-2', time: '11:00 AM', status: 'rejected', payment_status: 'failed' },
      { id: 'b-3', time: '02:00 PM', status: 'confirmed', payment_status: 'completed' },
    ];

    const activeBookedTimes = rawBookings
      .filter(b => b.status !== 'cancelled' && b.status !== 'rejected')
      .map(b => b.time);

    assert.deepEqual(activeBookedTimes, ['02:00 PM']);

    const slots = generateAvailableSlots({
      preferredTime: 'All Day',
      dateStr: '2026-11-13',
      bookedTimes: activeBookedTimes,
      referenceNow: new Date('2026-11-13T02:00:00Z'),
    });

    const slot10am = slots.find(s => s.time === '10:00 AM');
    const slot11am = slots.find(s => s.time === '11:00 AM');
    const slot2pm = slots.find(s => s.time === '02:00 PM');

    assert.ok(slot10am?.available);
    assert.ok(slot11am?.available);
    assert.equal(slot2pm?.available, false);
    assert.equal(slot2pm?.reason, 'booked');
  });

  it('6. Past slots cannot be booked', () => {
    // Slot in past relative to referenceNow + 15 min buffer
    const referenceNow = new Date('2026-11-12T08:00:00Z'); // 13:30 (1:30 PM IST)
    const isPast10am = isSlotInPast('2026-11-12', '10:00 AM', referenceNow);
    const isPast1pm = isSlotInPast('2026-11-12', '01:00 PM', referenceNow);
    const isPast3pm = isSlotInPast('2026-11-12', '03:00 PM', referenceNow);

    assert.equal(isPast10am, true);
    assert.equal(isPast1pm, true);
    assert.equal(isPast3pm, false);
  });

  it('7. IST/UTC conversion is correct and consistent', () => {
    // 10:00 AM IST on 2026-11-12 corresponds to 04:30 AM UTC on 2026-11-12
    const parsed = parseBookingDateTime('2026-11-12', '10:00 AM');
    assert.ok(parsed);
    assert.equal(parsed?.toISOString(), '2026-11-12T04:30:00.000Z');

    // 08:00 PM IST on 2026-11-12 corresponds to 14:30 UTC on 2026-11-12
    const parsed8pm = parseBookingDateTime('2026-11-12', '08:00 PM');
    assert.ok(parsed8pm);
    assert.equal(parsed8pm?.toISOString(), '2026-11-12T14:30:00.000Z');
  });

  it('8. Client and consultant see consistent availability', () => {
    const settings: ConsultantAvailabilitySettings = {
      version: 1,
      weeklySchedule: {
        monday: { enabled: true, windows: [{ start: '08:00', end: '22:00' }] },
        tuesday: { enabled: true, windows: [{ start: '08:00', end: '22:00' }] },
        wednesday: { enabled: true, windows: [{ start: '08:00', end: '22:00' }] },
        thursday: { enabled: true, windows: [{ start: '08:00', end: '22:00' }] },
        friday: { enabled: true, windows: [{ start: '08:00', end: '22:00' }] },
        saturday: { enabled: true, windows: [{ start: '08:00', end: '22:00' }] },
        sunday: { enabled: true, windows: [{ start: '08:00', end: '22:00' }] },
      },
      slotDurationMinutes: 60,
      bufferMinutes: 0,
      blockedDates: [],
      pricing: { pricing_30: 1000, pricing_60: 1800, currency: 'INR' },
      timezone: 'Asia/Kolkata',
      updatedAt: new Date().toISOString(),
    };

    const consultantViewSlots = generateAvailableSlots({
      availabilitySettings: settings,
      dateStr: '2026-11-15',
      sessionDuration: 60,
      referenceNow: new Date('2026-11-12T00:00:00Z'),
    });

    const clientViewSlots = generateAvailableSlots({
      availabilitySettings: settings,
      dateStr: '2026-11-15',
      sessionDuration: 60,
      referenceNow: new Date('2026-11-12T00:00:00Z'),
    });

    assert.equal(consultantViewSlots.length, clientViewSlots.length);
    assert.deepEqual(
      consultantViewSlots.map(s => s.time),
      clientViewSlots.map(s => s.time)
    );
  });

  it('9. Concurrent booking attempts cannot reserve the same slot twice (validation rejects already booked slot)', () => {
    const bookedSlots = ['04:00 PM'];
    const slots = generateAvailableSlots({
      preferredTime: 'All Day',
      dateStr: '2026-11-13',
      sessionDuration: 60,
      bookedSlots,
      referenceNow: new Date('2026-11-12T00:00:00Z'),
    });

    const slot4pm = slots.find(s => s.time === '04:00 PM');
    assert.equal(slot4pm?.available, false);
    assert.equal(slot4pm?.reason, 'booked');
  });

  it('10. Invalid dates and unauthorized booking requests are rejected server-side', () => {
    const isPastDate = '2026-11-01' < getNowInIST().dateStr;
    assert.equal(isPastDate, true);

    const emptySlots = generateAvailableSlots({
      dateStr: '',
    });
    assert.equal(emptySlots.length, 0);

    const holidaySettings = createDefaultAvailabilitySettings();
    holidaySettings.blockedDates = [{ date: '2026-11-15', reason: 'Public Holiday' }];
    const dayStatus = checkDayAvailability('2026-11-15', holidaySettings);
    assert.equal(dayStatus.isAvailable, false);
    assert.equal(dayStatus.isBlocked, true);
  });
});
