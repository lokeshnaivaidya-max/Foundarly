import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {
  submitConsultantApplication,
  resetConsultantApplicationIdempotencyStore,
  type SubmitConsultantApplicationResult,
} from '../src/server/consultantApplicationCore.js';
import {
  normalizeConsultantApplication,
  maskApplicationEmail,
} from '../src/lib/consultantApplicationValidation.js';
import { resolveBrandLogoUrl, OFFICIAL_LOGO_URL } from '../src/lib/brand.js';

const VALID_APPLICATION = {
  name: 'Ananya Sharma',
  email: 'ananya.sharma@example.com',
  phone: '+91 98765 43210',
  whatsapp: '+91 98765 43210',
  age: 34,
  gender: 'female',
  qualification: 'MBA, Finance',
  current_job: 'Founder at Northstar Advisory',
  location: 'Bengaluru, India',
  experience: 'Twelve years advising early-stage founders on fundraising and go-to-market strategy.',
  preferred_session_timing: 'Morning (8 AM – 12 PM)',
  linkedin_url: 'https://linkedin.com/in/ananya-sharma',
};

const OFFICIAL_LOGO_SHA256 = '4A1D5C887016AEFA2720717B08D2768E121D54AA6923D4166D8D90621FF98D2E';

interface FakeInsertOptions {
  error?: { code?: string; message?: string; details?: string; hint?: string } | null;
  hangUntilAbort?: boolean;
}

/**
 * Minimal fake of the Supabase query builder used by the shared submission
 * core. It reproduces the parts that matter for these tests: insert payload
 * capture, abortSignal wiring, and the `{ error }` result contract.
 */
function createFakeClient(options: FakeInsertOptions = {}) {
  const inserts: any[] = [];

  const client = {
    from(table: string) {
      assert.equal(table, 'consultant_applications');
      return {
        insert(payload: any) {
          inserts.push(payload);
          let rejectAborted: ((error: Error) => void) | null = null;

          const promise = new Promise<{ error: any }>((resolve, reject) => {
            if (options.hangUntilAbort) {
              rejectAborted = reject;
              return;
            }
            resolve({ error: options.error ?? null });
          });

          const query: any = {
            abortSignal(signal: AbortSignal) {
              if (options.hangUntilAbort) {
                signal.addEventListener('abort', () => {
                  const abortError = new Error('The operation was aborted');
                  abortError.name = 'AbortError';
                  rejectAborted?.(abortError);
                });
              }
              return query;
            },
            then(resolve: any, reject: any) {
              return promise.then(resolve, reject);
            },
            catch(reject: any) {
              return promise.catch(reject);
            },
          };

          return query;
        },
      };
    },
  };

  return { client: client as any, inserts };
}

function submit(
  client: any,
  raw: unknown = VALID_APPLICATION,
  overrides: Partial<Parameters<typeof submitConsultantApplication>[0]> = {},
): Promise<SubmitConsultantApplicationResult> {
  return submitConsultantApplication({
    client,
    raw,
    requestId: 'test-request-0001',
    timeoutMs: 500,
    ...overrides,
  });
}

