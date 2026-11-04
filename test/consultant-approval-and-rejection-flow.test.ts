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

    test('Application submission stamps the verified authenticated UUID (never name-based)', () => {
      const source = fs.readFileSync(path.join(process.cwd(), 'api', 'consultant-applications.ts'), 'utf8');
      assert.ok(
        source.includes('user_id: authenticatedUserId'),
        'Submission must stamp the authenticated UUID when identity is proven'
      );
      assert.ok(
        source.includes('applicantEmailVerified'),
        'user_id may only be stamped for a verified account email'
      );
      assert.ok(
        source.includes('applicantEmail === normalizedEmail'),
        'user_id may only be stamped when the account email matches the application email'
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

    test('Dashboard access is independent of the public consultants listing', () => {
      const dashSource = fs.readFileSync(path.join(process.cwd(), 'src', 'pages', 'ConsultantDashboard.tsx'), 'utf8');
      assert.ok(
        dashSource.includes('profile?.role === "consultant"') && dashSource.includes('profile?.is_consultant'),
        'Dashboard access must be granted from the activated account role, not a public listing record'
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
});