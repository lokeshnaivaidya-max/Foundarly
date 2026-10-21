import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import {
  calculateRejoinEligibility,
  validateParticipantAccess,
  parseSessionTimes,
} from '../../src/utils/meetingRejoin.js';
import { meetingParticipantStorage } from '../../src/server/meetingParticipantStorage.js';
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

  // Rate Limiting by IP (Distributed across instances with in-memory fallback)
  const ip = extractClientIp(req);
  const rateLimit = await checkDistributedRateLimit(`meeting_rate_${ip}`, 60, 60000);
  if (!rateLimit.allowed) {
    if (rateLimit.retryAfter) {
      res.setHeader('Retry-After', String(rateLimit.retryAfter));
    }
    return res.status(429).json({
      success: false,
      error: 'Too many requests. Please slow down and try again.',
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

  let cleanRoomId = (body?.roomId || '').trim();
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

    // Scoped client with user token if service role key is not configured
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

    let booking: any = null;
    let consultantObj: any = null;

    // 1. Prioritize SECURITY DEFINER RPC lookup (bypasses RLS safely and joins consultant details)
    try {
      const { data: rpcData, error: rpcError } = await clientToUse
        .rpc('lookup_meeting_room', { p_room_id: cleanRoomId });

      if (!rpcError && Array.isArray(rpcData) && rpcData.length > 0) {
        const row = rpcData[0];
        booking = {
          id: row.id,
          user_id: row.user_id,
          consultant_id: row.consultant_id,
          name: row.name,
          email: row.email,
          date: row.date,
          time: row.time,
          message: row.message,
          status: row.status,
          payment_status: row.payment_status,
          session_duration: row.session_duration,
          session_price: row.session_price,
          meeting_room_id: row.meeting_room_id || cleanRoomId,
          participants_count: row.participants_count,
          meeting_started_at: row.meeting_started_at,
          meeting_ended_at: row.meeting_ended_at,
          created_at: row.created_at,
          updated_at: row.updated_at,
        };
        if (row.consultant_name || row.consultant_email || row.consultant_user_id) {
          consultantObj = {
            id: row.consultant_id,
            name: row.consultant_name,
            email: row.consultant_email,
            title: row.consultant_title,
            user_id: row.consultant_user_id,
          };
        }
      }
    } catch {
      // Non-blocking: proceed to direct table queries
    }

    // 2. Fallback to direct table queries if RPC is not present or returned empty
    if (!booking) {
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

      const baseQuery = clientToUse
        .from('bookings')
        .select('*, consultants(id, name, title, email, user_id)');

      let { data: bookings, error: bookingError } = await baseQuery
        .or(orFilters.join(','))
        .limit(1);

      if (bookingError || !bookings || bookings.length === 0) {
        const flatQuery = clientToUse.from('bookings').select('*');
        const flatResult = await flatQuery.or(orFilters.join(',')).limit(1);
        if (flatResult.data && flatResult.data.length > 0) {
          bookings = flatResult.data;
          bookingError = null;
        }
      }

      // If user email is present, check if query filtered by email can locate the booking under email-scoped RLS
      if ((bookingError || !bookings || bookings.length === 0) && user?.email) {
        const userEmail = user.email.toLowerCase().trim();
        const emailQuery = clientToUse
          .from('bookings')
          .select('*, consultants(id, name, title, email, user_id)')
          .eq('email', userEmail);
        const emailResult = await emailQuery.or(orFilters.join(',')).limit(1);
        if (emailResult.data && emailResult.data.length > 0) {
          bookings = emailResult.data;
          bookingError = null;
        }
      }

      if (bookings && bookings.length > 0) {
        booking = bookings[0];
        consultantObj = Array.isArray(booking.consultants)
          ? booking.consultants[0]
          : booking.consultants;
      }
    }

    if (!booking) {
      return res.status(404).json({
        success: false,
        error: 'Meeting session not found or invalid meeting link.',
        code: 'ROOM_NOT_FOUND',
      });
    }

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

    const adminEmails = (process.env.ADMIN_EMAILS || 'admin@foundarly.com')
      .split(',')
      .map(e => e.trim().toLowerCase());
    const isAdmin = Boolean(user.email && adminEmails.includes(user.email.toLowerCase()));

    const authResult = validateParticipantAccess(user, booking, consultantObj, isAdmin);
    if (!authResult.authorized) {
      return res.status(403).json({
        success: false,
        error: authResult.reason || 'You are not authorized to access this meeting room.',
        code: authResult.code || 'UNAUTHORIZED_PARTICIPANT',
      });
    }

    // Auto-link guest booking user_id if client is now logged in with matching email
    if (!booking.user_id && user.id && authResult.role === 'client') {
      try {
        await clientToUse
          .from('bookings')
          .update({ user_id: user.id })
          .eq('id', booking.id);
        booking.user_id = user.id;
      } catch {
        // Non-blocking self-healing attempt
      }
    }

    // Load active follow-up request if present
    let followUp: any = null;
    try {
      const { data: fuData } = await clientToUse
        .from('follow_up_requests')
        .select('*')
        .eq('booking_id', booking.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (fuData) {
        followUp = fuData;
      }
    } catch {
      // Non-blocking
    }

    const sessionTimes = parseSessionTimes(booking);
    const timingResult = calculateRejoinEligibility(booking);

    const participantIdentifier = (user.id || user.email || 'unknown').trim().toLowerCase();
    const hasJoined = meetingParticipantStorage.hasJoined(booking.id, participantIdentifier, authResult.role);
    const participantHistory = meetingParticipantStorage.getParticipantHistory(booking.id, participantIdentifier, authResult.role);

    return res.status(200).json({
      success: true,
      authorized: true,
      canJoin: timingResult.canJoin,
      hasJoined: Boolean(hasJoined),
      isRejoin: Boolean(hasJoined),
      isRejoinWindow: timingResult.isRejoin,
      sessionStatus: timingResult.sessionStatus,
      participantHistory,
      role: authResult.role,
      followUp: followUp || null,
      timing: {
        scheduledStart: sessionTimes.scheduledStart.toISOString(),
        scheduledEnd: sessionTimes.scheduledEnd.toISOString(),
        rejoinDeadline: timingResult.rejoinDeadline.toISOString(),
        rejoinTimeRemainingMs: timingResult.rejoinTimeRemainingMs,
        rejoinDaysRemaining: timingResult.rejoinDaysRemaining,
        timeUntilStartMs: timingResult.timeUntilStartMs,
        serverTime: new Date().toISOString(),
      },
      booking: {
        id: booking.id,
        meeting_room_id: booking.meeting_room_id || cleanRoomId,
        user_id: booking.user_id,
        consultant_id: booking.consultant_id,
        date: booking.date,
        time: booking.time,
        session_duration: booking.session_duration || 60,
        status: booking.status,
        name: booking.name,
        email: booking.email,
        consultants: consultantObj ? {
          id: consultantObj.id,
          name: consultantObj.name,
          title: consultantObj.title,
          email: consultantObj.email,
          user_id: consultantObj.user_id,
        } : undefined,
      },
    });
  } catch (err: unknown) {
    console.error('[Meeting Serverless] Exception:', err);
    return res.status(500).json({
      success: false,
      error: 'Internal server error validating meeting access.',
      code: 'SERVER_ERROR',
    });
  }
}
