import dotenv from 'dotenv';
import {
  generateUserEmailHTML,
  generateUserEmailText,
  generateConsultantEmailHTML,
  generateConsultantEmailText,
  generateBookingRejectedEmailHTML,
  generateBookingRejectedEmailText,
  generateSessionCompletedEmailHTML,
  generateSessionCompletedEmailText,
  EmailBookingData,
  EmailBookingRejectedData,
  EmailSessionCompletedData,
} from '../src/utils/emailTemplates.js';
import {
  parseSessionTimes,
  calculateRejoinEligibility,
  formatRejoinExpiryDateTime,
} from '../src/utils/meetingRejoin.js';
import { completionEmailStorage } from '../src/server/completionEmailStorage.js';
import { sendEmail, getSmtpConfig } from '../src/server/mailer.js';
import { checkDistributedRateLimit, extractClientIp } from '../src/server/rateLimiter.js';

dotenv.config();

interface RequestLike {
  method?: string;
  body?: any;
  headers?: Record<string, string | string[] | undefined>;
}

interface ResponseLike {
  status: (code: number) => ResponseLike;
  json: (data: any) => ResponseLike;
  end: () => void;
  setHeader: (name: string, value: string) => void;
}

export default async function handler(req: RequestLike, res: ResponseLike) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const clientIp = extractClientIp(req);
  const rateLimit = await checkDistributedRateLimit(`booking_email_${clientIp}`, 30, 60000);
  if (!rateLimit.allowed) {
    res.setHeader('Retry-After', String(rateLimit.retryAfter));
    return res.status(429).json({
      success: false,
      error: `Too many requests. Please wait ${rateLimit.retryAfter} seconds before sending another email.`,
      code: 'RATE_LIMITED',
    });
  }

  try {
    const rawBody = req.body;
    let parsedBody = rawBody;
    if (typeof rawBody === 'string') {
      try {
        parsedBody = JSON.parse(rawBody);
      } catch {
        parsedBody = {};
      }
    }
    const { type, bookingId, emailData, reason } = parsedBody || {};

    if (!bookingId && !emailData) {
      return res.status(400).json({
        success: false,
        error: 'Booking ID or email data is required',
      });
    }

    const smtpConfig = getSmtpConfig();
    const siteUrl = (process.env.APP_URL || process.env.SITE_URL || process.env.VITE_SITE_URL || 'https://www.foundarlybusinessworld.in').trim();

    if (!smtpConfig.pass) {
      return res.status(400).json({
        success: false,
        error: 'SMTP_PASS is not configured on the server. Please set the SMTP_PASS environment variable (Titan mailbox password) in Vercel project settings.',
        missingConfig: 'SMTP_PASS',
      });
    }

    // =========================================================================
    // A. BOOKING REJECTION EMAIL FLOW
    // =========================================================================
    if (type === 'rejected') {
      let rejectData: EmailBookingRejectedData = emailData;

      if (!rejectData || !rejectData.userEmail) {
        const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://rfyxnshvtfswvaogjzwq.supabase.co';
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_QPkFtczpj8_WzxPf4ZoENw_ZpnfN9vd';

        const fetchRes = await fetch(`${supabaseUrl}/rest/v1/bookings?id=eq.${bookingId}&select=*,consultants(name,email,title)`, {
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
        });

        if (!fetchRes.ok) {
          const errText = await fetchRes.text();
          throw new Error(`Failed to fetch booking for rejection: ${errText}`);
        }

        const records = (await fetchRes.json()) as any[];
        const booking = records?.[0];

        if (!booking) {
          return res.status(404).json({ success: false, error: `Booking record ${bookingId} not found` });
        }

        const consultantObj = Array.isArray(booking.consultants) ? booking.consultants[0] : booking.consultants;
        rejectData = {
          bookingId: booking.id,
          userName: booking.name || 'Client',
          userEmail: booking.email,
          consultantName: consultantObj?.name || 'Consultant',
          date: booking.date,
          time: booking.time || 'Flexible',
          reason: reason || booking.rejection_reason || 'Unable to confirm consultation booking at this time.',
        };
      }

      if (!rejectData.userEmail || !rejectData.userEmail.includes('@')) {
        return res.status(400).json({
          success: false,
          error: 'Recipient email address is invalid or missing.',
        });
      }

      const rejectHtml = generateBookingRejectedEmailHTML(rejectData);
      const rejectText = generateBookingRejectedEmailText(rejectData);
      const rejectSubject = `Consultation Booking Update: ${rejectData.consultantName} | Foundarly`;

      const mailResult = await sendEmail({
        from: smtpConfig.defaultFrom,
        to: rejectData.userEmail,
        replyTo: smtpConfig.replyTo,
        subject: rejectSubject,
        html: rejectHtml,
        text: rejectText,
      });

      if (!mailResult.success) {
        return res.status(500).json({
          success: false,
          error: mailResult.error || 'Failed to send rejection email via Titan SMTP',
          diagnostic: mailResult.diagnostic,
          details: mailResult.details,
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Rejection email sent successfully',
        userEmailId: mailResult.messageId,
        recipient: rejectData.userEmail,
      });
    }

    // =========================================================================
    // B. POST-SESSION COMPLETION EMAIL FLOW (WITH 7-DAY REJOIN & DEDUPLICATION)
    // =========================================================================
    if (type === 'completed') {
      const targetBookingId = bookingId || emailData?.bookingId;
      if (!targetBookingId) {
        return res.status(400).json({
          success: false,
          error: 'Booking ID is required to send completion email',
        });
      }

      // Check idempotency: avoid sending duplicate emails when completion event triggers multiple times
      if (completionEmailStorage.isSent(targetBookingId)) {
        console.log(`[Email API] Post-session completion email already sent for booking: ${targetBookingId}. Skipping duplicate.`);
        return res.status(200).json({
          success: true,
          message: 'Post-session completion email already sent (idempotent)',
          alreadySent: true,
          bookingId: targetBookingId,
        });
      }

      const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://rfyxnshvtfswvaogjzwq.supabase.co';
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_QPkFtczpj8_WzxPf4ZoENw_ZpnfN9vd';

      let bookingRecord: any = null;
      let consultantRecord: any = null;

      try {
        const fetchRes = await fetch(`${supabaseUrl}/rest/v1/bookings?id=eq.${targetBookingId}&select=*,consultants(name,email,title)`, {
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
        });

        if (fetchRes.ok) {
          const records = (await fetchRes.json()) as any[];
          bookingRecord = records?.[0];
          consultantRecord = Array.isArray(bookingRecord?.consultants) ? bookingRecord.consultants[0] : bookingRecord?.consultants;
        }
      } catch (fetchErr) {
        console.warn('[Email API] Failed to fetch booking via REST, using payload data if available:', fetchErr);
      }

      const clientEmail = (bookingRecord?.email || emailData?.userEmail || '').toLowerCase().trim();
      const clientName = bookingRecord?.name || emailData?.userName || 'Client';
      const consultantName = consultantRecord?.name || emailData?.consultantName || 'Consultant';
      const consultantEmail = (consultantRecord?.email || emailData?.consultantEmail || '').toLowerCase().trim();
      const date = bookingRecord?.date || emailData?.date || new Date().toISOString().split('T')[0];
      const time = bookingRecord?.time || emailData?.time || 'Flexible';
      const sessionDuration = bookingRecord?.session_duration || emailData?.duration || 60;
      const meetingRoomId = bookingRecord?.meeting_room_id || emailData?.meetingRoomId || `foundarly-${targetBookingId}`;
      const meetingLink = `${siteUrl}/meeting/${meetingRoomId}`;

      // Calculate 7-day rejoin deadline
      const timing = parseSessionTimes({
        date,
        time,
        session_duration: sessionDuration,
        meeting_started_at: bookingRecord?.meeting_started_at,
        meeting_ended_at: bookingRecord?.meeting_ended_at,
      });
      const rejoinDeadlineIso = timing.rejoinDeadline.toISOString();
      const rejoinExpiryFormatted = formatRejoinExpiryDateTime(timing.rejoinDeadline);

      if (!clientEmail || !clientEmail.includes('@')) {
        return res.status(400).json({
          success: false,
          error: 'Recipient client email address is missing or invalid.',
        });
      }

      // 1. Send Completion & 7-Day Rejoin Email to Client
      const clientPayload: EmailSessionCompletedData = {
        bookingId: targetBookingId,
        userName: clientName,
        userEmail: clientEmail,
        consultantName,
        consultantEmail: consultantEmail || null,
        recipientRole: 'client',
        recipientName: clientName,
        recipientEmail: clientEmail,
        date,
        time,
        sessionDuration,
        meetingRoomId,
        meetingLink,
        rejoinDeadline: rejoinDeadlineIso,
        rejoinExpiryFormatted,
        rejoinDaysRemaining: 7,
      };

      const clientHtml = generateSessionCompletedEmailHTML(clientPayload);
      const clientText = generateSessionCompletedEmailText(clientPayload);
      const clientSubject = `Thank You for Attending Your Consultation with ${consultantName} | 7-Day Follow-Up Access Active`;

      const clientMailRes = await sendEmail({
        from: smtpConfig.defaultFrom,
        to: clientEmail,
        replyTo: smtpConfig.replyTo,
        subject: clientSubject,
        html: clientHtml,
        text: clientText,
      });

      if (!clientMailRes.success) {
        return res.status(500).json({
          success: false,
          error: clientMailRes.error || 'Failed to send post-session completion email to client',
          diagnostic: clientMailRes.diagnostic,
          details: clientMailRes.details,
        });
      }

      // 2. Also send Completion Email to Consultant if consultant email is available
      let consultantEmailId = null;
      if (consultantEmail && consultantEmail.includes('@') && consultantEmail !== clientEmail) {
        try {
          const consultantPayload: EmailSessionCompletedData = {
            ...clientPayload,
            recipientRole: 'consultant',
            recipientName: consultantName,
            recipientEmail: consultantEmail,
          };
          const consHtml = generateSessionCompletedEmailHTML(consultantPayload);
          const consText = generateSessionCompletedEmailText(consultantPayload);
          const consSubject = `Session Completed: Consultation with ${clientName} | 7-Day Follow-Up Active`;

          const consMailRes = await sendEmail({
            from: smtpConfig.defaultFrom,
            to: consultantEmail,
            replyTo: smtpConfig.replyTo,
            subject: consSubject,
            html: consHtml,
            text: consText,
          });
          if (consMailRes.success) {
            consultantEmailId = consMailRes.messageId;
          }
        } catch (consErr) {
          console.warn('[Email API] Consultant completion notification warning:', consErr);
        }
      }

      // Mark as sent in persistent storage to prevent duplicates
      completionEmailStorage.markSent(targetBookingId);

      return res.status(200).json({
        success: true,
        message: 'Post-session completion email sent successfully',
        clientEmailId: clientMailRes.messageId,
        consultantEmailId,
        recipient: clientEmail,
        rejoinDeadline: rejoinDeadlineIso,
        rejoinExpiryFormatted,
      });
    }

    // =========================================================================
    // C. BOOKING CONFIRMATION FLOW (CLIENT + CONSULTANT)
    // =========================================================================
    let dataToSend: EmailBookingData = emailData;

    // If data was not directly passed, or missing recipient info, fetch from Supabase
    if (!dataToSend || !dataToSend.userEmail) {
      const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://rfyxnshvtfswvaogjzwq.supabase.co';
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_QPkFtczpj8_WzxPf4ZoENw_ZpnfN9vd';

      try {
        const fetchRes = await fetch(`${supabaseUrl}/rest/v1/bookings?id=eq.${bookingId}&select=*,consultants(name,email,title)`, {
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
        });

        if (!fetchRes.ok) {
          const errText = await fetchRes.text();
          throw new Error(`Failed to fetch booking: ${errText}`);
        }

        const records = (await fetchRes.json()) as any[];
        const booking = records?.[0];

        if (!booking) {
          return res.status(404).json({
            success: false,
            error: `Booking record ${bookingId} not found`,
          });
        }

        const meetingRoomId = booking.meeting_room_id || `foundarly-${booking.id}`;
        const consultantObj = Array.isArray(booking.consultants) ? booking.consultants[0] : booking.consultants;

        dataToSend = {
          bookingId: booking.id,
          userName: booking.name || 'Client',
          userEmail: booking.email,
          consultantName: consultantObj?.name || 'Consultant',
          consultantEmail: consultantObj?.email || null,
          date: booking.date,
          time: booking.time || 'Flexible',
          duration: booking.session_duration || 60,
          meetingLink: `${siteUrl}/meeting/${meetingRoomId}`,
          meetingRoomId,
          price: booking.session_price,
          message: booking.message,
        };
      } catch (fetchError: any) {
        console.error('[Vercel API] Supabase fetch error:', fetchError);
        return res.status(500).json({
          success: false,
          error: `Failed to retrieve booking data: ${fetchError.message}`,
        });
      }
    }

    if (!dataToSend.userEmail || !dataToSend.userEmail.includes('@')) {
      return res.status(400).json({
        success: false,
        error: 'Recipient email address is invalid or missing from booking record.',
      });
    }

    const userHtml = generateUserEmailHTML(dataToSend);
    const userText = generateUserEmailText(dataToSend);

    // Clean, professional subject line
    const clientSubject = `Booking Confirmation: Consultation with ${dataToSend.consultantName} | Foundarly`;

    // 1. Send Confirmation Email to Client
    const mailResult = await sendEmail({
      from: smtpConfig.defaultFrom,
      to: dataToSend.userEmail,
      replyTo: smtpConfig.replyTo,
      subject: clientSubject,
      html: userHtml,
      text: userText,
    });

    if (!mailResult.success) {
      return res.status(500).json({
        success: false,
        error: mailResult.error || 'Failed to send booking confirmation email via Titan SMTP',
        diagnostic: mailResult.diagnostic,
        details: mailResult.details,
      });
    }

    // 2. Send Booking / Meeting Notification Email to Consultant
    let consultantEmailId = null;
    let consultantError = null;
    if (dataToSend.consultantEmail && dataToSend.consultantEmail.includes('@') && dataToSend.consultantEmail !== dataToSend.userEmail) {
      try {
        const consultantHtml = generateConsultantEmailHTML(dataToSend);
        const consultantText = generateConsultantEmailText(dataToSend);
        const consultantSubject = `New Consultation Booked: ${dataToSend.userName} | Foundarly`;

        const consultantMailRes = await sendEmail({
          from: smtpConfig.defaultFrom,
          to: dataToSend.consultantEmail,
          replyTo: smtpConfig.replyTo,
          subject: consultantSubject,
          html: consultantHtml,
          text: consultantText,
        });
        if (consultantMailRes.success) {
          consultantEmailId = consultantMailRes.messageId;
        } else {
          consultantError = consultantMailRes.error;
        }
      } catch (consErr: any) {
        console.warn('[Vercel API] Consultant notification email error:', consErr);
        consultantError = consErr?.message;
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Booking confirmation email sent successfully',
      userEmailId: mailResult.messageId,
      consultantEmailId: consultantEmailId,
      consultantError: consultantError || undefined,
      portUsed: mailResult.portUsed,
      recipient: dataToSend.userEmail,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error?.message || 'Internal server error while sending email',
    });
  }
}
