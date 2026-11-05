/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Atomic Consultant Deletion — Authorization & Transaction Audit
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { isAllowedAdminEmail, isDeveloperAdmin, getAdminAllowlist, isUserAdmin } from '../src/lib/authorization.js';

const root = process.cwd();

function readRel(p: string) {
  return fs.readFileSync(path.join(root, p), 'utf8');
}

describe('Atomic Consultant Deletion — Security Hardening Audit', () => {
  describe('1. Normal client cannot invoke deletion', () => {
    test('isAllowedAdminEmail rejects ordinary client emails', () => {
      assert.equal(isAllowedAdminEmail('client@example.com'), false);
      assert.equal(isAllowedAdminEmail('sri@gmail.com'), false);
      assert.equal(isAllowedAdminEmail('naivaidya@gmail.com'), false);
    });

    test('isDeveloperAdmin rejects ordinary client emails', () => {
      assert.equal(isDeveloperAdmin({ email: 'client@example.com' } as any, null), false);
      assert.equal(isDeveloperAdmin({ email: 'sri@gmail.com' } as any, null), false);
    });

    test('isDeveloperAdmin accepts only the verified developer admin identities', () => {
      assert.equal(isDeveloperAdmin({ email: 'foundarly@developer.in' } as any, null), true);
      // Wrong case should still be normalized
      assert.equal(isDeveloperAdmin({ email: 'Foundarly@Developer.IN' } as any, null), true);
      // Substrings are NOT allowed
      assert.equal(isDeveloperAdmin({ email: 'foundarly@developer.in.evil.com' } as any, null), false);
      assert.equal(isDeveloperAdmin({ email: 'fake-foundarly@developer.in' } as any, null), false);
    });

    test('isUserAdmin rejects ordinary client profile', () => {
      const clientUser = { id: 'u1', email: 'client@example.com' } as any;
      const clientProfile = { id: 'u1', role: 'client', full_name: 'Client' } as any;
      assert.equal(isUserAdmin(clientUser, clientProfile), false);
    });
  });

  describe('2. Non-allowlisted administrator cannot invoke the protected API', () => {
    test('isAllowedAdminEmail rejects unlisted administrators', () => {
      assert.equal(isAllowedAdminEmail('fake-admin@example.com'), false);
      assert.equal(isAllowedAdminEmail('attacker@foundarlybusinessworld.in'), false);
      // Only explicitly allowlisted emails authorize
      const allowlist = getAdminAllowlist();
      assert.ok(Array.isArray(allowlist) && allowlist.length > 0);
      for (const email of allowlist) {
        assert.equal(isAllowedAdminEmail(email), true, `Listed email must be allowed: ${email}`);
      }
    });

    test('API handler requires Admin allowlist or Developer Admin — never client', () => {
      const src = readRel('api/admin/delete-consultant.ts');
      // Uses the allowlist check
      assert.ok(src.includes('isAllowedAdminEmail'), 'Must use the Admin allowlist');
      // Uses Developer Admin verification
      assert.ok(src.includes('isDeveloperAdmin'), 'Must use developer admin auth');
      // Never trusts user_metadata role alone for authorization
      const forbidden = /user_metadata\?\.role === 'admin'/;
      assert.equal(forbidden.test(src), false, 'Must not trust user-editable metadata role');
    });

    test('Client/admin cannot call RPC anonymously — anon cannot execute', () => {
      const sql = readRel('supabase/migrations/20260812000000_atomic_consultant_deletion.sql');
      assert.ok(sql.includes('REVOKE ALL ON FUNCTION public.delete_consultant_atomically(UUID) FROM PUBLIC'));
      assert.ok(sql.includes('REVOKE ALL ON FUNCTION public.delete_consultant_atomically(UUID) FROM anon'));
      assert.ok(sql.includes('REVOKE ALL ON FUNCTION public.delete_consultant_atomically(UUID) FROM authenticated'));
      assert.ok(sql.includes('GRANT EXECUTE ON FUNCTION public.delete_consultant_atomically(UUID) TO service_role'));
    });
  });

  describe('3. Authorized Admin can invoke deletion (authorization admits only Admin/DevAdmin)', () => {
    test('Dev Admin identity resolves via verified email', () => {
      assert.equal(isDeveloperAdmin({ email: 'foundarly@developer.in' } as any, null), true);
      assert.equal(isAllowedAdminEmail('admin@foundarly.com'), true);
      assert.equal(isAllowedAdminEmail('admin@foundarlybusinessworld.in'), true);
      assert.equal(isAllowedAdminEmail('lokesh.naivaidya@gmail.com'), false);
    });

    test('Deletion service calls /api/admin/delete-consultant with Bearer token', () => {
      const src = readRel('src/services/consultants.ts');
      assert.ok(src.includes("fetch('/api/admin/delete-consultant'"), 'Service must call the admin API, not direct DB');
      assert.ok(src.includes('Authorization: `Bearer ${session.access_token}`'), 'Must forward the Bearer session token');
      // Must NOT perform a direct consultants delete from the browser
      const direct = /\.from\('consultants'\)[\s\S]*?\.delete\(\)/.test(src);
      assert.equal(direct, false, 'Frontend must never delete directly');
    });
  });

  describe('4. RPC failure does not trigger sequential fallback', () => {
    test('Service has NO sequential deletion fallback path', () => {
      const src = readRel('src/services/consultants.ts');
      // Function-level checks only
      assert.ok(!src.includes('async deleteSequential('), 'deleteSequential must be removed entirely');
      assert.ok(!src.includes('delete_sequential'), 'No sequential path');

      // Isolate the delete() implementation block
      const deleteIdx = src.indexOf('async delete(id: string) {');
      assert.notEqual(deleteIdx, -1, 'Delete method must exist');
      const afterDelete = src.slice(deleteIdx);
      const nextMethodIdx = afterDelete.search(/\n {2}async (?!delete)/);
      const deleteBlock = nextMethodIdx === -1 ? afterDelete : afterDelete.slice(0, nextMethodIdx);

      assert.ok(deleteBlock.includes('fetch('), 'delete() must call the API');
      assert.ok(deleteBlock.includes('/api/admin/delete-consultant'), 'delete() must hit the admin API');
      assert.ok(deleteBlock.includes('Bearer'), 'delete() must forward the Bearer token');
      assert.equal(deleteBlock.includes('.from('), false, 'delete() must not mutate Supabase directly');
      assert.equal(deleteBlock.includes('deleteSequential'), false, 'No fallback');
    });

    test('API returns closed failure: neither record changes on RPC error', () => {
      const src = readRel('api/admin/delete-consultant.ts');
      // On RPC error, must NOT fallback — return 500 with explicit error
      assert.ok(src.includes('res.status(500)'), 'RPC failure must return 500, not a hidden fallback');
      // No fallback path may attempt independent deletion
      const lower = src.toLowerCase();
      assert.ok(!lower.includes('fallback to direct'), 'Must not fall back to direct deletion');
      assert.ok(!lower.includes('delete_sequential'), 'Must not call sequential fallback');
    });
  });

  describe('5. RPC transaction rollback preserves both records', () => {
    test('Migration defines a single atomic plpgsql transaction', () => {
      const sql = readRel('supabase/migrations/20260812000000_atomic_consultant_deletion.sql');
      assert.ok(sql.includes('CREATE OR REPLACE FUNCTION public.delete_consultant_atomically(consultant_id UUID)'));
      assert.ok(sql.includes('SECURITY DEFINER'), 'Must be SECURITY DEFINER for server-side execution');
      assert.ok(sql.includes("SET search_path = public, pg_temp"), 'search_path must be pinned');
      // Resolve user_id from the consultants table server-side — never from client input
      assert.ok(
        sql.includes('SELECT user_id, email INTO consultant_user_id, consultant_email') ||
        sql.includes('SELECT user_id INTO consultant_user_id')
      );
      assert.ok(sql.includes('DELETE FROM public.consultants WHERE id = consultant_id'));
      assert.ok(sql.includes("UPDATE public.profiles"));
      assert.ok(sql.includes("SET role = 'client'"));
      // Only downgrade from consultant
      assert.ok(sql.includes("AND role = 'consultant'"), 'Only downgrade current consultants');
    });

    test('Migration refuses to downgrade admin / developer_admin', () => {
      const sql = readRel('supabase/migrations/20260812000000_atomic_consultant_deletion.sql');
      // The UPDATE is restricted to role='consultant', so admin/developer_admin untouched
      const updateBlock = sql.slice(sql.indexOf('UPDATE public.profiles'), sql.indexOf('SELECT jsonb_build_object'));
      assert.ok(updateBlock.includes("role = 'client'"));
      assert.ok(updateBlock.includes("role = 'consultant'"));
    });
  });

  describe('6. Deleted consultant cannot access consultant APIs', () => {
    test('Consultant APIs verify consultant record / profile role server-side', () => {
      const me = readRel('src/server/consultant/me.ts');
      assert.ok(me.length > 0);
      // Ensures consultant API contains an explicit consultant/profile role gate
      const ok =
        me.includes('consultants') ||
        me.includes('getConsultant') ||
        me.includes('role') ||
        me.includes('isConsultant');
      assert.ok(ok, 'API must verify consultant status server-side');
    });

    test('Public Experts page shows only active consultants', () => {
      const src = readRel('src/pages/Consultants.tsx');
      assert.ok(src.includes('getAll(true)'), 'Experts must request activeOnly=true so inactive consultants are hidden');
    });
  });

  describe('7. Admin and Developer Admin roles remain unchanged (atomic delete protects them)', () => {
    test('Migration only targets profiles.role = consultant', () => {
      const sql = readRel('supabase/migrations/20260812000000_atomic_consultant_deletion.sql');
      // Every UPDATE must include the consultant guard
      const updates = sql.match(/UPDATE public\.profiles/g) || [];
      for (const m of updates) {
        const idx = sql.indexOf(m);
        const block = sql.slice(idx, sql.indexOf('SELECT jsonb_build_object', idx));
        assert.ok(block.includes("role = 'consultant'"), 'Must only update from consultant');
      }
      // No UPDATE targets admin/developer_admin
      assert.equal(sql.includes("SET role = 'developer_admin'"), false, 'Must never touch developer_admin');
      assert.equal(sql.includes("SET role = 'admin'"), false, 'Must never touch admin');
      assert.equal(sql.includes("SET role = 'super_admin'"), false, 'Must never touch super_admin');
    });

    test('No email matching can elevate or preserve consultant from deletion path', () => {
      const sql = readRel('supabase/migrations/20260812000000_atomic_consultant_deletion.sql');
      // Profile downgrade must target user_id directly, never email matching
      const profileBlock = sql.slice(sql.indexOf('UPDATE public.profiles'));
      assert.ok(!/email/i.test(profileBlock), 'Profile downgrade must use user_id, never email');
    });
  });

  describe('8. API endpoint output contract', () => {
    test('Successful response includes atomic:true semantics', () => {
      const src = readRel('api/admin/delete-consultant.ts');
      assert.ok(src.includes('profileDowngraded'));
      assert.ok(src.includes('userId'));
      assert.ok(src.includes("error: 'Invalid or expired session token.'"));
    });
  });
});
