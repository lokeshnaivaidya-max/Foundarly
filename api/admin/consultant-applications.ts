import {
  authenticateAdminRequest,
  getSupabaseServiceKey,
} from '../../src/server/adminApiAuth.js';

interface RequestLike {
  method?: string;
  body?: unknown;
  headers?: Record<string, string | string[] | undefined>;
  query?: Record<string, string | string[] | undefined>;
}

interface ResponseLike {
  status: (code: number) => ResponseLike;
  json: (data: unknown) => ResponseLike;
  end: () => void;
  setHeader: (name: string, value: string) => void;
}

export const config = { maxDuration: 30 };

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function requestIdFrom(headers?: RequestLike['headers']): string {
  const raw = headers?.['x-request-id'];
  const candidate = first(raw);
  if (candidate && /^[A-Za-z0-9._:-]{8,80}$/.test(candidate)) return candidate;
  const maybeCrypto = globalThis.crypto as Crypto | undefined;
  if (maybeCrypto && typeof maybeCrypto.randomUUID === 'function') return maybeCrypto.randomUUID();
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function parseBody(body: unknown): any {
  if (typeof body !== 'string') return body;
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

function databaseError(error: any) {
  const code = String(error?.code || '');
  if (code === '42501' || code === '42P01' || code.startsWith('PGRST') || /policy|permission/i.test(String(error?.message || ''))) {
    return {
      status: 503,
      code: 'ADMIN_APPLICATION_STORAGE_UNAVAILABLE',
      error:
        'Admin application storage is unavailable. Configure SUPABASE_SERVICE_ROLE_KEY or apply the consultant application RLS migration.',
    };
  }
  return {
    status: 500,
    code: 'ADMIN_APPLICATION_STORAGE_ERROR',
    error: 'The application record could not be read or updated.',
  };
}

export default async function handler(req: RequestLike, res: ResponseLike) {
  const requestId = requestIdFrom(req.headers);
  const startedAt = Date.now();

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-Id');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Request-Id', requestId);

  if (req.method === 'OPTIONS') return res.status(204).end();

  const auth = await authenticateAdminRequest(req.headers?.authorization);
  if (!auth.ok || !auth.client || !auth.user) {
    return res.status(auth.status || 401).json({
      success: false,
      code: auth.status === 403 ? 'FORBIDDEN' : 'UNAUTHORIZED',
      error: auth.error || 'Administrator authentication required.',
      requestId,
    });
  }

  const client = auth.client;
  const id = first(req.query?.id);
  const storage = getSupabaseServiceKey() ? 'service-role' : 'user-rls';

  try {
    if (req.method === 'GET') {
      if (id) {
        const { data, error } = await client
          .from('consultant_applications')
          .select('*')
          .eq('id', id)
          .maybeSingle();

        if (error) {
          const mapped = databaseError(error);
          console.error('[admin-consultant-applications] read failed', { requestId, code: error.code });
          return res.status(mapped.status).json({ success: false, ...mapped, requestId });
        }
        return res.status(200).json({ success: true, application: data, requestId, storage });
      }

      const status = first(req.query?.status);
      let query = client
        .from('consultant_applications')
        .select('*')
        .order('created_at', { ascending: false });

      if (status && ['pending', 'approved', 'rejected'].includes(status)) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;
      if (error) {
        const mapped = databaseError(error);
        console.error('[admin-consultant-applications] list failed', { requestId, code: error.code });
        return res.status(mapped.status).json({ success: false, ...mapped, requestId });
      }

      console.info(
        '[admin-consultant-applications]',
        JSON.stringify({
          requestId,
          event: 'list',
          count: data?.length || 0,
          storage,
          elapsedMs: Date.now() - startedAt,
        }),
      );

      return res.status(200).json({
        success: true,
        applications: data || [],
        count: data?.length || 0,
        requestId,
        storage,
      });
    }

    if (req.method === 'PATCH') {
      const body = parseBody(req.body);
      if (!id || !body || typeof body !== 'object') {
        return res.status(400).json({
          success: false,
          code: 'INVALID_REQUEST',
          error: 'An application id and JSON body are required.',
          requestId,
        });
      }

      const updates: Record<string, unknown> = {};
      if (typeof body.status === 'string') {
        if (!['pending', 'approved', 'rejected'].includes(body.status)) {
          return res.status(400).json({
            success: false,
            code: 'INVALID_STATUS',
            error: 'Status must be pending, approved or rejected.',
            requestId,
          });
        }
        updates.status = body.status;
      }
      if (typeof body.admin_notes === 'string') {
        updates.admin_notes = body.admin_notes.slice(0, 5000);
      }
      if (Object.keys(updates).length === 0) {
        return res.status(400).json({
          success: false,
          code: 'NOTHING_TO_UPDATE',
          error: 'No supported fields were supplied.',
          requestId,
        });
      }
      updates.updated_at = new Date().toISOString();

      const { data, error } = await client
        .from('consultant_applications')
        .update(updates)
        .eq('id', id)
        .select()
        .maybeSingle();

      if (error) {
        const mapped = databaseError(error);
        console.error('[admin-consultant-applications] update failed', { requestId, code: error.code });
        return res.status(mapped.status).json({ success: false, ...mapped, requestId });
      }

      return res.status(200).json({ success: true, application: data, requestId, storage });
    }

    if (req.method === 'DELETE') {
      if (!id) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_REQUEST',
          error: 'An application id is required.',
          requestId,
        });
      }

      const { error } = await client.from('consultant_applications').delete().eq('id', id);
      if (error) {
        const mapped = databaseError(error);
        console.error('[admin-consultant-applications] delete failed', { requestId, code: error.code });
        return res.status(mapped.status).json({ success: false, ...mapped, requestId });
      }

      return res.status(200).json({ success: true, deleted: true, requestId, storage });
    }

    res.setHeader('Allow', 'GET, PATCH, DELETE, OPTIONS');
    return res.status(405).json({
      success: false,
      code: 'METHOD_NOT_ALLOWED',
      error: 'Unsupported method.',
      requestId,
    });
  } catch (error: any) {
    console.error('[admin-consultant-applications] unexpected error', {
      requestId,
      message: error?.message || String(error),
    });
    return res.status(500).json({
      success: false,
      code: 'ADMIN_APPLICATION_INTERNAL_ERROR',
      error: 'An unexpected error occurred while accessing consultant applications.',
      requestId,
    });
  }
}