describe('Consultant application submission', () => {
  beforeEach(() => resetConsultantApplicationIdempotencyStore());

  it('accepts a valid application and inserts the normalized record', async () => {
    const { client, inserts } = createFakeClient();
    const result = await submit(client);

    assert.equal(result.ok, true);
    if (!result.ok) return;

    assert.equal(result.status, 201);
    assert.equal(result.duplicate, false);
    assert.match(result.applicationId, /^[0-9a-f-]{36}$/i);
    assert.equal(inserts.length, 1);
    assert.equal(inserts[0].email, 'ananya.sharma@example.com');
    assert.equal(inserts[0].status, 'pending');
    assert.equal(inserts[0].whatsapp, '+91 98765 43210');
  });

  it('rejects an invalid payload without touching the database', async () => {
    const { client, inserts } = createFakeClient();
    const result = await submit(client, {
      name: '',
      email: 'not-an-email',
      phone: '123',
      age: 12,
      gender: 'other',
      preferred_session_timing: '',
    });

    assert.equal(result.ok, false);
    if (result.ok) return;

    assert.equal(result.status, 400);
    assert.equal(result.code, 'VALIDATION_ERROR');
    assert.ok(result.issues && result.issues.length >= 5);
    assert.deepEqual(
      result.issues!.map((issue) => issue.field).sort(),
      ['age', 'email', 'experience', 'gender', 'location', 'name', 'phone', 'preferred_session_timing', 'qualification', 'current_job', 'whatsapp'].sort(),
    );
    assert.equal(inserts.length, 0);
  });

  it('returns an actionable 503 when the database rejects the insert with an RLS error', async () => {
    const { client } = createFakeClient({
      error: { code: '42501', message: 'new row violates row-level security policy' },
    });
    const result = await submit(client);

    assert.equal(result.ok, false);
    if (result.ok) return;

    assert.equal(result.status, 503);
    assert.equal(result.code, 'APPLICATION_STORAGE_UNAVAILABLE');
    assert.match(result.error, /temporarily unavailable/i);
  });

  it('maps a NOT NULL constraint failure to a schema-mismatch message', async () => {
    const { client } = createFakeClient({
      error: { code: '23502', message: 'null value in column "qualification" violates not-null constraint' },
    });
    const result = await submit(client);

    assert.equal(result.ok, false);
    if (result.ok) return;

    assert.equal(result.status, 500);
    assert.equal(result.code, 'APPLICATION_SCHEMA_MISMATCH');
  });

  it('times out with a 504 instead of hanging forever, then recovers on retry', async () => {
    const slow = createFakeClient({ hangUntilAbort: true });
    const timedOut = await submit(slow.client, VALID_APPLICATION, { timeoutMs: 25 });

    assert.equal(timedOut.ok, false);
    if (timedOut.ok) return;

    assert.equal(timedOut.status, 504);
    assert.equal(timedOut.code, 'SUBMISSION_TIMEOUT');
    assert.match(timedOut.error, /contact support/i);

    // A failed timeout must not poison the idempotency store: the applicant can
    // safely retry and the retry is stored normally.
    const healthy = createFakeClient();
    const recovered = await submit(healthy.client, VALID_APPLICATION, {
      idempotencyKey: 'retry-after-timeout',
    });

    assert.equal(recovered.ok, true);
    if (!recovered.ok) return;
    assert.equal(recovered.status, 201);
  });

  it('deduplicates an accidental double submission with the same idempotency key', async () => {
    const { client, inserts } = createFakeClient();
    const options = { idempotencyKey: 'double-click-1' };

    const first = await submit(client, VALID_APPLICATION, options);
    const second = await submit(client, VALID_APPLICATION, options);

    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    if (!first.ok || !second.ok) return;

    assert.equal(first.status, 201);
    assert.equal(first.duplicate, false);
    assert.equal(second.status, 200);
    assert.equal(second.duplicate, true);
    assert.equal(second.applicationId, first.applicationId);
    assert.equal(inserts.length, 1);
  });

  it('deduplicates identical payloads without an explicit key (browser retry)', async () => {
    const { client, inserts } = createFakeClient();

    const first = await submit(client);
    const second = await submit(client);

    assert.equal(first.ok && second.ok, true);
    if (!first.ok || !second.ok) return;
    assert.equal(second.duplicate, true);
    assert.equal(inserts.length, 1);
  });

  it('normalizes trimming and defaulting rules deterministically', () => {
    const result = normalizeConsultantApplication({
      ...VALID_APPLICATION,
      name: '  Ananya Sharma  ',
      email: '  ANANYA.SHARMA@EXAMPLE.COM ',
      whatsapp: '',
      linkedin_url: '',
    });

    assert.equal(result.valid, true);
    if (!result.valid) return;
    assert.equal(result.value.name, 'Ananya Sharma');
    assert.equal(result.value.email, 'ananya.sharma@example.com');
    assert.equal(result.value.whatsapp, '+91 98765 43210');
    assert.equal(result.value.linkedin_url, null);
  });

  it('never logs or returns the full applicant email', () => {
    assert.equal(maskApplicationEmail('ananya.sharma@example.com'), 'a***a@example.com');
    assert.equal(maskApplicationEmail(''), '[redacted]');
    assert.equal(maskApplicationEmail(null), '[redacted]');
  });
});

describe('Consultant application admin visibility', () => {
  const migrationPath = 'supabase/migrations/20261104000001_fix_consultant_applications_admin_visibility.sql';

  it('grants read/update/delete to admin, super_admin and developer_admin', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');
    assert.match(sql, /'admin', 'super_admin', 'developer_admin'/);
    assert.match(sql, /FOR SELECT/i);
    assert.match(sql, /FOR UPDATE/i);
    assert.match(sql, /FOR DELETE/i);
    // Public submissions must remain possible without a login.
    assert.match(sql, /FOR INSERT[\s\S]*TO public/i);
  });

  it('admin API verifies a bearer token and an administrative role', () => {
    const authSource = fs.readFileSync('src/server/adminApiAuth.ts', 'utf8');
    assert.match(authSource, /'admin', 'super_admin', 'developer_admin'/);
    assert.match(authSource, /getUser\(token\)/);
    assert.match(authSource, /SUPABASE_SERVICE_ROLE_KEY/);

    const apiSource = fs.readFileSync('api/admin/consultant-applications.ts', 'utf8');
    assert.match(apiSource, /authenticateAdminRequest/);
    assert.match(apiSource, /consultant_applications/);
  });

  it('admin page reads through the service that prefers the authorized API', () => {
    const page = fs.readFileSync('src/pages/admin/AdminConsultantApplications.tsx', 'utf8');
    assert.match(page, /consultantApplicationsService\.getAll/);
    assert.match(page, /consultantApplicationsService\.update/);
    assert.match(page, /consultantApplicationsService\.delete/);

    const service = fs.readFileSync('src/services/consultantApplications.ts', 'utf8');
    assert.match(service, /\/api\/admin\/consultant-applications/);
    assert.match(service, /Authorization: `Bearer \$\{token\}`/);
  });
});

