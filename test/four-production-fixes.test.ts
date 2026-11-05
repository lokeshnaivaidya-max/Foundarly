import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import { getConsultantAvatar } from '../src/utils/avatar.js';
import { isSuperAdmin, isUserAdmin, getAdminAllowlist } from '../src/lib/authorization.js';

describe('Four Core Production Problems Validation', () => {
  it('1. /admin authentication: allowlisted admin email is immediately recognized without demotion', () => {
    const allowlist = getAdminAllowlist();
    assert.ok(allowlist.includes('admin@foundarly.com'));
    assert.ok(allowlist.includes('admin@foundarlybusinessworld.in'));
    assert.ok(!allowlist.includes('lokesh.naivaidya@gmail.com'));
    assert.ok(!allowlist.includes('jvedtechadmin@gmail.com'));

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

  it('3. Official Foundarly logo: vector SVG contains authentic stylized F emblem and typography', () => {
    assert.ok(fs.existsSync('public/logo.svg'));
    assert.ok(fs.existsSync('public/logo-mark.svg'));

    const svgContent = fs.readFileSync('public/logo.svg', 'utf-8');
    // Must contain the stylized F path from the official branding
    assert.ok(svgContent.includes('160 120 L 350 120'));
    assert.ok(svgContent.includes('Foundarly'));
    assert.ok(svgContent.includes('BUSINESS WORLD'));
  });

  it('4. /apply-consultant: backend endpoint and application creation handles submissions reliably', async () => {
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
      experience: '8 years',
      preferred_session_timing: 'Morning (8 AM – 12 PM)',
      linkedin_url: 'https://linkedin.com/in/automated-test',
    };

    // Test the live API endpoint on port 3000
    const res = await fetch('http://localhost:3000/api/consultant-applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    assert.ok(res.ok || res.status === 201, `Expected 200 or 201, got ${res.status}`);
    const json = await res.json();
    assert.equal(json.success, true);
  });
});
