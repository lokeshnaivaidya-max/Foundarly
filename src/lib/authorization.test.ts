import { describe, expect, it } from 'vitest';
import {
  getAdminAllowlist,
  isAllowedAdminEmail,
  isUserAdmin,
  sanitizeUserRole,
  getUserEffectiveRole,
} from './authorization';

describe('Authorization & Admin Security Suite', () => {
  const allowlistedAdminEmail = 'admin@foundarly.com';
  const normalUserEmail = 'naivaidya736@gmail.com';
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

  describe('Multi-Factor Admin Authorization (isUserAdmin)', () => {
    it('Scenario A: Verified admin email + database admin role => Authorized Admin', () => {
      const adminUser = { id: 'admin-1', email: allowlistedAdminEmail };
      const adminProfile = { id: 'admin-1', role: 'admin' as const, full_name: 'Admin' };

      expect(isUserAdmin(adminUser, adminProfile)).toBe(true);
      expect(getUserEffectiveRole(adminUser, adminProfile)).toBe('admin');
    });

    it('Scenario B: Normal Google user with client role => Not Admin (Client)', () => {
      const normalUser = { id: 'user-1', email: normalUserEmail };
      const clientProfile = { id: 'user-1', role: 'client' as const, full_name: 'Normal User' };

      expect(isUserAdmin(normalUser, clientProfile)).toBe(false);
      expect(getUserEffectiveRole(normalUser, clientProfile)).toBe('client');
    });

    it('Defense-in-Depth: Normal Google account with compromised/corrupted DB role "admin" => Rejected and Demoted', () => {
      // Even if attacker or accidental mutation set role='admin' in DB for a normal email
      const normalUser = { id: 'user-1', email: normalUserEmail };
      const corruptedProfile = { id: 'user-1', role: 'admin' as const, full_name: 'Normal User' };

      // Must be rejected
      expect(isUserAdmin(normalUser, corruptedProfile)).toBe(false);
      // Sanitizer must demote to 'client'
      expect(sanitizeUserRole(normalUser, corruptedProfile)).toBe('client');
      expect(getUserEffectiveRole(normalUser, corruptedProfile)).toBe('client');
    });

    it('Admin email but DB profile has not been assigned admin role => Not Admin', () => {
      const adminUser = { id: 'admin-2', email: allowlistedAdminEmail };
      const nonAdminProfile = { id: 'admin-2', role: 'client' as const, full_name: 'Pending Admin' };

      expect(isUserAdmin(adminUser, nonAdminProfile)).toBe(false);
    });

    it('Scenario D: Unauthenticated user (null user) => Not Admin', () => {
      expect(isUserAdmin(null, null)).toBe(false);
      expect(getUserEffectiveRole(null, null)).toBe('client');
    });
  });
});
