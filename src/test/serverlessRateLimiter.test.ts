import { describe, it, expect } from 'vitest';
import { checkServerlessRateLimit, checkDistributedRateLimit, extractClientIp } from '../server/rateLimiter';

describe('Serverless Rate Limiter', () => {
  it('allows requests within the limit and tracks remaining quota', () => {
    const key = `test_key_${Date.now()}`;
    const first = checkServerlessRateLimit(key, 5, 60000);
    expect(first.allowed).toBe(true);
    expect(first.remaining).toBe(4);

    const second = checkServerlessRateLimit(key, 5, 60000);
    expect(second.allowed).toBe(true);
    expect(second.remaining).toBe(3);
  });

  it('rejects requests when rate limit is exceeded', () => {
    const key = `test_exceeded_${Date.now()}`;
    for (let i = 0; i < 3; i++) {
      checkServerlessRateLimit(key, 3, 60000);
    }
    const blocked = checkServerlessRateLimit(key, 3, 60000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfter).toBeGreaterThan(0);
  });

  it('extracts client IP from x-forwarded-for header', () => {
    const req = {
      headers: {
        'x-forwarded-for': '203.0.113.195, 70.41.3.18',
      },
    };
    expect(extractClientIp(req)).toBe('203.0.113.195');
  });

  it('falls back to socket remoteAddress when header is missing', () => {
    const req = {
      headers: {},
      socket: { remoteAddress: '192.168.1.50' },
    };
    expect(extractClientIp(req)).toBe('192.168.1.50');
  });

  it('handles checkDistributedRateLimit gracefully with fallback', async () => {
    const key = `test_dist_${Date.now()}`;
    const result = await checkDistributedRateLimit(key, 5, 60000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);

    // Repeated call decreases quota
    const second = await checkDistributedRateLimit(key, 5, 60000);
    expect(second.allowed).toBe(true);
    expect(second.remaining).toBe(3);
  });

  it('blocks distributed requests when quota exceeded', async () => {
    const key = `test_dist_exhaust_${Date.now()}`;
    for (let i = 0; i < 2; i++) {
      await checkDistributedRateLimit(key, 2, 60000);
    }
    const third = await checkDistributedRateLimit(key, 2, 60000);
    expect(third.allowed).toBe(false);
    expect(third.remaining).toBe(0);
    expect(third.retryAfter).toBeGreaterThan(0);
  });
});

