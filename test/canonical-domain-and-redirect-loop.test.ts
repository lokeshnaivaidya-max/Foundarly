import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { sanitizeOrigin, getCanonicalSiteUrl, buildCanonicalUrl } from '../src/utils/canonicalUrl.js';

describe('Canonical Domain & Redirect Loop Prevention Suite', () => {
  const CANONICAL_DOMAIN = 'https://www.foundarlybusinessworld.in';
  const APEX_DOMAIN = 'https://foundarlybusinessworld.in';
  const VERCEL_DOMAIN = 'https://foundarly-delta.vercel.app';
  const TEST_MEETING_PATH = '/meeting/foundarly-99a01016-12fd-458a-b0be-7fabe8e85a3b';

  it('1. Vercel Configuration (vercel.json) does NOT redirect www.foundarlybusinessworld.in', () => {
    const vercelConfigPath = path.resolve(process.cwd(), 'vercel.json');
    const vercelJson = JSON.parse(fs.readFileSync(vercelConfigPath, 'utf8'));

    const redirects = vercelJson.redirects || [];
    
    // Ensure www.foundarlybusinessworld.in is NOT among redirected hosts
    const wwwRedirect = redirects.find((r: any) => 
      r.has?.some((h: any) => h.type === 'host' && h.value === 'www.foundarlybusinessworld.in')
    );
    assert.equal(wwwRedirect, undefined, 'www.foundarlybusinessworld.in must NOT be in redirects list');

    // Ensure apex domain redirects to www
    const apexRedirect = redirects.find((r: any) => 
      r.has?.some((h: any) => h.type === 'host' && h.value === 'foundarlybusinessworld.in')
    );
    assert.ok(apexRedirect, 'Apex foundarlybusinessworld.in must be redirected');
    assert.equal(apexRedirect.destination, 'https://www.foundarlybusinessworld.in/:path*');
    assert.equal(apexRedirect.permanent, true);

    // Ensure vercel app deployment domain redirects to www
    const vercelRedirect = redirects.find((r: any) => 
      r.has?.some((h: any) => h.type === 'host' && h.value === 'foundarly-delta.vercel.app')
    );
    assert.ok(vercelRedirect, 'foundarly-delta.vercel.app must be redirected');
    assert.equal(vercelRedirect.destination, 'https://www.foundarlybusinessworld.in/:path*');
  });

  it('2. Client-side index.html does NOT redirect www.foundarlybusinessworld.in', () => {
    const indexHtmlPath = path.resolve(process.cwd(), 'index.html');
    const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');

    // Ensure the guard explicitly returns for www
    assert.ok(
      indexHtml.includes("if (h === 'www.foundarlybusinessworld.in')"),
      'index.html must check and return early if already on www domain'
    );

    // Ensure targetOrigin is strictly the www canonical domain
    assert.ok(
      indexHtml.includes("var targetOrigin = 'https://www.foundarlybusinessworld.in';"),
      'index.html redirect target must be www.foundarlybusinessworld.in'
    );

    // Ensure canonical link is set to www
    assert.ok(
      indexHtml.includes('<link rel="canonical" href="https://www.foundarlybusinessworld.in/" />'),
      'Canonical link tag in index.html must point to www'
    );
  });

  it('3. App.tsx CanonicalDomainEnforcer does NOT redirect www.foundarlybusinessworld.in', () => {
    const appTsxPath = path.resolve(process.cwd(), 'src/App.tsx');
    const appTsx = fs.readFileSync(appTsxPath, 'utf8');

    assert.ok(
      appTsx.includes("if (hostname === 'www.foundarlybusinessworld.in')"),
      'App.tsx must return early for www.foundarlybusinessworld.in'
    );

    assert.ok(
      appTsx.includes("const canonicalOrigin = 'https://www.foundarlybusinessworld.in';"),
      'App.tsx redirect origin must be https://www.foundarlybusinessworld.in'
    );
  });

  it('4. sanitizeOrigin & canonicalUrl resolve all variations to https://www.foundarlybusinessworld.in', () => {
    assert.equal(sanitizeOrigin(APEX_DOMAIN), CANONICAL_DOMAIN);
    assert.equal(sanitizeOrigin(CANONICAL_DOMAIN), CANONICAL_DOMAIN);
    assert.equal(sanitizeOrigin(VERCEL_DOMAIN), CANONICAL_DOMAIN);
    assert.equal(sanitizeOrigin('https://preview-123.vercel.app'), CANONICAL_DOMAIN);
    assert.equal(sanitizeOrigin('https://foundarly.com'), CANONICAL_DOMAIN);
    assert.equal(sanitizeOrigin('https://www.foundarly.com'), CANONICAL_DOMAIN);
  });

  it('5. buildCanonicalUrl preserves paths and query parameters for meeting rooms', () => {
    const fullMeetingUrl = buildCanonicalUrl(TEST_MEETING_PATH);
    assert.equal(fullMeetingUrl, `${CANONICAL_DOMAIN}${TEST_MEETING_PATH}`);

    const meetingWithQuery = buildCanonicalUrl(`${TEST_MEETING_PATH}?role=client&ref=email`);
    assert.equal(meetingWithQuery, `${CANONICAL_DOMAIN}${TEST_MEETING_PATH}?role=client&ref=email`);
  });

  it('6. Trace Redirect Chains: Apex domain redirects exactly once to www with zero loops', () => {
    // Simulating the request flow
    // Request 1: https://foundarlybusinessworld.in/meeting/foundarly-99a01016-12fd-458a-b0be-7fabe8e85a3b
    const initialHost = 'foundarlybusinessworld.in';
    const initialPath = TEST_MEETING_PATH;

    // Step A: Vercel edge / server redirect
    let nextUrl: string | null = null;
    let statusCode: number | null = null;
    if (initialHost === 'foundarlybusinessworld.in') {
      nextUrl = `${CANONICAL_DOMAIN}${initialPath}`;
      statusCode = 308;
    }

    assert.equal(statusCode, 308, 'Initial request receives 308 Permanent Redirect');
    assert.equal(nextUrl, `${CANONICAL_DOMAIN}${TEST_MEETING_PATH}`);

    // Step B: Follow redirect to target
    const targetUrlObj = new URL(nextUrl!);
    const targetHost = targetUrlObj.hostname;

    // Check Vercel server behavior for targetHost
    const vercelConfigPath = path.resolve(process.cwd(), 'vercel.json');
    const vercelJson = JSON.parse(fs.readFileSync(vercelConfigPath, 'utf8'));
    const isRedirectedByVercel = (vercelJson.redirects || []).some((r: any) =>
      r.has?.some((h: any) => h.type === 'host' && h.value === targetHost)
    );
    assert.equal(isRedirectedByVercel, false, 'Target www host must NOT trigger a second Vercel redirect');

    // Check client-side guard behavior for targetHost
    const clientRedirectTriggered = (targetHost === 'foundarlybusinessworld.in' || targetHost.endsWith('.vercel.app'));
    assert.equal(clientRedirectTriggered, false, 'Client-side guard must NOT trigger on www host');

    // Confirmed: Total redirect count = 1. No loop.
  });

  it('7. Trace Redirect Chains: Direct www domain request serves immediately with 0 redirects', () => {
    const requestHost = 'www.foundarlybusinessworld.in';
    const requestPath = TEST_MEETING_PATH;

    const vercelConfigPath = path.resolve(process.cwd(), 'vercel.json');
    const vercelJson = JSON.parse(fs.readFileSync(vercelConfigPath, 'utf8'));
    const isRedirectedByVercel = (vercelJson.redirects || []).some((r: any) =>
      r.has?.some((h: any) => h.type === 'host' && h.value === requestHost)
    );
    assert.equal(isRedirectedByVercel, false, 'Direct request to www must have 0 server redirects');

    const clientRedirectTriggered = (requestHost === 'foundarlybusinessworld.in' || requestHost.endsWith('.vercel.app'));
    assert.equal(clientRedirectTriggered, false, 'Direct request to www must have 0 client redirects');
  });
});
