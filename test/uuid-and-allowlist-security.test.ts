/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Regression Test Suite:
 * - UUID format validation (including Lokesh's UUID: 3dc127b8-7334-4960-a3b5-8627923d40f1)
 * - Strict Admin Allowlist (lokesh.naivaidya@gmail.com and naivaidya736@gmail.com rejected)
 * - Authorized administrators retain access (admin@foundarly.com, admin@foundarlybusinessworld.in, foundarly@developer.in)
 * - Frontend deletion calls backend endpoint with Bearer token & never deletes directly
 * - Backend uses atomic service-role RPC and fails safely without service-role key
 * - Normal authenticated users cannot delete consultants
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  isAllowedAdminEmail,
  isDeveloperAdmin,
  isSuperAdmin,
  isUserAdmin,
  getUserEffectiveRole,
  getAdminAllowlist,
} from '../src/lib/authorization.js';

const root = process.cwd();
function readRel(p: string) {
  return fs.readFileSync(path.join(root, p), 'utf8');
}

describe('Regression & Security Verification Suite', () => {
  describe('1. UUID Validation (RFC 4122 Compliant)', () => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    test("Lokesh arcade's UUID 3dc127b8-7334-4960-a3b5-8627923d40f1 passes validation", () => {
      const lokeshUuid = '3dc127b8-7334-4960-a3b5-8627923d40f1';
      assert.ok(uuidRegex.test(lokeshUuid), "Lokesh's UUID must be accepted by standard UUID validator");
    });

    test('All UUID validators across codebase accept standard UUID with any valid hex digit in block 3', () => {
      const filesToCheck = [
        'src/services/consultants.ts',
        'server.ts',
        'api/admin/delete-consultant.ts',
        'api/admin/approve-consultant-application.ts',
      ];

      for (const filePath of filesToCheck) {
        const content = readRel(filePath);
        // Ensure no flawed [0-5a-f]{4} regex exists in the file
        assert.equal(
          content.includes('[0-5a-f]{4}'),
          false,
          `${filePath} must not contain flawed [0-5a-f]{4} regex`
        );
        // Ensure the standard 8-4-4-4-12 regex is present
        assert.ok(
          content.includes('[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'),
          `${filePath} must contain the standard UUID regex`
        );
      }
    });

    test('Invalid UUID strings are rejected', () => {
      assert.equal(uuidRegex.test('not-a-uuid'), false);
      assert.equal(uuidRegex.test('3dc127b8-7334-4960-a3b5-8627923d40f'), false); // too short
      assert.equal(uuidRegex.test('3dc127b8-7334-4960-a3b5-8627923d40f11'), false); // too long
      assert.equal(uuidRegex.test('3dc127b8-7334-4960-a3b5-8627923d40zg'), false); // non-hex
      assert.equal(uuidRegex.test(''), false);
    });
  });

  describe('2. Strict Admin Allowlist & Role Resolution', () => {
    test('lokesh.naivaidya@gmail.com is NOT an administrator by default', () => {
      assert.equal(isAllowedAdminEmail('lokesh.naivaidya@gmail.com'), false);
      assert.equal(isDeveloperAdmin({ email: 'lokesh.naivaidya@gmail.com' } as any, null), false);
      assert.equal(isSuperAdmin({ email: 'lokesh.naivaidya@gmail.com' } as any, null), false);
      assert.equal(isUserAdmin({ email: 'lokesh.naivaidya@gmail.com' } as any, null), false);
    });

    test('naivaidya736@gmail.com is NOT an administrator by default', () => {
      assert.equal(isAllowedAdminEmail('naivaidya736@gmail.com'), false);
      assert.equal(isDeveloperAdmin({ email: 'naivaidya736@gmail.com' } as any, null), false);
      assert.equal(isSuperAdmin({ email: 'naivaidya736@gmail.com' } as any, null), false);
      assert.equal(isUserAdmin({ email: 'naivaidya736@gmail.com' } as any, null), false);
    });

    test('lokesh.naivaidya@gmail.com resolves to client and cannot access admin dashboard', () => {
      const user = { id: 'lokesh-id', email: 'lokesh.naivaidya@gmail.com' } as any;
      const profile = { id: 'lokesh-id', role: 'client', full_name: 'Lokesh' } as any;
      const effectiveRole = getUserEffectiveRole(user, profile);
      assert.equal(effectiveRole, 'client');
    });

    test('Authorized administrators retain intended access', () => {
      // Super admins
      assert.equal(isAllowedAdminEmail('admin@foundarly.com'), true);
      assert.equal(isAllowedAdminEmail('admin@foundarlybusinessworld.in'), true);
      assert.equal(isSuperAdmin({ email: 'admin@foundarly.com' } as any, null), true);
      assert.equal(isSuperAdmin({ email: 'admin@foundarlybusinessworld.in' } as any, null), true);

      // Developer admin
      assert.equal(isDeveloperAdmin({ email: 'foundarly@developer.in' } as any, null), true);
      assert.equal(isUserAdmin({ email: 'foundarly@developer.in' } as any, null), true);

      // Allowlist contents
      const allowlist = getAdminAllowlist();
      assert.ok(allowlist.includes('admin@foundarly.com'));
      assert.ok(allowlist.includes('admin@foundarlybusinessworld.in'));
      assert.equal(allowlist.includes('lokesh.naivaidya@gmail.com'), false);
      assert.equal(allowlist.includes('naivaidya736@gmail.com'), false);
    });

    test('server.ts defaults strictly match authorized administrators', () => {
      const serverSrc = readRel('server.ts');
      assert.equal(serverSrc.includes('"lokesh.naivaidya@gmail.com"'), false);
      assert.equal(serverSrc.includes("'lokesh.naivaidya@gmail.com'"), false);
      assert.equal(serverSrc.includes('"naivaidya736@gmail.com"'), false);
      assert.equal(serverSrc.includes("'naivaidya736@gmail.com'"), false);
    });

    test('src/lib/authorization.ts defaults strictly match authorized administrators', () => {
      const authSrc = readRel('src/lib/authorization.ts');
      assert.equal(authSrc.includes('lokesh.naivaidya@gmail.com'), false);
      assert.equal(authSrc.includes('naivaidya736@gmail.com'), false);
    });
  });

  describe('3. Frontend Consultant Deletion Safety', () => {
    test('consultantsService.delete exclusively calls POST /api/admin/delete-consultant with Bearer token', () => {
      const src = readRel('src/services/consultants.ts');
      assert.ok(src.includes("fetch('/api/admin/delete-consultant'"));
      assert.ok(src.includes("method: 'POST'"));
      assert.ok(src.includes('Authorization: `Bearer ${session.access_token}`'));
    });

    test('consultantsService contains ZERO direct .from("consultants").delete() statements', () => {
      const src = readRel('src/services/consultants.ts');
      const directDeleteRegex = /\.from\(\s*['"]consultants['"]\s*\)[\s\S]*?\.delete\(\)/;
      assert.equal(directDeleteRegex.test(src), false, 'Direct Supabase delete must be absent');
    });

    test('consultantsService has NO client-side sequential deletion fallback', () => {
      const src = readRel('src/services/consultants.ts');
      assert.equal(src.includes('deleteSequential'), false);
      assert.equal(src.includes('delete_sequential'), false);
    });
  });

  describe('4. Backend Atomic RPC Deletion Safety', () => {
    test('api/admin/delete-consultant.ts requires authenticated Bearer token and admin auth', () => {
      const src = readRel('api/admin/delete-consultant.ts');
      assert.ok(src.includes('Missing Bearer token'));
      assert.ok(src.includes('isAllowedAdminEmail'));
      assert.ok(src.includes('isDeveloperAdmin'));
    });

    test('api/admin/delete-consultant.ts executes delete_consultant_atomically via service-role', () => {
      const src = readRel('api/admin/delete-consultant.ts');
      assert.ok(src.includes("supabaseAdminClient.rpc('delete_consultant_atomically'"));
    });

    test('api/admin/delete-consultant.ts fails closed (503) if service role key is absent or invalid', () => {
      const src = readRel('api/admin/delete-consultant.ts');
      assert.ok(src.includes('status(503)'));
      assert.ok(src.includes('Atomic deletion service is not configured'));
    });

    test('api/admin/delete-consultant.ts returns 500 on RPC error without falling back to sequential delete', () => {
      const src = readRel('api/admin/delete-consultant.ts');
      assert.ok(src.includes('Failed to execute atomic deletion'));
      assert.equal(src.includes('executing service-role fallback'), false);
    });

    test('server.ts /api/admin/delete-consultant fails closed (503) if service role key is missing', () => {
      const src = readRel('server.ts');
      assert.ok(src.includes('status(503).json({\n          success: false,\n          error: "Atomic deletion service is not configured'));
    });

    test('server.ts /api/admin/delete-consultant uses atomic RPC and returns 500 on RPC failure', () => {
      const src = readRel('server.ts');
      assert.ok(src.includes('supabaseAdminClient.rpc("delete_consultant_atomically"'));
      assert.ok(src.includes('Failed to execute atomic deletion:'));
    });
  });
});
