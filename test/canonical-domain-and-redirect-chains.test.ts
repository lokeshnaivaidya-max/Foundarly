import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { getCanonicalSiteUrl, buildCanonicalUrl, sanitizeOrigin } from '../src/utils/canonicalUrl.js';
import { normalizeMeetingPath, buildMeetingLoginUrl, isMeetingUrl } from '../src/utils/meetingRedirect.js';

describe('Canonical Domain & Redirect Chain Verification', () => {
  const vercelConfig = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'vercel.json'), 'utf-8'));
  const indexHtml = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf-8');
  const appTsx = fs.readFileSync(path.resolve(process.cwd(), 'src/App.tsx'), 'utf-8');

  describe('1. Vercel Configuration Verification', () => {
    it('does NOT contain any redirect rule matching www.foundarlybusinessworld.in (no loop)', () => {
      const wwwRedirects = (vercelConfig.redirects || []).filter((r: any) =>
        r.has?.some((h: any) => h.type === 'host' && h.value === 'www.foundarlybusinessworld.in')
      );
      assert.equal(wwwRedirects.length, 0, 'www.foundarlybusinessworld.in must serve directly, not redirect');
    });

    it('redirects apex foundarlybusinessworld.in to https://www.foundarlybusinessworld.in/:path*', () => {
      const apexRedirect = (vercelConfig.redirects || []).find((r: any) =>
        r.has?.some((h: any) => h.type === 'host' && h.value === 'foundarlybusinessworld.in')
      );
      assert.ok(apexRedirect, 'Must have a redirect for apex domain');
      assert.equal(apexRedirect.destination, 'https://www.foundarlybusinessworld.in/:path*');
      assert.equal(apexRedirect.permanent, true);
    });

    it('redirects foundarly-delta.vercel.app to https://www.foundarlybusinessworld.in/:path*', () => {
      const vercelHostRedirect = (vercelConfig.redirects || []).find((r: any) =>
        r.has?.some((h: any) => h.type === 'host' && h.value === 'foundarly-delta.vercel.app')
      );
      assert.ok(vercelHostRedirect, 'Must have a redirect for vercel deployment domain');
      assert.equal(vercelHostRedirect.destination, 'https://www.foundarlybusinessworld.in/:path*');
      assert.equal(vercelHostRedirect.permanent, true);
    });

    it('rewrites /meeting/:match* to /index.html for SPA hydration', () => {
      const meetingRewrite = (vercelConfig.rewrites || []).find((r: any) =>
        r.source === '/meeting/:match*' && r.destination === '/index.html'
      );
      assert.ok(meetingRewrite, 'SPA must rewrite /meeting/:match* to /index.html');
    });
  });

  describe('2. index.html Client-Side Canonical Domain Guard', () => {
    it('immediately terminates without redirecting when hostname is www.foundarlybusinessworld.in', () => {
      assert.ok(
        indexHtml.includes("if (h === 'www.foundarlybusinessworld.in')"),
        'Guard must explicitly early return when on canonical www domain'
      );
    });

    it('never redirects www.foundarlybusinessworld.in to apex foundarlybusinessworld.in', () => {
      assert.ok(
        !indexHtml.includes("h === 'www.foundarlybusinessworld.in' || h === 'www.foundarly.com';\n\n          if (isVercelHost || isWwwHost) {\n            var targetOrigin = 'https://foundarlybusinessworld.in'"),
        'Must not contain circular redirect from www to apex'
      );
    });

    it('sets canonical link, OpenGraph, and Twitter tags to https://www.foundarlybusinessworld.in/', () => {
      assert.ok(indexHtml.includes('<link rel="canonical" href="https://www.foundarlybusinessworld.in/" />'));
      assert.ok(indexHtml.includes('<meta property="og:url" content="https://www.foundarlybusinessworld.in/" />'));
      assert.ok(indexHtml.includes('<meta name="twitter:url" content="https://www.foundarlybusinessworld.in/" />'));
    });
  });

  describe('3. App.tsx React CanonicalDomainEnforcer', () => {
    it('immediately terminates without redirecting when hostname is www.foundarlybusinessworld.in', () => {
      assert.ok(
        appTsx.includes("if (hostname === 'www.foundarlybusinessworld.in')"),
        'App.tsx must early return when already on canonical www domain'
      );
    });

    it('redirects apex and preview hosts to https://www.foundarlybusinessworld.in', () => {
      assert.ok(
        appTsx.includes("const canonicalOrigin = 'https://www.foundarlybusinessworld.in';"),
        'App.tsx redirect origin must be www.foundarlybusinessworld.in'
      );
    });
  });

  describe('4. Canonical URL & Meeting Link Preservation', () => {
    it('resolves default canonical site URL to https://www.foundarlybusinessworld.in', () => {
      const url = getCanonicalSiteUrl();
      assert.equal(url, 'https://www.foundarlybusinessworld.in');
    });

    it('normalizes apex domain origin to www.foundarlybusinessworld.in', () => {
      const sanitized = sanitizeOrigin('https://foundarlybusinessworld.in');
      assert.equal(sanitized, 'https://www.foundarlybusinessworld.in');
    });

    it('normalizes Vercel preview domain origin to www.foundarlybusinessworld.in', () => {
      const sanitized = sanitizeOrigin('https://foundarly-delta.vercel.app');
      assert.equal(sanitized, 'https://www.foundarlybusinessworld.in');
    });

    it('builds canonical meeting room URL with correct domain', () => {
      const meetingPath = '/meeting/foundarly-99a01016-12fd-458a-b0be-7fabe8e85a3b';
      const fullUrl = buildCanonicalUrl(meetingPath);
      assert.equal(fullUrl, 'https://www.foundarlybusinessworld.in/meeting/foundarly-99a01016-12fd-458a-b0be-7fabe8e85a3b');
    });

    it('preserves meeting URL path and parameters through meeting login URL generation', () => {
      const targetMeeting = '/meeting/foundarly-99a01016-12fd-458a-b0be-7fabe8e85a3b?rejoin=true&role=client#video';
      assert.equal(isMeetingUrl(targetMeeting), true);
      const normalized = normalizeMeetingPath(targetMeeting);
      assert.equal(normalized, targetMeeting);

      const loginUrl = buildMeetingLoginUrl(targetMeeting);
      assert.ok(loginUrl.includes('redirect=' + encodeURIComponent(targetMeeting)));
      assert.ok(loginUrl.includes('from=' + encodeURIComponent(targetMeeting)));
    });
  });

  describe('5. Complete Redirect Chain Analysis (No Circular Loops)', () => {
    function simulateRedirect(initialUrl: string): string[] {
      const chain: string[] = [initialUrl];
      let current = initialUrl;
      const MAX_HOPS = 10;

      for (let hop = 0; hop < MAX_HOPS; hop++) {
        const parsed = new URL(current);
        const host = parsed.hostname;
        const pathname = parsed.pathname;
        const search = parsed.search;
        const hash = parsed.hash;

        // 1. Simulate Vercel config redirects
        let vercelRedirectTarget: string | null = null;
        for (const rule of vercelConfig.redirects || []) {
          const matchesHost = rule.has?.some((h: any) => h.type === 'host' && h.value === host);
          if (matchesHost) {
            vercelRedirectTarget = rule.destination
              .replace(':path*', pathname.replace(/^\//, '') + search + hash);
            break;
          }
        }

        if (vercelRedirectTarget) {
          chain.push(vercelRedirectTarget);
          current = vercelRedirectTarget;
          continue;
        }

        // 2. Client-side index.html guard
        if (
          host === 'foundarlybusinessworld.in' ||
          host === 'foundarly-delta.vercel.app' ||
          host === 'foundarly.com' ||
          host === 'www.foundarly.com'
        ) {
          const clientTarget = `https://www.foundarlybusinessworld.in${pathname}${search}${hash}`;
          if (clientTarget !== current) {
            chain.push(clientTarget);
            current = clientTarget;
            continue;
          }
        }

        // Terminal state reached: www.foundarlybusinessworld.in serves directly
        if (host === 'www.foundarlybusinessworld.in') {
          break;
        }

        break;
      }

      return chain;
    }

    it('Chain 1: Apex https://foundarlybusinessworld.in redirects exactly once to www and terminates (200 OK)', () => {
      const chain = simulateRedirect('https://foundarlybusinessworld.in/');
      assert.deepEqual(chain, [
        'https://foundarlybusinessworld.in/',
        'https://www.foundarlybusinessworld.in/',
      ]);
      assert.equal(chain.length, 2, 'Must take exactly 1 hop');
    });

    it('Chain 2: www https://www.foundarlybusinessworld.in terminates directly without redirect (200 OK)', () => {
      const chain = simulateRedirect('https://www.foundarlybusinessworld.in/');
      assert.deepEqual(chain, [
        'https://www.foundarlybusinessworld.in/',
      ]);
      assert.equal(chain.length, 1, 'Must serve directly with 0 hops');
    });

    it('Chain 3: Affected meeting link on apex redirects once to www and preserves full room ID (200 OK)', () => {
      const chain = simulateRedirect('https://foundarlybusinessworld.in/meeting/foundarly-99a01016-12fd-458a-b0be-7fabe8e85a3b');
      assert.deepEqual(chain, [
        'https://foundarlybusinessworld.in/meeting/foundarly-99a01016-12fd-458a-b0be-7fabe8e85a3b',
        'https://www.foundarlybusinessworld.in/meeting/foundarly-99a01016-12fd-458a-b0be-7fabe8e85a3b',
      ]);
      assert.equal(chain.length, 2, 'Must take exactly 1 hop and preserve path');
    });

    it('Chain 4: Affected meeting link on www serves directly without any redirect (200 OK)', () => {
      const chain = simulateRedirect('https://www.foundarlybusinessworld.in/meeting/foundarly-99a01016-12fd-458a-b0be-7fabe8e85a3b');
      assert.deepEqual(chain, [
        'https://www.foundarlybusinessworld.in/meeting/foundarly-99a01016-12fd-458a-b0be-7fabe8e85a3b',
      ]);
      assert.equal(chain.length, 1, 'Must serve directly with 0 hops');
    });

    it('Chain 5: Vercel preview domain redirects once to www and terminates (200 OK)', () => {
      const chain = simulateRedirect('https://foundarly-delta.vercel.app/pricing?plan=growth');
      assert.deepEqual(chain, [
        'https://foundarly-delta.vercel.app/pricing?plan=growth',
        'https://www.foundarlybusinessworld.in/pricing?plan=growth',
      ]);
      assert.equal(chain.length, 2, 'Must take exactly 1 hop and preserve query');
    });
  });
});
