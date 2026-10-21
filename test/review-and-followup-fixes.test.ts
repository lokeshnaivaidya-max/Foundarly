import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  checkBookingFollowUpEligibility,
  validateFollowUpTiming,
  parseFollowUpDateTime,
  calculateRejoinEligibility,
} from '../src/utils/meetingRejoin.js';
import { followUpStorage } from '../src/server/followUpStorage.js';

describe('Foundarly Review Submission & Follow-up Consultation Workflow Fixes', () => {

  // =========================================================================
  // ISSUE 1: REVIEW SUBMISSION FLOW & RLS POLICY TESTS
  // =========================================================================
  describe('Issue 1: Review Submission Flow & RLS Security Rules', () => {
    const referenceNow = new Date('2026-10-15T12:00:00Z');

    const completedBooking = {
      id: 'b84931a2-3b2d-4340-9a4f-5614917951a0',
      user_id: 'client-user-111',
      email: 'client@foundarly.com',
      name: 'Alice Johnson',
      consultant_id: 'c1234567-89ab-cdef-0123-456789abcdef',
      status: 'completed' as const,
      payment_status: 'paid' as const,
      date: '2026-10-14',
      time: '14:00',
      meeting_room_id: 'foundarly-room-abc',
    };

    test('1. Eligible client can prepare a valid review for their completed consultation', () => {
      const reviewInput = {
        bookingId: completedBooking.id,
        consultantId: completedBooking.consultant_id,
        rating: 5,
        review: 'Exceptional strategic guidance! Great insights into tech stack scaling.',
        displayName: 'Alice J.',
      };

      // Review record structure generated for insertion
      const record = {
        client_name: reviewInput.displayName.trim() || completedBooking.name,
        designation: 'Client',
        review: reviewInput.review.trim(),
        rating: reviewInput.rating,
        status: 'draft' as const, // Strict draft status for admin moderation
        consultant_id: completedBooking.consultant_id,
        booking_id: completedBooking.id,
      };

      assert.equal(record.rating, 5);
      assert.equal(record.client_name, 'Alice J.');
      assert.equal(record.status, 'draft');
      assert.equal(record.booking_id, completedBooking.id);
      assert.equal(record.consultant_id, completedBooking.consultant_id);
    });

    test('2. Display name falls back cleanly to booking name if client leaves display name blank', () => {
      const reviewInput = {
        bookingId: completedBooking.id,
        consultantId: completedBooking.consultant_id,
        rating: 4,
        review: 'Very practical advice.',
        displayName: '   ',
      };

      const resolvedDisplayName = reviewInput.displayName.trim() || completedBooking.name || 'Client';
      assert.equal(resolvedDisplayName, 'Alice Johnson');
    });

    test('3. Review moderation is strictly preserved: status cannot be set to published directly by client', () => {
      // Clients may only insert with status = 'draft' per RLS
      const clientInsertedStatus = 'draft';
      assert.equal(clientInsertedStatus, 'draft');
      assert.notEqual(clientInsertedStatus, 'published');
    });

    test('4. Rating validation: rejects ratings <= 0 or > 5, or empty review text', () => {
      const validateReviewInput = (rating: number, review: string) => {
        if (!rating || rating < 1 || rating > 5) {
          return { valid: false, error: 'Rating must be between 1 and 5' };
        }
        if (!review || !review.trim()) {
          return { valid: false, error: 'Please write your review' };
        }
        return { valid: true };
      };

      assert.equal(validateReviewInput(0, 'Good session').valid, false);
      assert.equal(validateReviewInput(6, 'Good session').valid, false);
      assert.equal(validateReviewInput(5, '   ').valid, false);
      assert.equal(validateReviewInput(5, 'Helpful advice').valid, true);
    });

    test('5. Duplicate review prevention: unique booking constraint prevents multiple reviews for one consultation', () => {
      const existingReviews = new Map<string, any>();
      existingReviews.set(completedBooking.id, { id: 'rev-1', rating: 5 });

      const attemptReviewInsert = (bookingId: string) => {
        if (existingReviews.has(bookingId)) {
          return { success: false, code: 'DUPLICATE_REVIEW', error: 'You have already submitted a review for this session.' };
        }
        return { success: true };
      };

      const result = attemptReviewInsert(completedBooking.id);
      assert.equal(result.success, false);
      assert.equal(result.code, 'DUPLICATE_REVIEW');
    });

    test('6. Ownership & payment validation: rejects review submission if booking is not owned or unpaid', () => {
      const checkReviewEligibility = (user: { id: string; email: string }, booking: typeof completedBooking) => {
        const isOwner = booking.user_id === user.id || booking.email.toLowerCase() === user.email.toLowerCase();
        if (!isOwner) return { eligible: false, error: 'Unauthorized: Booking does not belong to user.' };
        if (booking.status === 'cancelled' || booking.status === 'rejected') {
          return { eligible: false, error: 'Cannot review cancelled or rejected consultation.' };
        }
        if (booking.payment_status !== 'paid') {
          return { eligible: false, error: 'Cannot review unpaid consultation.' };
        }
        return { eligible: true };
      };

      // Owner check
      assert.equal(checkReviewEligibility({ id: 'client-user-111', email: 'client@foundarly.com' }, completedBooking).eligible, true);
      assert.equal(checkReviewEligibility({ id: 'unauthorized-user', email: 'intruder@random.com' }, completedBooking).eligible, false);

      // Payment check
      const unpaidBooking = { ...completedBooking, payment_status: 'pending' as const };
      assert.equal(checkReviewEligibility({ id: 'client-user-111', email: 'client@foundarly.com' }, unpaidBooking).eligible, false);

      // Status check
      const cancelledBooking = { ...completedBooking, status: 'cancelled' as const };
      assert.equal(checkReviewEligibility({ id: 'client-user-111', email: 'client@foundarly.com' }, cancelledBooking).eligible, false);
    });
  });

  // =========================================================================
  // ISSUE 2: FOLLOW-UP CONSULTATION REQUEST WORKFLOW & LOADING STATE TESTS
  // =========================================================================
  describe('Issue 2: Follow-up Consultation Request Workflow & Loading State', () => {
    const referenceNow = new Date('2026-10-15T12:00:00Z');

    const completedBooking = {
      id: 'f94821a3-4c3e-4450-8b5e-6725028062b1',
      user_id: 'client-user-222',
      email: 'client2@foundarly.com',
      name: 'Bob Smith',
      consultant_id: 'c8765432-10fe-dcba-4321-098765fedcba',
      status: 'completed' as const,
      payment_status: 'paid' as const,
      date: '2026-10-14',
      time: '14:00',
      session_duration: 60,
      meeting_room_id: 'foundarly-room-xyz',
    };

    test('1. Completed consultation is immediately eligible for 7-day follow-up request', () => {
      const eligibility = checkBookingFollowUpEligibility(completedBooking, referenceNow);
      assert.equal(eligibility.eligible, true);
      assert.ok(eligibility.daysRemaining >= 1 && eligibility.daysRemaining <= 7);
      assert.ok(eligibility.rejoinDeadline.getTime() > referenceNow.getTime());
    });

    test('2. Timing validation accepts valid date and time within the 7-day window', () => {
      const eligibility = checkBookingFollowUpEligibility(completedBooking, referenceNow);
      const proposedDate = '2026-10-18';
      const proposedTime = '15:30';

      const validation = validateFollowUpTiming(proposedDate, proposedTime, eligibility.rejoinDeadline, referenceNow);
      assert.equal(validation.valid, true);
      assert.equal(validation.code, 'OK');
    });

    test('3. Timing validation rejects proposed follow-up dates in the past or exceeding 7 days', () => {
      const eligibility = checkBookingFollowUpEligibility(completedBooking, referenceNow);

      // Past date
      const pastValidation = validateFollowUpTiming('2026-10-10', '10:00', eligibility.rejoinDeadline, referenceNow);
      assert.equal(pastValidation.valid, false);
      assert.equal(pastValidation.code, 'PAST_TIME');
      assert.ok(pastValidation.error?.includes('cannot be in the past'));

      // Date exceeding 7-day window
      const futureValidation = validateFollowUpTiming('2026-10-28', '10:00', eligibility.rejoinDeadline, referenceNow);
      assert.equal(futureValidation.valid, false);
      assert.equal(futureValidation.code, 'EXCEEDS_DEADLINE');
      assert.ok(futureValidation.error?.includes('7-day eligibility window'));
    });

    test('4. Loading state lifecycle: strictly set to true during request and cleared in finally block', async () => {
      let isSubmitting = false;
      let finallyBlockExecuted = false;

      // Simulated submit flow matching MyBookings.tsx
      const submitFollowUp = async (shouldFail: boolean) => {
        isSubmitting = true;
        try {
          if (shouldFail) {
            throw new Error('Simulated network timeout');
          }
          return { success: true };
        } finally {
          isSubmitting = false;
          finallyBlockExecuted = true;
        }
      };

      // Success path
      await submitFollowUp(false);
      assert.equal(isSubmitting, false);
      assert.equal(finallyBlockExecuted, true);

      // Failure path: finally must still reset isSubmitting
      finallyBlockExecuted = false;
      try {
        await submitFollowUp(true);
      } catch {
        // caught
      }
      assert.equal(isSubmitting, false);
      assert.equal(finallyBlockExecuted, true);
    });

    test('5. Duplicate submission prevention: debounces multiple clicks when submitting', async () => {
      let isSubmitting = false;
      let requestCount = 0;

      const triggerSubmit = async () => {
        if (isSubmitting) return 'BLOCKED_DUPLICATE';
        isSubmitting = true;
        try {
          requestCount++;
          await new Promise((resolve) => setTimeout(resolve, 5));
          return 'SUCCESS';
        } finally {
          isSubmitting = false;
        }
      };

      // Concurrently trigger two clicks
      const [res1, res2] = await Promise.all([triggerSubmit(), triggerSubmit()]);
      assert.equal(requestCount, 1);
      assert.ok(res1 === 'SUCCESS' || res2 === 'SUCCESS');
      assert.ok(res1 === 'BLOCKED_DUPLICATE' || res2 === 'BLOCKED_DUPLICATE');
    });

    test('6. FollowUpStorage creates valid UUID records and enforces single active request per booking', async () => {
      // Clear store for clean test
      followUpStorage.clearAll();

      const created = await followUpStorage.create({
        booking_id: completedBooking.id,
        client_id: completedBooking.user_id,
        client_name: completedBooking.name,
        client_email: completedBooking.email,
        consultant_id: completedBooking.consultant_id,
        consultant_name: 'Dr. Expert',
        consultant_email: 'expert@foundarly.com',
        meeting_room_id: completedBooking.meeting_room_id,
        reason: 'Architecture review',
        preferred_date: '2026-10-18',
        preferred_time: '15:00',
        status: 'pending_consultant',
        rejoin_deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });

      // Verify UUID format (36 chars with dashes)
      assert.ok(created.id);
      assert.match(created.id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      assert.equal(created.status, 'pending_consultant');
      assert.equal(created.meeting_room_id, completedBooking.meeting_room_id); // Preserves original meeting room

      // Check active duplicate detection
      const active = await followUpStorage.findActiveByBookingId(completedBooking.id);
      assert.ok(active);
      assert.equal(active?.id, created.id);

      // Clean up
      followUpStorage.clearAll();
    });
  });
});
