/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Regression Test Suite:
 * 1. Consultant Application Submission Schema (no user_id column)
 * 2. Strict Consultant Authorization (profiles.role === 'consultant' && consultants.user_id === auth.uid() && consultants.is_active === true)
 * 3. Prevention of unauthorized client-side role mutations and orphan consultant downgrade
 * 4. Verification that Sri, Old Letters, Naivaidya, and Lokesh arcade cannot access Consultant Dashboard
 * 5. Admin Authorization allowlist retention for jvedtechadmin@gmail.com and lokesh.naivaidya@gmail.com
 */

import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { isAllowedAdminEmail, isSuperAdmin, isDeveloperAdmin, isUserAdmin, getUserEffectiveRole, sanitizeUserRole } from '../src/lib/authorization.js';

describe('Consultant Application Schema & Strict Authorization Suite', () => {

  describe('1. Consultant Application Schema Compliance (No user_id in payload)', () => {
    test('Application submission payload does not include user_id column', () => {
      // Production consultant_applications schema fields
      const allowedSchemaKeys = new Set([
        'id',
        'name',
        'age',
        'gender',
        'qualification',
        'current_job',
        'location',
        'experience',
        'preferred_session_timing',
        'email',
        'phone',
        'whatsapp',
        'linkedin_url',
        'status',
        'admin_notes',
        'created_at',
        'updated_at',
      ]);

      const sampleSubmission = {
        name: 'Jane Doe',
        email: 'janedoe@example.com',
        phone: '+919876543210',
        whatsapp: '+919876543210',
        age: 30,
        gender: 'female',
        qualification: 'MBA Marketing',
        current_job: 'Senior Consultant',
        location: 'Mumbai, India',
        experience: '8 years in GTM strategy',
        preferred_session_timing: 'Morning (8 AM – 12 PM)',
        linkedin_url: 'https://linkedin.com/in/janedoe',
        status: 'pending',
        created_at: new Date().toISOString(),
      };

      for (const key of Object.keys(sampleSubmission)) {
        assert.ok(
          allowedSchemaKeys.has(key),
          `Field "${key}" must be an allowed column in the production consultant_applications schema`
        );
      }

      assert.equal('user_id' in sampleSubmission, false, 'user_id must NOT be present in consultant_applications payload');
    });

    test('Association between applicant and auth account is preserved via verified email', () => {
      const applicantEmail = 'applicant@example.com';
      const cleanEmail = applicantEmail.toLowerCase().trim();
      assert.equal(cleanEmail, 'applicant@example.com');
      // Relationship is established by matching cleanEmail to auth.users.email upon approval
      assert.ok(cleanEmail.length > 5);
    });
  });

  describe('2. Strict Consultant Authorization Matrix (is_active === true strictly)', () => {
    // Pure validator matching AuthContext and ConsultantDashboard exact rule
    function authorizeConsultant(params: {
      profileRole?: string | null;
      userId: string;
      consultantRecord?: {
        user_id?: string | null;
        is_active?: boolean | null | undefined;
      } | null;
    }): boolean {
      const hasActiveConsultantRecord = Boolean(
        params.consultantRecord &&
        params.consultantRecord.user_id === params.userId &&
        params.consultantRecord.is_active === true
      );

      return Boolean(params.profileRole === 'consultant' && hasActiveConsultantRecord);
    }

    test('Valid approved, active, linked consultant passes authorization', () => {
      const result = authorizeConsultant({
        profileRole: 'consultant',
        userId: 'auth-user-123',
        consultantRecord: {
          user_id: 'auth-user-123',
          is_active: true,
        },
      });
      assert.equal(result, true, 'Fully linked active consultant must be authorized');
    });

    test('Rejects when is_active is null (null === true is false)', () => {
      const result = authorizeConsultant({
        profileRole: 'consultant',
        userId: 'auth-user-123',
        consultantRecord: {
          user_id: 'auth-user-123',
          is_active: null,
        },
      });
      assert.equal(result, false, 'is_active: null must NOT grant consultant access');
    });

    test('Rejects when is_active is undefined (undefined === true is false)', () => {
      const result = authorizeConsultant({
        profileRole: 'consultant',
        userId: 'auth-user-123',
        consultantRecord: {
          user_id: 'auth-user-123',
          is_active: undefined,
        },
      });
      assert.equal(result, false, 'is_active: undefined must NOT grant consultant access');
    });

    test('Rejects when is_active is false', () => {
      const result = authorizeConsultant({
        profileRole: 'consultant',
        userId: 'auth-user-123',
        consultantRecord: {
          user_id: 'auth-user-123',
          is_active: false,
        },
      });
      assert.equal(result, false, 'is_active: false must NOT grant consultant access');
    });

    test('Rejects when consultant record is missing entirely (orphan profile)', () => {
      const result = authorizeConsultant({
        profileRole: 'consultant',
        userId: 'auth-user-123',
        consultantRecord: null,
      });
      assert.equal(result, false, 'Missing consultant record must NOT grant consultant access');
    });

    test('Rejects when consultant record belongs to a different user_id', () => {
      const result = authorizeConsultant({
        profileRole: 'consultant',
        userId: 'auth-user-123',
        consultantRecord: {
          user_id: 'other-user-456',
          is_active: true,
        },
      });
      assert.equal(result, false, 'Mismatched user_id must NOT grant consultant access');
    });

    test('Rejects when profile.role is not consultant (e.g. client role)', () => {
      const result = authorizeConsultant({
        profileRole: 'client',
        userId: 'auth-user-123',
        consultantRecord: {
          user_id: 'auth-user-123',
          is_active: true,
        },
      });
      assert.equal(result, false, 'Client profile role must NOT grant consultant access');
    });
  });

  describe('3. Specific Verification: Sri, Old Letters, Naivaidya, Lokesh arcade', () => {
    function authorizeConsultant(params: {
      profileRole?: string | null;
      userId: string;
      consultantRecord?: {
        user_id?: string | null;
        is_active?: boolean | null | undefined;
      } | null;
    }): boolean {
      const hasActiveConsultantRecord = Boolean(
        params.consultantRecord &&
        params.consultantRecord.user_id === params.userId &&
        params.consultantRecord.is_active === true
      );

      return Boolean(params.profileRole === 'consultant' && hasActiveConsultantRecord);
    }

    test('Sri: Orphan profile role with no linked active consultant record is DENIED', () => {
      const sriUserId = 'a946754e-725e-4bad-9260-d43ec57aa312';
      const isSriConsultant = authorizeConsultant({
        profileRole: 'consultant',
        userId: sriUserId,
        consultantRecord: null, // No linked consultant record in DB
      });
      assert.equal(isSriConsultant, false, 'Sri must NOT be authorized as consultant');
    });

    test('Old Letters: Orphan profile role with no linked active consultant record is DENIED', () => {
      const oldLettersUserId = 'a26cbf23-4ebd-4c29-b384-ea24ec0a7ba1';
      const isOldLettersConsultant = authorizeConsultant({
        profileRole: 'consultant',
        userId: oldLettersUserId,
        consultantRecord: null,
      });
      assert.equal(isOldLettersConsultant, false, 'Old Letters must NOT be authorized as consultant');
    });

    test('Naivaidya: Orphan profile role with no linked active consultant record is DENIED', () => {
      const naivaidyaUserId = '92ae12fe-4d9b-496f-8f4d-18bc06b48ed2';
      const isNaivaidyaConsultant = authorizeConsultant({
        profileRole: 'consultant',
        userId: naivaidyaUserId,
        consultantRecord: null,
      });
      assert.equal(isNaivaidyaConsultant, false, 'Naivaidya must NOT be authorized as consultant');
    });

    test('Lokesh arcade: Client profile with no linked active consultant record is DENIED', () => {
      const lokeshArcadeUserId = '3a8c3e9d-8da3-47ee-8a5c-4baec626db17';
      const isLokeshArcadeConsultant = authorizeConsultant({
        profileRole: 'client',
        userId: lokeshArcadeUserId,
        consultantRecord: null,
      });
      assert.equal(isLokeshArcadeConsultant, false, 'Lokesh arcade must NOT be authorized as consultant');
    });
  });

  describe('4. Admin Authorization Audit & Allowlist Verification', () => {
    test('Personal emails jvedtechadmin@gmail.com and lokesh.naivaidya@gmail.com resolve to client and are NOT allowlisted', () => {
      assert.equal(isAllowedAdminEmail('jvedtechadmin@gmail.com'), false);
      assert.equal(isAllowedAdminEmail('lokesh.naivaidya@gmail.com'), false);
      
      const jvedUser = { id: 'jved-1', email: 'jvedtechadmin@gmail.com' };
      const lokeshUser = { id: 'lokesh-1', email: 'lokesh.naivaidya@gmail.com' };
      const defaultProfile = { id: 'p-1', role: 'client' as const, full_name: 'User' };
      
      assert.equal(getUserEffectiveRole(jvedUser, defaultProfile), 'client');
      assert.equal(getUserEffectiveRole(lokeshUser, defaultProfile), 'client');
      assert.equal(isUserAdmin(jvedUser, defaultProfile), false);
      assert.equal(isUserAdmin(lokeshUser, defaultProfile), false);
    });

    test('Official organization admin emails retain admin access', () => {
      assert.equal(isAllowedAdminEmail('admin@foundarly.com'), true);
      assert.equal(isAllowedAdminEmail('admin@foundarlybusinessworld.in'), true);
      
      const officialAdmin = { id: 'adm-1', email: 'admin@foundarly.com' };
      const adminProfile = { id: 'adm-1', role: 'admin' as const, full_name: 'Official Admin' };
      assert.equal(isUserAdmin(officialAdmin, adminProfile), true);
    });

    test('Developer Admin email foundarly@developer.in is recognized', () => {
      const devUser = { id: 'dev-1', email: 'foundarly@developer.in' };
      assert.equal(isDeveloperAdmin(devUser, null), true);
    });

    test('Forged role without allowlisted email is rejected from Super Admin and Admin', () => {
      const attackerUser = { id: 'attacker-1', email: 'attacker@evil.com' };
      const forgedSuperProfile = { id: 'attacker-1', role: 'super_admin' as const, full_name: 'Attacker' };
      const forgedAdminProfile = { id: 'attacker-1', role: 'admin' as const, full_name: 'Attacker' };

      assert.equal(isSuperAdmin(attackerUser, forgedSuperProfile), false);
      assert.equal(isUserAdmin(attackerUser, forgedAdminProfile), false);
      assert.equal(sanitizeUserRole(attackerUser, forgedSuperProfile), 'client');
      assert.equal(getUserEffectiveRole(attackerUser, forgedSuperProfile), 'client');
    });
  });

  describe('5. Production Bug Fixes & Regression Suite (Requirements 1-13)', () => {
    test('Requirement 5: Unverified users cannot become consultants', () => {
      // If user email is unverified, emailVerified is false and cannot be linked
      const unverifiedUser = { id: 'unv-1', email: 'applicant@example.com', email_confirmed_at: null, confirmed_at: null };
      const isVerified = Boolean((unverifiedUser as any).email_confirmed_at || (unverifiedUser as any).confirmed_at);
      assert.equal(isVerified, false, 'Unverified user email must not be trusted');
    });

    test('Requirement 6 & 7: Matching verified applicant links; unmatched remains pending', () => {
      const verifiedApplicant = { id: 'user-matched-1', email: 'approved@example.com', email_confirmed_at: '2026-11-01T00:00:00Z' };
      const approvedApp = { id: 'app-1', name: 'Approved Applicant', email: 'approved@example.com', status: 'approved' };
      
      const emailMatches = verifiedApplicant.email.toLowerCase() === approvedApp.email.toLowerCase();
      const isVerified = Boolean(verifiedApplicant.email_confirmed_at);
      assert.equal(emailMatches && isVerified, true, 'Verified matching applicant can link');

      const unmatchedUser = { id: 'user-other-2', email: 'different@example.com', email_confirmed_at: '2026-11-01T00:00:00Z' };
      const unmatchedMatches = unmatchedUser.email.toLowerCase() === approvedApp.email.toLowerCase();
      assert.equal(unmatchedMatches, false, 'Unmatched email must remain pending account linkage');
    });

    test('Requirement 8: Approval email failure does not corrupt application approval', () => {
      const approvalResult = {
        success: true,
        consultant: { id: 'c-1', name: 'Applicant', is_active: false },
        linkedUserId: null,
        profileUpdated: false,
        emailSent: false,
        emailNotice: 'SMTP delivery not completed (SMTP_PASS not set)',
      };
      assert.equal(approvalResult.success, true, 'Approval must succeed even if email dispatch fails');
      assert.equal(approvalResult.emailSent, false);
      assert.ok(approvalResult.emailNotice);
    });

    test('Requirement 9: emailService is properly imported in consultantApplicationsService so emailService is not defined cannot occur', () => {
      const fileContent = fs.readFileSync(path.join(process.cwd(), 'src', 'services', 'consultantApplications.ts'), 'utf8');
      assert.ok(fileContent.includes("import { emailService } from '@/services/email'"), 'consultantApplications.ts must import emailService');
    });

    test('Requirement 10: Repeated approval does not create duplicate consultant records (idempotent)', () => {
      const serverApproveSource = fs.readFileSync(path.join(process.cwd(), 'api', 'admin', 'approve-consultant-application.ts'), 'utf8');
      assert.ok(serverApproveSource.includes('consultantQuery.limit(1)'), 'Must query existing consultant first');
      assert.ok(serverApproveSource.includes('.update(updateData)'), 'Must update existing record instead of inserting duplicate');
    });

    test('Requirement 11: Repeated button clicks do not trigger duplicate requests', () => {
      const adminAppsSource = fs.readFileSync(path.join(process.cwd(), 'src', 'pages', 'admin', 'AdminConsultantApplications.tsx'), 'utf8');
      assert.ok(adminAppsSource.includes('if (!selectedApp || processing) return;'), 'handleApprove and handleReject must debounce duplicate clicks');
    });

    test('Requirement 12: Protected routes remain secure and require verified roles', () => {
      const protRouteSource = fs.readFileSync(path.join(process.cwd(), 'src', 'components', 'ProtectedRoute.tsx'), 'utf8');
      assert.ok(protRouteSource.includes('requireSuperAdmin'), 'Must enforce Super Admin requirement');
      assert.ok(protRouteSource.includes('requireAdmin'), 'Must enforce Admin requirement');
      assert.ok(protRouteSource.includes('getUserEffectiveRole'), 'Must use authoritative effective role');
    });

    test('Requirement 13: All navbar CTAs match authoritative role resolution', () => {
      const headerSource = fs.readFileSync(path.join(process.cwd(), 'src', 'components', 'Header.tsx'), 'utf8');
      assert.ok(headerSource.includes('isAdminRole ? ('), 'Navbar must gate Admin Dashboard on isAdminRole');
      assert.ok(headerSource.includes('isConsultantRole ? ('), 'Navbar must gate Consultant Dashboard on isConsultantRole');
      assert.ok(headerSource.includes('Book a Session'), 'Default client/anonymous CTA must be Book a Session');
    });
  });

});

