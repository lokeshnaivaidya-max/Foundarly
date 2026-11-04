/**
 * Unified Canonical URL & Production Domain Resolver
 * 
 * Ensures consistent origin resolution across client, serverless API routes,
 * email links, and OAuth callbacks, preventing cross-origin session loss
 * (such as being logged into foundarly-delta.vercel.app while email opens a different domain).
 */

const DEFAULT_PRODUCTION_DOMAIN = 'https://foundarly-delta.vercel.app';
const BRAND_PRODUCTION_DOMAIN = 'https://www.foundarlybusinessworld.in';

interface RequestWithHeaders {
  headers?: Record<string, string | string[] | undefined>;
  get?: (headerName: string) => string | undefined;
}

/**
 * Extracts a normalized, clean base URL (no trailing slash) from an input string.
 */
export function sanitizeOrigin(urlStr?: string | null): string | null {
  if (!urlStr || typeof urlStr !== 'string') return null;
  const clean = urlStr.trim();
  if (!clean) return null;

  try {
    const parsed = new URL(clean.startsWith('http') ? clean : `https://${clean}`);
    return `${parsed.protocol}//${parsed.host}`.replace(/\/+$/, '');
  } catch {
    return null;
  }
}

/**
 * Determines the canonical site URL for the current runtime.
 * 
 * Order of precedence:
 * 1. Explicit override passed in (e.g., from an incoming request or booking context)
 * 2. Environment variables: VITE_SITE_URL, APP_URL, SITE_URL
 * 3. Browser location (window.location.origin) if running client-side
 * 4. Request headers (origin, referer, x-forwarded-host) if running server-side
 * 5. Default production domain (foundarly-delta.vercel.app)
 */
export function getCanonicalSiteUrl(req?: RequestWithHeaders, explicitUrl?: string | null): string {
  // 1. Explicit URL provided
  const sanitizedExplicit = sanitizeOrigin(explicitUrl);
  if (sanitizedExplicit) {
    return sanitizedExplicit;
  }

  // 2. Client-side Vite environment variables
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    const viteSiteUrl = sanitizeOrigin(import.meta.env.VITE_SITE_URL as string);
    if (viteSiteUrl) return viteSiteUrl;

    const viteAppUrl = sanitizeOrigin(import.meta.env.VITE_APP_URL as string);
    if (viteAppUrl) return viteAppUrl;
  }

  // 3. Node/Server-side process.env
  if (typeof process !== 'undefined' && process.env) {
    const isCleanEnvUrl = (u: string | null) => u && !u.includes('run.app') && !u.includes('vercel.app') && !u.includes('localhost') && !u.includes('127.0.0.1');

    const envAppUrl = sanitizeOrigin(process.env.APP_URL);
    if (isCleanEnvUrl(envAppUrl)) return envAppUrl!;

    const envSiteUrl = sanitizeOrigin(process.env.SITE_URL);
    if (isCleanEnvUrl(envSiteUrl)) return envSiteUrl!;

    const envViteSiteUrl = sanitizeOrigin(process.env.VITE_SITE_URL);
    if (isCleanEnvUrl(envViteSiteUrl)) return envViteSiteUrl!;
  }

  // 4. Client-side window.location
  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    const windowOrigin = sanitizeOrigin(window.location.origin);
    if (windowOrigin && !windowOrigin.includes('localhost') && !windowOrigin.includes('127.0.0.1') && !windowOrigin.includes('run.app')) {
      return windowOrigin;
    }
  }

  // 5. Server-side Request Headers
  if (req) {
    const getHeader = (name: string): string | undefined => {
      if (typeof req.get === 'function') {
        return req.get(name);
      }
      const val = req.headers?.[name] || req.headers?.[name.toLowerCase()];
      return Array.isArray(val) ? val[0] : val;
    };

    const isCleanHost = (h: string | null) => h && !h.includes('run.app') && !h.includes('vercel.app') && !h.includes('localhost') && !h.includes('127.0.0.1');

    const originHeader = getHeader('origin');
    const sanitizedOrigin = sanitizeOrigin(originHeader);
    if (isCleanHost(sanitizedOrigin)) return sanitizedOrigin!;

    const refererHeader = getHeader('referer');
    const sanitizedReferer = sanitizeOrigin(refererHeader);
    if (isCleanHost(sanitizedReferer)) return sanitizedReferer!;

    const forwardedHost = getHeader('x-forwarded-host');
    const forwardedProto = getHeader('x-forwarded-proto') || 'https';
    if (forwardedHost) {
      const sanitizedForwarded = sanitizeOrigin(`${forwardedProto}://${forwardedHost}`);
      if (isCleanHost(sanitizedForwarded)) return sanitizedForwarded!;
    }
  }

  // 6. Default fallback is always the canonical brand production domain
  return BRAND_PRODUCTION_DOMAIN;
}

/**
 * Builds an absolute URL using the canonical production domain.
 */
export function buildCanonicalUrl(path: string, req?: RequestWithHeaders, explicitBase?: string | null): string {
  const base = getCanonicalSiteUrl(req, explicitBase);
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${cleanPath}`;
}
