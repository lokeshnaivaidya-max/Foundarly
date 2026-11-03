import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import {
  parseAvailabilitySettings,
  checkDayAvailability,
  generateAvailableSlots,
  normalizeTimeSlot,
} from '../src/utils/timeSlots.js';
import { checkDistributedRateLimit, extractClientIp } from '../src/server/rateLimiter.js';

dotenv.config();

interface RequestLike {
  method?: string;
  query?: Record<string, string | string[] | undefined>;
  headers?: Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string };
}

interface ResponseLike {
  status: (code: number) => ResponseLike;
  json: (data: unknown) => ResponseLike;
  end: () => void;
  setHeader: (name: string, value: string) => void;
}

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://rfyxnshvtfswvaogjzwq.supabase.co';
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  'sb_publishable_QPkFtczpj8_WzxPf4ZoENw_ZpnfN9vd';

const supabaseAdminClient = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export default async function handler(req: RequestLike, res: ResponseLike) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  // Rate Limiting by IP (generous limit for slot browsing: 120 req/min)
  const clientIp = extractClientIp(req);
  const rateLimit = await checkDistributedRateLimit(`slots_${clientIp}`, 120, 60000);
  if (!rateLimit.allowed) {
    if (rateLimit.retryAfter) {
      res.setHeader('Retry-After', String(rateLimit.retryAfter));
    }
    return res.status(429).json({
      success: false,
      error: 'Too many slot queries. Please wait a moment.',
      code: 'RATE_LIMITED',
      retryAfter: rateLimit.retryAfter,
    });
  }

  const query = req.query || {};
  const id = typeof query.id === 'string' ? query.id : (typeof query.consultant_id === 'string' ? query.consultant_id : '');
  const date = typeof query.date === 'string' ? query.date : '';
  const durationStr = typeof query.duration === 'string' ? query.duration : '60';

  if (!id) {
    return res.status(400).json({ success: false, error: 'consultant_id is required', code: 'INVALID_ID' });
  }

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ success: false, error: 'Valid date (YYYY-MM-DD) is required', code: 'INVALID_DATE' });
  }

  const sessionDuration = parseInt(durationStr, 10) === 30 ? 30 : 60;

  try {
    const { data: consultant, error: cErr } = await supabaseAdminClient
      .from('consultants')
      .select('id, name, preferred_time, availability, pricing_30, pricing_60, social_links')
      .eq('id', id)
      .maybeSingle();

    if (cErr || !consultant) {
      return res.status(404).json({ success: false, error: 'Consultant not found', code: 'NOT_FOUND' });
    }

    const settings = parseAvailabilitySettings(consultant);
    const dayStatus = checkDayAvailability(date, settings);

    const { data: activeBookings } = await supabaseAdminClient
      .from('bookings')
      .select('id, time, status, payment_status, created_at')
      .eq('consultant_id', id)
      .eq('date', date);

    const nowMs = Date.now();
    const PENDING_EXPIRY_MS = 15 * 60 * 1000;

    const bookedTimes: string[] = (activeBookings || [])
      .filter((b) => {
        const status = (b.status || '').toLowerCase().trim();
        const paymentStatus = (b.payment_status || '').toLowerCase().trim();

        if (status === 'cancelled' || status === 'rejected') return false;
        if (paymentStatus === 'failed' || paymentStatus === 'rejected' || paymentStatus === 'refunded') return false;
        if (status === 'confirmed' || status === 'completed') return true;
        if (status === 'pending' || paymentStatus === 'pending') {
          const createdAtMs = b.created_at ? new Date(b.created_at).getTime() : 0;
          return (nowMs - createdAtMs) < PENDING_EXPIRY_MS;
        }
        return false;
      })
      .map((b) => b.time)
      .filter((t): t is string => Boolean(t && t.toLowerCase() !== 'flexible'));

    const slots = generateAvailableSlots({
      availabilitySettings: settings,
      dateStr: date,
      sessionDuration,
      bookedTimes,
    });

    return res.json({
      success: true,
      consultant_id: id,
      date,
      timezone: 'Asia/Kolkata (IST, UTC+05:30)',
      slots,
      is_blocked: dayStatus.isBlocked,
      blocked_reason: dayStatus.blockedReason,
      is_day_off: dayStatus.isDayOff,
      weekday: dayStatus.weekday,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to fetch slots', code: 'INTERNAL_ERROR' });
  }
}
