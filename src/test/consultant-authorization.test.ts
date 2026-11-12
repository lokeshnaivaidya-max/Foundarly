/**
 * Consultant Authorization & Public Experts Listing — Regression Tests
 *
 * Covers Issue 1: only an explicitly admin-approved, non-deleted consultant may
 * hold consultant privileges; public listings must expose only active, eligible
 * consultants; stale cached role data must never restore consultant access.
 *
 * These tests exercise the pure authorization helpers and assert on the
 * authoritative role-resolution / public-listing source contracts.
 */

import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  getUserEffectiveRole,
  sanitizeUserRole,
  isUserAdmin,
} from '@/lib/authorization';

const root = process.cwd();
function readRel(p: string) {
  return fs.readFileSync(path.join(root, p), 'utf8');
}

describe('Consultant role must never be inferred from profile role alone', () => {
  it('a normal client (profile.role === client) resolves to client, never consultant', () => {
    const user = { id: 'u-client', email: 'client@example.com' } as any;
    const profile = { id: 'u-client', role: 'client' as const, full_name: 'Client' } as any;
    expect(getUserEffectiveRole(user, profile)).toBe('client');
    expect(isUserAdmin(user, profile)).toBe(false);
  });

  it('a legitimate approved consultant (profile.role === consultant) keeps consultant access', () => {
    const user = { id: 'u-cons', email: 'consultant@example.com' } as any;
    const profile = { id: 'u-cons', role: 'consultant' as const, full_name: 'Consultant' } as any;
    expect(getUserEffectiveRole(user, profile)).toBe('consultant');
  });

  it('a deleted consultant is downgraded to client (role no longer consultant)', () => {
    // Atomic deletion downgrades profiles.role 'consultant' -> 'client'.
    const user = { id: 'u-deleted', email: 'deleted@example.com' } as any;
    const profile = { id: 'u-deleted', role: 'client' as const, full_name: 'Deleted' } as any;
    expect(getUserEffectiveRole(user, profile)).toBe('client');
  });

  it('a rejected or pending application never confers the consultant role', () => {
    // Pending/rejected applications do not set profiles.role = 'consultant';
    // only explicit admin approval does. A client-role profile stays client.
    const user = { id: 'u-app', email: 'applicant@example.com' } as any;
    const profile = { id: 'u-app', role: 'client' as const, full_name: 'Applicant' } as any;
    expect(getUserEffectiveRole(user, profile)).toBe('client');
  });

  it('forgeable client metadata must never elevate a user to consultant', () => {
    const user = { id: 'u-forge', email: 'forge@example.com', user_metadata: { role: 'consultant' } } as any;
    const profile = { id: 'u-forge', role: 'client' as const, full_name: 'Forge' } as any;
    expect(getUserEffectiveRole(user, profile)).toBe('client');
    expect(sanitizeUserRole(user, profile)).toBe('client');
  });
});

describe('AuthContext consultant authorization (source contract)', () => {
  const authContext = readRel('src/contexts/AuthContext.tsx');

  it('requires a linked consultant record or approved application', () => {
    expect(authContext).toContain('hasLinkedConsultantRecord');
    expect(authContext).toContain('isMatchedConsultant');
    expect(authContext).toContain('approvedApp && emailVerified');
  });

  it('matches consultant records by exact user_id (never email-only)', () => {
    expect(authContext).toContain("q = q.eq('user_id', userId)");
    expect(authContext).toContain('consultantOut.matched.user_id === userId');
  });

  it('requires an active consultant record (is_active === true) before granting access', () => {
    expect(authContext).toContain('consultantOut.matched.is_active');
    expect(authContext).toContain('is_active: true');
  });

  it('demotes unlinked consultant profiles when the record lookup is definitively empty', () => {
    expect(authContext).toContain('consultantOut?.definitivelyEmpty');
    expect(authContext).toContain("supabase.from('profiles').update({ role: 'client' })");
  });

  it('never serves a cached consultant role when the live lookup is definitively empty', () => {
    expect(authContext).toContain('consultantLookupDefinitivelyEmpty');
    expect(authContext).toContain("cachedRoleProfile.role !== 'consultant' || !consultantLookupDefinitivelyEmpty");
  });

  it('matches approved applications by status === approved only', () => {
    expect(authContext).toContain(".eq('status', 'approved')");
  });
});

describe('Public Experts listing exposes only active, eligible consultants', () => {
  const consultantsPage = readRel('src/pages/Consultants.tsx');
  const consultantsSection = readRel('src/components/home/ConsultantsSection.tsx');
  const consultantsService = readRel('src/services/consultants.ts');

  it('Public Experts page requests active consultants only (is_active = true)', () => {
    expect(consultantsPage).toContain('getAll(true)');
  });

  it('Homepage Experts section requests active consultants only (is_active = true)', () => {
    expect(consultantsSection).toContain('getAll(true)');
  });

  it('consultantsService.getAll filters by is_active when activeOnly is set', () => {
    expect(consultantsService).toContain("query = query.eq('is_active', true)");
  });
});

describe('ConsultantDashboard access is authoritative (no forgeable metadata)', () => {
  const dashboard = readRel('src/pages/ConsultantDashboard.tsx');

  it('does not trust forgeable user_metadata.role for consultant access', () => {
    expect(dashboard).not.toContain('user_metadata');
    expect(dashboard).not.toContain('user_metadata.role');
  });

  it('requires profile role AND a linked consultant record owned by the user', () => {
    expect(dashboard).toContain('profile?.role === "consultant"');
    expect(dashboard).toContain('consultant.user_id === user.id');
  });
});
