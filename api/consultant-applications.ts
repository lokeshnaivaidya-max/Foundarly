import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { checkDistributedRateLimit, extractClientIp } from '../src/server/rateLimiter.js';

dotenv.config();

interface RequestLike {
  method?: string;
  body?: any;
  headers?: Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string };
}

interface ResponseLike {
  status: (code: number) => ResponseLike;
  json: (data: any) => ResponseLike;
  end: () => void;
  setHeader: (name: string, value: string) => void;
}

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://rfyxnshvtfswvaogjzwq.supabase.co';
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  'sb_publishable_QPkFtczpj8_WzxPf4ZoENw_ZpnfN9vd';

const supabaseAdminClient = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function maskIdentifier(val: string): string {
  if (!val) return '***';
  if (val.includes('@')) {
    const [user, domain] = val.split('@');
    return `${user.slice(0, 2)}***@${domain || '***'}`;
  }
  return `${val.slice(0, 3)}****${val.slice(-2)}`;
}

export default async function handler(req: RequestLike, res: ResponseLike) {
  const startTime = Date.now();
  const requestId = `app_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed', requestId });
  }

  // Rate Limiting by IP (15 submissions per 10 minutes to prevent abuse)
  const clientIp = extractClientIp(req);
  const rateLimit = await checkDistributedRateLimit(`apply_${clientIp}`, 15, 600000);
  if (!rateLimit.allowed) {
    if (rateLimit.retryAfter) {
      res.setHeader('Retry-After', String(rateLimit.retryAfter));
    }
    console.warn(`[Consultant Application] [${requestId}] Rate limited IP: ${clientIp}`);
    return res.status(429).json({
      success: false,
      error: `Too many submissions. Please wait ${rateLimit.retryAfter || 60} seconds before trying again.`,
      code: 'RATE_LIMITED',
      requestId,
    });
  }

  try {
    const rawBody = req.body;
    let body = rawBody;
    if (typeof rawBody === 'string') {
      try {
        body = JSON.parse(rawBody);
      } catch {
        body = {};
      }
    }

    const {
      name,
      email,
      phone,
      whatsapp,
      age,
      gender,
      qualification,
      current_job,
      location,
      experience,
      preferred_session_timing,
      linkedin_url,
    } = body || {};

    // 1. Validation
    if (!name || !String(name).trim()) {
      return res.status(400).json({ success: false, error: 'Full name is required.', requestId });
    }
    if (!email || !String(email).trim() || !String(email).includes('@')) {
      return res.status(400).json({ success: false, error: 'A valid email address is required.', requestId });
    }
    if (!phone || !String(phone).trim()) {
      return res.status(400).json({ success: false, error: 'Phone number is required.', requestId });
    }
    if (!preferred_session_timing || !String(preferred_session_timing).trim()) {
      return res.status(400).json({ success: false, error: 'Preferred session timing is required.', requestId });
    }

    const parsedAge = parseInt(String(age || '25'), 10) || 25;
    if (parsedAge < 18) {
      return res.status(400).json({ success: false, error: 'Age must be 18 or older.', requestId });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const cleanPhone = String(phone).trim();
    // Guarantee whatsapp is NEVER null (violates PostgreSQL NOT NULL constraint)
    const cleanWhatsapp = (whatsapp ? String(whatsapp).trim() : cleanPhone) || cleanPhone;

    // Identity capture: when the applicant is signed in with a VERIFIED account
    // whose email matches the application email, stamp the authenticated UUID on
    // the application. Approval then links the consultant record by UUID instead
    // of guessing by name or unverified email.
    let authenticatedUserId: string | null = null;
    try {
      const appAuthHeader = req.headers?.authorization;
      const appToken = typeof appAuthHeader === 'string' && appAuthHeader.startsWith('Bearer ')
        ? appAuthHeader.slice(7).trim()
        : null;
      if (appToken) {
        const { data: { user: applicantUser } } = await supabaseAdminClient.auth.getUser(appToken);
        const applicantEmail = (applicantUser?.email || '').toLowerCase().trim();
        const applicantEmailVerified = Boolean(
          (applicantUser as { email_confirmed_at?: string })?.email_confirmed_at ||
            (applicantUser as { confirmed_at?: string })?.confirmed_at
        );
        if (applicantUser && applicantEmailVerified && applicantEmail === normalizedEmail) {
          authenticatedUserId = applicantUser.id;
          console.log(
            `[Consultant Application] [${requestId}] Identity captured for ${maskIdentifier(normalizedEmail)}`
          );
        }
      }
    } catch (identityErr: any) {
      console.warn(`[Consultant Application] [${requestId}] Identity capture notice:`, identityErr?.message);
    }

    const payload = {
      name: String(name).trim(),
      email: normalizedEmail,
      phone: cleanPhone,
      whatsapp: cleanWhatsapp,
      age: parsedAge,
      gender: gender === 'female' ? 'female' : 'male',
      qualification: qualification ? String(qualification).trim() : '',
      current_job: current_job ? String(current_job).trim() : '',
      location: location ? String(location).trim() : '',
      experience: experience ? String(experience).trim() : '',
      preferred_session_timing: String(preferred_session_timing).trim(),
      linkedin_url: linkedin_url && String(linkedin_url).trim().length > 0 ? String(linkedin_url).trim() : null,
      status: 'pending',
      created_at: new Date().toISOString(),
      ...(authenticatedUserId ? { user_id: authenticatedUserId } : {}),
    };

    console.log(
      `[Consultant Application] [${requestId}] Processing submission for ${maskIdentifier(normalizedEmail)} (${maskIdentifier(cleanPhone)})`
    );

    // 2. Perform DB insert with 15s timeout
    const insertPromise = supabaseAdminClient
      .from('consultant_applications')
      .insert(payload);

    const timeoutPromise = new Promise<{ error: Error }>((resolve) =>
      setTimeout(
        () => resolve({ error: new Error('Database operation timed out after 15 seconds. Please try again.') }),
        15000
      )
    );

    const { error } = (await Promise.race([insertPromise, timeoutPromise])) as any;

    const elapsed = Date.now() - startTime;

    if (error) {
      console.error(`[Consultant Application] [${requestId}] DB insert error (${elapsed}ms):`, {
        message: error.message,
        code: error.code,
        details: error.details,
      });
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to submit application. Please check your details and try again.',
        code: error.code || 'DB_ERROR',
        requestId,
      });
    }

    console.log(
      `[Consultant Application] [${requestId}] Successfully inserted application in ${elapsed}ms for ${maskIdentifier(normalizedEmail)}`
    );

    return res.status(201).json({
      success: true,
      message: 'Application submitted successfully. We will review your application soon.',
      requestId,
    });
  } catch (err: any) {
    const elapsed = Date.now() - startTime;
    console.error(`[Consultant Application] [${requestId}] Unexpected exception (${elapsed}ms):`, err?.message || err);
    return res.status(500).json({
      success: false,
      error: err?.message || 'An unexpected error occurred while processing your application.',
      requestId,
    });
  }
}
