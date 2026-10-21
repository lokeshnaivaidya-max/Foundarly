import type { User } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';

export type UserRole = 'super_admin' | 'developer_admin' | 'admin' | 'consultant' | 'client';

export type AdminSection =
  | 'overview'
  | 'administrators'
  | 'developer'
  | 'logs'
  | 'users'
  | 'settings'
  | 'pricing'
  | 'payouts'
  | 'bookings'
  | 'consultants'
  | 'consultant_applications'
  | 'content'
  | 'categories'
  | 'referrals'
  | 'testimonials'
  | 'blog'
  | 'faqs'
  | 'networking';

type Profile = Database['public']['Tables']['profiles']['Row'] | {
  id: string;
  role?: string | null;
  full_name?: string | null;
  is_consultant?: boolean | null;
  [key: string]: any;
};

/**
 * Explicit admin allowlist resolution for Super Administrators.
 * Only designated administrator emails can hold or be granted the Super Admin role.
 * Defaults strictly to the official organization admin email (admin@foundarly.com).
 * Personal email accounts are NEVER granted super admin rights by default.
 */
export function getAdminAllowlist(): string[] {
  const envEmails = (
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPER_ADMIN_EMAILS) ||
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_ADMIN_EMAILS) ||
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_ADMIN_EMAIL) ||
    ''
  );

  const parsedList = envEmails
    .split(',')
    .map((email: string) => email.trim().toLowerCase())
    .filter(Boolean);

  if (parsedList.length > 0) {
    return parsedList;
  }
  return ['admin@foundarly.com'];
}

/**
 * Check if an email matches the explicit admin allowlist for Super Admin.
 */
export function isAllowedAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  const allowlist = getAdminAllowlist();
  return allowlist.includes(normalized);
}

/**
 * Check if user possesses verified Super Admin authorization.
 * Defense-in-depth: Requires BOTH a database role of ('super_admin' | 'admin')
 * AND the user's verified authenticated email to be in the explicit allowlist.
 */
export function isSuperAdmin(
  user?: User | null,
  profile?: Profile | null
): boolean {
  if (!user || !user.email) return false;
  const hasAllowlistedEmail = isAllowedAdminEmail(user.email);
  const hasSuperRole = profile?.role === 'super_admin' || profile?.role === 'admin';
  return hasAllowlistedEmail && hasSuperRole;
}

/**
 * Check if user possesses Developer Admin role.
 * Developer Admin is designated for technical maintenance and diagnostics.
 * It does NOT grant Super Admin privileges.
 */
export function isDeveloperAdmin(
  user?: User | null,
  profile?: Profile | null
): boolean {
  if (!user || !user.id) return false;
  return profile?.role === 'developer_admin';
}

/**
 * Determine if a user possesses any administrator authorization
 * (either Super Admin or Developer Admin).
 */
export function isUserAdmin(
  user?: User | null,
  profile?: Profile | null
): boolean {
  return isSuperAdmin(user, profile) || isDeveloperAdmin(user, profile);
}

/**
 * Get the effective authenticated role for a user and profile.
 */
export function getUserEffectiveRole(
  user?: User | null,
  profile?: Profile | null
): 'super_admin' | 'developer_admin' | 'consultant' | 'client' {
  if (isSuperAdmin(user, profile)) {
    return 'super_admin';
  }
  if (isDeveloperAdmin(user, profile)) {
    return 'developer_admin';
  }
  if (profile?.role === 'consultant' || profile?.is_consultant) {
    return 'consultant';
  }
  return 'client';
}

/**
 * Sanitize and correct profile roles.
 * If a profile has role 'super_admin' or 'admin' in the database but the email is not allowlisted,
 * demote/sanitize the role to 'client' to neutralize unauthorized privilege escalation.
 */
export function sanitizeUserRole(
  userOrEmail: User | string | null | undefined,
  profileOrRole?: Profile | string | null | undefined
): 'super_admin' | 'developer_admin' | 'consultant' | 'client' {
  const email = typeof userOrEmail === 'string'
    ? userOrEmail
    : userOrEmail?.email;
  const currentRole = typeof profileOrRole === 'string'
    ? profileOrRole
    : profileOrRole?.role;

  if (currentRole === 'super_admin' || currentRole === 'admin') {
    if (isAllowedAdminEmail(email)) {
      return 'super_admin';
    }
    return 'client';
  }

  if (currentRole === 'developer_admin') {
    return 'developer_admin';
  }

  if (currentRole === 'consultant' || (typeof profileOrRole === 'object' && profileOrRole?.is_consultant)) {
    return 'consultant';
  }

  return 'client';
}

/**
 * Fine-grained permission checker for admin sections.
 * Strictly separates Super Admin executive powers from Developer Admin technical scope.
 */
export function canAccessSection(
  role: 'super_admin' | 'developer_admin' | 'consultant' | 'client' | 'admin' | string | null | undefined,
  section: AdminSection
): boolean {
  if (!role) return false;

  // Super Admin has full platform access
  if (role === 'super_admin' || role === 'admin') {
    return true;
  }

  // Developer Admin permissions: Technical health, non-sensitive configs, diagnostics & redacted logs, FAQs
  if (role === 'developer_admin') {
    const devAllowedSections: AdminSection[] = [
      'overview',
      'developer',
      'logs',
      'faqs',
      'blog',
    ];
    return devAllowedSections.includes(section);
  }

  // Clients and Consultants have no admin section access
  return false;
}

/**
 * Check if the user can manage administrators and role assignments.
 * STRICTLY restricted to Super Admin. Developer Admin CANNOT manage admins.
 */
export function canManageAdministrators(user?: User | null, profile?: Profile | null): boolean {
  return isSuperAdmin(user, profile);
}

/**
 * Check if the user can access financial data, payouts, and sensitive billing details.
 * STRICTLY restricted to Super Admin.
 */
export function canAccessFinancials(user?: User | null, profile?: Profile | null): boolean {
  return isSuperAdmin(user, profile);
}

/**
 * Check if the user can manage user accounts and profile credentials.
 * STRICTLY restricted to Super Admin.
 */
export function canManageUsers(user?: User | null, profile?: Profile | null): boolean {
  return isSuperAdmin(user, profile);
}

/**
 * Check if the user can manage platform settings and secrets.
 * STRICTLY restricted to Super Admin.
 */
export function canManageSettings(user?: User | null, profile?: Profile | null): boolean {
  return isSuperAdmin(user, profile);
}
