import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { extractClientIp } from '../../src/server/rateLimiter.js';
import { isAllowedAdminEmail } from '../../src/lib/authorization.js';
import { secureLog } from '../../src/utils/security.js';

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
    // Email-based identity matching is only trusted when Supabase has confirmed
    // the address (email_confirmed_at; confirmed_at covers legacy accounts and
    // OAuth identities confirmed at first sign-in). An unverified email must
    // never grant consultant access on its own — the authenticated UUID is the
    // preferred identity.
    const emailVerified = Boolean(
      (user as { email_confirmed_at?: string }).email_confirmed_at ||
        (user as { confirmed_at?: string }).confirmed_at
    );

    secureLog.info('[Consultant Me] Request received', {
      userId,
      hasEmail: Boolean(userEmail),
    });

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

    // 1. Search existing consultant record. Prefer the authenticated UUID;
    // email matching only when the authenticated email is verified.
    let consultantQuery = activeDbClient
      .from('consultants')
      .select('*');

    if (userEmail && emailVerified) {
      consultantQuery = consultantQuery.or(`user_id.eq.${userId},email.ilike.${userEmail}`);
    } else {
      consultantQuery = consultantQuery.eq('user_id', userId);
    }

    const { data: consultants } = await consultantQuery.limit(1);
    let consultant = consultants?.[0] || null;

    // 2. If not found in consultants, check if user has an APPROVED application
    // in consultant_applications (email-based match requires a verified email)
    if (!consultant && userEmail && emailVerified) {
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
      secureLog.info('[Consultant Me] No consultant record found for user', { userId, hasEmail: Boolean(userEmail) });
      return res.status(200).json({
        success: true,
        isConsultant: false,
        consultant: null,
      });
    }

    secureLog.info('[Consultant Me] Consultant record found', {
      userId,
      consultantId: consultant.id,
      consultantUserId: consultant.user_id ?? null,
      isActive: consultant.is_active ?? null,
      hasMatchedUserId: consultant.user_id === userId,
    });

    // 3. Reconcile user_id link on consultant record (best-effort; requires admin RLS).
    // Track linkage explicitly so the response never represents the account as
    // securely linked when the link is missing or could not be established.
    let linked = consultant.user_id === userId;
    if (!linked && consultant.user_id) {
      // Already linked to a different authenticated account — never overwrite
      // another account's claim on this consultant record.
      secureLog.warn(
        '[Consultant Me] Consultant record is linked to a different authenticated user; not overwriting',
        { userId, consultantId: consultant.id, existingUserId: consultant.user_id }
      );
    } else if (!linked) {
      const { error: linkErr } = await activeDbClient
        .from('consultants')
        .update({ user_id: userId, is_active: true })
        .eq('id', consultant.id);
      if (linkErr) {
        // Non-admin users cannot update consultants.user_id due to RLS.
        // The consultant record is still valid (matched by UUID or verified
        // email); `linked` stays false so callers know the DB link is not
        // established. Linking will be retried by admin-side sync.
        secureLog.warn(
          '[Consultant Me] Could not link consultant user_id (RLS or write error):',
          { userId, consultantId: consultant.id, error: linkErr?.message || String(linkErr) }
        );
      } else {
        consultant.user_id = userId;
        consultant.is_active = true;
        linked = true;
      }
    }

    // 4. Reconcile email if missing (best-effort; requires admin RLS). Only a
    // verified email may be written onto the consultant record.
    if (!consultant.email && userEmail && emailVerified) {
      const { error: emailErr } = await activeDbClient
        .from('consultants')
        .update({ email: userEmail })
        .eq('id', consultant.id);
      if (emailErr) {
        secureLog.warn(
          '[Consultant Me] Could not update consultant email (RLS or write error):',
          { userId, consultantId: consultant.id, error: emailErr?.message || String(emailErr) }
        );
      } else {
        consultant.email = userEmail;
      }
    }

    // 5. Authoritatively update user profile role in profiles table (unless admin)
    if (!isSuper && !isDev) {
      const { error: profileErr } = await activeDbClient
        .from('profiles')
        .upsert({
          id: userId,
          role: 'consultant',
          full_name: consultant.name,
          is_consultant: true,
        });
      if (profileErr) {
        secureLog.warn(
          '[Consultant Me] Could not update profile role (RLS or write error):',
          { userId, error: profileErr?.message || String(profileErr) }
        );
      }
    }

    secureLog.info('[Consultant Me] Returning isConsultant=true', {
      userId,
      consultantId: consultant.id,
      linked,
    });

    return res.status(200).json({
      success: true,
      isConsultant: true,
      linked,
      consultant,
    });
  } catch (err: any) {
    console.error('[Consultant Me Endpoint] Error:', err);
    secureLog.error('[Consultant Me] Request failed', { userId, error: err?.message || String(err) });
    return res.status(500).json({
      success: false,
      error: 'Failed to verify consultant status.',
    });
  }
}
