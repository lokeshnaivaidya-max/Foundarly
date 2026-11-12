import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { secureLog } from '../../utils/security.js';

dotenv.config();

interface RequestLike {
  method?: string;
  query?: Record<string, string | string[] | undefined>;
  headers?: Record<string, string | string[] | undefined>;
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

  const authHeader = req.headers?.authorization;
  const token = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : null;

  if (!token) {
    return res.status(401).json({ success: false, error: 'Authentication required. Missing Bearer token.' });
  }

  try {
    const deadline = Date.now() + 8000;
    const bounded = async <T>(operation: PromiseLike<T>, label: string, ms = 4000): Promise<T> => {
      const remaining = Math.min(ms, deadline - Date.now());
      if (remaining < 250) {
        throw new Error(`Server deadline exceeded before ${label}`);
      }
      return await Promise.race([
        Promise.resolve(operation),
        new Promise<T>((_, reject) =>
          setTimeout(() => reject(new Error(`${label} timed out after ${Math.round(remaining)}ms`)), remaining)
        ),
      ]);
    };

    const { data: { user }, error: userError } = await bounded(
      supabaseAdminClient.auth.getUser(token),
      'auth user verification'
    );
    if (userError || !user) {
      return res.status(401).json({ success: false, error: 'Invalid or expired session token.' });
    }

    const userId = user.id;
    const userEmail = (user.email || '').toLowerCase().trim();

    const hasServiceRoleKey = Boolean(
      process.env.SUPABASE_SERVICE_ROLE_KEY &&
      process.env.SUPABASE_SERVICE_ROLE_KEY.trim().length > 20 &&
      !process.env.SUPABASE_SERVICE_ROLE_KEY.includes('publishable')
    );

    const authenticatedClient = createClient(supabaseUrl, process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_QPkFtczpj8_WzxPf4ZoENw_ZpnfN9vd', {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const activeDbClient = hasServiceRoleKey ? supabaseAdminClient : authenticatedClient;

    let consultantQuery = activeDbClient
      .from('consultants')
      .select('id, name, email, user_id')
      .eq('is_active', true);

    if (userEmail) {
      consultantQuery = consultantQuery.or(`user_id.eq.${userId},email.ilike.${userEmail}`);
    } else {
      consultantQuery = consultantQuery.eq('user_id', userId);
    }

    const { data: consultants } = await bounded(consultantQuery.limit(1), 'consultant lookup');
    const consultant = consultants?.[0];

    if (!consultant) {
      return res.status(403).json({ success: false, error: 'Forbidden: Not registered as an active consultant.' });
    }

    const { data: bookings } = await bounded(
      activeDbClient
        .from('bookings')
        .select('id, status, session_price, consultant_earnings, payout_status, date, time')
        .eq('consultant_id', consultant.id),
      'consultant bookings stats query'
    );

    const allBookings = bookings || [];
    const totalBookings = allBookings.length;
    const completedSessions = allBookings.filter((b) => b.status === 'completed').length;
    const upcomingSessions = allBookings.filter((b) => b.status === 'confirmed').length;

    let totalEarnings = 0;
    let pendingEarnings = 0;
    let paidEarnings = 0;

    for (const b of allBookings) {
      if (b.status === 'completed') {
        const earnings = b.consultant_earnings ?? (b.session_price ? Math.round(b.session_price * 0.8) : 0);
        totalEarnings += earnings;
        if (b.payout_status === 'paid') {
          paidEarnings += earnings;
        } else {
          pendingEarnings += earnings;
        }
      }
    }

    const { data: reviews } = await bounded(
      activeDbClient
        .from('testimonials')
        .select('rating')
        .eq('consultant_id', consultant.id),
      'consultant reviews stats query'
    ).catch(() => ({ data: [] }));

    let avgRating: number | null = null;
    const totalReviews = reviews?.length || 0;
    if (totalReviews > 0) {
      const sum = reviews!.reduce((acc: number, r: any) => acc + (r.rating || 5), 0);
      avgRating = Number((sum / totalReviews).toFixed(1));
    }

    return res.status(200).json({
      success: true,
      stats: {
        total_bookings: totalBookings,
        completed_sessions: completedSessions,
        upcoming_sessions: upcomingSessions,
        total_earnings: totalEarnings,
        pending_earnings: pendingEarnings,
        paid_earnings: paidEarnings,
        average_rating: avgRating,
        total_reviews: totalReviews,
      },
    });
  } catch (err: any) {
    console.error('[Consultant Stats Endpoint] Error:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to compute consultant statistics.',
    });
  }
}
