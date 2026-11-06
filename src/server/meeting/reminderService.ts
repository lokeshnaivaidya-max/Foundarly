/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Foundarly Automated Meeting Reminder Engine
 * 
 * Requirements:
 * - Sends reminder emails to both client and consultant.
 * - Dispatches once every 1 hour during the 24 hours preceding the scheduled meeting.
 * - Includes formatted date, time, timezone (IST), participant info, and meeting room link.
 * - Stops sending when meeting has started, is cancelled, completed, or rejected.
 * - Prevents duplicate emails for the same reminder interval.
 * - Gracefully handles rescheduled meetings based on the newly scheduled timestamp.
 * - Safe delivery logging and error isolation.
 */

import { reminderStorage, SentReminderRecord } from './reminderStorage.js';
import {
  generateMeetingReminderEmailHTML,
  generateMeetingReminderEmailText,
  EmailMeetingReminderData,
  FOUNDARLY_BRAND,
} from '../../utils/emailTemplates.js';
import { sendEmail, getSmtpConfig } from '../mailer.js';
import { parseSessionTimes } from '../../utils/meetingRejoin.js';
import { meetingParticipantStorage } from '../meetingParticipantStorage.js';

export interface BookingReminderCandidate {
  id: string;
  meeting_room_id?: string | null;
  name: string;
  email: string;
  date: string;
  time: string;
  session_duration?: number | null;
  status: string;
  meeting_started_at?: string | null;
  consultant_id?: string;
  consultants?: {
    id: string;
    name: string;
    title?: string;
    email: string;
    user_id?: string;
  } | Array<{
    id: string;
    name: string;
    title?: string;
    email: string;
    user_id?: string;
  }> | null;
}

export interface ReminderProcessSummary {
  scannedCount: number;
  eligibleCount: number;
  sentCount: number;
  skippedCount: number;
  errorCount: number;
  details: Array<{
    bookingId: string;
    hoursRemaining: number;
    clientEmail?: string;
    consultantEmail?: string;
    clientSent?: boolean;
    consultantSent?: boolean;
    reason?: string;
    error?: string;
  }>;
}

/**
 * Determine if a meeting is actively eligible for a pre-meeting reminder.
 * Reminders are only eligible during the 24 hours before the scheduled start time,
 * and must terminate when the meeting starts, is cancelled, completed, or in the past.
 */
export function evaluateReminderEligibility(
  booking: BookingReminderCandidate,
  now: Date = new Date()
): {
  eligible: boolean;
  hoursRemaining: number;
  scheduledStart: Date;
  scheduledEnd: Date;
  scheduledStartIso: string;
  reason?: string;
} {
  // 1. Status checks: Cancelled, completed, or rejected meetings receive NO reminders
  const normalizedStatus = (booking.status || '').toLowerCase().trim();
  if (['cancelled', 'completed', 'rejected', 'missed'].includes(normalizedStatus)) {
    return {
      eligible: false,
      hoursRemaining: 0,
      scheduledStart: new Date(0),
      scheduledEnd: new Date(0),
      scheduledStartIso: '',
      reason: `Booking status is '${normalizedStatus}'`,
    };
  }

  // 2. Check if meeting has already started (authoritative start timestamp)
  const isStarted = Boolean(
    booking.meeting_started_at ||
    meetingParticipantStorage.hasJoined(booking.id)
  );
  if (isStarted) {
    return {
      eligible: false,
      hoursRemaining: 0,
      scheduledStart: new Date(0),
      scheduledEnd: new Date(0),
      scheduledStartIso: '',
      reason: 'Meeting has already started or completed',
    };
  }

  // 3. Parse scheduled times
  let sessionTimes;
  try {
    sessionTimes = parseSessionTimes(booking);
  } catch (err: any) {
    return {
      eligible: false,
      hoursRemaining: 0,
      scheduledStart: new Date(0),
      scheduledEnd: new Date(0),
      scheduledStartIso: '',
      reason: `Could not parse session times: ${err?.message || 'Invalid format'}`,
    };
  }

  const { scheduledStart, scheduledEnd } = sessionTimes;
  const scheduledStartIso = scheduledStart.toISOString();
  const diffMs = scheduledStart.getTime() - now.getTime();

  // 4. Meeting already in the past
  if (diffMs <= 0) {
    return {
      eligible: false,
      hoursRemaining: 0,
      scheduledStart,
      scheduledEnd,
      scheduledStartIso,
      reason: 'Meeting start time has already passed',
    };
  }

  // 5. 24-hour window constraint: 0 < diffMs <= 24 hours
  const twentyFourHoursMs = 24 * 60 * 60 * 1000;
  if (diffMs > twentyFourHoursMs) {
    const hoursAway = Math.round(diffMs / (60 * 60 * 1000));
    return {
      eligible: false,
      hoursRemaining: hoursAway,
      scheduledStart,
      scheduledEnd,
      scheduledStartIso,
      reason: `Meeting is ${hoursAway} hours away (reminder window begins 24 hours before)`,
    };
  }

  // 6. Calculate discrete hourly interval (1 to 24)
  // E.g., if 23h 45m remain -> interval 24
  // If 55m remain -> interval 1
  const hoursRemaining = Math.max(1, Math.min(24, Math.ceil(diffMs / (60 * 60 * 1000))));

  return {
    eligible: true,
    hoursRemaining,
    scheduledStart,
    scheduledEnd,
    scheduledStartIso,
  };
}

