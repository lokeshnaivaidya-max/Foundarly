import type { SupabaseClient } from '@supabase/supabase-js';
import {
  normalizeConsultantApplication,
  validationErrorMessage,
  maskApplicationEmail,
  type ConsultantApplicationInput,
} from '../lib/consultantApplicationValidation.js';

export interface SubmitConsultantApplicationOptions {
  client: SupabaseClient;
  raw: unknown;
  requestId: string;
  timeoutMs?: number;
  idempotencyKey?: string | null;
}

export interface SubmitConsultantApplicationSuccess {
  ok: true;
  status: 200 | 201;
  applicationId: string;
  duplicate: boolean;
  elapsedMs: number;
  email: string;
}

export interface SubmitConsultantApplicationFailure {
  ok: false;
  status: 400 | 409 | 429 | 500 | 503 | 504;
  code: string;
  error: string;
  issues?: Array<{ field: string; message: string }>;
  elapsedMs: number;
  retryAfter?: number;
  email?: string;
}

export type SubmitConsultantApplicationResult =
  | SubmitConsultantApplicationSuccess
  | SubmitConsultantApplicationFailure;

const DEFAULT_TIMEOUT_MS = 12_000;
const IDEMPOTENCY_TTL_MS = 5 * 60 * 1000;

const recentSubmissions = new Map<string, { applicationId: string; expiresAt: number }>();

/** Test-only helper. */
export function resetConsultantApplicationIdempotencyStore() {
  recentSubmissions.clear();
}

function newApplicationId(): string {
  const maybeCrypto = globalThis.crypto as Crypto | undefined;
  if (maybeCrypto && typeof maybeCrypto.randomUUID === 'function') {
    return maybeCrypto.randomUUID();
  }
  // Fallback for older Node runtimes. Not used for security decisions.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const value = (Math.random() * 16) | 0;
    return (char === 'x' ? value : (value & 0x3) | 0x8).toString(16);
  });
}

function idempotencyKeyFor(
  value: ConsultantApplicationInput,
  explicitKey?: string | null,
): string {
  if (explicitKey && explicitKey.trim()) {
    return `key:${explicitKey.trim().slice(0, 200)}`;
  }
  // Conservative payload fingerprint. Prevents accidental double submissions
  // from the same browser while still allowing a genuine later re-application
  // (the entry expires after five minutes).
  return `fingerprint:${[value.email, value.phone, value.name, value.experience.length].join('|')}`;
}

function purgeExpiredIdempotencyEntries(now: number) {
  for (const [key, record] of recentSubmissions.entries()) {
    if (record.expiresAt <= now) recentSubmissions.delete(key);
  }
}

function mapDatabaseError(error: any): Pick<SubmitConsultantApplicationFailure, 'status' | 'code' | 'error'> {
  const code = String(error?.code || '');
  const message = String(error?.message || '');

  if (code === '23502') {
    return {
      status: 500,
      code: 'APPLICATION_SCHEMA_MISMATCH',
      error:
        'The application could not be saved because the database is missing a required field. Please contact support and reference this request ID.',
    };
  }

  if (code === '23505') {
    return {
      status: 409,
      code: 'DUPLICATE_APPLICATION',
      error: 'This application appears to have already been submitted. Please contact support if you need to update it.',
    };
  }

  if (code === '23514') {
    return {
      status: 400,
      code: 'INVALID_APPLICATION_VALUE',
      error: 'One of the application values is not accepted. Please review the form and try again.',
    };
  }

  if (code === '42501' || code === '42P01' || code.startsWith('PGRST') || /permission|row-level security|policy/i.test(message)) {
    return {
      status: 503,
      code: 'APPLICATION_STORAGE_UNAVAILABLE',
      error:
        'Application storage is temporarily unavailable. Please try again in a moment or contact support with this request ID.',
    };
  }

  return {
    status: 500,
    code: 'APPLICATION_STORAGE_ERROR',
    error:
      'We could not save your application. Please try again. If the problem continues, contact support with this request ID.',
  };
}

/**
 * Authoritative submission path shared by the Vercel serverless function and
 * the local Express server. The caller supplies a Supabase client so the server
 * can use the service role key (never exposed to the browser) when available.
 */
