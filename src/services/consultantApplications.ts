import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/database.types';

type ConsultantApplication = Database['public']['Tables']['consultant_applications']['Row'];
type ConsultantApplicationInsert = Database['public']['Tables']['consultant_applications']['Insert'];
type ConsultantApplicationUpdate = Database['public']['Tables']['consultant_applications']['Update'];

type ApplicationStatus = 'pending' | 'approved' | 'rejected';

export class ConsultantApplicationError extends Error {
  code: string;
  status?: number;
  requestId?: string;
  issues?: Array<{ field: string; message: string }>;
  retryable: boolean;

  constructor(
    message: string,
    options: {
      code: string;
      status?: number;
      requestId?: string;
      issues?: Array<{ field: string; message: string }>;
      retryable?: boolean;
    },
  ) {
    super(message);
    this.name = 'ConsultantApplicationError';
    this.code = options.code;
    this.status = options.status;
    this.requestId = options.requestId;
    this.issues = options.issues;
    this.retryable = Boolean(options.retryable);
  }
}

const SUBMIT_TIMEOUT_MS = 15_000;
const ADMIN_TIMEOUT_MS = 20_000;

function newRequestId(): string {
  const maybeCrypto = globalThis.crypto as Crypto | undefined;
  if (maybeCrypto && typeof maybeCrypto.randomUUID === 'function') {
    return maybeCrypto.randomUUID();
  }
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Stable fingerprint of the submitted payload. Used as the idempotency key so a
 * retry after a network timeout (or an accidental double click) cannot create a
 * second application record within the server's five-minute window.
 */
function applicationFingerprint(value: unknown): string {
  const text = JSON.stringify(value);
  let hash = 5381;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) + hash) ^ text.charCodeAt(i);
  }
  return `application-${(hash >>> 0).toString(36)}`;
}

interface ApiErrorBody {
  success?: boolean;
  code?: string;
  error?: string;
  message?: string;
  requestId?: string;
  issues?: Array<{ field: string; message: string }>;
  retryAfter?: number;
}

async function readResponseBody(res: Response): Promise<any> {
  const text = await res.text().catch(() => '');
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { error: text.slice(0, 500) };
  }
}

function errorFromResponse(res: Response, body: ApiErrorBody | null, fallback: string): ConsultantApplicationError {
  const requestId = body?.requestId;
  const baseMessage = body?.error || body?.message || fallback;
  const message =
    requestId && !baseMessage.includes(requestId) ? `${baseMessage} (Reference: ${requestId})` : baseMessage;
  return new ConsultantApplicationError(message, {
    code: body?.code || `HTTP_${res.status}`,
    status: res.status,
    requestId,
    issues: body?.issues,
    retryable: res.status >= 500 || res.status === 429,
  });
}

async function getAccessToken(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || null;
  } catch {
    return null;
  }
}

/**
 * Admin endpoints are authoritative when deployed. The direct Supabase
 * fallback exists only for environments where the serverless admin route is
 * genuinely unavailable (404/405) or the deployment is missing server storage
 * credentials (503). An authorization failure is never silently downgraded.
 */
function shouldFallBackToSupabase(error: ConsultantApplicationError): boolean {
  return error.status === 404 || error.status === 405 || error.status === 503;
}

