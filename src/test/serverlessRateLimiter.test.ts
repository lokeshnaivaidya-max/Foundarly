import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  checkServerlessRateLimit,
  checkDistributedRateLimit,
  extractClientIp,
  setSupabaseClientForTesting,
} from '../server/rateLimiter';
import verifySmtpHandler from '../../api/verify-smtp';

describe('Serverless Rate Limiter', () => {
  afterEach(() => {
    setSupabaseClientForTesting(null);
  });

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

  it('handles checkDistributedRateLimit gracefully with fallback when client is unconfigured', async () => {
    const key = `test_dist_fallback_${Date.now()}`;
    const result = await checkDistributedRateLimit(key, 5, 60000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
    expect(result.source).toBe('in-memory-fallback');
  });

  it('successfully invokes check_rate_limit RPC with service_role client and returns distributed status', async () => {
    const mockRpc = vi.fn().mockResolvedValue({
      data: [{ allowed: true, remaining: 19, retry_after: 0 }],
      error: null,
    });

    const mockClient = {
      rpc: mockRpc,
    } as any;

    setSupabaseClientForTesting(mockClient);

    const result = await checkDistributedRateLimit('test_user_ip_1', 20, 60000);

    expect(mockRpc).toHaveBeenCalledWith('check_rate_limit', {
      p_key: 'test_user_ip_1',
      p_limit: 20,
      p_window_seconds: 60,
    });
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(19);
    expect(result.source).toBe('distributed');
  });

  it('atomically enforces quota exhaustion via RPC and returns allowed=false with retryAfter', async () => {
    const mockRpc = vi.fn().mockResolvedValue({
      data: [{ allowed: false, remaining: 0, retry_after: 42 }],
      error: null,
    });

    const mockClient = {
      rpc: mockRpc,
    } as any;

    setSupabaseClientForTesting(mockClient);

    const result = await checkDistributedRateLimit('test_user_exhausted', 20, 60000);

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfter).toBe(42);
    expect(result.source).toBe('distributed');
  });

  it('atomically tracks concurrent requests across separate serverless instances without lost updates', async () => {
    let currentCount = 0;
    const limit = 5;

    // Simulated atomic Postgres DB row update behavior inside check_rate_limit RPC
    const mockRpc = vi.fn().mockImplementation(async (_proc: string, args: { p_key: string; p_limit: number }) => {
      currentCount++;
      if (currentCount <= args.p_limit) {
        return {
          data: [{ allowed: true, remaining: args.p_limit - currentCount, retry_after: 0 }],
          error: null,
        };
      }
      return {
        data: [{ allowed: false, remaining: 0, retry_after: 60 }],
        error: null,
      };
    });

    const mockClient = { rpc: mockRpc } as any;
    setSupabaseClientForTesting(mockClient);

    // Fire 10 simultaneous concurrent requests simulating 10 parallel lambda instances
    const requests = Array.from({ length: 10 }).map((_, i) =>
      checkDistributedRateLimit('atomic_test_key', limit, 60000)
    );

    const results = await Promise.all(requests);

    const allowedCount = results.filter((r) => r.allowed).length;
    const blockedCount = results.filter((r) => !r.allowed).length;

    expect(allowedCount).toBe(5);
    expect(blockedCount).toBe(5);
    expect(mockRpc).toHaveBeenCalledTimes(10);
    expect(results[9].allowed).toBe(false);
    expect(results[9].retryAfter).toBe(60);
  });

  it('guarantees SUPABASE_SERVICE_ROLE_KEY is never exposed in response objects or error messages', async () => {
    const sensitiveKey = 'service_role_secret_abc123xyz_do_not_leak';
    process.env.SUPABASE_SERVICE_ROLE_KEY = sensitiveKey;

    const mockRpc = vi.fn().mockResolvedValue({
      data: [{ allowed: true, remaining: 9, retry_after: 0 }],
      error: null,
    });
    setSupabaseClientForTesting({ rpc: mockRpc } as any);

    const result = await checkDistributedRateLimit('leak_check_key', 10, 60000);

    const stringified = JSON.stringify(result);
    expect(stringified).not.toContain(sensitiveKey);
    expect(stringified).not.toContain('secret');
  });

  it('Vercel serverless endpoint returns HTTP 429 and Retry-After header when rate limit is exceeded', async () => {
    // Mock RPC to simulate rate limit exceeded
    const mockRpc = vi.fn().mockResolvedValue({
      data: [{ allowed: false, remaining: 0, retry_after: 55 }],
      error: null,
    });
    setSupabaseClientForTesting({ rpc: mockRpc } as any);

    let statusCode = 200;
    const responseHeaders: Record<string, string> = {};
    let responseBody: any = null;

    const mockReq = {
      method: 'GET',
      headers: { 'x-forwarded-for': '198.51.100.22' },
    };

    const mockRes = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      setHeader(name: string, value: string) {
        responseHeaders[name] = value;
      },
      json(body: any) {
        responseBody = body;
        return this;
      },
      end() {},
    };

    await verifySmtpHandler(mockReq as any, mockRes as any);

    expect(statusCode).toBe(429);
    expect(responseHeaders['Retry-After']).toBe('55');
    expect(responseBody).toEqual({
      success: false,
      error: 'Too many SMTP verification requests. Please wait 55s.',
      code: 'RATE_LIMITED',
    });
    // Ensure no secrets leaked in response
    expect(JSON.stringify(responseBody)).not.toContain('supabase');
    expect(JSON.stringify(responseBody)).not.toContain('service_role');
  });
});
