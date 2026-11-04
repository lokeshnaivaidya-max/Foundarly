import {
  submitConsultantApplication,
  logConsultantApplicationResult,
} from '../src/server/consultantApplicationCore.js';
import { createServerSupabaseClient, getSupabaseServiceKey } from '../src/server/adminApiAuth.js';
import { checkServerlessRateLimit, extractClientIp } from '../src/server/rateLimiter.js';

interface RequestLike {
  method?: string;
  body?: unknown;
  headers?: Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string };
}

interface ResponseLike {
  status: (code: number) => ResponseLike;
  json: (data: unknown) => ResponseLike;
  end: () => void;
  setHeader: (name: string, value: string) => void;
}

export const config = { maxDuration: 30 };

function requestIdFrom(headers?: RequestLike['headers']): string {
  const raw = headers?.['x-request-id'];
  const candidate = Array.isArray(raw) ? raw[0] : raw;
  if (candidate && /^[A-Za-z0-9._:-]{8,80}$/.test(candidate)) return candidate;
  const maybeCrypto = globalThis.crypto as Crypto | undefined;
  if (maybeCrypto && typeof maybeCrypto.randomUUID === 'function') return maybeCrypto.randomUUID();
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function idempotencyKeyFrom(headers?: RequestLike['headers']): string | null {
  const raw = headers?.['idempotency-key'] || headers?.['x-idempotency-key'];
  const candidate = Array.isArray(raw) ? raw[0] : raw;
  return candidate && typeof candidate === 'string' ? candidate : null;
}

function parseBody(body: unknown): unknown {
  if (typeof body !== 'string') return body;
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

export default async function handler(req: RequestLike, res: ResponseLike) {
  const requestId = requestIdFrom(req.headers);
  const startedAt = Date.now();

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-Id, Idempotency-Key');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Request-Id', requestId);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(405).json({
      success: false,
      code: 'METHOD_NOT_ALLOWED',
      error: 'Only POST is supported for consultant applications.',
      requestId,
    });
  }

  const clientIp = extractClientIp(req);
  const rateLimit = checkServerlessRateLimit(`consultant_application_${clientIp}`, 8, 60_000);
  if (!rateLimit.allowed) {
    res.setHeader('Retry-After', String(rateLimit.retryAfter));
    console.warn(
      '[consultant-applications]',
      JSON.stringify({
        requestId,
        event: 'consultant_application_rate_limited',
        retryAfter: rateLimit.retryAfter,
        elapsedMs: Date.now() - startedAt,
      }),
    );
    return res.status(429).json({
      success: false,
      code: 'RATE_LIMITED',
      error: `Too many application attempts. Please wait ${rateLimit.retryAfter} seconds and try again.`,
      retryAfter: rateLimit.retryAfter,
      requestId,
    });
  }

  const body = parseBody(req.body);
  if (!body || typeof body !== 'object') {
    return res.status(400).json({
      success: false,
      code: 'INVALID_JSON',
      error: 'The application request body must be valid JSON.',
      requestId,
    });
  }

  const result = await submitConsultantApplication({
    client: createServerSupabaseClient(),
    raw: body,
    requestId,
    idempotencyKey: idempotencyKeyFrom(req.headers),
    timeoutMs: 12_000,
  });

  logConsultantApplicationResult(requestId, result, {
    route: 'POST /api/consultant-applications',
    ip: clientIp,
  });

  if (!result.ok) {
    if (result.status === 429 && result.retryAfter) {
      res.setHeader('Retry-After', String(result.retryAfter));
    }
    return res.status(result.status).json({
      success: false,
      code: result.code,
      error: result.error,
      issues: result.issues,
      requestId,
      elapsedMs: result.elapsedMs,
    });
  }

  return res.status(result.status).json({
    success: true,
    applicationId: result.applicationId,
    duplicate: result.duplicate,
    message: result.duplicate
      ? 'This application was already received.'
      : 'Application submitted successfully.',
    requestId,
    elapsedMs: result.elapsedMs,
    storage: getSupabaseServiceKey() ? 'service-role' : 'anon-rls',
  });
}
