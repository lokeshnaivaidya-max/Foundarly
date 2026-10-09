/**
 * Rate Limiting Module for Serverless & Edge API Routes
 *
 * ARCHITECTURAL CLARIFICATION:
 * 1. An in-memory Map rate limiter (checkServerlessRateLimit) is per-instance / per-container.
 *    In serverless runtimes (like Vercel / AWS Lambda), state is isolated within individual lambda instances.
 *    It is NOT genuinely shared across concurrent serverless instances or across cold restarts.
 * 2. To achieve genuinely shared / distributed rate limiting across serverless instances WITHOUT
 *    introducing paid third-party services (such as Upstash Redis or paid rate limiting APIs),
 *    this module leverages our existing Supabase PostgreSQL instance (via the atomic
 *    check_rate_limit stored procedure and rate_limit_entries table).
 * 3. If Supabase is unconfigured, unreachable, or undergoing maintenance, checkDistributedRateLimit
 *    gracefully and immediately falls back to the local in-memory sliding window limiter (fail-safe).
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface RateLimitResult {
  allowed: boolean;
  retryAfter: number;
  remaining: number;
  source?: 'distributed' | 'in-memory-fallback';
}

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

// In-memory sliding window bucket store (per lambda container)
const rateLimitBuckets = new Map<string, RateLimitRecord>();

// Periodic memory purge every 5 minutes to prevent memory leaks
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, val] of rateLimitBuckets.entries()) {
      if (val.resetAt <= now) {
        rateLimitBuckets.delete(key);
      }
    }
  }, 5 * 60 * 1000).unref?.();
}

/**
 * Extracts client IP from HTTP headers or socket
 */
export function extractClientIp(req: {
  headers?: Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string };
}): string {
  const forwarded = req.headers?.['x-forwarded-for'];
  if (forwarded) {
    const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    return raw.split(',')[0].trim();
  }
  const realIp = req.headers?.['x-real-ip'];
  if (realIp) {
    return Array.isArray(realIp) ? realIp[0].trim() : realIp.trim();
  }
  return req.socket?.remoteAddress || '127.0.0.1';
}

/**
 * Synchronous in-memory rate limiter (per lambda instance).
 * Fast, zero-dependency, but isolated per container.
 */
export function checkServerlessRateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  const record = rateLimitBuckets.get(key);

  if (!record || record.resetAt <= now) {
    rateLimitBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfter: 0, remaining: limit - 1, source: 'in-memory-fallback' };
  }

  if (record.count >= limit) {
    const retryAfter = Math.max(1, Math.ceil((record.resetAt - now) / 1000));
    return { allowed: false, retryAfter, remaining: 0, source: 'in-memory-fallback' };
  }

  record.count += 1;
  return {
    allowed: true,
    retryAfter: 0,
    remaining: Math.max(0, limit - record.count),
    source: 'in-memory-fallback',
  };
}

let cachedSupabaseClient: SupabaseClient | null = null;

/**
 * Test helper to inject or reset Supabase client for testing
 */
export function setSupabaseClientForTesting(client: SupabaseClient | null) {
  cachedSupabaseClient = client;
}

function getSupabaseClient(): SupabaseClient | null {
  if (cachedSupabaseClient) return cachedSupabaseClient;

  const url =
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL;

  // Strictly require the trusted server-side service_role key.
  // anon / authenticated roles have no permission on check_rate_limit().
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) return null;

  try {
    cachedSupabaseClient = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    return cachedSupabaseClient;
  } catch {
    return null;
  }
}

/**
 * Distributed rate limiter across serverless instances.
 * Backed by Supabase PostgreSQL stored procedure `check_rate_limit`.
 * Falls back seamlessly to in-memory sliding window if Supabase is offline or unconfigured.
 */
export async function checkDistributedRateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  const client = getSupabaseClient();
  if (!client) {
    return checkServerlessRateLimit(key, limit, windowMs);
  }

  try {
    const windowSeconds = Math.max(1, Math.ceil(windowMs / 1000));
    const { data, error } = await client.rpc('check_rate_limit', {
      p_key: key,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });

    if (error || !data || !Array.isArray(data) || data.length === 0) {
      // Graceful fallback to in-memory limiter on database error or missing function
      return checkServerlessRateLimit(key, limit, windowMs);
    }

    const row = data[0];
    return {
      allowed: Boolean(row.allowed),
      retryAfter: Number(row.retry_after || 0),
      remaining: Number(row.remaining || 0),
      source: 'distributed',
    };
  } catch {
    return checkServerlessRateLimit(key, limit, windowMs);
  }
}

