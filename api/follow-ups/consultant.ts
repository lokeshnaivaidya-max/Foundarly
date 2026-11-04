import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { secureLog } from '../../src/utils/security.js';

dotenv.config();

interface RequestLike {
  method?: string;
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
    // BOUNDED EXECUTION: every Supabase call is raced against a shared deadline
    // so the function ALWAYS responds within ~8s.
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

    // Consultant identity: authenticated UUID first, exact email fallback —
    // the same convention as the client fallback in followUpService.
    let consultantQuery = activeDbClient
      .from('consultants')
      .select('id');

    if (userEmail) {
      consultantQuery = consultantQuery.or(`user_id.eq.${userId},email.ilike.${userEmail}`);
    } else {
      consultantQuery = consultantQuery.eq('user_id', userId);
    }

    const { data: consultants } = await bounded(consultantQuery.limit(1), 'consultant lookup');
    const consultant = consultants?.[0] || null;

    if (!consultant) {
      // No listing record yet (e.g. inactive draft pending creation):
      // legitimately zero follow-up requests — never fabricated data.
      return res.status(200).json({ success: true, followUps: [] });
    }

    const { data: followUps, error: followUpsError } = await bounded(
      activeDbClient
        .from('follow_up_requests')
        .select('*')
        .eq('consultant_id', consultant.id)
        .order('created_at', { ascending: false }),
      'follow-up requests lookup'
    );

    if (followUpsError) {
      secureLog.error('[Consultant Follow-ups] Lookup failed:', {
        userId,
        consultantId: consultant.id,
        error: followUpsError?.message || String(followUpsError),
      });
      return res.status(500).json({
        success: false,
        error: 'Failed to load follow-up requests.',
      });
    }

    return res.status(200).json({
      success: true,
      followUps: followUps || [],
    });
  } catch (err: any) {
    console.error('[Consultant Follow-ups Endpoint] Error:', err);
    secureLog.error('[Consultant Follow-ups] Request failed', { error: err?.message || String(err) });
    const isTimeout = String(err?.message || '').includes('timed out');
    return res.status(isTimeout ? 504 : 500).json({
      success: false,
      error: isTimeout
        ? 'Follow-up requests lookup timed out. Please retry.'
        : 'Failed to load follow-up requests.',
    });
  }
}
