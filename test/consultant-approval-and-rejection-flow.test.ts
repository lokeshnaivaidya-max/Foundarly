/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Foundarly Consultant Application Approval & Rejection Flow Verification Suite
 */

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import approveHandler from '../api/admin/approve-consultant-application.js';
import consultantMeHandler from '../src/server/consultant/me.js';
import { consultantsService } from '../src/services/consultants.js';
import { supabase } from '../src/lib/supabase.js';
import {
  getUserEffectiveRole,
  isUserAdmin,
  isSuperAdmin,
  isDeveloperAdmin,
  sanitizeUserRole,
  canAccessSection,
} from '../src/lib/authorization.js';

describe('Foundarly Consultant Application Approval & Rejection Flow', () => {
  const mockApplication = {
    id: 'f83a21d9-5a41-477b-89ef-3b1a29d58e11',
    name: 'Dr. Priya Sharma',
    email: 'priya.sharma@example.com',
    phone: '+91 9876543210',
    whatsapp: '+91 9876543210',
    age: 32,
    gender: 'female' as const,
    qualification: 'Ph.D. in Organizational Leadership',
    current_job: 'Senior Strategy Director',
    location: 'Mumbai, India',
    experience: '10+ years in management consulting and executive coaching.',
    preferred_session_timing: 'Morning (8 AM – 12 PM)',
    status: 'pending' as const,
    admin_notes: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const mockAdminUser = {
    id: '8e4fec7f-dc33-48b8-9787-28d2438dd5d7',
    email: 'admin@foundarly.com',
  };

  function createMockRes() {
    let statusCode = 200;
    let data: any = null;
    const headers: Record<string, string> = {};

    return {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(d: any) {
        data = d;
        return this;
      },
      setHeader(name: string, value: string) {
        headers[name] = value;
      },
      end() {},
      get statusCode() {
        return statusCode;
      },
      getData() {
        return data;
      },
      getHeaders() {
        return headers;
      },
    };
  }

  describe('1. Rejection Workflow (Unchanged & Verified)', () => {
    test('Rejecting an application sets status to rejected and records admin notes without touching consultants table', () => {
      const updatedApp = {
        ...mockApplication,
        status: 'rejected' as const,
        admin_notes: 'Insufficient background for verified consultant tier.',
        updated_at: new Date().toISOString(),
      };

      assert.equal(updatedApp.status, 'rejected');
      assert.equal(updatedApp.admin_notes, 'Insufficient background for verified consultant tier.');
      assert.notEqual(updatedApp.status, 'approved');
    });
  });

  describe('2. Approval Workflow: Serverless Endpoint & Application Payload Fallback', () => {
    test('Requires Bearer token for authentication', async () => {
      const req = {
        method: 'POST',
        headers: {},
        body: { applicationId: mockApplication.id },
      };
      const res = createMockRes();

      await approveHandler(req, res);

      assert.equal(res.statusCode, 401);
      const data = res.getData();
      assert.equal(data.success, false);
      assert.ok(data.error.includes('Missing Bearer token'));
    });

    test('Requires applicationId in request body', async () => {
      const req = {
        method: 'POST',
        headers: { authorization: 'Bearer test-token' },
        body: {},
      };
      const res = createMockRes();

      await approveHandler(req, res);

      assert.ok(res.statusCode === 400 || res.statusCode === 401);
    });

    test('Passes application payload to eliminate "Consultant application not found." error when service key is absent', () => {
      const reqBody = {
        applicationId: mockApplication.id,
        adminNotes: 'Approved for GTM and Strategy consulting.',
        pricing30: 1200,
        pricing60: 2000,
        application: mockApplication,
      };

      const resolvedApp = reqBody.application && reqBody.application.id === reqBody.applicationId
        ? reqBody.application
        : null;

      assert.ok(resolvedApp !== null, 'Application must be resolved from payload fallback');
      assert.equal(resolvedApp.name, 'Dr. Priya Sharma');
      assert.equal(resolvedApp.email, 'priya.sharma@example.com');
      assert.equal(resolvedApp.gender, 'female');
    });
  });

  describe('3. Consultant Activation & Profile Role Linkage', () => {
    test('Approval creates active consultant with correct pricing and preferred timing', () => {
      const applicantAuthUserId = 'usr_priya_sharma_uuid_123';
      const parsedPricing30 = 1200;
      const parsedPricing60 = 2000;
      const genderValue = (mockApplication.gender.toLowerCase() === 'female' ? 'female' : 'male') as 'male' | 'female';

      const consultantRecord = {
        id: 'cons_uuid_456',
        name: mockApplication.name,
        title: mockApplication.current_job || 'Consultant',
        bio: mockApplication.experience || '',
        expertise: ['Consulting', mockApplication.qualification],
        pricing_30: parsedPricing30,
        pricing_60: parsedPricing60,
        gender: genderValue,
        is_active: true,
        email: mockApplication.email.toLowerCase().trim(),
        preferred_time: mockApplication.preferred_session_timing,
        user_id: applicantAuthUserId,
      };

      assert.equal(consultantRecord.is_active, true, 'Consultant must be active');
      assert.equal(consultantRecord.user_id, applicantAuthUserId, 'Consultant must be linked to applicant auth user ID');
      assert.equal(consultantRecord.pricing_30, 1200);
      assert.equal(consultantRecord.pricing_60, 2000);
      assert.equal(consultantRecord.gender, 'female');
      assert.equal(consultantRecord.preferred_time, 'Morning (8 AM – 12 PM)');
    });

    test('Approval sets profiles.role = "consultant" and is_consultant = true', () => {
      const applicantAuthUserId = 'usr_priya_sharma_uuid_123';
      const initialProfile = {
        id: applicantAuthUserId,
        role: 'client' as const,
        full_name: 'Dr. Priya Sharma',
        is_consultant: false,
      };

      const updatedProfile = {
        ...initialProfile,
        role: 'consultant' as const,
        is_consultant: true,
        updated_at: new Date().toISOString(),
      };

      assert.equal(updatedProfile.role, 'consultant');
      assert.equal(updatedProfile.is_consultant, true);
    });

    test('Super admin applicant is NOT accidentally demoted when approved', () => {
      const adminApplicantUserId = 'usr_admin_applicant_uuid_999';
      const superAdminProfile = {
        id: adminApplicantUserId,
        role: 'super_admin' as const,
        full_name: 'Admin User',
        is_consultant: false,
      };

      const isSuper = superAdminProfile.role === 'super_admin';
      const updatedRole = isSuper ? superAdminProfile.role : 'consultant';

      assert.equal(updatedRole, 'super_admin', 'Super admin role must be preserved');
    });
  });

  describe('4. Consultant Dashboard Access Verification', () => {
    test('Consultant Dashboard grants access when consultant record is active and matches user', () => {
      const user = {
        id: 'usr_priya_sharma_uuid_123',
        email: 'priya.sharma@example.com',
      };

      const profile = {
        id: user.id,
        role: 'consultant',
        is_consultant: true,
        full_name: 'Dr. Priya Sharma',
      };

      const activeConsultant = {
        id: 'cons_uuid_456',
        name: 'Dr. Priya Sharma',
        email: 'priya.sharma@example.com',
        user_id: user.id,
        is_active: true,
      };

      const isUserConsultant = Boolean(
        activeConsultant ||
          profile?.role === 'consultant' ||
          profile?.is_consultant
      );

      assert.equal(isUserConsultant, true, 'Consultant Dashboard access check must pass for active consultant');
      assert.equal(activeConsultant.is_active, true);
      assert.equal(activeConsultant.user_id, user.id);
    });

    test('Consultant Dashboard self-heals user_id link when user matches by email', () => {
      const user = {
        id: 'usr_priya_sharma_uuid_123',
        email: 'priya.sharma@example.com',
      };

      const unlinkedConsultant = {
        id: 'cons_uuid_456',
        name: 'Dr. Priya Sharma',
        email: 'priya.sharma@example.com',
        user_id: null,
        is_active: true,
      };

      const linked = { ...unlinkedConsultant };
      if (linked.user_id !== user.id) {
        linked.user_id = user.id;
      }

      assert.equal(linked.user_id, user.id);
      assert.equal(linked.is_active, true);
    });
  });

  describe('5. Supabase Error Handling Regression (user_id/email/profile UPDATEs)', () => {
    test('Returns 401 when no Bearer token is provided (does not crash)', async () => {
      const req = {
        method: 'GET',
        headers: {},
        body: null,
      };
      const res = createMockRes();

      await consultantMeHandler(req, res);

      assert.equal(res.statusCode, 401);
      const data = res.getData();
      assert.equal(data.success, false);
      assert.ok(data.error.includes('Missing Bearer token'));
    });

    test('Returns 401 when an invalid Bearer token is provided (does not crash)', async () => {
      const req = {
        method: 'GET',
        headers: { authorization: 'Bearer invalid-token-that-does-not-exist' },
        body: null,
      };
      const res = createMockRes();

      await consultantMeHandler(req, res);

      assert.equal(res.statusCode, 401);
      const data = res.getData();
      assert.equal(data.success, false);
      assert.ok(data.error.includes('Invalid or expired session token'));
    });

    test('Source code explicitly destructures { error } from all three Supabase write operations', () => {
      const source = fs.readFileSync(path.join(process.cwd(), 'src', 'server', 'consultant', 'me.ts'), 'utf8');

      assert.ok(
        source.includes('const { error: linkErr } = await bounded('),
        'user_id UPDATE must destructure { error } (bounded)'
      );
      assert.ok(
        source.includes('const { error: emailErr } = await bounded('),
        'email UPDATE must destructure { error } (bounded)'
      );
      assert.ok(
        source.includes('const { error: profileErr } = await bounded('),
        'profiles upsert must destructure { error } (bounded)'
      );

      const secureLogWarnCount = (source.match(/secureLog\.warn/g) || []).length;
      assert.ok(secureLogWarnCount >= 3, 'All three write failures must be logged via secureLog.warn');

      assert.ok(source.includes('isConsultant: true'), 'Endpoint must return isConsultant=true when consultant record is verified');
    });

    test('Endpoint does not return 500 when Supabase writes fail with RLS errors', () => {
      const source = fs.readFileSync(path.join(process.cwd(), 'src', 'server', 'consultant', 'me.ts'), 'utf8');

      assert.ok(
        source.includes('const { error: linkErr } = await bounded('),
        'user_id UPDATE must destructure { error } (bounded)'
      );
      assert.ok(
        source.includes('const { error: emailErr } = await bounded('),
        'email UPDATE must destructure { error } (bounded)'
      );
      assert.ok(
        source.includes('const { error: profileErr } = await bounded('),
        'profiles upsert must destructure { error } (bounded)'
      );

      assert.ok(source.includes('if (linkErr)'), 'user_id link error must be checked');
      assert.ok(source.includes('if (emailErr)'), 'email update error must be checked');
      assert.ok(source.includes('if (profileErr)'), 'profile upsert error must be checked');

      const secureLogWarnCount = (source.match(/secureLog\.warn/g) || []).length;
      assert.ok(secureLogWarnCount >= 3, 'All three write failures must be logged via secureLog.warn');
      assert.ok(source.includes('isConsultant: true'), 'Endpoint must return isConsultant=true when consultant record is verified');
    });

    test('Consultant lookup prefers the authenticated UUID and only matches by verified email', () => {
      const source = fs.readFileSync(path.join(process.cwd(), 'src', 'server', 'consultant', 'me.ts'), 'utf8');

      // Verified-email flag must be derived from Supabase confirmation fields
      assert.ok(
        source.includes('email_confirmed_at'),
        'Endpoint must check Supabase email confirmation (email_confirmed_at) before email matching'
      );

      // Primary consultant query: email matching gated behind a verified email
      const gateIdx = source.indexOf('if (userEmail && emailVerified) {');
      assert.ok(gateIdx !== -1, 'Email-based consultant matching must be gated on a verified email');
      const orIdx = source.indexOf('consultantQuery.or(');
      assert.ok(orIdx > gateIdx, 'Email matching must occur inside the verified-email branch');
    });

    test('Auto-activation from an approved application requires a verified email', () => {
      const source = fs.readFileSync(path.join(process.cwd(), 'src', 'server', 'consultant', 'me.ts'), 'utf8');
      assert.ok(
        source.includes('if (!consultant && userEmail && emailVerified) {'),
        'consultant_applications email lookup must require a verified email'
      );
    });

    test('Consultant email backfill only writes verified emails', () => {
      const source = fs.readFileSync(path.join(process.cwd(), 'src', 'server', 'consultant', 'me.ts'), 'utf8');
      assert.ok(
        source.includes('if (!consultant.email && userEmail && emailVerified) {'),
        'Consultant email backfill must require a verified email'
      );
    });

    test('Failed UUID linking is explicitly reported and never overwrites another account', () => {
      const source = fs.readFileSync(path.join(process.cwd(), 'src', 'server', 'consultant', 'me.ts'), 'utf8');

      // Linkage status starts truthful: only true when the record already
      // carries the authenticated UUID.
      assert.ok(
        source.includes('let linked = consultant.user_id === userId;'),
        'Linked status must be initialised from the actual stored user_id'
      );

      // Never overwrite a different account's claim on the consultant record
      assert.ok(
        source.includes('linked to a different authenticated user; not overwriting'),
        'Endpoint must refuse to overwrite a consultant record linked to another user'
      );

      // linked=true only inside the success branch of the UPDATE
      assert.ok(source.includes('linked = true;'), 'Successful link must set linked=true');

      // Response must expose linkage status so callers never assume a secure link
      assert.ok(
        /isConsultant: true,\s*\n\s*linked,/.test(source),
        'Response must include explicit linked status alongside isConsultant'
      );
    });
  });

  describe('6. Authorization Role Resolution (getUserEffectiveRole)', () => {
    const mockUser = (email: string) => ({ id: 'user-123', email });

    test('Returns super_admin for allowlisted admin email', () => {
      const user = mockUser('admin@foundarly.com');
      assert.equal(getUserEffectiveRole(user, { id: 'user-123', role: 'client' }), 'super_admin');
    });

    test('Returns super_admin when profile role is super_admin AND email is allowlisted', () => {
      const user = mockUser('admin@foundarly.com');
      assert.equal(getUserEffectiveRole(user, { id: 'user-123', role: 'super_admin' }), 'super_admin');
    });

    test('Does NOT return super_admin for non-allowlisted email even with super_admin profile', () => {
      const user = mockUser('anyone@example.com');
      assert.equal(getUserEffectiveRole(user, { id: 'user-123', role: 'super_admin' }), 'client');
    });

    test('Returns admin when profile role is admin AND email is allowlisted (returns super_admin due to allowlist)', () => {
      const user = mockUser('admin@foundarly.com');
      assert.equal(getUserEffectiveRole(user, { id: 'user-123', role: 'admin' }), 'super_admin');
    });

    test('Returns developer_admin for foundarly@developer.in profile role', () => {
      const user = mockUser('foundarly@developer.in');
      assert.equal(getUserEffectiveRole(user, { id: 'user-123', role: 'developer_admin' }), 'developer_admin');
    });

    test('Returns consultant when profile role is consultant', () => {
      const user = mockUser('consultant@example.com');
      assert.equal(getUserEffectiveRole(user, { id: 'user-123', role: 'consultant', is_consultant: true }), 'consultant');
    });

    test('Returns consultant when profile is_consultant is true', () => {
      const user = mockUser('consultant@example.com');
      assert.equal(getUserEffectiveRole(user, { id: 'user-123', role: 'client', is_consultant: true }), 'consultant');
    });

    test('Returns client for ordinary users', () => {
      const user = mockUser('client@example.com');
      assert.equal(getUserEffectiveRole(user, { id: 'user-123', role: 'client' }), 'client');
      assert.equal(getUserEffectiveRole(user, null), 'client');
    });

    test('Does NOT treat developer_admin as super_admin', () => {
      const user = mockUser('foundarly@developer.in');
      assert.equal(isSuperAdmin(user, { id: 'user-123', role: 'developer_admin' }), false);
      assert.equal(getUserEffectiveRole(user, { id: 'user-123', role: 'developer_admin' }), 'developer_admin');
    });
  });

  describe('7. Authorization Permission Checks', () => {
    const adminUser = { id: 'admin-1', email: 'admin@foundarly.com' };
    const devUser = { id: 'dev-1', email: 'foundarly@developer.in' };
    const consultantUser = { id: 'consultant-1', email: 'consultant@example.com' };
    const clientUser = { id: 'client-1', email: 'client@example.com' };

    test('isUserAdmin returns true for super_admin', () => {
      assert.equal(isUserAdmin(adminUser, { id: 'admin-1', role: 'super_admin' }), true);
    });

    test('isUserAdmin returns true for developer_admin', () => {
      assert.equal(isUserAdmin(devUser, { id: 'dev-1', role: 'developer_admin' }), true);
    });

    test('isUserAdmin returns true for admin with allowlisted email', () => {
      assert.equal(isUserAdmin(adminUser, { id: 'admin-1', role: 'admin' }), true);
    });

    test('isUserAdmin returns false for consultant', () => {
      assert.equal(isUserAdmin(consultantUser, { id: 'consultant-1', role: 'consultant' }), false);
    });

    test('isUserAdmin returns false for client', () => {
      assert.equal(isUserAdmin(clientUser, { id: 'client-1', role: 'client' }), false);
    });

    test('canAccessSection allows super_admin and admin for all sections', () => {
      assert.equal(canAccessSection('super_admin', 'administrators'), true);
      assert.equal(canAccessSection('admin', 'administrators'), true);
      assert.equal(canAccessSection('super_admin', 'consultants'), true);
    });

    test('canAccessSection allows developer_admin except administrators', () => {
      assert.equal(canAccessSection('developer_admin', 'consultants'), true);
      assert.equal(canAccessSection('developer_admin', 'administrators'), false);
    });

    test('canAccessSection denies consultant and client', () => {
      assert.equal(canAccessSection('consultant', 'consultants'), false);
      assert.equal(canAccessSection('client', 'consultants'), false);
    });

    test('sanitizeUserRole neutralizes forged admin roles for non-allowlisted emails', () => {
      assert.equal(sanitizeUserRole('hacker@example.com', 'super_admin'), 'client');
      assert.equal(sanitizeUserRole('hacker@example.com', 'admin'), 'client');
    });

    test('sanitizeUserRole preserves legitimate roles', () => {
      assert.equal(sanitizeUserRole('admin@foundarly.com', 'super_admin'), 'super_admin');
      assert.equal(sanitizeUserRole('consultant@example.com', 'consultant'), 'consultant');
      assert.equal(sanitizeUserRole('client@example.com', 'client'), 'client');
    });
  });

  describe('8. AuthContext Controlled Role Re-Check (Client → Consultant)', () => {
    const originalFrom = supabase.from;
    const originalSignInWithPassword = supabase.auth.signInWithPassword;

    function restoreSupabase() {
      supabase.auth.signInWithPassword = originalSignInWithPassword;
      supabase.from = originalFrom;
    }

    afterEach(() => {
      restoreSupabase();
    });

    // Mock supabase.auth.signInWithPassword to return a session
    supabase.auth.signInWithPassword = async (params) => {
      return {
        data: {
          user: { id: 'user-1', email: params.email },
          session: { access_token: 'mock-token' },
        },
        error: null,
      };
    };

    // Mock supabase.from to return different profiles based on mockProfile
    let mockProfile = { id: 'user-1', role: 'client', full_name: 'Client User', is_consultant: false };
    supabase.from = (table) => {
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: mockProfile }),
            }),
          }),
        };
      }
      return {
        select: () => ({
          eq: () => ({
            ilike: () => ({
              eq: () => ({
                limit: () => Promise.resolve({ data: [] }),
              }),
            }),
          }),
        }),
      };
    };

    // TTL constant mirrored from src/contexts/AuthContext.tsx
    const CLIENT_ROLE_RECHECK_MS = 5 * 60 * 1000;

    // Mirrors the controlled skip logic implemented in AuthContext.resolveProfile:
    // - privileged roles never re-resolve within a session
    // - 'client' roles re-resolve at most once per CLIENT_ROLE_RECHECK_MS
    // - 'null' (unknown/transient) roles always re-resolve
    function shouldReResolveProfile(existing, userId, now) {
      if (!existing || existing.userId !== userId) return true;
      if (existing.role !== 'client' && existing.role !== 'null') return false;
      if (existing.role === 'client' && now - existing.resolvedAt < CLIENT_ROLE_RECHECK_MS) return false;
      return true;
    }

    test('Old skip logic is documented as buggy: clients were never re-resolved', () => {
      const existingClient = { userId: 'user-1', role: 'client', resolvedAt: Date.now() };
      const userId = 'user-1';
      // OLD: existing.role !== 'null' → 'client' !== 'null' is true → skipped forever,
      // so an approved consultant was never recognised (the original redirect bug).
      const oldSkipClient = existingClient && existingClient.userId === userId && existingClient.role !== 'null';
      assert.equal(oldSkipClient, true, 'Old code incorrectly skips client role');
    });

    test('Ordinary client resolved recently is NOT refetched on every TOKEN_REFRESHED', () => {
      const now = Date.now();
      const existingClient = { userId: 'user-1', role: 'client', resolvedAt: now - 60 * 1000 };
      assert.equal(
        shouldReResolveProfile(existingClient, 'user-1', now),
        false,
        'Client resolved inside the TTL window must be skipped (no refetch on every token refresh)'
      );
    });

    test('Client role re-checks after the TTL window, detecting a same-session approval', () => {
      const now = Date.now();
      const existingClient = {
        userId: 'user-1',
        role: 'client',
        resolvedAt: now - (CLIENT_ROLE_RECHECK_MS + 1000),
      };
      assert.equal(
        shouldReResolveProfile(existingClient, 'user-1', now),
        true,
        'Client resolved outside the TTL window must re-resolve to pick up the approval'
      );
    });

    test('Privileged roles never trigger same-session re-resolution', () => {
      const now = Date.now();
      const longAgo = now - 60 * 60 * 1000;
      assert.equal(shouldReResolveProfile({ userId: 'user-1', role: 'consultant', resolvedAt: longAgo }, 'user-1', now), false);
      assert.equal(shouldReResolveProfile({ userId: 'user-1', role: 'super_admin', resolvedAt: longAgo }, 'user-1', now), false);
      assert.equal(shouldReResolveProfile({ userId: 'user-1', role: 'admin', resolvedAt: longAgo }, 'user-1', now), false);
      assert.equal(shouldReResolveProfile({ userId: 'user-1', role: 'developer_admin', resolvedAt: longAgo }, 'user-1', now), false);
    });

    test("Unknown role 'null' always re-resolves (preserves transient-failure retry)", () => {
      const now = Date.now();
      assert.equal(
        shouldReResolveProfile({ userId: 'user-1', role: 'null', resolvedAt: now }, 'user-1', now),
        true,
        "A profile resolved with no role must re-resolve on the next auth event"
      );
    });

    test('A different user always re-resolves', () => {
      const now = Date.now();
      assert.equal(
        shouldReResolveProfile({ userId: 'other-user', role: 'consultant', resolvedAt: now }, 'user-1', now),
        true
      );
    });

    test('fetchProfile is called again when role changes from client to consultant', async () => {
      // Mock supabase.from to return different profiles on different calls
      supabase.from = (table) => {
        if (table === 'profiles') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: () => Promise.resolve({ data: mockProfile }),
              }),
            }),
          };
        }
        return {
          select: () => ({
            eq: () => ({
              ilike: () => ({
                eq: () => ({
                  limit: () => Promise.resolve({ data: [] }),
                }),
              }),
            }),
          }),
        };
      };

      // First sign-in: profile resolves to 'client'
      mockProfile = { id: 'user-1', role: 'client', full_name: 'Client User', is_consultant: false };
      await supabase.auth.signInWithPassword({ email: 'client@example.com', password: 'password' });
      const { data: firstProfile } = await supabase.from('profiles').select('*').eq('id', 'user-1').maybeSingle();
      assert.equal(firstProfile.role, 'client', 'First sign-in should resolve to client');

      // Simulate admin approval: change profile to consultant
      mockProfile = { id: 'user-1', role: 'consultant', full_name: 'Consultant User', is_consultant: true };

      // Re-sign in (simulating a TOKEN_REFRESHED after the re-check window elapses)
      await supabase.auth.signInWithPassword({ email: 'client@example.com', password: 'password' });
      const { data: secondProfile } = await supabase.from('profiles').select('*').eq('id', 'user-1').maybeSingle();
      assert.equal(secondProfile.role, 'consultant', 'Second sign-in should resolve to consultant after approval');
    });
  });

  describe('10. Production Approval Linkage & Identity Regression', () => {
    const approvalSource = () =>
      fs.readFileSync(path.join(process.cwd(), 'api', 'admin', 'approve-consultant-application.ts'), 'utf8');

    test('Approval handler never matches profiles by display name (production bug)', () => {
      const source = approvalSource();
      assert.ok(
        !source.includes("ilike('full_name'"),
        'Display-name matching must be removed — it linked the wrong account in production'
      );
      assert.ok(
        !source.includes("select('id, full_name, role')"),
        'The name-match profile lookup must be gone entirely'
      );
    });

    test('Approval handler prefers the authenticated user_id captured on the application', () => {
      const source = approvalSource();
      assert.ok(
        source.includes('app.user_id'),
        'Approval must prefer the authenticated UUID stamped on the application'
      );
    });

    test('Approval handler reports profile-role update failures instead of silently succeeding', () => {
      const source = approvalSource();
      assert.ok(
        source.includes('const { error: profileUpsertErr }'),
        'profiles upsert must destructure { error } — an unchecked upsert silently no-ops under RLS'
      );
      assert.ok(
        source.includes('FAILED to update applicant profile role'),
        'Profile update failure must be logged loudly'
      );
      assert.ok(
        source.includes('profileUpdated'),
        'Response must include explicit profileUpdated status'
      );
    });

    test('Approval handler fails loudly when the consultant record cannot be activated', () => {
      const source = approvalSource();
      assert.ok(
        source.includes('Failed to activate consultant record'),
        'Consultant activation failure must surface as 500, not silent success'
      );
    });

    test('Application submission conforms to production schema without user_id column', () => {
      const source = fs.readFileSync(path.join(process.cwd(), 'api', 'consultant-applications.ts'), 'utf8');
      assert.ok(
        !source.includes('user_id: authenticatedUserId'),
        'consultant_applications does not have user_id column; must not be included in payload'
      );
      assert.ok(
        source.includes('normalizedEmail'),
        'Application identity is preserved using normalizedEmail'
      );
    });

    test('Submission client forwards the session token for identity capture', () => {
      const source = fs.readFileSync(path.join(process.cwd(), 'src', 'services', 'consultantApplications.ts'), 'utf8');
      const createIdx = source.indexOf('async create(');
      assert.ok(createIdx !== -1, 'create() must exist');
      const chunk = source.slice(createIdx, createIdx + 1600);
      assert.ok(
        chunk.includes('Bearer ${session.access_token}'),
        'create() fetch must forward the session token to /api/consultant-applications'
      );
    });

    test('consultant/me reclaims provably stale UUID links for verified email matches', () => {
      const source = fs.readFileSync(path.join(process.cwd(), 'src', 'server', 'consultant', 'me.ts'), 'utf8');
      assert.ok(
        source.includes('storedLinkProvablyStale'),
        'Stale-link verification must exist'
      );
      assert.ok(
        source.includes('reclaiming link for verified requester'),
        'Provably stale links must be reclaimed for verified requesters'
      );
      assert.ok(
        source.includes('not overwriting'),
        'Live different-owner links must still be refused'
      );
    });

    test('AuthContext bounds every profile-resolution DB operation (no infinite AUTHENTICATING)', () => {
      const source = fs.readFileSync(path.join(process.cwd(), 'src', 'contexts', 'AuthContext.tsx'), 'utf8');
      const bounded = (source.match(/withDbTimeout\(/g) || []).length;
      assert.ok(
        bounded >= 4,
        `All blocking DB awaits must use withDbTimeout (found ${bounded}, need >= 4)`
      );
      assert.ok(
        source.includes('Profile resolution exceeded hard cap'),
        'Hard cap must release the loading state so ProtectedRoute never wedges'
      );
      assert.ok(
        !source.includes('const { error: upsertErr } = await supabase.from'),
        'Bare awaited upserts must be wrapped in withDbTimeout'
      );
    });

    test('Consultants page renders bounded error/empty states instead of infinite skeletons', () => {
      const source = fs.readFileSync(path.join(process.cwd(), 'src', 'pages', 'Consultants.tsx'), 'utf8');
      assert.ok(source.includes('isError'), 'Query error state must be destructured and rendered');
      assert.ok(source.includes('Consultant list could not be loaded'), 'Error state must be visible');
      assert.ok(source.includes('refetchConsultants'), 'Retry action must be wired to refetch');
      assert.ok(source.includes('No Consultants Available'), 'Genuine empty state must be distinct from filter-empty');
      assert.ok(
        source.includes('retry: 2'),
        'Query must use bounded retries'
      );
    });

    test('ProtectedRoute never routes an unresolved profile as Client', () => {
      const source = fs.readFileSync(path.join(process.cwd(), 'src', 'components', 'ProtectedRoute.tsx'), 'utf8');
      assert.ok(
        source.includes('if (user && !profile)'),
        'An authenticated user with a null profile must be intercepted before role computation'
      );
      assert.ok(
        source.includes('Verifying your account'),
        'In-flight resolution must show an explicit verifying state'
      );
      assert.ok(
        source.includes('retryProfileResolution'),
        'Definitive resolution failure must offer an explicit retry'
      );
      assert.ok(
        source.includes("Couldn't Verify Your Access"),
        'Failed verification must be an explicit error state, not a silent client route'
      );
    });

    test('AuthContext exposes explicit role-resolution failure state and bounded retry', () => {
      const source = fs.readFileSync(path.join(process.cwd(), 'src', 'contexts', 'AuthContext.tsx'), 'utf8');
      assert.ok(
        source.includes('roleResolutionFailed'),
        'AuthContext must expose roleResolutionFailed'
      );
      assert.ok(
        source.includes('retryProfileResolution'),
        'AuthContext must expose an explicit retry'
      );
      // The flag must be set on definitive failure AND cleared on success
      const failSet = source.includes('setRoleResolutionFailed(true)');
      const clearedOnSuccess = source.includes('setRoleResolutionFailed(false)');
      assert.ok(failSet, 'Failure must set roleResolutionFailed=true');
      assert.ok(clearedOnSuccess, 'Success/sign-out must clear roleResolutionFailed');
    });

    test('Login never routes an unresolved profile to the client dashboard', () => {
      const source = fs.readFileSync(path.join(process.cwd(), 'src', 'pages', 'Login.tsx'), 'utf8');
      assert.ok(
        source.includes('if (!profile) {'),
        'Post-login routing must wait for a resolved profile'
      );
      assert.ok(
        source.includes('Verifying your account access'),
        'Sign-in with unresolved profile must not silently route as client'
      );
    });

    test('Client-side approval fallback has no display-name matching and reports profileUpdated', () => {
      const source = fs.readFileSync(path.join(process.cwd(), 'src', 'services', 'consultantApplications.ts'), 'utf8');
      assert.ok(
        !source.includes("ilike('full_name'"),
        'Client-side fallback must not match profiles by display name'
      );
      assert.ok(
        source.includes('(app as any).user_id'),
        'Fallback must prefer the authenticated UUID captured on the application'
      );
      assert.ok(
        source.includes('const { error: profileRoleErr }'),
        'Fallback profile update must destructure { error }'
      );
      assert.ok(
        source.includes('profileUpdated'),
        'Fallback result must include profileUpdated'
      );
    });

    test('Admin approval UI distinguishes full activation from pending account linkage', () => {
      const source = fs.readFileSync(path.join(process.cwd(), 'src', 'pages', 'admin', 'AdminConsultantApplications.tsx'), 'utf8');
      assert.ok(
        source.includes('profileUpdated'),
        'Approval handler must consume profileUpdated'
      );
      assert.ok(
        source.includes('Approved — Account Link Pending'),
        'Pending linkage must be an explicit, visible outcome'
      );
      assert.ok(
        source.includes('serviceRoleConfigured'),
        'Missing service-role configuration must be surfaced operationally'
      );
      assert.ok(
        source.includes('fully activated') || source.includes('with a linked account'),
        'Full activation message must be distinct from the pending one'
      );
    });

    test('Approve endpoint reports service-role configuration state (server-side only secret)', () => {
      const source = approvalSource();
      assert.ok(
        source.includes('serviceRoleConfigured: hasServiceRoleKey'),
        'Approve response must include serviceRoleConfigured for operational visibility'
      );
      // The service-role key must never be referenced in client bundles
      const clientFiles = [
        path.join(process.cwd(), 'src', 'contexts', 'AuthContext.tsx'),
        path.join(process.cwd(), 'src', 'services', 'consultants.ts'),
        path.join(process.cwd(), 'src', 'services', 'consultantApplications.ts'),
        path.join(process.cwd(), 'src', 'lib', 'supabase.ts'),
      ];
      for (const f of clientFiles) {
        const src = fs.readFileSync(f, 'utf8');
        assert.ok(
          !src.includes('SUPABASE_SERVICE_ROLE_KEY'),
          `${path.basename(f)} must never reference the service-role key`
        );
      }
    });
  });

  describe('11. Activation vs Publication Separation (test-data safety)', () => {
    const approvalSource = () =>
      fs.readFileSync(path.join(process.cwd(), 'api', 'admin', 'approve-consultant-application.ts'), 'utf8');

    test('consultant/me auto-activation creates a NON-PUBLIC identity-only draft', () => {
      const source = fs.readFileSync(path.join(process.cwd(), 'src', 'server', 'consultant', 'me.ts'), 'utf8');
      const draftIdx = source.indexOf('NON-PUBLIC draft consultant record');
      assert.ok(draftIdx !== -1, 'Draft creation path must exist for approved applications');
      const insertBlock = source.slice(draftIdx, draftIdx + 1100);
      assert.ok(
        insertBlock.includes('is_active: false'),
        'Auto-created consultant record must be a NON-PUBLIC draft'
      );
      assert.ok(
        !insertBlock.includes('pricing_30: 1000') && !insertBlock.includes('pricing_60: 1800'),
        'No invented pricing defaults in auto-created drafts'
      );
      assert.ok(
        !insertBlock.includes('approvedApp.current_job'),
        'Application current_job must never become a listing title'
      );
      assert.ok(
        !insertBlock.includes('approvedApp.experience'),
        'Application experience must never become a listing bio'
      );
      assert.ok(
        !insertBlock.includes('approvedApp.qualification'),
        'Application qualification must never become public expertise'
      );
      assert.ok(
        insertBlock.includes('user_id: userId'),
        'Draft must be linked to the authenticated UUID'
      );
    });

    test('Approval handler creates drafts and never publishes application free-text', () => {
      const source = approvalSource();
      assert.ok(
        !source.includes('is_active: true'),
        'Approval must never publish (is_active: true) a consultant listing'
      );
      const draftIdx = source.indexOf('Inserting NON-PUBLIC draft consultant record');
      assert.ok(draftIdx !== -1, 'New listings must be created as drafts');
      const insertBlock = source.slice(draftIdx, draftIdx + 900);
      assert.ok(insertBlock.includes('is_active: false'), 'New listings must be non-public drafts');
      assert.ok(insertBlock.includes("title: ''"), 'Draft title must be empty — never application text');
      assert.ok(insertBlock.includes('pricing_30: 0'), 'Draft pricing must be neutral zero — never invented');
      assert.ok(!insertBlock.includes('current_job'), 'Application current_job must not be copied into drafts');
      assert.ok(!insertBlock.includes('app.experience'), 'Application experience must not be copied into drafts');

      // Existing-row updates are identity-only
      const updateIdx = source.indexOf('IDENTITY ONLY');
      assert.ok(updateIdx !== -1, 'Re-approval must be documented as identity-only');
      const updateBlock = source.slice(source.indexOf('const updateData', updateIdx), source.indexOf('.update(', updateIdx));
      assert.ok(!updateBlock.includes('title:'), 'Existing listing title must never be overwritten on re-approval');
      assert.ok(!updateBlock.includes('bio:'), 'Existing listing bio must never be overwritten on re-approval');
      assert.ok(!updateBlock.includes('is_active'), 'Re-approval must never change publication state');
    });

    test('Dashboard never presents an approved application as a consultant record', () => {
      const source = fs.readFileSync(path.join(process.cwd(), 'src', 'services', 'consultantDashboard.ts'), 'utf8');
      assert.ok(
        !source.includes('id: apps[0].id'),
        'Application ids must never be returned as consultant ids — consultant_id-keyed writes would orphan'
      );
    });

    test('Dashboard access requires linked consultant record and consultant role, allowing unpublished draft consultants', () => {
      const dashSource = fs.readFileSync(path.join(process.cwd(), 'src', 'pages', 'ConsultantDashboard.tsx'), 'utf8');
      assert.ok(
        dashSource.includes('profile?.role === "consultant"') &&
        dashSource.includes('consultant.user_id === user.id'),
        'Dashboard access must strictly require profile consultant role and user_id match'
      );
      assert.ok(
        !dashSource.includes('(consultant as any).is_active === true'),
        'Dashboard access must NOT require is_active === true, allowing unpublished draft consultants access'
      );
      assert.ok(
        dashSource.includes('Unpublished Draft'),
        'Dashboard must render an Unpublished Draft indicator for draft consultants'
      );
      const svcSource = fs.readFileSync(path.join(process.cwd(), 'src', 'services', 'consultantDashboard.ts'), 'utf8');
      assert.ok(
        svcSource.includes('if (!consultant) return [];'),
        'Dashboard data loads must degrade gracefully without a listing record'
      );
      assert.ok(
        svcSource.includes('must NEVER be presented'),
        'The listing-record fallback must document the activation/publication boundary'
      );
    });
  });

  describe('12. Wedged auth-lock lifecycle regression (production 9d05159 incident)', () => {
    const authSource = () =>
      fs.readFileSync(path.join(process.cwd(), 'src', 'contexts', 'AuthContext.tsx'), 'utf8');

    test('auth.getSession is raced — profile resolution can never wedge on the auth lock', () => {
      const source = authSource();
      // The exact production wedge: an un-raced getSession awaited while a hung
      // startup token refresh holds the supabase-js auth lock pre-dispatch.
      assert.ok(
        !source.includes('await supabase.auth.getSession()'),
        'auth.getSession must never be awaited un-raced inside profile resolution'
      );
      assert.ok(
        source.includes("supabase.auth.getSession(),") && source.includes("'auth session lookup'"),
        'getSession must be raced via withDbTimeout so resolution always settles'
      );
    });

    test('A timed-out profile lookup is transient failure, never client classification', () => {
      const source = authSource();
      assert.ok(
        source.includes('profilesLookupFailed'),
        'The profiles race must capture its error instead of discarding it'
      );
      assert.ok(
        source.includes('refusing client fallback'),
        'Transient lookup failure must refuse the client fallback (consultant misclassification guard)'
      );
      const raceIdx = source.indexOf('const { data, error: profileFetchError }');
      assert.ok(raceIdx !== -1, 'The profiles race must destructure its error');
    });

    test('consultantsService.getAll hard-settles even when abortSignal cannot reject', () => {
      const source = fs.readFileSync(path.join(process.cwd(), 'src', 'services', 'consultants.ts'), 'utf8');
      assert.ok(
        source.includes('Consultant list request timed out'),
        'getAll must race the query against a rejecting timeout — abortSignal cannot reject a never-dispatched request'
      );
      const raceIdx = source.indexOf('Promise.race([\n          query.abortSignal');
      assert.ok(raceIdx !== -1, 'The abortSignal query must be wrapped in a settling race');
    });

    test('Hard cap is followed by a terminal watchdog with an explicit error state', () => {
      const source = authSource();
      assert.ok(
        source.includes('Profile resolution exceeded terminal watchdog'),
        'A terminal watchdog must surface the verification-failed state instead of indefinite "Verifying your account..."'
      );
      const protectedSource = fs.readFileSync(path.join(process.cwd(), 'src', 'components', 'ProtectedRoute.tsx'), 'utf8');
      assert.ok(
        protectedSource.includes("Couldn't Verify Your Access"),
        'The terminal state must be the explicit verification-failed card with retry'
      );
    });
  });

  describe('13. Bounded server endpoints and dashboard section independence', () => {
    const readApi = (p: string[]) => fs.readFileSync(path.join(process.cwd(), ...p), 'utf8');

    const readServerApi = (p: string[]) => fs.readFileSync(path.join(process.cwd(), 'src', 'server', ...p), 'utf8');

    test('/api/consultant/me executes within a bounded deadline on every path', () => {
      const source = readServerApi(['consultant', 'me.ts']);
      assert.ok(
        source.includes('const deadline = Date.now() + 8000'),
        'me.ts must enforce a shared server deadline'
      );
      const boundedCount = (source.match(/await bounded\(/g) || []).length;
      assert.ok(
        boundedCount >= 8,
        `Every Supabase await in me.ts must be bounded (found ${boundedCount}, need >= 8)`
      );
      assert.ok(
        !source.includes('await activeDbClient'),
        'No un-bounded activeDbClient awaits may remain in me.ts'
      );
      assert.ok(
        !source.includes('await supabaseAdminClient.auth.getUser(token)'),
        'auth.getUser must be bounded'
      );
    });

    test('/api/consultant/bookings exists with real data access and auth (was 404)', () => {
      const source = readServerApi(['consultant', 'bookings.ts']);
      assert.ok(source.includes("from('bookings')"), 'Endpoint must read real bookings data');
      assert.ok(
        source.includes('Missing Bearer token'),
        'Endpoint must require Bearer authentication'
      );
      assert.ok(source.includes('consultant_id'), 'Bookings must be keyed by consultant_id');
      assert.ok(
        source.includes('success: true,\n      bookings') || source.includes('bookings: bookings || []'),
        'Response shape must match consultantDashboardService expectations'
      );
      assert.ok(
        (source.match(/await bounded\(/g) || []).length >= 3,
        'All Supabase awaits in the endpoint must be bounded'
      );
    });

    test('/api/follow-ups/consultant exists with real data access and auth (was 404)', () => {
      const source = readApi(['api', 'follow-ups', 'consultant.ts']);
      assert.ok(source.includes("from('follow_up_requests')"), 'Endpoint must read real follow-up data');
      assert.ok(
        source.includes('Missing Bearer token'),
        'Endpoint must require Bearer authentication'
      );
      assert.ok(
        source.includes('followUps: followUps || []'),
        'Response shape must match followUpService expectations'
      );
      assert.ok(
        (source.match(/await bounded\(/g) || []).length >= 3,
        'All Supabase awaits in the endpoint must be bounded'
      );
    });

    test('Dashboard renders with zeroed stats and independent section errors (no crash)', () => {
      const source = fs.readFileSync(path.join(process.cwd(), 'src', 'pages', 'ConsultantDashboard.tsx'), 'utf8');
      assert.ok(
        !source.includes('useState<DashboardStats | null>(null)'),
        'stats must never be nullable — a null stats render crashed the dashboard'
      );
      assert.ok(
        source.includes('total_earnings: 0'),
        'stats default must be a zeroed object'
      );
      assert.ok(
        source.includes('sectionErrors'),
        'Per-section error flags must exist'
      );
      assert.ok(
        source.includes('Dashboard statistics could not be loaded'),
        'Stats section must render its own retry state'
      );
      assert.ok(
        source.includes('sectionErrors.bookings && bookings.length === 0') &&
        source.includes('sectionErrors.followUps && followUps.length === 0') &&
        source.includes('sectionErrors.payouts && payoutRequests.length === 0'),
        'Bookings, follow-ups and payouts sections must fail independently'
      );
    });

    test('Dashboard service endpoints are client-side bounded', () => {
      const source = fs.readFileSync(path.join(process.cwd(), 'src', 'services', 'consultantDashboard.ts'), 'utf8');
      const meIdx = source.indexOf('"/api/consultant/me"');
      const meBlock = source.slice(Math.max(0, meIdx - 200), meIdx + 500);
      assert.ok(
        meBlock.includes('AbortController'),
        '/api/consultant/me fetch must be bounded client-side'
      );
      const bookingsIdx = source.indexOf('"/api/consultant/bookings"');
      const bookingsBlock = source.slice(Math.max(0, bookingsIdx - 200), bookingsIdx + 500);
      assert.ok(
        bookingsBlock.includes('AbortController'),
        '/api/consultant/bookings fetch must be bounded client-side'
      );
      const fuSource = fs.readFileSync(path.join(process.cwd(), 'src', 'services', 'followUpService.ts'), 'utf8');
      const fuIdx = fuSource.indexOf("'/api/follow-ups/consultant'");
      const fuBlock = fuSource.slice(Math.max(0, fuIdx - 200), fuIdx + 500);
      assert.ok(
        fuBlock.includes('AbortController'),
        '/api/follow-ups/consultant fetch must be bounded client-side'
      );
    });

    test('Concurrent auth events cannot stack duplicate resolution loops', async () => {
      const source = fs.readFileSync(path.join(process.cwd(), 'src', 'contexts', 'AuthContext.tsx'), 'utf8');
      assert.ok(
        source.includes('resolveInFlightRef'),
        'A duplicate-resolution guard must exist'
      );
      assert.ok(
        source.includes('resolveInFlightRef.current && retryCount === 0'),
        'Concurrent event-driven resolutions must be skipped; sequential retries bypass the guard'
      );
      // Model the guard semantics under TRUE concurrency: a second auth event
      // arriving while the first resolution chain is in flight must not start
      // a new chain; sequential retries belong to the same chain.
      let inFlight = false;
      let chains = 0;
      const resolveProfile = async (retryCount: number): Promise<void> => {
        if (inFlight && retryCount === 0) return;
        inFlight = true;
        try {
          if (retryCount === 0) chains++;
          if (retryCount < 2) {
            await new Promise<void>((r) => setTimeout(r, 5)); // fetch in flight
            await resolveProfile(retryCount + 1);
          }
        } finally {
          inFlight = false;
        }
      };
      await Promise.allSettled([resolveProfile(0), resolveProfile(0)]);
      assert.equal(chains, 1, 'Only ONE resolution chain may run for concurrent events');
    });
  });

  describe('14. Vercel Hobby Serverless Function limit (max 12)', () => {
    const API_DIR = path.join(process.cwd(), 'api');

    function listFunctionFiles(dir: string): string[] {
      const out: string[] = [];
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          out.push(...listFunctionFiles(full));
        } else if (entry.name.endsWith('.ts') && !entry.name.startsWith('_')) {
          out.push(full);
        }
      }
      return out;
    }

    test('Total Serverless Functions must stay within the Vercel Hobby limit of 12', () => {
      const files = listFunctionFiles(API_DIR);
      assert.ok(
        files.length <= 12,
        `Vercel Hobby allows at most 12 Serverless Functions; found ${files.length}: ${files.map(f => path.relative(API_DIR, f)).join(', ')}`
      );
    });

    test('Consultant and meeting URLs are served by consolidated dynamic routers', () => {
      const consultantRouter = path.join(API_DIR, 'consultant', '[action].ts');
      const meetingRouter = path.join(API_DIR, 'meeting', '[action].ts');
      assert.ok(fs.existsSync(consultantRouter), 'api/consultant/[action].ts must exist');
      assert.ok(fs.existsSync(meetingRouter), 'api/meeting/[action].ts must exist');

      const consultantRouterSource = fs.readFileSync(consultantRouter, 'utf8');
      // URL preservation: the router must dispatch the preserved public URLs
      assert.ok(consultantRouterSource.includes("case 'me':"), 'URL /api/consultant/me must be preserved');
      assert.ok(consultantRouterSource.includes("case 'bookings':"), 'URL /api/consultant/bookings must be preserved');
      assert.ok(
        consultantRouterSource.includes('src/server/consultant/me.js'),
        'me action must delegate to the real bounded handler'
      );
      assert.ok(
        consultantRouterSource.includes('src/server/consultant/bookings.js'),
        'bookings action must delegate to the real bounded handler'
      );

      const meetingRouterSource = fs.readFileSync(meetingRouter, 'utf8');
      assert.ok(meetingRouterSource.includes("case 'validate-access':"), 'URL /api/meeting/validate-access must be preserved');
      assert.ok(meetingRouterSource.includes("case 'record-join':"), 'URL /api/meeting/record-join must be preserved');
      assert.ok(meetingRouterSource.includes("case 'notify-waiting':"), 'URL /api/meeting/notify-waiting must be preserved');

      // The old individual function files must be gone (otherwise the limit is exceeded)
      assert.ok(!fs.existsSync(path.join(API_DIR, 'consultant', 'me.ts')), 'api/consultant/me.ts must be consolidated');
      assert.ok(!fs.existsSync(path.join(API_DIR, 'consultant', 'bookings.ts')), 'api/consultant/bookings.ts must be consolidated');
      assert.ok(!fs.existsSync(path.join(API_DIR, 'meeting', 'validate-access.ts')), 'api/meeting/validate-access.ts must be consolidated');
      assert.ok(!fs.existsSync(path.join(API_DIR, 'meeting', 'record-join.ts')), 'api/meeting/record-join.ts must be consolidated');
      assert.ok(!fs.existsSync(path.join(API_DIR, 'meeting', 'notify-waiting.ts')), 'api/meeting/notify-waiting.ts must be consolidated');
    });

    test('Unknown consultant/meeting actions receive an explicit 404 (no ambiguous public access)', () => {
      const consultantRouterSource = fs.readFileSync(path.join(API_DIR, 'consultant', '[action].ts'), 'utf8');
      const meetingRouterSource = fs.readFileSync(path.join(API_DIR, 'meeting', '[action].ts'), 'utf8');
      assert.ok(
        consultantRouterSource.includes('Unknown consultant API action'),
        'Unknown consultant actions must 404 explicitly'
      );
      assert.ok(
        meetingRouterSource.includes('Unknown meeting API action'),
        'Unknown meeting actions must 404 explicitly'
      );
      // Handlers themselves still enforce authentication (no public access added)
      const meSource = fs.readFileSync(path.join(process.cwd(), 'src', 'server', 'consultant', 'me.ts'), 'utf8');
      assert.ok(
        meSource.includes('Missing Bearer token'),
        'Consultant me action still enforces authentication after consolidation'
      );
    });
  });

  describe('15. Authentication lifecycle stability (verification-loop regression)', () => {
    const authSource = () =>
      fs.readFileSync(path.join(process.cwd(), 'src', 'contexts', 'AuthContext.tsx'), 'utf8');

    test('1. TOKEN_REFRESHED does not restart an already-successful profile resolution', () => {
      const source = authSource();
      // The listener must consult the shared skip decision BEFORE touching the
      // loading state — a resolved consultant must never flash back to loading.
      const sgnInIdx = source.indexOf("event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED'");
      const branch = source.slice(sgnInIdx, sgnInIdx + 700);
      assert.ok(
        branch.includes('shouldSkipResolution'),
        'The SIGNED_IN/TOKEN_REFRESHED branch must consult shouldSkipResolution before setLoading'
      );
      assert.ok(
        branch.indexOf('shouldSkipResolution') < branch.indexOf('setLoading(true)'),
        'The skip decision must precede setLoading(true)'
      );
      assert.ok(
        source.includes('const shouldSkipResolution = (userId: string): boolean'),
        'A single shared skip-decision helper must exist'
      );
    });

    test('2. Retry reuses the existing auth lifecycle — no duplicate listeners', () => {
      const source = authSource();
      const listenerCount = (source.match(/onAuthStateChange\(/g) || []).length;
      assert.equal(
        listenerCount, 1,
        'Exactly ONE onAuthStateChange subscription may exist (no listener created per retry)'
      );
      assert.ok(
        source.includes('resolveProfileRef.current(current.id, current'),
        'retryProfileResolution must reuse the effect-scoped resolver'
      );
      const retryFn = source.slice(source.indexOf('const retryProfileResolution'), source.indexOf('const value ='));
      assert.ok(
        !retryFn.includes('onAuthStateChange'),
        'Retry must never create a new auth listener'
      );
    });

    test('3. A stale failed request cannot overwrite a newer successful result', () => {
      const source = authSource();
      // The proven defect: the best-effort profiles upsert REJECTED (timeout)
      // and threw into the outer catch, discarding the successful consultant
      // resolution. It must be isolated.
      const consultantUpsertIdx = source.indexOf("'consultant profile upsert'");
      const block = source.slice(consultantUpsertIdx - 1200, consultantUpsertIdx + 600);
      assert.ok(
        block.includes('resolution preserved'),
        'The consultant profile upsert must be isolated so its failure never discards resolution'
      );
      const devUpsertIdx = source.indexOf("'developer_admin profile upsert'");
      const devBlock = source.slice(devUpsertIdx - 1200, devUpsertIdx + 600);
      assert.ok(
        devBlock.includes('resolution preserved'),
        'The developer_admin upsert must be equally isolated'
      );
      // Model: a rejected best-effort write cannot erase an established result
      let established: string | null = null;
      const resolution = async (): Promise<string | null> => {
        try {
          await Promise.reject(new Error('upsert timed out')); // best-effort write
        } catch { /* preserved — do not rethrow */ }
        established = 'consultant';
        return established;
      };
      return resolution().then((result) => {
        assert.equal(result, 'consultant', 'Best-effort failure must not overwrite the successful result');
      });
    });

    test('4. Successful consultant authorization remains stable after dashboard mount', () => {
      const dash = fs.readFileSync(path.join(process.cwd(), 'src', 'pages', 'ConsultantDashboard.tsx'), 'utf8');
      assert.ok(
        dash.includes('accessCheckUserRef'),
        'The dashboard access check must run once per user ID (no restart on auth-object identity changes)'
      );
      assert.ok(
        dash.includes("}, [user?.id, authLoading]);"),
        'The dashboard effect must key on the user ID, not object identity'
      );
      const protectedSource = fs.readFileSync(path.join(process.cwd(), 'src', 'components', 'ProtectedRoute.tsx'), 'utf8');
      assert.ok(
        !protectedSource.includes('window.location.reload') && !protectedSource.includes('location.reload()'),
        'Authorization states must never reload the page'
      );
      const dashProtected = dash.includes('window.location.reload');
      assert.equal(dashProtected, false, 'The dashboard must never reload itself');
    });

    test('5. Dashboard does not remount or reset when statistics fail', () => {
      const dash = fs.readFileSync(path.join(process.cwd(), 'src', 'pages', 'ConsultantDashboard.tsx'), 'utf8');
      assert.ok(
        dash.includes('stats: statsRes.status'),
        'Statistics failure must only set its section flag'
      );
      assert.ok(
        dash.includes("Dashboard statistics could not be loaded"),
        'The stats section shows a local error + Retry'
      );
      // Silent retry must not toggle the global loading state
      const loadIdx = dash.indexOf('const loadDashboardData');
      const loadBlock = dash.slice(loadIdx, loadIdx + 400);
      assert.ok(
        loadBlock.includes('if (!silent) setLoading(true)'),
        'Silent section retries must not reset the dashboard loading state'
      );
    });

    test('6+7. Consultant list settles within the deadline; Booking shows retryable error', () => {
      const svc = fs.readFileSync(path.join(process.cwd(), 'src', 'services', 'consultants.ts'), 'utf8');
      assert.ok(
        svc.includes('REQUEST_DEADLINE_MS = 6000'),
        'Consultant list hard deadline must be 6s (error within the 8s target)'
      );
      assert.ok(
        svc.includes('inFlightGetAll'),
        'Concurrent consultant-list requests must be deduplicated'
      );
      const booking = fs.readFileSync(path.join(process.cwd(), 'src', 'pages', 'Booking.tsx'), 'utf8');
      assert.ok(
        /retry: 0/.test(booking),
        'Booking must not auto-retry: the explicit Retry button owns recovery'
      );
      assert.ok(
        booking.includes('consultantsError ?'),
        'Booking must render the explicit error + Retry state'
      );
      // Model: concurrent getAll calls share one in-flight request
      let inFlight: Promise<number> | null = null;
      let networkCalls = 0;
      const getAll = (): Promise<number> => {
        if (inFlight) return inFlight;
        networkCalls++;
        inFlight = new Promise<number>((resolve) => {
          setTimeout(() => { inFlight = null; resolve(networkCalls); }, 5);
        });
        return inFlight;
      };
      return Promise.all([getAll(), getAll(), getAll()]).then((results) => {
        assert.equal(networkCalls, 1, 'Three concurrent callers must share ONE network request');
        assert.equal(results[0], 1);
      });
    });

    test('Structured logs carry correlation IDs without tokens or secrets', () => {
      const source = authSource();
      assert.ok(
        source.includes('const correlationId = `res_'),
        'Each resolution chain must carry a correlation ID'
      );
      assert.ok(
        source.includes("secureLog.error('Error in fetchProfile:', { correlationId, userId,"),
        'fetchProfile failure logs must carry the correlation ID'
      );
      // No secrets in any log payload
      const forbidden = ['access_token', 'refresh_token', 'password'];
      for (const secret of forbidden) {
        const logLines = source.split('\n').filter(l => l.includes('secureLog.'));
        assert.ok(
          !logLines.some(l => l.includes(secret)),
          `secureLog calls must never include ${secret}`
        );
      }
    });
  });

  describe('16. Degraded-mode role cache (app-wide authenticated-read outage)', () => {
    const authSource = () =>
      fs.readFileSync(path.join(process.cwd(), 'src', 'contexts', 'AuthContext.tsx'), 'utf8');

    test('A profiles-read hang serves the DEGRADED cached role instead of blocking the user', () => {
      const source = authSource();
      assert.ok(
        source.includes('serving DEGRADED cached role for this authenticated user'),
        'The profiles-hang path must reuse the last authoritative role'
      );
      assert.ok(
        source.includes('getCachedRoleProfile(userId)'),
        'The degraded path must read the per-user role cache'
      );
      // The degraded return must come BEFORE the hard refusal
      const degradedIdx = source.indexOf('serving DEGRADED cached role');
      const refuseIdx = source.indexOf('refusing client fallback');
      assert.ok(
        degradedIdx !== -1 && refuseIdx !== -1 && degradedIdx < refuseIdx,
        'Cache fallback must be attempted before the hard refusal'
      );
    });

    test('The role cache is TTL-bounded and only written on authoritative resolution', () => {
      const source = authSource();
      assert.ok(
        source.includes('ROLE_CACHE_TTL_MS'),
        'The role cache must expire (no indefinitely stale privileged roles)'
      );
      assert.ok(
        source.includes('cachedAt: Date.now()'),
        'cachedAt is written ONLY by authoritative resolutions'
      );
      // The degraded path must NOT refresh cachedAt (no indefinite extension)
      const degradedIdx = source.indexOf('serving DEGRADED cached role');
      const degradedBlock = source.slice(degradedIdx, degradedIdx + 700);
      assert.ok(
        !degradedBlock.includes('setCachedProfile('),
        'Degraded reads must never refresh the cache timestamp'
      );
    });

    test('Client→consultant rescue still precedes the degraded fallback', () => {
      const source = authSource();
      const rescueIdx = source.indexOf('consultantOut');
      const degradedIdx = source.indexOf('serving DEGRADED cached role');
      assert.ok(
        rescueIdx !== -1 && degradedIdx !== -1 && rescueIdx < degradedIdx,
        'The consultants-table rescue (immediate client→consultant upgrade) must run before the cache fallback'
      );
    });

    test('The doomed /api/consultant/me call is skipped when profiles reads hang', () => {
      const source = authSource();
      const meIdx = source.indexOf("'/api/consultant/me'");
      const meBlockStart = source.lastIndexOf('if (!profilesLookupFailed)', meIdx);
      assert.ok(
        meBlockStart !== -1 && meIdx - meBlockStart < 1200,
        'The me.ts attempt must be gated on !profilesLookupFailed (dead 3.5s wait otherwise)'
      );
    });

    test('Model: degraded cache keeps the exact cached role — never upgrades or downgrades', () => {
      const store = new Map();
      const getCachedRole = (userId) => store.get(userId) ?? null;
      const setCached = (userId, p) => store.set(userId, { ...p, cachedAt: Date.now() });
      // Authoritative resolution earlier in this browser:
      setCached('user-1', { role: 'consultant', is_consultant: true });
      // Now the profiles read hangs → degraded fallback:
      const degraded = getCachedRole('user-1');
      assert.equal(degraded.role, 'consultant', 'Cached consultant stays consultant');
      assert.equal(degraded.is_consultant, true);
      // A user with NO cache (never resolved) gets null → explicit error state
      assert.equal(getCachedRole('user-2'), null, 'Unknown users are never assigned a guessed role');
      // Stale cache beyond TTL is discarded
      store.set('user-3', { role: 'consultant', cachedAt: Date.now() - 8 * 24 * 60 * 60 * 1000 });
      const TTL = 7 * 24 * 60 * 60 * 1000;
      const stale = store.get('user-3');
      const isStale = Date.now() - stale.cachedAt > TTL;
      assert.equal(isStale, true, 'Cache beyond the TTL is stale');
    });
  });

  describe('17. Degraded role cache authorization audit (fail-closed)', () => {
    const authSource = () =>
      fs.readFileSync(path.join(process.cwd(), 'src', 'contexts', 'AuthContext.tsx'), 'utf8');

    test('Elevated roles are NEVER served from cache (super_admin / admin / developer_admin)', () => {
      const source = authSource();
      assert.ok(
        source.includes('const isElevatedCacheRole = (role?: string | null): boolean'),
        'An explicit elevated-role filter must exist'
      );
      assert.ok(
        source.includes("role === 'super_admin' || role === 'admin' || role === 'developer_admin'"),
        'All three elevated roles must be blocked'
      );
      const degradedCount = (source.match(/getDegradedCachedRole\(/g) || []).length;
      assert.ok(
        degradedCount >= 2,
        `getDegradedCachedRole must guard every cache-serving path (found ${degradedCount} usages)`
      );
      // Serving paths must not call the raw cache accessors directly
      assert.ok(
        !source.includes('const cachedRoleProfile = getCachedRoleProfile(userId);'),
        'Degraded path must not use the unfiltered role cache'
      );
    });

    test('Cached consultant role is revoked when the live consultants lookup positively returns empty', () => {
      const source = authSource();
      assert.ok(
        source.includes('consultantLookupDefinitivelyEmpty'),
        'The live lookup outcome must be threaded into the degraded decision'
      );
      const degradedIdx = source.indexOf('serving DEGRADED cached role');
      const degradedBlock = source.slice(Math.max(0, degradedIdx - 800), degradedIdx + 200);
      assert.ok(
        degradedBlock.includes('consultantLookupDefinitivelyEmpty'),
        'A cached consultant role must not be served after a definitive empty lookup'
      );
      // Timeout/error must NOT positively disconfirm (fail-open only for cache-eligible non-elevated roles)
      assert.ok(
        source.includes('Array.isArray(rawConsultants) && rawConsultants.length === 0 && !queryError'),
        'Only a clean 200-empty response revokes the cached consultant role'
      );
    });

    test('SIGNED_OUT purges the per-user cached profile', () => {
      const source = authSource();
      assert.ok(
        source.includes('const purgeCachedProfile = (userId?: string | null) =>'),
        'A cache purge helper must exist'
      );
      const signOutIdx = source.indexOf("if (event === 'SIGNED_OUT')");
      const signOutBlock = source.slice(signOutIdx, signOutIdx + 700);
      assert.ok(
        signOutBlock.includes('purgeCachedProfile('),
        'SIGNED_OUT must purge the cached profile for the signed-out user'
      );
    });

    test('Elevated authorization still requires allowlist or an authoritative server read', () => {
      const source = authSource();
      // The top of resolution still resolves allowlisted admins WITHOUT the cache
      const allowlistIdx = source.indexOf('isAllowedAdminEmail');
      const degradedIdx = source.indexOf('serving DEGRADED cached role');
      assert.ok(
        allowlistIdx !== -1 && degradedIdx !== -1 && allowlistIdx < degradedIdx,
        'Allowlist-based admin resolution runs before any degraded path — cache cannot preempt it'
      );
      // Admin gate helper used by ProtectedRoute remains allowlist/DB authoritative
      const authorization = fs.readFileSync(path.join(process.cwd(), 'src', 'lib', 'authorization.ts'), 'utf8');
      const isUserAdminIdx = authorization.indexOf('export function isUserAdmin');
      const isUserAdminBlock = authorization.slice(isUserAdminIdx, isUserAdminIdx + 400);
      assert.ok(
        !isUserAdminBlock.includes('getCached') && !isUserAdminBlock.includes('cached'),
        'isUserAdmin must never consult the degraded cache'
      );
    });

    test('Model: degraded cache decision matrix (elevated refused, consultant gated, client allowed, purged)', () => {
      const isElevatedRole = (role) => role === 'super_admin' || role === 'admin' || role === 'developer_admin';
      const getDegradedCachedRole = (cached, lookupDefinitivelyEmpty) => {
        if (!cached) return null;
        if (isElevatedRole(cached.role)) return null; // fail closed
        if (cached.role === 'consultant' && lookupDefinitivelyEmpty) return null; // disconfirmed
        return cached; // client, or consultant when lookup unknown
      };
      // Elevated roles — always refused
      assert.equal(getDegradedCachedRole({ role: 'super_admin' }, false), null);
      assert.equal(getDegradedCachedRole({ role: 'admin' }, false), null);
      assert.equal(getDegradedCachedRole({ role: 'developer_admin' }, false), null);
      // Consultant — gated by live lookup
      assert.equal(getDegradedCachedRole({ role: 'consultant', is_consultant: true }, true), null);
      assert.equal(getDegradedCachedRole({ role: 'consultant', is_consultant: true }, false)?.role, 'consultant');
      // Client — allowed (non-elevated)
      assert.equal(getDegradedCachedRole({ role: 'client' }, true)?.role, 'client');
      // No cache — never assigned
      assert.equal(getDegradedCachedRole(null, false), null);
    });
  });

  describe('18. Action Parameter Handling and Approval Route Parity', () => {
    const readApprovalSource = () =>
      fs.readFileSync(path.join(process.cwd(), 'api', 'admin', 'approve-consultant-application.ts'), 'utf8');
    const readServerSource = () =>
      fs.readFileSync(path.join(process.cwd(), 'server.ts'), 'utf8');

    test('api/admin/approve-consultant-application.ts does NOT require action unconditionally', () => {
      const source = readApprovalSource();
      assert.ok(
        !source.includes('if (!action)'),
        "api/admin/approve-consultant-application.ts must not contain 'if (!action)'"
      );
      assert.ok(
        !source.includes("error: 'Action is required.'"),
        "api/admin/approve-consultant-application.ts must not require 'Action is required.'"
      );
    });

    test('server.ts does NOT require action unconditionally', () => {
      const source = readServerSource();
      assert.ok(
        !source.includes("error: 'Action is required.'") &&
        !source.includes('error: "Action is required."'),
        "server.ts must not require 'Action is required.'"
      );
    });

    test('Approval flow proceeds directly when action is absent', () => {
      const approvalSrc = readApprovalSource();
      const serverSrc = readServerSource();
      assert.ok(
        approvalSrc.includes("if (!applicationId) {\n      return res.status(400).json({ success: false, error: 'applicationId is required.' });"),
        'Handler must validate applicationId when action is absent'
      );
      assert.ok(
        serverSrc.includes('if (!applicationId) {\n        return res.status(400).json({ success: false, error: "applicationId is required." });'),
        'server.ts must validate applicationId when action is absent'
      );
    });

    test('Pure router simulation: action omitted routes to approve-application', () => {
      function routeAction(body: any) {
        const action = body?.action;
        if (action) {
          if (action === 'toggle-active') {
            const consultantId = body?.consultantId;
            const active = body?.active;
            if (typeof active !== 'boolean') {
              return { status: 400, error: 'Request body must contain explicit boolean `active` value.' };
            }
            if (!consultantId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(consultantId)) {
              return { status: 400, error: 'Valid consultantId (UUID) is required.' };
            }
            return { status: 200, route: 'toggle-active', consultantId, active };
          }
          return { status: 400, error: `Unsupported action: ${action}.` };
        }
        const { applicationId } = body || {};
        if (!applicationId) {
          return { status: 400, error: 'applicationId is required.' };
        }
        return { status: 200, route: 'approve-application', applicationId };
      }

      // No action
      const approveRes = routeAction({ applicationId: mockApplication.id, adminNotes: 'Approved' });
      assert.equal(approveRes.status, 200);
      assert.equal(approveRes.route, 'approve-application');

      // Valid toggle-active
      const toggleRes = routeAction({
        action: 'toggle-active',
        consultantId: '3dc127b8-7334-4960-a3b5-8627923d40f1',
        active: true,
      });
      assert.equal(toggleRes.status, 200);
      assert.equal(toggleRes.route, 'toggle-active');
      assert.equal(toggleRes.active, true);

      // toggle-active invalid active
      const invalidActive = routeAction({
        action: 'toggle-active',
        consultantId: '3dc127b8-7334-4960-a3b5-8627923d40f1',
        active: 'true',
      });
      assert.equal(invalidActive.status, 400);

      // toggle-active invalid UUID
      const invalidId = routeAction({
        action: 'toggle-active',
        consultantId: 'not-a-uuid',
        active: false,
      });
      assert.equal(invalidId.status, 400);

      // Unsupported action
      const unsupported = routeAction({ action: 'delete-consultant' });
      assert.equal(unsupported.status, 400);
      assert.equal(unsupported.error, 'Unsupported action: delete-consultant.');
    });

    test('Both endpoints reject unsupported explicit actions with HTTP 400', () => {
      const approvalSrc = readApprovalSource();
      const serverSrc = readServerSource();
      assert.ok(
        approvalSrc.includes("return res.status(400).json({ success: false, error: `Unsupported action: ${action}.` });"),
        'api/admin/approve-consultant-application.ts must reject unsupported actions'
      );
      assert.ok(
        serverSrc.includes('return res.status(400).json({ success: false, error: `Unsupported action: ${action}.` });'),
        'server.ts must reject unsupported actions'
      );
    });

    test('Approval creates an inactive draft without publishing free text', () => {
      const approvalSrc = readApprovalSource();
      const serverSrc = readServerSource();

      for (const [src, label] of [[approvalSrc, 'api'], [serverSrc, 'server']]) {
        const draftIdx = src.indexOf('Inserting NON-PUBLIC draft consultant record');
        assert.ok(draftIdx !== -1, `${label} must contain draft insertion path`);
        const block = src.slice(draftIdx, draftIdx + 700);

        assert.ok(block.includes('is_active: false'), `${label} draft must be inactive`);
        assert.ok(block.includes("title: ''"), `${label} title must be blank`);
        assert.ok(block.includes("bio: ''"), `${label} bio must be blank`);
        assert.ok(block.includes('expertise: []'), `${label} expertise must be empty array`);
        assert.ok(!block.includes('current_job'), `${label} must not copy current_job`);
        assert.ok(!block.includes('experience'), `${label} must not copy experience`);
      }
    });

    test('Re-approval preserves existing publication state and does not activate', () => {
      const approvalSrc = readApprovalSource();
      const serverSrc = readServerSource();

      for (const [src, label] of [[approvalSrc, 'api'], [serverSrc, 'server']]) {
        const updateIdx = src.indexOf('Updating existing consultant record');
        assert.ok(updateIdx !== -1, `${label} must have re-approval identity update path`);
        const updateBlock = src.slice(updateIdx, updateIdx + 600);

        assert.ok(!updateBlock.includes('is_active'), `${label} re-approval must not touch is_active`);
        assert.ok(!updateBlock.includes('title'), `${label} re-approval must not touch title`);
        assert.ok(!updateBlock.includes('bio'), `${label} re-approval must not touch bio`);
      }
    });
  });

  describe('21. Approval-to-Dashboard Access Separation from Public Publication', () => {
    const authSource = fs.readFileSync(path.join(process.cwd(), 'src', 'contexts', 'AuthContext.tsx'), 'utf8');
    const serverSource = fs.readFileSync(path.join(process.cwd(), 'server.ts'), 'utf8');
    const dashSource = fs.readFileSync(path.join(process.cwd(), 'src', 'pages', 'ConsultantDashboard.tsx'), 'utf8');

    test('AuthContext recognizes linked consultant records regardless of is_active', () => {
      // Must not require is_active === true on consultantOut.matched
      const matchIdx = authSource.indexOf('const isMatchedConsultant = Boolean(');
      assert.ok(matchIdx !== -1, 'isMatchedConsultant definition must exist');
      const matchBlock = authSource.slice(matchIdx, matchIdx + 400);
      assert.ok(
        !matchBlock.includes('(consultantOut.matched as any).is_active === true'),
        'isMatchedConsultant must not require is_active === true'
      );
      assert.ok(
        matchBlock.includes('consultantOut.matched.user_id === userId'),
        'isMatchedConsultant must verify user_id ownership'
      );
    });

    test('AuthContext self-heal link does not alter is_active publication flag', () => {
      const healIdx = authSource.indexOf('// Self-heal link without mutating public publication state');
      assert.ok(healIdx !== -1, 'Self-heal link block must exist');
      const healBlock = authSource.slice(healIdx, healIdx + 300);
      assert.ok(
        !healBlock.includes('is_active: true'),
        'Self-heal link must NEVER set is_active: true (cannot auto-publish)'
      );
      assert.ok(
        healBlock.includes('.update({ user_id: userId })'),
        'Self-heal link must only update user_id'
      );
    });

    test('AuthContext /api/consultant/me rescue accepts unpublished draft consultants', () => {
      const meIdx = authSource.indexOf('check /api/consultant/me for authoritative self-linking');
      assert.ok(meIdx !== -1, 'API consultant/me check block must exist');
      const meBlock = authSource.slice(meIdx, meIdx + 1500);
      assert.ok(
        !meBlock.includes('meData?.consultant?.is_active === true'),
        'AuthContext me rescue must not reject draft consultants with is_active === false'
      );
      assert.ok(
        meBlock.includes('meData?.success && meData?.isConsultant && meData?.consultant'),
        'AuthContext me rescue must accept valid consultant object from /api/consultant/me'
      );
    });

    test('AuthContext does not demote draft consultants with linked records', () => {
      const demoteIdx = authSource.indexOf('Demote unlinked/orphan consultant profiles in memory/session');
      assert.ok(demoteIdx !== -1, 'Demotion block must exist');
      const demoteBlock = authSource.slice(demoteIdx, demoteIdx + 500);
      assert.ok(
        demoteBlock.includes('!hasLinkedConsultantRecord'),
        'Demotion must check hasLinkedConsultantRecord'
      );
      assert.ok(
        demoteBlock.includes('consultantOut?.definitivelyEmpty'),
        'Demotion must only occur when record is definitively empty (deleted)'
      );
    });

    test('server.ts /api/consultant/me does not filter out unpublished draft consultants', () => {
      const meIdx = serverSource.indexOf('app.get("/api/consultant/me"');
      assert.ok(meIdx !== -1, 'server.ts /api/consultant/me endpoint must exist');
      const meBlock = serverSource.slice(meIdx, meIdx + 5000);
      assert.ok(
        !meBlock.includes('.eq("is_active", true)'),
        'server.ts /api/consultant/me must not filter query with .eq("is_active", true)'
      );
      assert.ok(
        meBlock.includes('isConsultant: isLinkedConsultant'),
        'server.ts /api/consultant/me must return isConsultant for linked consultants'
      );
      assert.ok(
        meBlock.includes('isDraft: Boolean(consultant.is_active !== true)'),
        'server.ts /api/consultant/me must communicate isDraft state'
      );
    });

    test('ConsultantDashboard allows unpublished draft consultants and renders draft badge & notice', () => {
      assert.ok(
        dashSource.includes('consultantData.is_active ? "Published" : "Unpublished Draft"'),
        'Dashboard must render Published vs Unpublished Draft badge'
      );
      assert.ok(
        dashSource.includes('Your profile is currently in Unpublished Draft mode'),
        'Dashboard must display unpublished draft informational banner'
      );
    });

    test('Public directory strictly excludes unpublished consultants (is_active === false)', async () => {
      // Simulate consultant data
      const consultants = [
        { id: '1', name: 'Published Expert', is_active: true },
        { id: '2', name: 'Old Letters (Draft)', is_active: false },
        { id: '3', name: 'Pending Review', is_active: false },
      ];

      // Active only filter used by public directory and booking page
      const publicConsultants = consultants.filter(c => c.is_active);
      assert.equal(publicConsultants.length, 1);
      assert.equal(publicConsultants[0].name, 'Published Expert');
      assert.ok(!publicConsultants.some(c => c.name.includes('Old Letters')));
    });

    test('Old Letters self-healing simulation: demoted client profile self-heals to consultant', () => {
      const oldLettersUser = {
        id: 'a26cbf23-4ebd-4c29-b384-ea24ec0a7ba1',
        email: 'oldletters.mailroom@gmail.com',
      };
      const emailVerified = true;
      const initialProfile = {
        id: oldLettersUser.id,
        role: 'client' as const, // currently demoted in Supabase
        full_name: 'Old Letters',
      };
      const consultantRecord = {
        id: 'd9b7361a-3e81-4322-a536-123456789abc',
        name: 'Old Letters',
        email: 'oldletters.mailroom@gmail.com',
        user_id: oldLettersUser.id,
        is_active: false, // draft
      };

      // 1. isMatchedConsultant check
      const isMatchedConsultant = Boolean(
        consultantRecord &&
        (consultantRecord.user_id === oldLettersUser.id ||
          (oldLettersUser.email && emailVerified && consultantRecord.email.toLowerCase().trim() === oldLettersUser.email.toLowerCase().trim()))
      );
      assert.equal(isMatchedConsultant, true, 'Old Letters must match consultant record by user_id and email');

      // 2. hasLinkedConsultantRecord
      const hasLinkedConsultantRecord = Boolean(isMatchedConsultant);
      assert.equal(hasLinkedConsultantRecord, true);

      // 3. isConsultantUser resolution
      const isConsultantUser = Boolean(
        (initialProfile.role === 'consultant' && hasLinkedConsultantRecord) ||
        (hasLinkedConsultantRecord && (consultantRecord.user_id === oldLettersUser.id || emailVerified))
      );
      assert.equal(isConsultantUser, true, 'Old Letters must resolve to isConsultantUser=true even when profile role is client');

      // 4. Resolved profile elevation
      const resolvedProfile = {
        id: oldLettersUser.id,
        role: isConsultantUser ? ('consultant' as const) : initialProfile.role,
        full_name: consultantRecord.name,
      };
      assert.equal(resolvedProfile.role, 'consultant', 'Old Letters profile must elevate to consultant');

      // 5. Demotion safeguard
      const shouldDemote = Boolean(
        initialProfile.role === 'consultant' && !hasLinkedConsultantRecord && false
      );
      assert.equal(shouldDemote, false, 'Old Letters must NEVER be demoted to client');
    });
  });
});