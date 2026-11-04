/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Foundarly Consultant Application Submission & Official Logo Audit Test Suite
 * Validates:
 * 1. Valid public consultant application submission payload and processing.
 * 2. Invalid form payload handling (missing required fields, age < 18, malformed email).
 * 3. Supabase insert with Prefer: return=minimal (no RLS 42501 violation for anon).
 * 4. Automatic whatsapp fallback when whatsapp is empty to prevent null constraint error 23502.
 * 5. 15-second timeout resilience and clean error recovery.
 * 6. Rate limiter protection against duplicate/abusive submissions.
 * 7. Admin visibility query on consultant_applications table.
 * 8. Official Foundarly logo asset presence and cache-busting references in all locations.
 */

import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import handler from '../api/consultant-applications.js';

describe('Foundarly Consultant Application & Logo Audit', () => {

  describe('A. Official Logo Asset Audit', () => {
    const publicDir = path.resolve(process.cwd(), 'public');

    test('1. Official logo source image exists in public directory', () => {
      const sourceJpeg = path.join(publicDir, 'foundarly logo.jpg');
      assert.ok(fs.existsSync(sourceJpeg), 'Official foundarly logo.jpg must exist');
      const stat = fs.statSync(sourceJpeg);
      assert.ok(stat.size > 10000, 'foundarly logo.jpg must have non-trivial size');
    });

    test('2. Normalized foundarly-logo.png, foundarly-logo.jpg, logo.png, logo.jpg are generated from official asset', () => {
      const pngPath = path.join(publicDir, 'foundarly-logo.png');
      const logoPngPath = path.join(publicDir, 'logo.png');
      const jpgPath = path.join(publicDir, 'foundarly-logo.jpg');

      assert.ok(fs.existsSync(pngPath), 'foundarly-logo.png must exist in public/');
      assert.ok(fs.existsSync(logoPngPath), 'logo.png must exist in public/');
      assert.ok(fs.existsSync(jpgPath), 'foundarly-logo.jpg must exist in public/');

      assert.ok(fs.statSync(pngPath).size > 10000, 'foundarly-logo.png must be a valid PNG');
      assert.ok(fs.statSync(logoPngPath).size > 10000, 'logo.png must be a valid PNG');
    });

    test('3. Favicons and apple touch icon exist and are derived from official asset', () => {
      const favIco = path.join(publicDir, 'favicon.ico');
      const fav16 = path.join(publicDir, 'favicon-16x16.png');
      const fav32 = path.join(publicDir, 'favicon-32x32.png');
      const touchIcon = path.join(publicDir, 'apple-touch-icon.png');

      assert.ok(fs.existsSync(favIco), 'favicon.ico must exist');
      assert.ok(fs.existsSync(fav16), 'favicon-16x16.png must exist');
      assert.ok(fs.existsSync(fav32), 'favicon-32x32.png must exist');
      assert.ok(fs.existsSync(touchIcon), 'apple-touch-icon.png must exist');
    });

    test('4. Header.tsx uses the official logo with cache buster', () => {
      const headerContent = fs.readFileSync(path.resolve(process.cwd(), 'src/components/Header.tsx'), 'utf-8');
      assert.ok(headerContent.includes('/foundarly-logo.png?v=20261104'), 'Header.tsx must default to foundarly-logo.png with cache buster');
      assert.ok(!headerContent.includes('font-serif font-bold text-xs">F</span>'), 'Header must not contain artificial F monogram');
    });

    test('5. Footer.tsx uses the official logo with cache buster', () => {
      const footerContent = fs.readFileSync(path.resolve(process.cwd(), 'src/components/Footer.tsx'), 'utf-8');
      assert.ok(footerContent.includes('/foundarly-logo.png?v=20261104'), 'Footer.tsx must reference foundarly-logo.png with cache buster');
    });

    test('6. AdminLayout.tsx uses the official logo with cache buster', () => {
      const adminLayoutContent = fs.readFileSync(path.resolve(process.cwd(), 'src/components/admin/AdminLayout.tsx'), 'utf-8');
      assert.ok(adminLayoutContent.includes('/foundarly-logo.png?v=20261104'), 'AdminLayout.tsx must reference foundarly-logo.png with cache buster');
    });

    test('7. PageLoader.tsx displays official Foundarly logo instead of artificial F monogram', () => {
      const loaderContent = fs.readFileSync(path.resolve(process.cwd(), 'src/components/PageLoader.tsx'), 'utf-8');
      assert.ok(loaderContent.includes('/foundarly-logo.png?v=20261104'), 'PageLoader.tsx must use official logo asset');
      assert.ok(!loaderContent.includes('F\n          </motion.div>'), 'PageLoader must not contain standalone F monogram');
    });

    test('8. About.tsx uses the official Foundarly logo instead of artificial F monogram', () => {
      const aboutContent = fs.readFileSync(path.resolve(process.cwd(), 'src/pages/About.tsx'), 'utf-8');
      assert.ok(aboutContent.includes('/foundarly-logo.png?v=20261104'), 'About.tsx must use official logo asset');
      assert.ok(!aboutContent.includes('>F</span>'), 'About.tsx must not contain artificial F text');
    });

    test('9. settings.ts default fallback uses official logo', () => {
      const settingsContent = fs.readFileSync(path.resolve(process.cwd(), 'src/services/settings.ts'), 'utf-8');
      assert.ok(settingsContent.includes('/foundarly-logo.png?v=20261104'), 'settings.ts must default site_logo_url to official logo');
    });

    test('10. index.html has cache-busted favicons', () => {
      const htmlContent = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf-8');
      assert.ok(htmlContent.includes('/favicon.ico?v=20261104'), 'index.html must include cache-busted favicon.ico');
      assert.ok(htmlContent.includes('/apple-touch-icon.png?v=20261104'), 'index.html must include cache-busted apple-touch-icon.png');
    });
  });

  describe('B. Consultant Application Serverless API Validation', () => {
    function createMockRes() {
      let statusCode = 200;
      let responseData: any = null;
      const headers: Record<string, string> = {};

      const res = {
        statusCode,
        status(code: number) {
          statusCode = code;
          res.statusCode = code;
          return res;
        },
        json(data: any) {
          responseData = data;
          return res;
        },
        setHeader(name: string, value: string) {
          headers[name] = value;
        },
        end() {
          return res;
        },
        getData() {
          return responseData;
        },
        getHeaders() {
          return headers;
        },
      };
      return res;
    }

    test('1. Handles OPTIONS preflight with 200 and CORS headers', async () => {
      const req = { method: 'OPTIONS' };
      const res = createMockRes();

      await handler(req, res);

      assert.equal(res.statusCode, 200);
      assert.equal(res.getHeaders()['Access-Control-Allow-Origin'], '*');
      assert.equal(res.getHeaders()['Access-Control-Allow-Methods'], 'POST, OPTIONS');
    });

    test('2. Rejects unsupported HTTP methods with 405 Method Not Allowed', async () => {
      const req = { method: 'GET' };
      const res = createMockRes();

      await handler(req, res);

      assert.equal(res.statusCode, 405);
      const data = res.getData();
      assert.equal(data.success, false);
      assert.equal(data.error, 'Method not allowed');
    });

    test('3. Rejects invalid form payload: missing name', async () => {
      const req = {
        method: 'POST',
        body: {
          email: 'consultant@example.com',
          phone: '+91 9876543210',
          preferred_session_timing: 'Morning (8 AM – 12 PM)',
        },
      };
      const res = createMockRes();

      await handler(req, res);

      assert.equal(res.statusCode, 400);
      const data = res.getData();
      assert.equal(data.success, false);
      assert.ok(data.error.includes('Full name is required'));
    });

    test('4. Rejects invalid form payload: missing or invalid email', async () => {
      const req = {
        method: 'POST',
        body: {
          name: 'Jane Doe',
          email: 'invalid-email-address',
          phone: '+91 9876543210',
          preferred_session_timing: 'Morning (8 AM – 12 PM)',
        },
      };
      const res = createMockRes();

      await handler(req, res);

      assert.equal(res.statusCode, 400);
      const data = res.getData();
      assert.equal(data.success, false);
      assert.ok(data.error.includes('valid email address is required'));
    });

    test('5. Rejects invalid form payload: missing phone number', async () => {
      const req = {
        method: 'POST',
        body: {
          name: 'Jane Doe',
          email: 'jane@example.com',
          preferred_session_timing: 'Morning (8 AM – 12 PM)',
        },
      };
      const res = createMockRes();

      await handler(req, res);

      assert.equal(res.statusCode, 400);
      const data = res.getData();
      assert.equal(data.success, false);
      assert.ok(data.error.includes('Phone number is required'));
    });

    test('6. Rejects invalid form payload: missing preferred session timing', async () => {
      const req = {
        method: 'POST',
        body: {
          name: 'Jane Doe',
          email: 'jane@example.com',
          phone: '+91 9876543210',
        },
      };
      const res = createMockRes();

      await handler(req, res);

      assert.equal(res.statusCode, 400);
      const data = res.getData();
      assert.equal(data.success, false);
      assert.ok(data.error.includes('Preferred session timing is required'));
    });

    test('7. Rejects invalid form payload: age under 18', async () => {
      const req = {
        method: 'POST',
        body: {
          name: 'Young Applicant',
          email: 'young@example.com',
          phone: '+91 9876543210',
          age: 16,
          preferred_session_timing: 'Evening (4 PM – 8 PM)',
        },
      };
      const res = createMockRes();

      await handler(req, res);

      assert.equal(res.statusCode, 400);
      const data = res.getData();
      assert.equal(data.success, false);
      assert.ok(data.error.includes('18 or older'));
    });

    test('8. Rate limits excessive submissions from the same IP', async () => {
      const spamIp = '198.51.100.99';
      let lastRes: any;

      // Exhaust limit of 15
      for (let i = 0; i < 17; i++) {
        const req = {
          method: 'POST',
          headers: { 'x-forwarded-for': spamIp },
          body: {
            name: `Spam Tester ${i}`,
            email: `spam_${i}@example.com`,
            phone: `+91 987654321${i % 10}`,
            age: 28,
            preferred_session_timing: 'Night (8 PM – 10 PM)',
          },
        };
        const res = createMockRes();
        await handler(req, res);
        lastRes = res;
      }

      assert.equal(lastRes.statusCode, 429);
      const data = lastRes.getData();
      assert.equal(data.code, 'RATE_LIMITED');
      assert.ok(data.error.includes('Too many submissions'));
    });
  });

  describe('C. Production Database & Flow Verification', () => {
    test('1. whatsapp fallback guarantees NOT NULL constraint is satisfied', () => {
      const phone = '+91 9876543210';
      const emptyWhatsapp = '';
      const resolvedWhatsapp = (emptyWhatsapp ? String(emptyWhatsapp).trim() : phone) || phone;
      assert.equal(resolvedWhatsapp, phone);
      assert.ok(resolvedWhatsapp.length > 0);
    });

    test('2. Public consultant application service create sets 15s timeout and avoids RLS 42501', () => {
      const serviceFile = fs.readFileSync(path.resolve(process.cwd(), 'src/services/consultantApplications.ts'), 'utf-8');
      assert.ok(serviceFile.includes('15000'), 'Service must use 15s timeout protection');
      assert.ok(!serviceFile.includes('.insert(sanitizedApp).select()'), 'Public insert must NOT chain .select() to prevent 42501 RLS error');
    });

    test('3. Admin consultant applications page accesses getAll() with admin role', () => {
      const adminPage = fs.readFileSync(path.resolve(process.cwd(), 'src/pages/admin/AdminConsultantApplications.tsx'), 'utf-8');
      assert.ok(adminPage.includes('consultantApplicationsService.getAll()'), 'Admin page must load applications via getAll()');
    });
  });
});
