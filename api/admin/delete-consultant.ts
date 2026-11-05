import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { isAllowedAdminEmail, isDeveloperAdmin } from '../../src/lib/authorization.js';

dotenv.config();

interface RequestLike {
  method?: string;
  body?: any;
  headers?: Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string };
}

interface ResponseLike {
  status: (code: number) => ResponseLike;
  json: (data: unknown) => ResponseLike;
  end: () => void;
  setHeader: (name: string, value: string) => void;
}

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://rfyxnshvtfswvaogjzwq.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Both must be present for the atomic path; never silently degrade
if (!serviceRoleKey || serviceRoleKey.trim().length < 20 || serviceRoleKey.includes('publishable')) {
  // We still create the client lazily so the API fails closed when invoked,
  // instead of appearing usable. The key is NEVER sent to the frontend.
}

const supabaseAdminClient = serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

export default async function handler(req: RequestLike, res: ResponseLike) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  // 1. Authenticate caller via Supabase Auth
  const authHeader = req.headers?.authorization;
  const token = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : null;

  if (!token) {
    return res.status(401).json({ success: false, error: 'Authentication required. Missing Bearer token.' });
  }

  if (!supabaseAdminClient) {
    return res.status(503).json({
      success: false,
      error: 'Atomic deletion service is not configured. Apply migration 20260812000000_atomic_consultant_deletion.sql and set SUPABASE_SERVICE_ROLE_KEY.',
    });
  }

  try {
    const { data: { user: adminUser }, error: userError } = await supabaseAdminClient.auth.getUser(token);
    if (userError || !adminUser) {
      return res.status(410).json({ success: false, error: 'Invalid or expired session token.' });
    }

    // 2. Authorize caller — only allowlisted Admins or Developer Admin
    const adminEmail = (adminUser.email || '').toLowerCase().trim();
    const isAllowlisted = isAllowedAdminEmail(adminEmail);
    const isDevAdmin = isDeveloperAdmin(adminUser, null);

    if (!isAllowlisted && !isDevAdmin) {
      return res.status(403).json({ success: false, error: 'Forbidden. Admin or Developer Admin authorization required.' });
    }

    // 3. Parse and validate request body — never trust client-supplied user_id
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        body = {};
      }
    }

    const consultantId = body?.consultantId;
    if (!consultantId || typeof consultantId !== 'string') {
      return res.status(400).json({ success: false, error: 'Valid consultantId (UUID) is required.' });
    }

    // Basic UUID shape check
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(consultantId)) {
      return res.status(400).json({ success: false, error: 'consultantId must be a valid UUID.' });
    }

    // 4. Invoke the ATOMIC PostgreSQL RPC via service-role
    //    - resolves linked user_id from the consultants table (never from the client)
    //    - deletes consultant + downgrades associated profiles.role 'consultant' → 'client' in ONE transaction
    //    - rolls back entirely if any step fails
    const { data, error: rpcError } = await supabaseAdminClient.rpc('delete_consultant_atomically', {
      consultant_id: consultantId,
    });

    if (rpcError) {
      console.error('[Delete Consultant] Atomic RPC failed:', rpcError.message);
      return res.status(500).json({
        success: false,
        error: 'Atomic deletion failed. The migration 20260812000000_atomic_consultant_deletion.sql may need to be applied. Neither the consultant record nor the profile role were changed.',
        detail: rpcError.message,
      });
    }

    const result = data as {
      success?: boolean;
      error?: string;
      deleted?: boolean;
      profile_downgraded?: boolean;
      user_id?: string | null;
      original_profile_role?: string | null;
    };

    if (!result?.success) {
      return res.status(404).json({
        success: false,
        error: result?.error || 'Consultant record not found.',
      });
    }

    return res.status(200).json({
      success: true,
      deleted: result.deleted ?? true,
      profileDowngraded: result.profile_downgraded ?? false,
      userId: result.user_id ?? null,
      originalProfileRole: result.original_profile_role ?? null,
      message: result.profile_downgraded
        ? 'Consultant record deleted and associated account authorization revoked (downgraded to Client).'
        : 'Consultant record deleted. Profile role was not downgraded (not consultant or already appropriate).',
    });
  } catch (err: any) {
    console.error('[Delete Consultant] Unexpected exception:', err);
    return res.status(500).json({
      success: false,
      error: err?.message || 'An unexpected error occurred while deleting the consultant.',
    });
  }
}