export async function submitConsultantApplication(
  options: SubmitConsultantApplicationOptions,
): Promise<SubmitConsultantApplicationResult> {
  const startedAt = Date.now();
  const normalized = normalizeConsultantApplication(options.raw);

  if (!normalized.valid) {
    const issues = (normalized as { issues: Array<{ field: string; message: string }> }).issues || [];
    return {
      ok: false,
      status: 400,
      code: 'VALIDATION_ERROR',
      error: validationErrorMessage(issues),
      issues,
      elapsedMs: Date.now() - startedAt,
    };
  }

  const value = normalized.value;
  const now = Date.now();
  purgeExpiredIdempotencyEntries(now);

  const idempotencyKey = idempotencyKeyFor(value, options.idempotencyKey);
  const existing = recentSubmissions.get(idempotencyKey);
  if (existing && existing.expiresAt > now) {
    return {
      ok: true,
      status: 200,
      applicationId: existing.applicationId,
      duplicate: true,
      elapsedMs: Date.now() - startedAt,
      email: maskApplicationEmail(value.email),
    };
  }

  const applicationId = newApplicationId();
  const payload = {
    id: applicationId,
    ...value,
    status: 'pending' as const,
    admin_notes: null,
    created_at: new Date().toISOString(),
  };

  const timeoutMs = Math.max(1_000, options.timeoutMs || DEFAULT_TIMEOUT_MS);
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutHandle = setTimeout(() => controller?.abort(), timeoutMs);

  try {
    let query: any = options.client.from('consultant_applications').insert(payload);
    if (controller && typeof query?.abortSignal === 'function') {
      query = query.abortSignal(controller.signal);
    }

    const { error } = await query;

    if (error) {
      const mapped = mapDatabaseError(error);
      return {
        ...mapped,
        ok: false,
        elapsedMs: Date.now() - startedAt,
        email: maskApplicationEmail(value.email),
      };
    }

    recentSubmissions.set(idempotencyKey, {
      applicationId,
      expiresAt: Date.now() + IDEMPOTENCY_TTL_MS,
    });

    return {
      ok: true,
      status: 201,
      applicationId,
      duplicate: false,
      elapsedMs: Date.now() - startedAt,
      email: maskApplicationEmail(value.email),
    };
  } catch (error: any) {
    const isAbort =
      error?.name === 'AbortError' ||
      error?.name === 'TimeoutError' ||
      /abort|timed out|timeout/i.test(String(error?.message || ''));

    if (isAbort) {
      return {
        ok: false,
        status: 504,
        code: 'SUBMISSION_TIMEOUT',
        error:
          'The submission took too long to confirm. Please try again. If you are unsure whether it was saved, contact support with this request ID before retrying.',
        elapsedMs: Date.now() - startedAt,
        email: maskApplicationEmail(value.email),
      };
    }

    const mapped = mapDatabaseError(error);
    return {
      ...mapped,
      ok: false,
      elapsedMs: Date.now() - startedAt,
      email: maskApplicationEmail(value.email),
    };
  } finally {
    clearTimeout(timeoutHandle);
  }
}

/** Safe structured log line; never includes tokens, keys or full personal data. */
export function logConsultantApplicationResult(
  requestId: string,
  result: SubmitConsultantApplicationResult,
  context: { route: string; ip?: string },
) {
  const level = result.ok ? 'info' : 'error';
  const line = {
    requestId,
    route: context.route,
    event: 'consultant_application_submit',
    ok: result.ok,
    status: result.status,
    code: result.ok
      ? result.duplicate
        ? 'DUPLICATE_APPLICATION'
        : 'CREATED'
      : (result as { code?: string }).code || 'SUBMISSION_FAILED',
    applicationId: result.ok ? result.applicationId : undefined,
    email: result.email || undefined,
    elapsedMs: result.elapsedMs,
    ipHash: context.ip ? hashIp(context.ip) : undefined,
    timestamp: new Date().toISOString(),
  };

  const logger = level === 'info' ? console.info : console.error;
  logger('[consultant-applications]', JSON.stringify(line));
}

function hashIp(ip: string): string {
  // Small non-reversible fingerprint for abuse investigation without storing IPs.
  let hash = 2166136261;
  for (let i = 0; i < ip.length; i++) {
    hash ^= ip.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
