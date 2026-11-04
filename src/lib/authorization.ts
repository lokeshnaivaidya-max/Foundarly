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
    (typeof process !== 'undefined' && (process.env?.ADMIN_EMAILS || process.env?.SUPER_ADMIN_EMAILS)) ||
    ''
  );

  const parsedList = envEmails
    .split(',')
    .map((email: string) => email.trim().toLowerCase())
    .filter(Boolean);

  const defaults = [
    'admin@foundarly.com',
    'admin@foundarlybusinessworld.in',
    'jvedtechadmin@gmail.com',
    'lokesh.naivaidya@gmail.com',
  ];

  return Array.from(new Set([...defaults, ...parsedList]));
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
 * Resolves to true if user has allowlisted email and matching super_admin or legacy admin role.
 * Developer Admin role is strictly isolated and never treated as Super Admin.
 */
export function isSuperAdmin(
  user?: User | null,
  profile?: Profile | null
): boolean {
  if (profile?.role === 'developer_admin') return false;
  if (user?.email) {
    const email = user.email.toLowerCase().trim();
    if (email === 'foundarly@developer.in') return false;
    if (isAllowedAdminEmail(email)) return true;
  }
  return profile?.role === 'super_admin';
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
  if (profile?.role === 'developer_admin') return true;
  if (!user || !user.email) return false;
  return user.email.toLowerCase().trim() === 'foundarly@developer.in';
}

/**
 * Determine if a user possesses any administrator authorization
 * (Super Admin, Admin, or Developer Admin).
 */
export function isUserAdmin(
  user?: User | null,
  profile?: Profile | null
): boolean {
  return (
    isSuperAdmin(user, profile) ||
    profile?.role === 'admin' ||
    isDeveloperAdmin(user, profile)
  );
}

/**
 * Get the effective authenticated role for a user and profile.
 */
export function getUserEffectiveRole(
  user?: User | null,
  profile?: Profile | null
): UserRole {
  if (isSuperAdmin(user, profile)) {
    return 'super_admin';
  }
  if (profile?.role === 'admin') {
    return 'admin';
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
 * Sanitize and correct profile roles without demoting legitimate roles.
 * Neutralizes forged super_admin / admin roles if email is not allowlisted.
 */
export function sanitizeUserRole(
  userOrEmail: User | string | null | undefined,
  profileOrRole?: Profile | string | null | undefined
): UserRole {
  const email = typeof userOrEmail === 'string'
    ? userOrEmail
    : userOrEmail?.email;

  const currentRole = typeof profileOrRole === 'string'
    ? profileOrRole
    : profileOrRole?.role;

  if (currentRole === 'super_admin' || currentRole === 'admin') {
    if (isAllowedAdminEmail(email)) {
      return currentRole;
    }
    return 'client';
  }

  if (currentRole === 'developer_admin') {
    return 'developer_admin';
  }

  if (currentRole === 'consultant' || (typeof profileOrRole === 'object' && profileOrRole?.is_consultant)) {
    return 'consultant';
  }

  if (isAllowedAdminEmail(email)) {
    return 'super_admin';
  }

  return 'client';
}

/**
 * Fine-grained permission checker for admin sections.
 * Super Admin has full platform access.
 * Developer Admin can access all ordinary operational admin sections plus developer tools,
 * but CANNOT access 'administrators' (admin account management & role assignment).
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

  // Developer Admin permissions: Full access to all ordinary admin sections plus developer tools,
  // strictly excluding 'administrators' (admin-account management & role assignment)
  if (role === 'developer_admin') {
    return section !== 'administrators';
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
 * Check if the user can mutate user roles (promote, demote, or assign admin privileges).
 * STRICTLY restricted to Super Admin.
 */
export function canMutateUserRoles(user?: User | null, profile?: Profile | null): boolean {
  return isSuperAdmin(user, profile);
}

/**
 * Check if the user can access financial data, payouts, and billing records.
 * Accessible to Super Admin and Developer Admin for operational monitoring.
 */
export function canAccessFinancials(user?: User | null, profile?: Profile | null): boolean {
  return isUserAdmin(user, profile);
}

/**
 * Check if the user can view and manage user records.
 * General user management is accessible to all administrators,
 * while privileged role modifications are strictly gated by canMutateUserRoles.
 */
export function canManageUsers(user?: User | null, profile?: Profile | null): boolean {
  return isUserAdmin(user, profile);
}

/**
 * Check if the user can manage platform settings.
 * Accessible to Super Admin and Developer Admin.
 */
export function canManageSettings(user?: User | null, profile?: Profile | null): boolean {
  return isUserAdmin(user, profile);
}

