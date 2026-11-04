import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';

export const DEFAULT_SUPABASE_URL = 'https://rfyxnshvtfswvaogjzwq.supabase.co';
export const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_QPkFtczpj8_WzxPf4ZoENw_ZpnfN9vd';

const ADMIN_ROLES = new Set(['admin', 'super_admin', 'developer_admin']);

export function getSupabaseUrl(): string {
  return (
    process.env.VITE_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    DEFAULT_SUPABASE_URL
  );
}

export function getSupabaseAnonKey(): string {
  return (
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    DEFAULT_SUPABASE_ANON_KEY
  );
}

export function getSupabaseServiceKey(): string | null {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return key && key.trim() ? key.trim() : null;
}

export function getAdminEmailAllowlist(): string[] {
  const envList = [
    process.env.ADMIN_EMAILS,
    process.env.SUPER_ADMIN_EMAILS,
    process.env.VITE_ADMIN_EMAILS,
    process.env.VITE_SUPER_ADMIN_EMAILS,
    process.env.ADMIN_EMAIL,
    process.env.VITE_ADMIN_EMAIL,
  ]
    .filter(Boolean)
    .join(',');

  const parsed = envList
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  const defaults = [
    'admin@foundarly.com',
    'admin@foundarlybusinessworld.in',
    'foundarly@developer.in',
    'jvedtechadmin@gmail.com',
    'lokesh.naivaidya@gmail.com',
  ];

  return Array.from(new Set([...defaults, ...parsed]));
}

export function isAllowlistedAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return getAdminEmailAllowlist().includes(email.trim().toLowerCase());
}

/** Service-role client when configured (bypasses RLS). Never returned to a browser. */
export function createServerSupabaseClient(): SupabaseClient {
  const serviceKey = getSupabaseServiceKey();
  return createClient(getSupabaseUrl(), serviceKey || getSupabaseAnonKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Client scoped to the caller's access token. Required when the deployment has
 * no service role key, so RLS evaluates auth.uid() instead of anon.
 */
export function createUserScopedSupabaseClient(accessToken: string): SupabaseClient {
  const serviceKey = getSupabaseServiceKey();
  return createClient(getSupabaseUrl(), serviceKey || getSupabaseAnonKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: serviceKey ? {} : { Authorization: `Bearer ${accessToken}` },
    },
  });
}

export interface AdminAuthResult {
  ok: boolean;
  status?: number;
  error?: string;
  user?: User;
  profile?: { id: string; role?: string | null; full_name?: string | null } | null;
  client?: SupabaseClient;
  usingServiceRole?: boolean;
}

/**
 * Validate a bearer token and require an admin role (super_admin, admin or
 * developer_admin) or an explicitly allowlisted admin email.
 */
export async function authenticateAdminRequest(
  authorizationHeader?: string | string[] | null,
): Promise<AdminAuthResult> {
  const header = Array.isArray(authorizationHeader) ? authorizationHeader[0] : authorizationHeader;
  if (!header || typeof header !== 'string' || !header.startsWith('Bearer ')) {
    return { ok: false, status: 401, error: 'Authentication required.' };
  }

  const token = header.slice('Bearer '.length).trim();
  if (!token) {
    return { ok: false, status: 401, error: 'Authentication token is missing.' };
  }

  const usingServiceRole = Boolean(getSupabaseServiceKey());
  const baseClient = createServerSupabaseClient();

  try {
    const { data: userData, error: userError } = await baseClient.auth.getUser(token);
    if (userError || !userData?.user) {
      return { ok: false, status: 401, error: 'Invalid or expired authentication session.' };
    }

    const user = userData.user;
    const queryClient = createUserScopedSupabaseClient(token);

    const { data: profile, error: profileError } = await queryClient
      .from('profiles')
      .select('id, role, full_name')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      // A missing/blocked profile should not grant access, but an allowlisted
      // email can still be repaired by the same rules as the UI.
        console.warn('[admin-api-auth] Profile lookup failed:', profileError.code || profileError.message);
    }

    const role = String((profile as any)?.role || '').toLowerCase();
    const emailAllowed = isAllowlistedAdminEmail(user.email);

    if (!ADMIN_ROLES.has(role) && !emailAllowed) {
      return { ok: false, status: 403, error: 'Administrator privileges are required.' };
    }

    return {
      ok: true,
      user,
      profile: (profile as any) || null,
      client: queryClient,
      usingServiceRole,
    };
  } catch (error: any) {
    console.error('[admin-api-auth] Unexpected auth error:', error?.message || error);
    return { ok: false, status: 500, error: 'Could not verify administrator authorization.' };
  }
}
