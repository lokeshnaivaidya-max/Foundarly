/**
 * 7-Day Meeting Rejoin & Session Lifecycle Utilities
 *
 * Rules:
 * - Within 7 days after the scheduled consultation has taken place,
 *   authorized participants (client and assigned consultant) can rejoin
 *   the original meeting room for follow-up clarifications.
 * - Eligibility is strictly calculated from server-side reference timestamps.
 * - Cancelled or rejected bookings are never eligible for rejoin.
 */

export const REJOIN_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds (604,800,000 ms)
export const EARLY_JOIN_WINDOW_MS = 5 * 60 * 1000; // 5 minutes before scheduled start

export interface SessionTiming {
  scheduledStart: Date;
  scheduledEnd: Date;
  sessionReferenceEnd: Date;
  rejoinDeadline: Date;
  joinWindowStart: Date;
}

export type MeetingSessionStatus = 'upcoming' | 'live' | 'rejoin_eligible' | 'expired';

export interface RejoinEligibilityResult {
  sessionStatus: MeetingSessionStatus;
  canJoin: boolean;
  isRejoin: boolean;
  rejoinDeadline: Date;
  rejoinDaysRemaining: number;
  rejoinTimeRemainingMs: number;
  timeUntilStartMs: number;
}

export interface ParticipantAuthResult {
  authorized: boolean;
  role: 'client' | 'consultant' | 'admin' | null;
  reason?: string;
  code?: string;
}

/**
 * Parses time string like "14:30", "2:30 PM", "10:00 AM", or "Flexible"
 * and returns { hours, minutes }. Defaults to 10:00 if invalid or flexible.
 */
export function parseTimeString(timeStr?: string | null): { hours: number; minutes: number } {
  if (!timeStr || typeof timeStr !== 'string' || timeStr.trim().toLowerCase() === 'flexible') {
    return { hours: 10, minutes: 0 };
  }

  const clean = timeStr.trim();

  // Match 12-hour AM/PM format (e.g., "10:30 AM", "02:15 PM")
  const ampmMatch = clean.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)$/i);
  if (ampmMatch) {
    let hours = parseInt(ampmMatch[1], 10);
    const minutes = parseInt(ampmMatch[2], 10);
    const meridiem = ampmMatch[3].toUpperCase();

    if (meridiem === 'PM' && hours < 12) hours += 12;
    if (meridiem === 'AM' && hours === 12) hours = 0;
    return { hours, minutes };
  }

  // Match 24-hour format (e.g., "14:30", "09:00", "14:30:00")
  const militaryMatch = clean.match(/^(\d{1,2}):(\d{2})/);
  if (militaryMatch) {
    return {
      hours: parseInt(militaryMatch[1], 10),
      minutes: parseInt(militaryMatch[2], 10),
    };
  }

  return { hours: 10, minutes: 0 };
}

/**
 * Robustly parses a booking record into its session timing coordinates.
 */
export function parseSessionTimes(booking: {
  date: string;
  time?: string | null;
  session_duration?: number | null;
  meeting_started_at?: string | null;
  meeting_ended_at?: string | null;
}): SessionTiming {
  const durationMinutes = booking.session_duration && booking.session_duration > 0
    ? booking.session_duration
    : 60;
  const durationMs = durationMinutes * 60 * 1000;

  const { hours, minutes } = parseTimeString(booking.time);

  // Parse YYYY-MM-DD cleanly to avoid cross-timezone shifts
  let scheduledStart: Date;
  if (booking.date && booking.date.includes('T')) {
    scheduledStart = new Date(booking.date);
  } else if (booking.date) {
    const parts = booking.date.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      scheduledStart = new Date(Date.UTC(year, month, day, hours, minutes, 0));
    } else {
      scheduledStart = new Date(`${booking.date}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00Z`);
    }
  } else {
    scheduledStart = new Date();
  }

  if (isNaN(scheduledStart.getTime())) {
    scheduledStart = new Date();
  }

  const scheduledEnd = new Date(scheduledStart.getTime() + durationMs);
  const joinWindowStart = new Date(scheduledStart.getTime() - EARLY_JOIN_WINDOW_MS);

  // Session reference end: either the actual ended timestamp, or max(started + duration, scheduledEnd)
  let sessionReferenceEnd = scheduledEnd;

  if (booking.meeting_ended_at) {
    const endedAt = new Date(booking.meeting_ended_at);
    if (!isNaN(endedAt.getTime()) && endedAt.getTime() > scheduledStart.getTime()) {
      sessionReferenceEnd = endedAt;
    }
  } else if (booking.meeting_started_at) {
    const startedAt = new Date(booking.meeting_started_at);
    if (!isNaN(startedAt.getTime())) {
      const actualCalculatedEnd = new Date(startedAt.getTime() + durationMs);
      if (actualCalculatedEnd.getTime() > sessionReferenceEnd.getTime()) {
        sessionReferenceEnd = actualCalculatedEnd;
      }
    }
  }

  const rejoinDeadline = new Date(sessionReferenceEnd.getTime() + REJOIN_WINDOW_MS);

  return {
    scheduledStart,
    scheduledEnd,
    sessionReferenceEnd,
    rejoinDeadline,
    joinWindowStart,
  };
}

/**
 * Calculates meeting status and 7-day rejoin eligibility based on a reference timestamp.
 * Server MUST pass its own authoritative Date to prevent client-side clock tampering.
 */