describe('Consultant application API wiring', () => {
  it('ships a real Vercel serverless function for public submissions', () => {
    assert.ok(fs.existsSync('api/consultant-applications.ts'));
    const source = fs.readFileSync('api/consultant-applications.ts', 'utf8');
    assert.match(source, /submitConsultantApplication/);
    assert.match(source, /req\.method !== 'POST'/);
    assert.match(source, /X-Request-Id/);
    assert.match(source, /Idempotency-Key/);
    assert.match(source, /maxDuration/);
  });

  it('browser create() uses the API and no longer falls back to a direct insert', () => {
    const service = fs.readFileSync('src/services/consultantApplications.ts', 'utf8');
    assert.match(service, /fetch\('\/api\/consultant-applications'/);
    assert.match(service, /Idempotency-Key/);
    assert.ok(!/falling back to direct DB insert/i.test(service));
    assert.ok(!/from\('consultant_applications'\)\s*\n?\s*\.insert\(application\)/.test(service));
  });

  it('form guards against double submits and always ends its loading state', () => {
    const page = fs.readFileSync('src/pages/ApplyConsultant.tsx', 'utf8');
    assert.match(page, /submittingRef\.current/);
    assert.match(page, /finally \{[\s\S]*setLoading\(false\)/);
    assert.match(page, /role="alert"/);
  });

  it('Express dev server shares the same submission core and admin routes', () => {
    const source = fs.readFileSync('server.ts', 'utf8');
    assert.match(source, /submitConsultantApplication/);
    assert.match(source, /app\.post\("\/api\/consultant-applications"/);
    assert.match(source, /app\.get\("\/api\/admin\/consultant-applications"/);
    assert.match(source, /app\.patch\("\/api\/admin\/consultant-applications"/);
    assert.match(source, /app\.delete\("\/api\/admin\/consultant-applications"/);
  });
});

describe('Official Foundarly logo', () => {
  it('serves the exact uploaded asset with a content-hashed filename', () => {
    assert.equal(OFFICIAL_LOGO_URL, '/brand/foundarly-official-logo-4a1d5c88.jpg');
    const filePath = `public${OFFICIAL_LOGO_URL}`;
    assert.ok(fs.existsSync(filePath), `${filePath} must exist`);

    const bytes = fs.readFileSync(filePath);
    const hash = crypto.createHash('sha256').update(bytes).digest('hex').toUpperCase();
    assert.equal(hash, OFFICIAL_LOGO_SHA256);
    assert.ok(bytes.length > 10_000);
    // JPEG SOI marker.
    assert.equal(bytes[0], 0xff);
    assert.equal(bytes[1], 0xd8);
  });

  it('normalizes every legacy logo reference to the official image', () => {
    for (const legacy of [
      '/logo.svg',
      '/logo-mark.svg',
      '/logo.png',
      '/foundarly%20logo.jpg',
      'https://www.foundarlybusinessworld.in/foundarly-logo.jpg',
      null,
      '',
    ]) {
      assert.equal(resolveBrandLogoUrl(legacy), OFFICIAL_LOGO_URL);
    }

    const custom = 'https://storage.example.com/tenant/logo.png';
    assert.equal(resolveBrandLogoUrl(custom), custom);
  });

  it('uses the official asset in the navbar, footer, loader, metadata and favicons', () => {
    for (const file of [
      'src/components/Header.tsx',
      'src/components/Footer.tsx',
      'src/components/PageLoader.tsx',
      'src/pages/AdminLogin.tsx',
      'src/pages/Login.tsx',
      'src/pages/ResetPassword.tsx',
      'src/pages/ConsultantDashboard.tsx',
      'src/components/admin/AdminLayout.tsx',
    ]) {
      const source = fs.readFileSync(file, 'utf8');
      assert.match(source, /OFFICIAL_LOGO_URL|resolveBrandLogoUrl/, `${file} must resolve the official logo`);
    }

    const indexHtml = fs.readFileSync('index.html', 'utf8');
    assert.ok(indexHtml.includes('/brand/foundarly-official-logo-4a1d5c88.jpg'));
    assert.ok(!indexHtml.includes('/logo.svg'));
    assert.ok(indexHtml.includes('favicon-32x32.png?v=4a1d5c88'));

    const manifest = JSON.parse(fs.readFileSync('public/site.webmanifest', 'utf8'));
    assert.ok(manifest.icons.every((icon: any) => icon.src.includes('v=4a1d5c88')));
    assert.ok(fs.existsSync('public/favicon.ico'));
    assert.ok(fs.readFileSync('public/favicon-32x32.png').length > 100);
    assert.ok(fs.readFileSync('public/apple-touch-icon.png').length > 100);

    const emailTemplates = fs.readFileSync('src/utils/emailTemplates.ts', 'utf8');
    assert.ok(emailTemplates.includes('/brand/foundarly-official-logo-4a1d5c88.jpg'));
    assert.ok(!emailTemplates.includes('foundarlybusinessworld.in/logo.png'));
  });
});
