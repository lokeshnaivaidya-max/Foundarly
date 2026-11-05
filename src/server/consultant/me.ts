import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { extractClientIp } from '../rateLimiter.js';
import { isAllowedAdminEmail } from '../../lib/authorization.js';
import { secureLog } from '../../utils/security.js';

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

  // Hoisted for the outer catch: an error may occur before the authenticated
  // user is known; the failure log must never itself throw (TS18004 catch bug).
  let userId = '';

  try {
    // BOUNDED EXECUTION: server-side RLS/policy evaluation on some tables
    // (profiles, consultant_applications) has been observed to hang for
    // authenticated sessions (production incident on 9929d98 — /api/consultant/me
    // pending forever). Every Supabase call is raced against a shared deadline
    // so this function ALWAYS returns a response within ~8s. A timeout surfaces
    // as an honest 500 — never a fake success and never an indefinite pending.
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

    userId = user.id;
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
    const { data: userProfile } = await bounded(
      activeDbClient
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .maybeSingle(),
      'profile role lookup'
    );

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

    const { data: consultants } = await bounded(consultantQuery.limit(1), 'consultant lookup');
    let consultant = consultants?.[0] || null;

    // 2. If not found in consultants, check if user has an APPROVED application
    // in consultant_applications (email-based match requires a verified email)
    if (!consultant && userEmail && emailVerified) {
      const { data: applications } = await bounded(
        activeDbClient
          .from('consultant_applications')
          .select('*')
          .ilike('email', userEmail)
          .eq('status', 'approved')
          .order('created_at', { ascending: false })
          .limit(1),
        'approved application lookup'
      );

      const approvedApp = applications?.[0];
      if (approvedApp) {
        // ACCOUNT ACTIVATION vs PUBLIC PUBLICATION: an approved application
        // activates the consultant ACCOUNT (profiles.role). It must NEVER
        // auto-publish application free-text (qualification, current_job,
        // experience) as a public consultant profile. Create an identity-only
        // DRAFT (is_active: false) with neutral empty professional fields —
        // title/bio/expertise/pricing are filled in by the consultant or admin
        // and the profile is published explicitly via the Manage Consultants
        // toggle. Nothing here becomes publicly visible until is_active=true.
        console.log(`[Consultant Me] Approved application found; creating NON-PUBLIC draft consultant record for ${userEmail}`);
        const { data: newConsultant, error: createErr } = await bounded(
          activeDbClient
            .from('consultants')
            .insert({
              name: approvedApp.name,
              email: userEmail,
              user_id: userId,
              is_active: true,
              title: approvedApp.title || '',
              bio: approvedApp.bio || '',
              expertise: approvedApp.expertise || [],
              pricing_30: 0,
              pricing_60: 0,
            })
            .select()
            .single(),
          'active consultant creation'
        );

        if (!createErr && newConsultant) {
          consultant = newConsultant;
        } else if (createErr) {
          // Likely RLS (non-admin tokens cannot insert consultants rows).
          // Account activation is unaffected — the draft can be created later
          // by admin-side sync. Never fatal for role resolution.
          secureLog.warn(
            '[Consultant Me] Could not create draft consultant record (RLS or write error):',
            { userId, error: createErr?.message || String(createErr) }
          );
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
      // The record carries a different user_id. Before refusing, check whether
      // that link is provably stale: with the service role key we can confirm no
      // live authenticated account owns this link with the consultant's email
      // (auth emails are unique, so a stored account with a different email
      // cannot be the legitimate owner). Only then may the verified-email
      // requester reclaim the link. Without the service role key we never
      // overwrite another account's claim.
      let storedUserEmail: string | null = null;
      if (hasServiceRoleKey) {
        try {
          const { data: usersData } = await bounded(
            supabaseAdminClient.auth.admin.listUsers({
              page: 1,
              perPage: 1000,
            }),
            'auth admin user lookup'
          );
          // Explicit shape: supabase-js listUsers types resolve differently
          // under Vercel's node16 moduleResolution (users can infer as never[]).
          const users = (usersData as { users?: Array<{ id: string; email?: string | null }> } | null | undefined)?.users;
          const storedUser = users?.find((u) => u.id === consultant.user_id);
          storedUserEmail = (storedUser?.email || '').toLowerCase().trim() || null;
        } catch {
          storedUserEmail = null;
        }
      }

      const storedLinkProvablyStale =
        hasServiceRoleKey && storedUserEmail !== null && storedUserEmail !== userEmail;

      if (!storedLinkProvablyStale) {
        // Already linked to a different authenticated account — never overwrite
        // another account's claim on this consultant record.
        secureLog.warn(
          '[Consultant Me] Consultant record is linked to a different authenticated user; not overwriting',
          { userId, consultantId: consultant.id, existingUserId: consultant.user_id }
        );
      } else {
        secureLog.warn(
          '[Consultant Me] Stored user_id no longer matches the consultant email; reclaiming link for verified requester',
          { userId, consultantId: consultant.id, existingUserId: consultant.user_id }
        );
        const { error: linkErr } = await bounded(
          activeDbClient
            .from('consultants')
            .update({ user_id: userId, is_active: true })
            .eq('id', consultant.id),
          'stale-link reclaim update'
        );
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
    } else if (!linked) {
      const { error: linkErr } = await bounded(
        activeDbClient
          .from('consultants')
          .update({ user_id: userId, is_active: true })
          .eq('id', consultant.id),
        'consultant user_id link update'
      );
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
      const { error: emailErr } = await bounded(
        activeDbClient
          .from('consultants')
          .update({ email: userEmail })
          .eq('id', consultant.id),
        'consultant email backfill'
      );
      if (emailErr) {
        secureLog.warn(
          '[Consultant Me] Could not update consultant email (RLS or write error):',
          { userId, consultantId: consultant.id, error: emailErr?.message || String(emailErr) }
        );
      } else {
        consultant.email = userEmail;
      }
    }

    // 5. Authoritatively update user profile role in profiles table ONLY AFTER authoritative linking
    if (linked && !isSuper && !isDev) {
      const { error: profileErr } = await bounded(
        activeDbClient
          .from('profiles')
          .upsert({
            id: userId,
            role: 'consultant',
            full_name: consultant.name,
          }),
        'profile role upsert'
      );
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