export const consultantApplicationsService = {
  async getAll(status?: ApplicationStatus) {
    const token = await getAccessToken();
    if (token) {
      const requestId = newRequestId();
      const query = status ? `?status=${encodeURIComponent(status)}` : '';

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), ADMIN_TIMEOUT_MS);
        let res: Response;
        try {
          res = await fetch(`/api/admin/consultant-applications${query}`, {
            method: 'GET',
            headers: {
              Accept: 'application/json',
              Authorization: `Bearer ${token}`,
              'X-Request-Id': requestId,
            },
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timeoutId);
        }

        const body = await readResponseBody(res);
        if (!res.ok) {
          const error = errorFromResponse(res, body, 'Could not load consultant applications.');
          if (!shouldFallBackToSupabase(error)) throw error;
          console.warn('[consultantApplicationsService] Admin API unavailable, using Supabase fallback:', error.code);
        } else {
          return (body?.applications || []) as ConsultantApplication[];
        }
      } catch (error: any) {
        if (error instanceof ConsultantApplicationError) {
          if (!shouldFallBackToSupabase(error)) throw error;
        } else if (error?.name !== 'AbortError') {
          console.warn('[consultantApplicationsService] Admin API request failed, using Supabase fallback:', error?.message);
        } else {
          console.warn('[consultantApplicationsService] Admin API timed out, using Supabase fallback');
        }
      }
    }

    let dbQuery = supabase
      .from('consultant_applications')
      .select('*')
      .order('created_at', { ascending: false });

    if (status) {
      dbQuery = dbQuery.eq('status', status);
    }

    const { data, error } = await dbQuery;
    if (error) {
      console.error('Supabase error fetching consultant_applications:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
      throw new ConsultantApplicationError(error.message, {
        code: error.code || 'SUPABASE_READ_ERROR',
        retryable: true,
      });
    }
    return data as ConsultantApplication[];
  },

  async getById(id: string) {
    const token = await getAccessToken();
    if (token) {
      const requestId = newRequestId();
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), ADMIN_TIMEOUT_MS);
        let res: Response;
        try {
          res = await fetch(`/api/admin/consultant-applications?id=${encodeURIComponent(id)}`, {
            method: 'GET',
            headers: {
              Accept: 'application/json',
              Authorization: `Bearer ${token}`,
              'X-Request-Id': requestId,
            },
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timeoutId);
        }

        const body = await readResponseBody(res);
        if (!res.ok) {
          const error = errorFromResponse(res, body, 'Could not load the consultant application.');
          if (!shouldFallBackToSupabase(error)) throw error;
        } else {
          return (body?.application || null) as ConsultantApplication | null;
        }
      } catch (error: any) {
        if (error instanceof ConsultantApplicationError && !shouldFallBackToSupabase(error)) throw error;
        if (!(error instanceof ConsultantApplicationError)) {
          console.warn('[consultantApplicationsService] Admin API getById failed, using Supabase fallback:', error?.message);
        }
      }
    }

    const { data, error } = await supabase
      .from('consultant_applications')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('Supabase error fetching consultant_application by id:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
      throw new ConsultantApplicationError(error.message, {
        code: error.code || 'SUPABASE_READ_ERROR',
        retryable: true,
      });
    }
    return data as ConsultantApplication | null;
  },

  async create(application: ConsultantApplicationInsert) {
    const requestId = newRequestId();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), SUBMIT_TIMEOUT_MS);

    try {
      let res: Response;
      try {
        res = await fetch('/api/consultant-applications', {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-Request-Id': requestId,
            'Idempotency-Key': applicationFingerprint(application),
          },
          body: JSON.stringify(application),
          signal: controller.signal,
        });
      } catch (networkError: any) {
        const aborted =
          networkError?.name === 'AbortError' ||
          /abort|timed out|timeout/i.test(String(networkError?.message || ''));
        throw new ConsultantApplicationError(
          aborted
            ? `The submission is taking longer than expected. Please check your connection and try again. (Reference: ${requestId})`
            : `We could not reach the application service. Please check your connection and try again. (Reference: ${requestId})`,
          {
            code: aborted ? 'SUBMISSION_TIMEOUT' : 'NETWORK_ERROR',
            requestId,
            retryable: true,
          },
        );
      }

      const body = await readResponseBody(res);

      if (!res.ok || body?.success !== true) {
        throw errorFromResponse(res, body, 'We could not submit your application. Please try again.');
      }

      return {
        ...body,
        requestId: body?.requestId || requestId,
        applicationId: body?.applicationId,
        duplicate: Boolean(body?.duplicate),
      };
    } finally {
      clearTimeout(timeoutId);
    }
  },

  async update(id: string, updates: ConsultantApplicationUpdate) {
    const payload = { ...updates, updated_at: new Date().toISOString() };
    const token = await getAccessToken();

    if (token) {
      const requestId = newRequestId();
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), ADMIN_TIMEOUT_MS);
        let res: Response;
        try {
          res = await fetch(`/api/admin/consultant-applications?id=${encodeURIComponent(id)}`, {
            method: 'PATCH',
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
              'X-Request-Id': requestId,
            },
            body: JSON.stringify(payload),
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timeoutId);
        }

        const body = await readResponseBody(res);
        if (!res.ok) {
          const error = errorFromResponse(res, body, 'Could not update the consultant application.');
          if (!shouldFallBackToSupabase(error)) throw error;
        } else {
          return (body?.application || null) as ConsultantApplication | null;
        }
      } catch (error: any) {
        if (error instanceof ConsultantApplicationError && !shouldFallBackToSupabase(error)) throw error;
        if (!(error instanceof ConsultantApplicationError)) {
          console.warn('[consultantApplicationsService] Admin API update failed, using Supabase fallback:', error?.message);
        }
      }
    }

    const { data, error } = await (supabase as any)
      .from('consultant_applications')
      .update(payload)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) {
      console.error('[Supabase Consultant Application Update Failure Log]:', {
        tableName: 'consultant_applications',
        applicationId: id,
        supabaseErrorObject: {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        },
      });
      throw new ConsultantApplicationError(error.message, {
        code: error.code || 'SUPABASE_UPDATE_ERROR',
        retryable: true,
      });
    }

    return data as ConsultantApplication;
  },

  async delete(id: string) {
    const token = await getAccessToken();

    if (token) {
      const requestId = newRequestId();
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), ADMIN_TIMEOUT_MS);
        let res: Response;
        try {
          res = await fetch(`/api/admin/consultant-applications?id=${encodeURIComponent(id)}`, {
            method: 'DELETE',
            headers: {
              Accept: 'application/json',
              Authorization: `Bearer ${token}`,
              'X-Request-Id': requestId,
            },
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timeoutId);
        }

        const body = await readResponseBody(res);
        if (!res.ok) {
          const error = errorFromResponse(res, body, 'Could not delete the consultant application.');
          if (!shouldFallBackToSupabase(error)) throw error;
        } else {
          return;
        }
      } catch (error: any) {
        if (error instanceof ConsultantApplicationError && !shouldFallBackToSupabase(error)) throw error;
        if (!(error instanceof ConsultantApplicationError)) {
          console.warn('[consultantApplicationsService] Admin API delete failed, using Supabase fallback:', error?.message);
        }
      }
    }

    const { error } = await supabase
      .from('consultant_applications')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Supabase error deleting consultant_application:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
      throw new ConsultantApplicationError(error.message, {
        code: error.code || 'SUPABASE_DELETE_ERROR',
        retryable: true,
      });
    }
  }
};
