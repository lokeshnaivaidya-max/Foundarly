import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { meetingParticipantStorage } from '../../src/server/meetingParticipantStorage.js';
import { checkDistributedRateLimit, extractClientIp } from '../../src/server/rateLimiter.js';

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
  const rateLimit = await checkDistributedRateLimit(`record_join_${clientIp}`, 60, 60000);
  if (!rateLimit.allowed) {
    return res.status(429).json({ success: false, error: 'Too many requests' });
  }

  const authHeader = req.headers?.authorization || req.headers?.Authorization;
  const token = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
    ? authHeader.substring(7).trim()
    : null;

  if (!token) {
    return res.status(401).json({ success: false, error: 'Authentication required', code: 'UNAUTHENTICATED' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://rfyxnshvtfswvaogjzwq.supabase.co';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_QPkFtczpj8_WzxPf4ZoENw_ZpnfN9vd';
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData?.user) {
    return res.status(401).json({ success: false, error: 'Invalid authentication session', code: 'INVALID_TOKEN' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }

  const { roomId, bookingId, role } = body || {};
  const targetId = (bookingId || roomId || '').trim();
  if (!targetId) {
    return res.status(400).json({ success: false, error: 'Room ID or Booking ID is required' });
  }

  try {
    const cleanBookingId = targetId.replace(/^foundarly-/, '');
    const participantIdentifier = (userData.user.id || userData.user.email || 'unknown').trim().toLowerCase();
    const userEmail = userData.user.email ? userData.user.email.trim().toLowerCase() : undefined;

    const result = meetingParticipantStorage.recordJoin(cleanBookingId, participantIdentifier, role, userEmail);

    try {
      const { data: bData } = await supabase
        .from('bookings')
        .select('id, meeting_started_at, participants_count')
        .or(`id.eq.${cleanBookingId},meeting_room_id.eq.${targetId},meeting_room_id.eq.foundarly-${cleanBookingId}`)
        .maybeSingle();

      if (bData) {
        const updates: any = {
          participants_count: (bData.participants_count || 0) + (result.isFirstJoin ? 1 : 0),
        };
        if (!bData.meeting_started_at) {
          updates.meeting_started_at = new Date().toISOString();
        }
        await supabase
          .from('bookings')
          .update(updates)
          .eq('id', bData.id);
      }
    } catch (dbErr) {
      console.warn('[Vercel API] Warning updating booking join in Supabase:', dbErr);
    }

    return res.status(200).json({
      success: true,
      hasJoined: true,
      isFirstJoin: result.isFirstJoin,
      joinCount: result.joinCount,
      bookingId: cleanBookingId,
    });
  } catch (err: any) {
    console.error('[Vercel API] Error recording participant join:', err);
    return res.status(500).json({ success: false, error: 'Internal server error recording join' });
  }
}
