import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import {
  calculateRejoinEligibility,
  validateParticipantAccess,
} from '../../src/utils/meetingRejoin.js';
import {
  generateParticipantWaitingEmailHTML,
  generateParticipantWaitingEmailText,
  EmailParticipantWaitingData,
} from '../../src/utils/emailTemplates.js';
import { sendEmail, getSmtpConfig } from '../../src/server/mailer.js';
import { checkDistributedRateLimit, extractClientIp } from '../../src/server/rateLimiter.js';

dotenv.config();

interface RequestLike {
  method?: string;
  body?: unknown;
  headers?: Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string };
}

interface ResponseLike {
  status: (code: number) => ResponseLike;
  json: (data: unknown) => ResponseLike;
  end: () => void;
  setHeader: (name: string, value: string) => void;
}

// Memory-based cooldown map for serverless execution
const waitingCooldowns = new Map<string, number>();

export default async function handler(req: RequestLike, res: ResponseLike) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  // Rate Limiting by IP
  const ip = extractClientIp(req);
  const rateLimit = await checkDistributedRateLimit(`waiting_alert_${ip}`, 30, 60000);
  if (!rateLimit.allowed) {
    if (rateLimit.retryAfter) {
      res.setHeader('Retry-After', String(rateLimit.retryAfter));
    }
    return res.status(429).json({
      success: false,
      error: 'Too many requests. Please wait a moment before trying again.',
      code: 'RATE_LIMITED',
    });
  }

  // Authenticate session user token
  const authHeader = req.headers?.authorization || req.headers?.Authorization;
  const token = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
    ? authHeader.substring(7).trim()
    : null;

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Authentication token required.',
      code: 'UNAUTHENTICATED',
    });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://rfyxnshvtfswvaogjzwq.supabase.co';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_QPkFtczpj8_WzxPf4ZoENw_ZpnfN9vd';
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData?.user) {
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired user session.',
      code: 'INVALID_TOKEN',
    });
  }

  const user = userData.user;

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }

  let cleanRoomId = ((body as any)?.roomId || '').trim();
  if (cleanRoomId.includes('/meeting/')) {
    cleanRoomId = cleanRoomId.split('/meeting/').pop() || cleanRoomId;
  }
  cleanRoomId = cleanRoomId.split('?')[0].split('#')[0].replace(/\/+$/, '').trim();

  if (!cleanRoomId || cleanRoomId.length > 255) {
    return res.status(400).json({
      success: false,
      error: 'Valid meeting room ID is required.',
      code: 'INVALID_ROOM_ID',
    });
  }

  try {
    const rawBookingId = cleanRoomId.startsWith('foundarly-')
      ? cleanRoomId.replace('foundarly-', '')
      : cleanRoomId;
    const prefixedRoomId = cleanRoomId.startsWith('foundarly-')
      ? cleanRoomId
      : `foundarly-${cleanRoomId}`;
    const isRawUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawBookingId);
    const isCleanUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanRoomId);

    const orFilters: string[] = [
      `meeting_room_id.eq.${cleanRoomId}`,
      `meeting_room_id.eq.${prefixedRoomId}`,
      `meeting_room_id.eq.${rawBookingId}`,
    ];
    if (isRawUuid) {
      orFilters.push(`id.eq.${rawBookingId}`);
    }
    if (isCleanUuid && cleanRoomId !== rawBookingId) {
      orFilters.push(`id.eq.${cleanRoomId}`);
    }

    const clientToUse = (process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY.trim())
      ? supabase
      : createClient(supabaseUrl, process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_QPkFtczpj8_WzxPf4ZoENw_ZpnfN9vd', {
          global: {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          },
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        });

    let bookings: any[] | null = null;
    let bookingError: any = null;

    // 1. Prioritize SECURITY DEFINER RPC lookup
    try {
      const { data: rpcData, error: rpcError } = await clientToUse
        .rpc('lookup_meeting_room', { p_room_id: cleanRoomId });
      if (!rpcError && Array.isArray(rpcData) && rpcData.length > 0) {
        const row = rpcData[0];
        bookings = [{
          ...row,
          consultants: (row.consultant_name || row.consultant_email || row.consultant_user_id) ? {
            id: row.consultant_id,
            name: row.consultant_name,
            email: row.consultant_email,
            title: row.consultant_title,
            user_id: row.consultant_user_id,
          } : undefined,
        }];
      }
    } catch {
      // Non-blocking
    }

    if (!bookings || bookings.length === 0) {
      const baseQuery = clientToUse
        .from('bookings')
        .select('*, consultants(id, name, title, email, user_id)');

      const baseRes = await baseQuery.or(orFilters.join(',')).limit(1);
      bookings = baseRes.data;
      bookingError = baseRes.error;

      if (bookingError || !bookings || bookings.length === 0) {
        const flatQuery = clientToUse.from('bookings').select('*');
        const flatResult = await flatQuery.or(orFilters.join(',')).limit(1);
        if (flatResult.data && flatResult.data.length > 0) {
          bookings = flatResult.data;
          bookingError = null;
        }
      }

      if ((bookingError || !bookings || bookings.length === 0) && user?.email) {
        const emailQuery = clientToUse
          .from('bookings')
          .select('*, consultants(id, name, title, email, user_id)')
          .eq('email', user.email.toLowerCase().trim());
        const emailResult = await emailQuery.or(orFilters.join(',')).limit(1);
        if (emailResult.data && emailResult.data.length > 0) {
          bookings = emailResult.data;
          bookingError = null;
        }
      }
    }

    if (bookingError || !bookings || bookings.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Meeting session not found or invalid meeting link.',
        code: 'ROOM_NOT_FOUND',
      });
    }

    const booking = bookings[0];

    let consultantObj = Array.isArray(booking.consultants)
      ? booking.consultants[0]
      : booking.consultants;

    if (!consultantObj && booking.consultant_id) {
      const { data: directConsultant } = await clientToUse
        .from('consultants')
        .select('id, name, title, email, user_id')
        .eq('id', booking.consultant_id)
        .maybeSingle();
      if (directConsultant) {
        consultantObj = directConsultant;
      }
    }

    const authCheck = validateParticipantAccess(
      user,
      booking,
      consultantObj,
      false
    );

    if (!authCheck.authorized) {
      return res.status(403).json({
        success: false,
        error: authCheck.reason || 'You are not authorized to access this meeting session.',
        code: authCheck.code || 'UNAUTHORIZED_PARTICIPANT',
      });
    }

    const eligibility = calculateRejoinEligibility(booking, new Date());
    if (eligibility.sessionStatus === 'expired') {
      return res.status(410).json({
        success: false,
        error: 'The 7-day follow-up window for this consultation has concluded.',
        code: 'REJOIN_EXPIRED',
      });
    }

    const senderRole = authCheck.role;
    if (senderRole !== 'client' && senderRole !== 'consultant') {
      return res.json({
        success: true,
        message: 'Admin presence does not trigger participant notification.',
      });
    }

    const cooldownKey = `${booking.id}_${senderRole}`;
    const now = Date.now();
    const lastSent = waitingCooldowns.get(cooldownKey) || 0;
    if (now - lastSent < 3 * 60 * 1000) {
      return res.json({
        success: true,
        throttled: true,
        message: 'Waiting notification was recently sent. Please wait before notifying again.',
      });
    }

    const siteUrl = (
      process.env.APP_URL ||
      process.env.SITE_URL ||
      process.env.VITE_SITE_URL ||
      (req.headers?.origin as string) ||
      'https://foundarlybusinessworld.in'
    ).trim();

    const effectiveRoomId = booking.meeting_room_id || `foundarly-${booking.id}`;
    const meetingLink = `${siteUrl}/meeting/${effectiveRoomId}`;
    const isFollowUp = eligibility.isRejoin || booking.status === 'completed';

    let recipientEmail = '';
    let recipientName = '';
    let waitingUserName = '';

    if (senderRole === 'client') {
      recipientEmail = consultantObj?.email || '';
      recipientName = consultantObj?.name || 'Consultant';
      waitingUserName = booking.name || user.email?.split('@')[0] || 'Client';
    } else {
      recipientEmail = booking.email || '';
      recipientName = booking.name || 'Client';
      waitingUserName = consultantObj?.name || user.email?.split('@')[0] || 'Consultant';
    }

    if (!recipientEmail || !recipientEmail.includes('@')) {
      return res.json({
        success: false,
        error: 'Recipient email is not available for this booking.',
      });
    }

    const waitingData: EmailParticipantWaitingData = {
      bookingId: booking.id,
      recipientName,
      recipientEmail,
      waitingUserName,
      waitingUserRole: senderRole,
      meetingLink,
      meetingRoomId: effectiveRoomId,
      date: booking.date,
      time: booking.time,
      isFollowUp,
    };

    const emailHtml = generateParticipantWaitingEmailHTML(waitingData);
    const emailText = generateParticipantWaitingEmailText(waitingData);
    const emailSubject = senderRole === 'client'
      ? `${waitingUserName} is waiting in your Foundarly meeting room`
      : `Your consultant, ${waitingUserName}, is waiting in your Foundarly meeting room`;

    const smtpConfig = getSmtpConfig();
    if (!smtpConfig.pass) {
      waitingCooldowns.set(cooldownKey, now);
      return res.json({
        success: true,
        simulated: true,
        message: `Notification simulated (SMTP_PASS not configured). Target: ${recipientEmail}`,
        recipient: recipientEmail,
      });
    }

    const mailResult = await sendEmail({
      from: smtpConfig.defaultFrom,
      to: recipientEmail,
      replyTo: smtpConfig.replyTo,
      subject: emailSubject,
      html: emailHtml,
      text: emailText,
    });

    waitingCooldowns.set(cooldownKey, now);

    if (!mailResult.success) {
      return res.status(500).json({
        success: false,
        error: mailResult.error || 'Failed to send waiting notification email.',
      });
    }

    return res.json({
      success: true,
      message: `Notification sent to ${recipientEmail}`,
      recipient: recipientEmail,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Internal error';
    return res.status(500).json({
      success: false,
      error: errorMsg,
    });
  }
}
