import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import {
  calculateRejoinEligibility,
  validateParticipantAccess,
} from '../../src/utils/meetingRejoin.js';
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

  const roomId = body?.roomId;
  const cleanRoomId = (roomId || '').trim();

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
    const isRawUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawBookingId);

    const baseQuery = supabase
      .from('bookings')
      .select('*, consultants(id, name, title, email, user_id)');

    const { data: bookings, error: bookingError } = await (
      isRawUuid
        ? baseQuery.or(`meeting_room_id.eq.${cleanRoomId},id.eq.${rawBookingId}`).limit(1)
        : baseQuery.eq('meeting_room_id', cleanRoomId).limit(1)
    );

    if (bookingError) {
      console.error('[Meeting Serverless] DB error:', bookingError);
      return res.status(500).json({
        success: false,
        error: 'Failed to verify meeting session due to a database error.',
        code: 'DATABASE_ERROR',
      });
    }

    const booking = bookings?.[0];
    if (!booking) {
      return res.status(404).json({
        success: false,
        error: 'Meeting session not found or invalid meeting link.',
        code: 'ROOM_NOT_FOUND',
      });
    }

    let consultantObj = Array.isArray(booking.consultants)
      ? booking.consultants[0]
      : booking.consultants;

    if (!consultantObj && booking.consultant_id) {
      const { data: directConsultant } = await supabase
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

    const timingResult = calculateRejoinEligibility(booking);

    return res.status(200).json({
      success: true,
      authorized: true,
      canJoin: timingResult.canJoin,
      isRejoin: timingResult.isRejoin,
      sessionStatus: timingResult.sessionStatus,
      role: authResult.role,
      timing: {
        scheduledStart: timingResult.rejoinDeadline.toISOString(),
        rejoinDeadline: timingResult.rejoinDeadline.toISOString(),
        rejoinTimeRemainingMs: timingResult.rejoinTimeRemainingMs,
        rejoinDaysRemaining: timingResult.rejoinDaysRemaining,
        serverTime: new Date().toISOString(),
      },
      booking: {
        id: booking.id,
        meeting_room_id: booking.meeting_room_id || `foundarly-${booking.id}`,
        date: booking.date,
        time: booking.time,
        status: booking.status,
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
