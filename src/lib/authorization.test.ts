import { describe, expect, it } from 'vitest';
import {
  getAdminAllowlist,
  isAllowedAdminEmail,
  isSuperAdmin,
  isDeveloperAdmin,
  isUserAdmin,
  sanitizeUserRole,
  getUserEffectiveRole,
  canAccessSection,
  canManageAdministrators,
  canAccessFinancials,
  canManageUsers,
  canManageSettings,
} from './authorization';

describe('Authorization & Admin Role Hierarchy Security Suite', () => {
  const allowlistedAdminEmail = 'admin@foundarly.com';
  const normalUserEmail = 'naivaidya736@gmail.com';
  const developerEmail = 'developer@foundarly.com';
  const otherNormalEmail = 'random.user@gmail.com';

  describe('Allowlist Verification (isAllowedAdminEmail)', () => {
    it('approves legitimate allowlisted admin emails', () => {
      expect(isAllowedAdminEmail(allowlistedAdminEmail)).toBe(true);
      expect(isAllowedAdminEmail('  ADMIN@FOUNDARLY.COM  ')).toBe(true);
    });

    it('rejects normal Google accounts and non-allowlisted emails', () => {
      expect(isAllowedAdminEmail(normalUserEmail)).toBe(false);
      expect(isAllowedAdminEmail(otherNormalEmail)).toBe(false);
      expect(isAllowedAdminEmail('attacker@evil.com')).toBe(false);
      expect(isAllowedAdminEmail('')).toBe(false);
      expect(isAllowedAdminEmail(null)).toBe(false);
      expect(isAllowedAdminEmail(undefined)).toBe(false);
    });
  });

  describe('Super Admin vs Developer Admin Multi-Factor Authorization', () => {
    it('Scenario 1: Verified allowlisted email + database super_admin role => Authorized Super Admin', () => {
      const superUser = { id: 'admin-1', email: allowlistedAdminEmail };
      const superProfile = { id: 'admin-1', role: 'super_admin' as const, full_name: 'Super Admin' };

      expect(isSuperAdmin(superUser, superProfile)).toBe(true);
      expect(isDeveloperAdmin(superUser, superProfile)).toBe(false);
      expect(isUserAdmin(superUser, superProfile)).toBe(true);
      expect(getUserEffectiveRole(superUser, superProfile)).toBe('super_admin');
    });

    it('Scenario 1b: Backward-compatible admin role + allowlisted email => Recognized Super Admin', () => {
      const legacyAdminUser = { id: 'admin-1', email: allowlistedAdminEmail };
      const legacyAdminProfile = { id: 'admin-1', role: 'admin' as const, full_name: 'Admin' };

      expect(isSuperAdmin(legacyAdminUser, legacyAdminProfile)).toBe(true);
      expect(isUserAdmin(legacyAdminUser, legacyAdminProfile)).toBe(true);
      expect(getUserEffectiveRole(legacyAdminUser, legacyAdminProfile)).toBe('super_admin');
    });

    it('Scenario 2: Developer Admin with designated role in database => Authorized Developer Admin only', () => {
      const devUser = { id: 'dev-1', email: developerEmail };
      const devProfile = { id: 'dev-1', role: 'developer_admin' as const, full_name: 'Dev Admin' };

      expect(isDeveloperAdmin(devUser, devProfile)).toBe(true);
      expect(isSuperAdmin(devUser, devProfile)).toBe(false);
      expect(isUserAdmin(devUser, devProfile)).toBe(true);
      expect(getUserEffectiveRole(devUser, devProfile)).toBe('developer_admin');
    });

    it('Scenario 3: Normal client user => Not Admin (Client)', () => {
      const normalUser = { id: 'user-1', email: normalUserEmail };
      const clientProfile = { id: 'user-1', role: 'client' as const, full_name: 'Normal User' };

      expect(isSuperAdmin(normalUser, clientProfile)).toBe(false);
      expect(isDeveloperAdmin(normalUser, clientProfile)).toBe(false);
      expect(isUserAdmin(normalUser, clientProfile)).toBe(false);
      expect(getUserEffectiveRole(normalUser, clientProfile)).toBe('client');
    });

    it('Defense-in-Depth: Malicious user setting role="super_admin" without allowlist => Demoted to Client', () => {
      const normalUser = { id: 'user-1', email: normalUserEmail };
      const corruptedProfile = { id: 'user-1', role: 'super_admin' as const, full_name: 'Attacker' };

      expect(isSuperAdmin(normalUser, corruptedProfile)).toBe(false);
      expect(sanitizeUserRole(normalUser, corruptedProfile)).toBe('client');
      expect(getUserEffectiveRole(normalUser, corruptedProfile)).toBe('client');
    });
  });

  describe('Least-Privilege Section & Capability Enforcement', () => {
    it('Super Admin can access all operational and technical sections', () => {
      const superRole = 'super_admin';
      expect(canAccessSection(superRole, 'administrators')).toBe(true);
      expect(canAccessSection(superRole, 'users')).toBe(true);
      expect(canAccessSection(superRole, 'payouts')).toBe(true);
      expect(canAccessSection(superRole, 'pricing')).toBe(true);
      expect(canAccessSection(superRole, 'settings')).toBe(true);
      expect(canAccessSection(superRole, 'developer')).toBe(true);
      expect(canAccessSection(superRole, 'logs')).toBe(true);
    });

    it('Developer Admin can access all ordinary operational admin sections plus developer tools', () => {
      const devRole = 'developer_admin';
      // Allowed operational & technical areas:
      expect(canAccessSection(devRole, 'overview')).toBe(true);
      expect(canAccessSection(devRole, 'developer')).toBe(true);
      expect(canAccessSection(devRole, 'logs')).toBe(true);
      expect(canAccessSection(devRole, 'faqs')).toBe(true);
      expect(canAccessSection(devRole, 'blog')).toBe(true);
      expect(canAccessSection(devRole, 'bookings')).toBe(true);
      expect(canAccessSection(devRole, 'consultants')).toBe(true);
      expect(canAccessSection(devRole, 'consultant_applications')).toBe(true);
      expect(canAccessSection(devRole, 'payouts')).toBe(true);
      expect(canAccessSection(devRole, 'pricing')).toBe(true);
      expect(canAccessSection(devRole, 'settings')).toBe(true);
      expect(canAccessSection(devRole, 'users')).toBe(true);
      expect(canAccessSection(devRole, 'content')).toBe(true);
      expect(canAccessSection(devRole, 'categories')).toBe(true);
      expect(canAccessSection(devRole, 'referrals')).toBe(true);
      expect(canAccessSection(devRole, 'testimonials')).toBe(true);
      expect(canAccessSection(devRole, 'networking')).toBe(true);

      // STRICTLY FORBIDDEN: Administrator account management & role assignment:
      expect(canAccessSection(devRole, 'administrators')).toBe(false);
    });

    it('Permission functions strictly protect administrator account management and role mutations', () => {
      const superUser = { id: 'admin-1', email: allowlistedAdminEmail };
      const superProfile = { id: 'admin-1', role: 'super_admin' as const, full_name: 'Super Admin' };

      const devUser = { id: 'dev-1', email: developerEmail };
      const devProfile = { id: 'dev-1', role: 'developer_admin' as const, full_name: 'Dev Admin' };

      // Super Admin passes all
      expect(canManageAdministrators(superUser, superProfile)).toBe(true);
      expect(canAccessFinancials(superUser, superProfile)).toBe(true);
      expect(canManageUsers(superUser, superProfile)).toBe(true);
      expect(canManageSettings(superUser, superProfile)).toBe(true);

      // Developer Admin has operational access to ordinary admin tools
      expect(canAccessFinancials(devUser, devProfile)).toBe(true);
      expect(canManageUsers(devUser, devProfile)).toBe(true);
      expect(canManageSettings(devUser, devProfile)).toBe(true);

      // Developer Admin is STRICTLY blocked from managing administrator accounts
      expect(canManageAdministrators(devUser, devProfile)).toBe(false);
    });
  });
});

