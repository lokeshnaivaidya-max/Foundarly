import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { extractClientIp } from '../../src/server/rateLimiter.js';
import { isAllowedAdminEmail } from '../../src/lib/authorization.js';

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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
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
    const { data: { user }, error: userError } = await supabaseAdminClient.auth.getUser(token);
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

    // Check existing profile role so we never demote super admins or developer admins
    const { data: userProfile } = await activeDbClient
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle();

    const isSuper = (userProfile?.role === 'super_admin' || userProfile?.role === 'admin') && isAllowedAdminEmail(userEmail);
    const isDev = userProfile?.role === 'developer_admin';

    // 1. Search existing consultant record
    let consultantQuery = activeDbClient
      .from('consultants')
      .select('*');

    if (userEmail) {
      consultantQuery = consultantQuery.or(`user_id.eq.${userId},email.ilike.${userEmail}`);
    } else {
      consultantQuery = consultantQuery.eq('user_id', userId);
    }

    const { data: consultants } = await consultantQuery.limit(1);
    let consultant = consultants?.[0] || null;

    // 2. If not found in consultants, check if user has an APPROVED application in consultant_applications
    if (!consultant && userEmail) {
      const { data: applications } = await activeDbClient
        .from('consultant_applications')
        .select('*')
        .ilike('email', userEmail)
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .limit(1);

      const approvedApp = applications?.[0];
      if (approvedApp) {
        console.log(`[Consultant Me] Auto-activating consultant record from approved application for ${userEmail}`);
        const genderValue = approvedApp.gender?.toLowerCase() === 'female' ? 'female' : 'male';
        const { data: newConsultant, error: createErr } = await activeDbClient
          .from('consultants')
          .insert({
            name: approvedApp.name,
            title: approvedApp.current_job || 'Consultant',
            bio: approvedApp.experience || '',
            expertise: ['Consulting', approvedApp.qualification || 'Advisory'].filter(Boolean),
            pricing_30: 1000,
            pricing_60: 1800,
            gender: genderValue,
            is_active: true,
            email: userEmail,
            preferred_time: approvedApp.preferred_session_timing || 'Morning (8 AM – 12 PM)',
            user_id: userId,
          })
          .select()
          .single();

        if (!createErr && newConsultant) {
          consultant = newConsultant;
        }
      }
    }

    if (!consultant) {
      return res.status(200).json({
        success: true,
        isConsultant: false,
        consultant: null,
      });
    }

    // 3. Reconcile user_id link on consultant record
    if (consultant.user_id !== userId) {
      console.log(`[Consultant Me] Linking consultant ${consultant.id} to user_id ${userId}`);
      await activeDbClient
        .from('consultants')
        .update({ user_id: userId, is_active: true })
        .eq('id', consultant.id);
      consultant.user_id = userId;
      consultant.is_active = true;
    }

    // 4. Reconcile email if missing
    if (!consultant.email && userEmail) {
      await activeDbClient
        .from('consultants')
        .update({ email: userEmail })
        .eq('id', consultant.id);
      consultant.email = userEmail;
    }

    // 5. Authoritatively update user profile role in profiles table (unless admin)
    if (!isSuper && !isDev) {
      await activeDbClient
        .from('profiles')
        .upsert({
          id: userId,
          role: 'consultant',
          full_name: consultant.name,
          is_consultant: true,
        });
    }

    return res.status(200).json({
      success: true,
      isConsultant: true,
      consultant,
    });
  } catch (err: any) {
    console.error('[Consultant Me Endpoint] Error:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to verify consultant status.',
    });
  }
}
