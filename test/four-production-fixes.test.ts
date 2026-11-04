import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import { getConsultantAvatar } from '../src/utils/avatar.js';
import { isSuperAdmin, isUserAdmin, getAdminAllowlist } from '../src/lib/authorization.js';

describe('Four Core Production Problems Validation', () => {
  it('1. /admin authentication: allowlisted admin email is immediately recognized without demotion', () => {
    const allowlist = getAdminAllowlist();
    assert.ok(allowlist.includes('admin@foundarly.com'));
    assert.ok(allowlist.includes('lokesh.naivaidya@gmail.com'));

    // Even if profile in DB had default 'client' role, allowlisted user is recognized as Super Admin
    const adminUser = { id: 'admin-uuid-1', email: 'admin@foundarly.com' };
    const clientProfile = { id: 'admin-uuid-1', role: 'client', full_name: 'Admin User' };

    assert.equal(isSuperAdmin(adminUser as any, clientProfile as any), true);
    assert.equal(isUserAdmin(adminUser as any, clientProfile as any), true);

    // Regular client is NOT admin
    const regularUser = { id: 'reg-uuid-1', email: 'client@example.com' };
    assert.equal(isSuperAdmin(regularUser as any, clientProfile as any), false);
    assert.equal(isUserAdmin(regularUser as any, clientProfile as any), false);
  });

  it('2. Manage Consultants: avatar assets exist, are valid uncorrupted files, and fallbacks resolve', () => {
    assert.equal(getConsultantAvatar(null, 'female'), '/female-default.jpg');
    assert.equal(getConsultantAvatar(null, 'male'), '/male-default.png');
    assert.equal(getConsultantAvatar('', 'female'), '/female-default.jpg');

    // Verify files physically exist in public/
    assert.ok(fs.existsSync('public/female-default.jpg'));
    assert.ok(fs.existsSync('public/male-default.png'));
    assert.ok(fs.existsSync('public/female-default.svg'));
    assert.ok(fs.existsSync('public/male-default.svg'));

    // Verify binary magic numbers (no UTF-8 replacement character corruption ef bf bd)
    const maleBuf = fs.readFileSync('public/male-default.png');
    // PNG signature: 137, 80, 78, 71 (0x89, 'P', 'N', 'G')
    assert.equal(maleBuf[0], 0x89);
    assert.equal(maleBuf[1], 0x50);
    assert.equal(maleBuf[2], 0x4e);
    assert.equal(maleBuf[3], 0x47);

    const femaleBuf = fs.readFileSync('public/female-default.jpg');
    // Check it is a valid image buffer
    assert.ok(femaleBuf.length > 500);
    assert.notEqual(femaleBuf[0], 0xef, 'Must not be corrupted with UTF-8 replacement byte 0xEF');
  });

  it('3. Official Foundarly logo: exact uploaded image is served from a content-hashed asset', () => {
    assert.ok(fs.existsSync('public/brand/foundarly-official-logo-4a1d5c88.jpg'));
    assert.ok(fs.existsSync('public/logo.png'));
    assert.ok(!fs.existsSync('public/logo.svg'), 'legacy black monogram SVG must be removed');
    assert.ok(!fs.existsSync('public/logo-mark.svg'), 'legacy logo mark must be removed');

    const logo = fs.readFileSync('public/brand/foundarly-official-logo-4a1d5c88.jpg');
    // JPEG SOI marker and a real photographic-size payload.
    assert.equal(logo[0], 0xff);
    assert.equal(logo[1], 0xd8);
    assert.ok(logo.length > 10_000);
  });

  it('4. /apply-consultant: authoritative API + shared core submit normalized applications', async () => {
    const { submitConsultantApplication, resetConsultantApplicationIdempotencyStore } = await import(
      '../src/server/consultantApplicationCore.js'
    );
    resetConsultantApplicationIdempotencyStore();

    const payload = {
      name: 'Automated Test Applicant',
      email: 'automated.test@example.com',
      phone: '+919999988888',
      whatsapp: '+919999988888',
      age: 32,
      gender: 'female',
      qualification: 'Chartered Accountant (CA)',
      current_job: 'Senior Financial Advisor',
      location: 'New Delhi',
      experience: 'Eight years advising founders on financial planning and compliance.',
      preferred_session_timing: 'Morning (8 AM – 12 PM)',
      linkedin_url: 'https://linkedin.com/in/automated-test',
    };

    let inserted: any = null;
    const fakeClient: any = {
      from() {
        return {
          insert(record: any) {
            inserted = record;
            const query: any = {
              abortSignal() {
                return query;
              },
              then(resolve: any) {
                return Promise.resolve({ error: null }).then(resolve);
              },
            };
            return query;
          },
        };
      },
    };

    const result = await submitConsultantApplication({
      client: fakeClient,
      raw: payload,
      requestId: 'four-fixes-test-0001',
      timeoutMs: 500,
    });

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.status, 201);
    assert.equal(inserted.status, 'pending');
    assert.equal(inserted.email, 'automated.test@example.com');

    // The deployed production path must be the serverless function, not the
    // old 404-ing request or the browser's direct database fallback.
    assert.ok(fs.existsSync('api/consultant-applications.ts'));
    const service = fs.readFileSync('src/services/consultantApplications.ts', 'utf8');
    assert.ok(service.includes("fetch('/api/consultant-applications'"));
    assert.ok(!service.includes('falling back to direct DB insert'));
  });
});
