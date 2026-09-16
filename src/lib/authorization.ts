import type { User } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';

type Profile = Database['public']['Tables']['profiles']['Row'] | {
  id: string;
  role?: string | null;
  full_name?: string | null;
  is_consultant?: boolean | null;
  [key: string]: any;
};

/**
 * Explicit admin allowlist resolution.
 * Only designated administrator emails can hold or be granted the admin role.
 * Defaults strictly to the official organization admin email (admin@foundarly.com).
 * Personal email accounts are NEVER granted admin rights by default.
 */
export function getAdminAllowlist(): string[] {
  const envEmails = (
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_ADMIN_EMAILS) ||
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_ADMIN_EMAIL) ||
    ''
  );

  const parsedList = envEmails
    .split(',')
    .map((email: string) => email.trim().toLowerCase())
    .filter(Boolean);

  // If environment specifies an allowlist, use it; otherwise, default to the official platform admin email.
  if (parsedList.length > 0) {
    return parsedList;
  }

  return ['admin@foundarly.com'];
}

/**
 * Check if an email matches the explicit admin allowlist.
 */
export function isAllowedAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  const allowlist = getAdminAllowlist();
  return allowlist.includes(normalized);
}

/**
 * Determine if a user possesses legitimate administrator authorization.
 * Defense-in-depth: Requires BOTH the database role to be 'admin' AND
 * the user's verified authenticated email to be in the explicit admin allowlist.
 */
export function isUserAdmin(
  user?: User | null,
  profile?: Profile | null
): boolean {
  if (!user || !user.email) return false;
  const hasAllowlistedEmail = isAllowedAdminEmail(user.email);
  const hasAdminRole = profile?.role === 'admin';
  return hasAllowlistedEmail && hasAdminRole;
}

/**
 * Sanitize and correct profile roles.
 * If a profile has role 'admin' in the database but the email is not in the admin allowlist,
 * demote/sanitize the role to 'client' to neutralize any historical unauthorized privilege escalation.
 */
export function sanitizeUserRole(
  userOrEmail: User | string | null | undefined,
  profileOrRole?: Profile | string | null | undefined
): 'admin' | 'consultant' | 'client' {
  const email = typeof userOrEmail === 'string'
    ? userOrEmail
    : userOrEmail?.email;

  const currentRole = typeof profileOrRole === 'string'
    ? profileOrRole
    : profileOrRole?.role;

  if (currentRole === 'admin') {
    if (isAllowedAdminEmail(email)) {
      return 'admin';
    }
    // Unauthorized or accidental admin assignment -> sanitize to standard client
    return 'client';
  }

  if (currentRole === 'consultant' || (typeof profileOrRole === 'object' && profileOrRole?.is_consultant)) {
    return 'consultant';
  }

  return 'client';
}

/**
 * Get the effective authenticated role for a user and profile.
 */
export function getUserEffectiveRole(
  user?: User | null,
  profile?: Profile | null
): 'admin' | 'consultant' | 'client' {
  if (isUserAdmin(user, profile)) {
    return 'admin';
  }
  if (profile?.role === 'consultant' || profile?.is_consultant) {
    return 'consultant';
  }
  return 'client';
}