export function calculateRejoinEligibility(
  booking: {
    date: string;
    time?: string | null;
    session_duration?: number | null;
    status?: string | null;
    payment_status?: string | null;
    meeting_started_at?: string | null;
    meeting_ended_at?: string | null;
  },
  referenceNow: Date = new Date()
): RejoinEligibilityResult {
  const { scheduledEnd, joinWindowStart, rejoinDeadline } = parseSessionTimes(booking);
  const nowMs = referenceNow.getTime();
  const scheduledEndMs = scheduledEnd.getTime();
  const joinWindowStartMs = joinWindowStart.getTime();
  const rejoinDeadlineMs = rejoinDeadline.getTime();

  const isRejectedOrCancelled = (
    booking.status === 'cancelled' ||
    booking.status === 'rejected' ||
    booking.payment_status === 'rejected' ||
    booking.payment_status === 'failed'
  );

  // Cancelled/rejected bookings are never joinable
  if (isRejectedOrCancelled) {
    return {
      sessionStatus: 'expired',
      canJoin: false,
      isRejoin: false,
      rejoinDeadline,
      rejoinDaysRemaining: 0,
      rejoinTimeRemainingMs: 0,
      timeUntilStartMs: Math.max(0, joinWindowStartMs - nowMs),
    };
  }

  // 1. Upcoming: Before the 5-minute pre-call join window
  if (nowMs < joinWindowStartMs) {
    return {
      sessionStatus: 'upcoming',
      canJoin: false,
      isRejoin: false,
      rejoinDeadline,
      rejoinDaysRemaining: 7,
      rejoinTimeRemainingMs: REJOIN_WINDOW_MS,
      timeUntilStartMs: joinWindowStartMs - nowMs,
    };
  }

  // 2. Live: Inside the original session window (5 minutes before to scheduled end)
  if (nowMs >= joinWindowStartMs && nowMs <= scheduledEndMs) {
    return {
      sessionStatus: 'live',
      canJoin: true,
      isRejoin: false,
      rejoinDeadline,
      rejoinDaysRemaining: 7,
      rejoinTimeRemainingMs: Math.max(0, rejoinDeadlineMs - nowMs),
      timeUntilStartMs: 0,
    };
  }

  // 3. Rejoin Eligible: Within the 7 days after the original session has taken place
  if (nowMs > scheduledEndMs && nowMs <= rejoinDeadlineMs) {
    const remainingMs = Math.max(0, rejoinDeadlineMs - nowMs);
    const daysRemaining = Math.max(1, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));

    return {
      sessionStatus: 'rejoin_eligible',
      canJoin: true,
      isRejoin: true,
      rejoinDeadline,
      rejoinDaysRemaining: daysRemaining,
      rejoinTimeRemainingMs: remainingMs,
      timeUntilStartMs: 0,
    };
  }

  // 4. Expired: 7-day follow-up period has elapsed
  return {
    sessionStatus: 'expired',
    canJoin: false,
    isRejoin: false,
    rejoinDeadline,
    rejoinDaysRemaining: 0,
    rejoinTimeRemainingMs: 0,
    timeUntilStartMs: 0,
  };
}

/**
 * Validates whether an authenticated user is authorized to join the session.
 * Authorized participants:
 * - Client (user_id matches booking.user_id, or email matches booking.email)
 * - Assigned Consultant (consultant.user_id matches, or consultant.email matches)
 * - Platform Admin
 */
export function validateParticipantAccess(
  user: { id: string; email?: string | null },
  booking: {
    id: string;
    user_id?: string | null;
    email?: string | null;
    consultant_id?: string | null;
    status?: string | null;
    payment_status?: string | null;
  },
  consultant?: {
    id?: string | null;
    user_id?: string | null;
    email?: string | null;
  } | null,
  isAdmin: boolean = false
): ParticipantAuthResult {
  if (!user || !user.id) {
    return {
      authorized: false,
      role: null,
      reason: 'Authentication required. Please sign in to access the meeting room.',
      code: 'UNAUTHENTICATED',
    };
  }

  const userEmail = (user.email || '').trim().toLowerCase();
  const bookingEmail = (booking.email || '').trim().toLowerCase();
  const consultantEmail = (consultant?.email || '').trim().toLowerCase();

  // Booking lifecycle checks
  if (booking.status === 'cancelled' || booking.status === 'rejected' || booking.payment_status === 'rejected') {
    return {
      authorized: false,
      role: null,
      reason: 'This consultation has been cancelled or rejected and cannot be accessed.',
      code: 'BOOKING_CANCELLED',
    };
  }

  if (booking.status === 'pending') {
    return {
      authorized: false,
      role: null,
      reason: 'This consultation is pending verification and has not been confirmed yet.',
      code: 'BOOKING_PENDING',
    };
  }

  // 1. Platform Admin check
  if (isAdmin) {
    return { authorized: true, role: 'admin' };
  }

  // 2. Client verification
  const isClientById = Boolean(booking.user_id && booking.user_id === user.id);
  const isClientByEmail = Boolean(userEmail && bookingEmail && userEmail === bookingEmail);

  if (isClientById || isClientByEmail) {
    return { authorized: true, role: 'client' };
  }

  // 3. Consultant verification
  const isConsultantById = Boolean(consultant?.user_id && consultant.user_id === user.id);
  const isConsultantByEmail = Boolean(userEmail && consultantEmail && userEmail === consultantEmail);

  if (isConsultantById || isConsultantByEmail) {
    return { authorized: true, role: 'consultant' };
  }

  return {
    authorized: false,
    role: null,
    reason: 'Access denied: Only the scheduled client and assigned consultant are permitted to access this meeting.',
    code: 'UNAUTHORIZED_PARTICIPANT',
  };
}
