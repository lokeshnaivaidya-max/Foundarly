import {
  generateUserEmailHTML,
  generateUserEmailText,
  generateConsultantEmailHTML,
  generateConsultantEmailText,
  generateBookingRejectedEmailHTML,
  generateBookingRejectedEmailText,
  EmailBookingData,
  EmailBookingRejectedData,
} from '../src/utils/emailTemplates.js';
import { sendEmail, getSmtpConfig } from '../src/server/mailer.js';

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
    const siteUrl = (process.env.APP_URL || process.env.SITE_URL || process.env.VITE_SITE_URL || 'https://foundarly.com').trim();

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
    // B. BOOKING CONFIRMATION FLOW (CLIENT + CONSULTANT)
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
