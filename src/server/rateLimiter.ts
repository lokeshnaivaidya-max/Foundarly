/**
 * Sliding Window In-Memory Rate Limiter for Serverless & Edge API Routes
 */

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const rateLimitBuckets = new Map<string, RateLimitRecord>();

// Periodic memory purge every 5 minutes
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

export function extractClientIp(req: { headers?: Record<string, string | string[] | undefined>; socket?: { remoteAddress?: string } }): string {
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

export function checkServerlessRateLimit(
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; retryAfter: number; remaining: number } {
  const now = Date.now();
  const record = rateLimitBuckets.get(key);

  if (!record || record.resetAt <= now) {
    rateLimitBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfter: 0, remaining: limit - 1 };
  }

  if (record.count >= limit) {
    const retryAfter = Math.max(1, Math.ceil((record.resetAt - now) / 1000));
    return { allowed: false, retryAfter, remaining: 0 };
  }

  record.count += 1;
  return {
    allowed: true,
    retryAfter: 0,
    remaining: Math.max(0, limit - record.count),
  };
}
