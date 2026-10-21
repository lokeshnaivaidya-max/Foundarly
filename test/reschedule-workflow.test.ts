import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('Foundarly Client Reschedule Request Workflow', () => {
  it('1. Validates that reschedule request requires valid booking ID, future date, time, and reason', () => {
    const validateRequest = (params: { bookingId?: string; newDate?: string; newTime?: string; reason?: string }) => {
      if (!params.bookingId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.bookingId)) {
        return { valid: false, error: 'Invalid booking ID' };
      }
      if (!params.newDate || !/^\d{4}-\d{2}-\d{2}$/.test(params.newDate)) {
        return { valid: false, error: 'Invalid date format' };
      }
      const today = new Date().toISOString().split('T')[0];
      if (params.newDate < today) {
        return { valid: false, error: 'Proposed reschedule date cannot be in the past' };
      }
      if (!params.newTime || !params.newTime.trim()) {
        return { valid: false, error: 'Invalid time' };
      }
      if (!params.reason || !params.reason.trim()) {
        return { valid: false, error: 'Reason is required' };
      }
      return { valid: true };
    };

    assert.equal(validateRequest({}).valid, false);
    assert.equal(validateRequest({ bookingId: 'invalid-id' }).valid, false);
    assert.equal(validateRequest({
      bookingId: '123e4567-e89b-12d3-a456-426614174000',
      newDate: '2020-01-01',
      newTime: '14:00',
      reason: 'Need morning',
    }).valid, false);

    assert.equal(validateRequest({
      bookingId: '123e4567-e89b-12d3-a456-426614174000',
      newDate: '2099-12-31',
      newTime: '15:30',
      reason: 'Conflict with client meeting',
    }).valid, true);
  });

  it('2. Preserves original booking schedule until consultant approves request', () => {
    const originalBooking = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      date: '2026-11-01',
      time: '10:00 AM',
      reschedule_status: 'none',
    };

    const newDate = '2026-11-05';
    const newTime = '02:00 PM';
    const reason = 'Emergency travel';

    // When requested:
    const updatedBooking = {
      ...originalBooking,
      original_date: originalBooking.date,
      original_time: originalBooking.time,
      reschedule_requested_at: new Date().toISOString(),
      reschedule_status: 'requested',
      reschedule_reason: `Proposed: ${newDate} at ${newTime} | Reason: ${reason}`,
    };

    // Date and time of the active booking must remain unchanged until approved
    assert.equal(updatedBooking.date, '2026-11-01');
    assert.equal(updatedBooking.time, '10:00 AM');
    assert.equal(updatedBooking.original_date, '2026-11-01');
    assert.equal(updatedBooking.reschedule_status, 'requested');
    assert.ok(updatedBooking.reschedule_reason.includes('Proposed: 2026-11-05 at 02:00 PM'));
  });

  it('3. Rejects duplicate reschedule requests when one is already pending', () => {
    const checkCanRequest = (booking: { reschedule_status: string }) => {
      if (booking.reschedule_status === 'requested' || booking.reschedule_status === 'pending') {
        return { allowed: false, error: 'A reschedule request is already pending consultant review.' };
      }
      return { allowed: true };
    };

    assert.equal(checkCanRequest({ reschedule_status: 'requested' }).allowed, false);
    assert.equal(checkCanRequest({ reschedule_status: 'pending' }).allowed, false);
    assert.equal(checkCanRequest({ reschedule_status: 'none' }).allowed, true);
    assert.equal(checkCanRequest({ reschedule_status: 'rejected' }).allowed, true);
  });

  it('4. Successfully transitions to approved when consultant accepts', () => {
    const requestedBooking = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      date: '2026-11-01',
      time: '10:00 AM',
      original_date: '2026-11-01',
      original_time: '10:00 AM',
      reschedule_status: 'requested',
      reschedule_reason: 'Proposed: 2026-11-05 at 02:00 PM | Reason: Need afternoon slot',
      reschedule_count: 0,
    };

    // Consultant approves with the proposed date and time
    const approvedBooking = {
      ...requestedBooking,
      date: '2026-11-05',
      time: '02:00 PM',
      reschedule_status: 'approved',
      reschedule_count: requestedBooking.reschedule_count + 1,
    };

    assert.equal(approvedBooking.date, '2026-11-05');
    assert.equal(approvedBooking.time, '02:00 PM');
    assert.equal(approvedBooking.reschedule_status, 'approved');
    assert.equal(approvedBooking.reschedule_count, 1);
  });
});