/**
 * Format timeframe label for subject and email body
 */
export function getTimeframeLabel(hoursRemaining: number): string {
  if (hoursRemaining === 1) {
    return 'Starting in 1 Hour';
  }
  return `Starting in ${hoursRemaining} Hours`;
}

/**
 * Format time with explicit IST timezone label
 */
export function formatTimeWithTimezone(timeString: string): string {
  if (!timeString) return 'IST (India Standard Time)';
  if (timeString.includes('IST') || timeString.includes('Asia/Kolkata')) {
    return timeString;
  }
  return `${timeString} IST (India Standard Time / Asia/Kolkata)`;
}

/**
 * Process upcoming meeting reminders across a list of bookings
 */
export async function processMeetingReminders(
  bookings: BookingReminderCandidate[],
  options?: {
    now?: Date;
    dryRun?: boolean;
    siteUrl?: string;
  }
): Promise<ReminderProcessSummary> {
  const now = options?.now || new Date();
  const dryRun = Boolean(options?.dryRun);
  const siteUrl = (options?.siteUrl || process.env.SITE_URL || process.env.APP_URL || 'https://www.foundarlybusinessworld.in').replace(/\/+$/, '');
  const smtpConfig = getSmtpConfig();

  const summary: ReminderProcessSummary = {
    scannedCount: bookings.length,
    eligibleCount: 0,
    sentCount: 0,
    skippedCount: 0,
    errorCount: 0,
    details: [],
  };

  for (const booking of bookings) {
    const evalResult = evaluateReminderEligibility(booking, now);

    if (!evalResult.eligible) {
      summary.skippedCount++;
      summary.details.push({
        bookingId: booking.id,
        hoursRemaining: evalResult.hoursRemaining,
        reason: evalResult.reason,
      });
      continue;
    }

    summary.eligibleCount++;
    const { hoursRemaining, scheduledStartIso } = evalResult;

    // Resolve consultant details
    const consultantObj = Array.isArray(booking.consultants)
      ? booking.consultants[0]
      : booking.consultants;

    const consultantName = consultantObj?.name || 'Your Consultant';
    const consultantEmail = consultantObj?.email?.trim() || '';
    const clientName = booking.name || 'Client';
    const clientEmail = (booking.email || '').trim();

    const canonicalRoomId = booking.meeting_room_id || `foundarly-${booking.id}`;
    const cleanRoom = canonicalRoomId.replace(/^foundarly-/, '');
    const meetingLink = `${siteUrl}/meeting/foundarly-${cleanRoom}`;
    const timeframeLabel = getTimeframeLabel(hoursRemaining);
    const formattedTime = formatTimeWithTimezone(booking.time);
    const duration = booking.session_duration || 60;

    let clientSent = false;
    let consultantSent = false;
    let entryError: string | undefined;

    // 1. Process Client Reminder
    if (clientEmail && clientEmail.includes('@')) {
      const alreadySent = reminderStorage.isReminderSent(
        booking.id,
        scheduledStartIso,
        hoursRemaining,
        'client'
      );

      if (!alreadySent) {
        const clientPayload: EmailMeetingReminderData = {
          bookingId: booking.id,
          recipientName: clientName,
          recipientEmail: clientEmail,
          recipientRole: 'client',
          partnerName: consultantName,
          date: booking.date,
          time: formattedTime,
          duration,
          meetingLink,
          meetingRoomId: `foundarly-${cleanRoom}`,
          timeframeLabel,
        };

        const clientHtml = generateMeetingReminderEmailHTML(clientPayload);
        const clientText = generateMeetingReminderEmailText(clientPayload);
        const subject = `Your Foundarly Meeting Reminder – Consultation ${timeframeLabel}`;

        if (!dryRun) {
          try {
            const mailRes = await sendEmail({
              from: smtpConfig.defaultFrom,
              to: clientEmail,
              replyTo: smtpConfig.replyTo,
              subject,
              html: clientHtml,
              text: clientText,
            });

            if (mailRes.success) {
              clientSent = true;
              summary.sentCount++;
              reminderStorage.recordReminderSent({
                bookingId: booking.id,
                scheduledStartIso,
                hoursRemaining,
                recipientRole: 'client',
                recipientEmail: clientEmail,
                sentAt: now.toISOString(),
                messageId: mailRes.messageId,
                status: 'sent',
              });
            } else {
              summary.errorCount++;
              entryError = mailRes.error || 'Failed sending client reminder';
              reminderStorage.recordReminderSent({
                bookingId: booking.id,
                scheduledStartIso,
                hoursRemaining,
                recipientRole: 'client',
                recipientEmail: clientEmail,
                sentAt: now.toISOString(),
                status: 'failed',
                error: mailRes.error,
              });
            }
          } catch (sendErr: any) {
            summary.errorCount++;
            entryError = sendErr?.message || 'Exception sending client reminder';
          }
        } else {
          clientSent = true;
          summary.sentCount++;
        }
      }
    }

    // 2. Process Consultant Reminder
    if (consultantEmail && consultantEmail.includes('@')) {
      const alreadySent = reminderStorage.isReminderSent(
        booking.id,
        scheduledStartIso,
        hoursRemaining,
        'consultant'
      );

      if (!alreadySent) {
        const consultantPayload: EmailMeetingReminderData = {
          bookingId: booking.id,
          recipientName: consultantName,
          recipientEmail: consultantEmail,
          recipientRole: 'consultant',
          partnerName: clientName,
          date: booking.date,
          time: formattedTime,
          duration,
          meetingLink,
          meetingRoomId: `foundarly-${cleanRoom}`,
          timeframeLabel,
        };

        const consultantHtml = generateMeetingReminderEmailHTML(consultantPayload);
        const consultantText = generateMeetingReminderEmailText(consultantPayload);
        const subject = `Upcoming Client Consultation – ${timeframeLabel} with ${clientName}`;

        if (!dryRun) {
          try {
            const mailRes = await sendEmail({
              from: smtpConfig.defaultFrom,
              to: consultantEmail,
              replyTo: smtpConfig.replyTo,
              subject,
              html: consultantHtml,
              text: consultantText,
            });

            if (mailRes.success) {
              consultantSent = true;
              summary.sentCount++;
              reminderStorage.recordReminderSent({
                bookingId: booking.id,
                scheduledStartIso,
                hoursRemaining,
                recipientRole: 'consultant',
                recipientEmail: consultantEmail,
                sentAt: now.toISOString(),
                messageId: mailRes.messageId,
                status: 'sent',
              });
            } else {
              summary.errorCount++;
              const err = mailRes.error || 'Failed sending consultant reminder';
              entryError = entryError ? `${entryError}; ${err}` : err;
              reminderStorage.recordReminderSent({
                bookingId: booking.id,
                scheduledStartIso,
                hoursRemaining,
                recipientRole: 'consultant',
                recipientEmail: consultantEmail,
                sentAt: now.toISOString(),
                status: 'failed',
                error: mailRes.error,
              });
            }
          } catch (sendErr: any) {
            summary.errorCount++;
            const err = sendErr?.message || 'Exception sending consultant reminder';
            entryError = entryError ? `${entryError}; ${err}` : err;
          }
        } else {
          consultantSent = true;
          summary.sentCount++;
        }
      }
    }

    summary.details.push({
      bookingId: booking.id,
      hoursRemaining,
      clientEmail,
      consultantEmail,
      clientSent,
      consultantSent,
      error: entryError,
    });
  }

  return summary;
}

export const reminderService = {
  evaluateReminderEligibility,
  processMeetingReminders,
  processBookingReminders: processMeetingReminders,
  formatMeetingDateIST(date: string, time: string): string {
    const timeClean = time.includes(':') ? time : `${time}:00`;
    const [year, month, day] = date.split('-').map(Number);
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const monthName = !isNaN(month) && month >= 1 && month <= 12 ? monthNames[month - 1] : '';
    const formattedDate = monthName ? `${monthName} ${day}, ${year}` : date;
    return `${formattedDate} at ${timeClean} IST`;
  },
  getMeetingJoinLink(meetingRoomId: string): string {
    const baseUrl = process.env.SITE_URL || process.env.APP_URL || 'https://www.foundarlybusinessworld.in';
    const cleanBase = baseUrl.replace(/\/+$/, '');
    return `${cleanBase}/meeting/${meetingRoomId}`;
  },
};

