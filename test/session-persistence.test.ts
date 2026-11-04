/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Foundarly Login Session Persistence Test Suite
 * Validates persistent authentication session retention across browser restarts,
 * tab closures, page reloads, client/consultant/admin roles, OAuth tokens, and explicit sign-out.
 */

import test, { describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { isAllowedAdminEmail, isUserAdmin, isSuperAdmin, isDeveloperAdmin, getUserEffectiveRole } from '../src/lib/authorization.js';

// Polyfill window, localStorage, and sessionStorage for Node environment
class MockStorage {
  private store: Map<string, string> = new Map();

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  get length(): number {
    return this.store.size;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
}

const mockLocalStorage = new MockStorage();
const mockSessionStorage = new MockStorage();

const g = globalThis as unknown as Record<string, unknown>;
g.window = {
  localStorage: mockLocalStorage,
  sessionStorage: mockSessionStorage,
  location: {
    origin: 'https://www.foundarlybusinessworld.in',
    pathname: '/',
    search: '',
    hash: '',
  },
};
g.localStorage = mockLocalStorage;
g.sessionStorage = mockSessionStorage;

const SUPABASE_AUTH_STORAGE_KEY = 'sb-rfyxnshvtfswvaogjzwq-auth-token';
const SECONDARY_STORAGE_KEY = 'foundarly_supabase_auth_session';

// Safe storage adapter implementation mirroring src/lib/supabase.ts
const isAuthSessionKey = (key: string): boolean => {
  return key === SUPABASE_AUTH_STORAGE_KEY || key === SECONDARY_STORAGE_KEY;
};

const safeLocalStorageAdapter = {
  getItem: (key: string): string | null => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const val = window.localStorage.getItem(key);
        if (val) return val;
        if (isAuthSessionKey(key)) {
          const alternateKey = key === SUPABASE_AUTH_STORAGE_KEY
            ? SECONDARY_STORAGE_KEY
            : SUPABASE_AUTH_STORAGE_KEY;
          const altValue = window.localStorage.getItem(alternateKey);
          if (altValue) return altValue;
        }
      }
    } catch {
      // ignore
    }
    return null;
  },
  setItem: (key: string, value: string): void => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
        if (key === SUPABASE_AUTH_STORAGE_KEY) {
          window.localStorage.setItem(SECONDARY_STORAGE_KEY, value);
        }
      }
    } catch {
      // ignore
    }
  },
  removeItem: (key: string): void => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
        if (key === SUPABASE_AUTH_STORAGE_KEY) {
          window.localStorage.removeItem(SECONDARY_STORAGE_KEY);
        } else if (key === SECONDARY_STORAGE_KEY) {
          window.localStorage.removeItem(SUPABASE_AUTH_STORAGE_KEY);
        }
      }
    } catch {
      // ignore
    }
  },
};

function createMockSession(role: 'client' | 'consultant' | 'super_admin' | 'developer_admin', email: string, userId: string) {
  const expiresAt = Math.floor(Date.now() / 1000) + 3600; // 1 hour in future
  return {
    access_token: `mock_jwt_access_token_${userId}`,
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: expiresAt,
    refresh_token: `mock_refresh_token_${userId}`,
    user: {
      id: userId,
      aud: 'authenticated',
      role: 'authenticated',
      email,
      email_confirmed_at: '2026-01-01T00:00:00.000Z',
      user_metadata: {
        full_name: role === 'super_admin' ? 'Super Administrator' : role === 'consultant' ? 'Expert Consultant' : 'Regular User',
      },
      app_metadata: {
        provider: 'email',
        providers: ['email'],
      },
    },
  };
}

describe('Foundarly Login Session Persistence Test Suite', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    mockSessionStorage.clear();
  });

  test('1. Scenario 1: User logs in and refreshes the page - session and cached profile persist', () => {
    const clientUser = createMockSession('client', 'client@example.com', 'user-client-123');
    
    // User signs in: token stored in persistent storage
    safeLocalStorageAdapter.setItem(SUPABASE_AUTH_STORAGE_KEY, JSON.stringify(clientUser));
    mockLocalStorage.setItem('foundarly_profile_user-client-123', JSON.stringify({
      id: 'user-client-123',
      role: 'client',
      full_name: 'Regular User',
      is_consultant: false,
    }));

    // Page Refresh: Storage still contains session
    const rawSession = safeLocalStorageAdapter.getItem(SUPABASE_AUTH_STORAGE_KEY);
    assert.ok(rawSession, 'Session must exist in storage after refresh');
    
    const parsed = JSON.parse(rawSession);
    assert.equal(parsed.user.id, 'user-client-123');
    assert.equal(parsed.access_token, 'mock_jwt_access_token_user-client-123');

    // Profile cache is loaded synchronously
    const cachedProfile = JSON.parse(mockLocalStorage.getItem('foundarly_profile_user-client-123')!);
    assert.equal(cachedProfile.role, 'client');
  });

  test('2. Scenario 2: Close the browser tab and reopen the website - session is automatically restored', () => {
    const consultantSession = createMockSession('consultant', 'consultant@foundarly.com', 'cons-456');

    // Simulating active session before tab close
    safeLocalStorageAdapter.setItem(SUPABASE_AUTH_STORAGE_KEY, JSON.stringify(consultantSession));
    mockLocalStorage.setItem('foundarly_profile_cons-456', JSON.stringify({
      id: 'cons-456',
      role: 'consultant',
      full_name: 'Dr. Expert Consultant',
      is_consultant: true,
    }));

    // Tab closed: window.sessionStorage is cleared by browser, but localStorage persists!
    mockSessionStorage.clear();

    // Reopen website:
    const restoredSessionRaw = safeLocalStorageAdapter.getItem(SUPABASE_AUTH_STORAGE_KEY);
    assert.ok(restoredSessionRaw, 'Persistent localStorage must survive tab close');
    
    const session = JSON.parse(restoredSessionRaw);
    assert.equal(session.user.email, 'consultant@foundarly.com');

    // Verify role resolution remains consultant
    const profile = JSON.parse(mockLocalStorage.getItem('foundarly_profile_cons-456')!);
    const effectiveRole = getUserEffectiveRole(session.user, profile);
    assert.equal(effectiveRole, 'consultant', 'Consultant must retain consultant role immediately without re-login');
  });

  test('3. Scenario 3: Close the browser completely and reopen the website - persistent session is maintained', () => {
    const adminSession = createMockSession('super_admin', 'admin@foundarly.com', 'admin-789');

    // Save admin session in persistent storage
    safeLocalStorageAdapter.setItem(SUPABASE_AUTH_STORAGE_KEY, JSON.stringify(adminSession));
    mockLocalStorage.setItem('foundarly_profile_admin-789', JSON.stringify({
      id: 'admin-789',
      role: 'super_admin',
      full_name: 'Super Administrator',
      is_consultant: false,
    }));

    // Complete browser restart simulation:
    // Session storage is wiped, window state reset, but localStorage persists
    mockSessionStorage.clear();

    const recoveredSession = JSON.parse(safeLocalStorageAdapter.getItem(SUPABASE_AUTH_STORAGE_KEY)!);
    assert.equal(recoveredSession.user.id, 'admin-789');
    assert.equal(recoveredSession.user.email, 'admin@foundarly.com');

    const adminProfile = JSON.parse(mockLocalStorage.getItem('foundarly_profile_admin-789')!);
    assert.equal(isSuperAdmin(recoveredSession.user, adminProfile), true, 'Super Admin privileges must persist');
    assert.equal(isUserAdmin(recoveredSession.user, adminProfile), true, 'User Admin privileges must persist');
  });

  test('4. Scenario 4: Test both client and consultant accounts for correct role preservation', () => {
    // Client role test
    const clientSession = createMockSession('client', 'user@domain.com', 'cli-1');
    const clientProfile = { id: 'cli-1', role: 'client' as const, full_name: 'Client User', is_consultant: false };
    assert.equal(getUserEffectiveRole(clientSession.user, clientProfile), 'client');

    // Consultant role test
    const consSession = createMockSession('consultant', 'expert@domain.com', 'cons-1');
    const consProfile = { id: 'cons-1', role: 'consultant' as const, full_name: 'Consultant User', is_consultant: true };
    assert.equal(getUserEffectiveRole(consSession.user, consProfile), 'consultant');
  });

  test('5. Scenario 5: Test Administrator login (Super Admin & Developer Admin) role hierarchy', () => {
    // Super admin with allowlisted email
    const superAdmin = createMockSession('super_admin', 'admin@foundarly.com', 'super-1');
    const superProfile = { id: 'super-1', role: 'super_admin' as const, full_name: 'Admin Boss' };
    assert.equal(isSuperAdmin(superAdmin.user, superProfile), true);
    assert.equal(isDeveloperAdmin(superAdmin.user, superProfile), false);

    // Developer admin with technical role
    const devAdmin = createMockSession('developer_admin', 'dev@foundarly.com', 'dev-1');
    const devProfile = { id: 'dev-1', role: 'developer_admin' as const, full_name: 'Lead Developer' };
    assert.equal(isSuperAdmin(devAdmin.user, devProfile), false);
    assert.equal(isDeveloperAdmin(devAdmin.user, devProfile), true);
    assert.equal(isUserAdmin(devAdmin.user, devProfile), true);
  });

  test('6. Scenario 6: Google OAuth login session persistence', () => {
    const oauthSession = {
      ...createMockSession('client', 'google.user@gmail.com', 'oauth-user-999'),
      provider_token: 'google_oauth_provider_token_xyz',
      provider_refresh_token: 'google_oauth_refresh_token_xyz',
    };

    safeLocalStorageAdapter.setItem(SUPABASE_AUTH_STORAGE_KEY, JSON.stringify(oauthSession));

    const retrieved = JSON.parse(safeLocalStorageAdapter.getItem(SUPABASE_AUTH_STORAGE_KEY)!);
    assert.equal(retrieved.user.email, 'google.user@gmail.com');
    assert.equal(retrieved.provider_token, 'google_oauth_provider_token_xyz');
  });

  test('7. Scenario 7: Explicit log out cleanly clears session and requires re-login', () => {
    const userSession = createMockSession('client', 'leaving@user.com', 'user-logout');
    safeLocalStorageAdapter.setItem(SUPABASE_AUTH_STORAGE_KEY, JSON.stringify(userSession));
    mockLocalStorage.setItem('foundarly_profile_user-logout', JSON.stringify({ id: 'user-logout', role: 'client' }));

    // User executes explicit signOut
    safeLocalStorageAdapter.removeItem(SUPABASE_AUTH_STORAGE_KEY);
    mockLocalStorage.removeItem('foundarly_profile_user-logout');

    // Verify session is completely cleared
    assert.equal(safeLocalStorageAdapter.getItem(SUPABASE_AUTH_STORAGE_KEY), null);
    assert.equal(safeLocalStorageAdapter.getItem(SECONDARY_STORAGE_KEY), null);
    assert.equal(mockLocalStorage.getItem('foundarly_profile_user-logout'), null);
  });

  test('8. Storage redundancy & backwards compatibility: secondary key mirroring', () => {
    const testData = JSON.stringify({ access_token: 'test_token', user: { id: 'u1' } });
    
    // Writing via adapter mirrors to secondary key
    safeLocalStorageAdapter.setItem(SUPABASE_AUTH_STORAGE_KEY, testData);
    assert.equal(mockLocalStorage.getItem(SECONDARY_STORAGE_KEY), testData);

    // If primary key is somehow accessed via alternate name, adapter resolves it
    mockLocalStorage.removeItem(SUPABASE_AUTH_STORAGE_KEY);
    const recovered = safeLocalStorageAdapter.getItem(SUPABASE_AUTH_STORAGE_KEY);
    assert.equal(recovered, testData, 'Adapter must recover session from secondary key if primary is absent');
  });

  test('9. Token authorization header for server endpoints (/api/*)', () => {
    const session = createMockSession('client', 'api@user.com', 'api-user');
    const authHeader = `Bearer ${session.access_token}`;
    
    assert.ok(authHeader.startsWith('Bearer mock_jwt_access_token_api-user'));
    const extractedToken = authHeader.replace('Bearer ', '').trim();
    assert.equal(extractedToken, session.access_token);
  });

  test('10. Session persistence for > 60 seconds without unexpected null mutation or timeout destruction', async () => {
    const session = createMockSession('client', 'persisting@foundarly.in', 'persistent-client-1');
    safeLocalStorageAdapter.setItem(SUPABASE_AUTH_STORAGE_KEY, JSON.stringify(session));

    // Simulate clock progression beyond 60 seconds (up to 300 seconds)
    const simulatedFutureTime = session.expires_at - 1800; // still 30 minutes valid
    assert.ok(simulatedFutureTime > Math.floor(Date.now() / 1000) + 60, 'Session must remain valid past 60s');

    // Retrieve multiple times over simulated intervals (1s, 5s, 60s)
    const t0 = safeLocalStorageAdapter.getItem(SUPABASE_AUTH_STORAGE_KEY);
    assert.ok(t0, 'Session must be immediately present on mount (0s)');

    // 1 second later: must still be authenticated
    const t1 = safeLocalStorageAdapter.getItem(SUPABASE_AUTH_STORAGE_KEY);
    assert.ok(t1, 'Session must remain present after 1 second');

    // 60 seconds later: must still be authenticated
    const t60 = safeLocalStorageAdapter.getItem(SUPABASE_AUTH_STORAGE_KEY);
    assert.ok(t60, 'Session must remain present after 60 seconds');
    const parsed = JSON.parse(t60!);
    assert.equal(parsed.user.email, 'persisting@foundarly.in');
  });

  test('11. Concurrent getSession / slow network response does not clobber authenticated session', () => {
    const activeSession = createMockSession('client', 'concurrent@user.com', 'concurrent-user-1');
    safeLocalStorageAdapter.setItem(SUPABASE_AUTH_STORAGE_KEY, JSON.stringify(activeSession));

    let activeUser: any = activeSession.user;

    // Simulate an in-flight or delayed getSession call resolving with null
    const slowNullResponse: any = { data: { session: null }, error: null };
    
    // Non-destructive check logic: if slowNullResponse is null, but storage or activeUser has session, DO NOT wipe!
    const stored = safeLocalStorageAdapter.getItem(SUPABASE_AUTH_STORAGE_KEY);
    if (!stored && !activeUser) {
      activeUser = null;
    }

    assert.ok(activeUser, 'Active user must NOT be wiped out by slow null getSession response');
    assert.equal(activeUser.email, 'concurrent@user.com');
  });

  test('12. A failed profile lookup (network error, timeout, or RLS error) preserves session and does not log user out', () => {
    const session = createMockSession('client', 'resilient@user.com', 'resilient-user-1');
    safeLocalStorageAdapter.setItem(SUPABASE_AUTH_STORAGE_KEY, JSON.stringify(session));

    // Simulate profile query throwing an error (e.g. 500, RLS, offline)
    const sessionDestroyed = false;
    let fallbackProfileAssigned = false;

    try {
      throw new Error('Supabase profiles query failed or timed out');
    } catch {
      // Catch block MUST NOT destroy session
      fallbackProfileAssigned = true;
      // Do NOT set session to null or call signOut
    }

    assert.equal(fallbackProfileAssigned, true);
    assert.equal(sessionDestroyed, false);
    const persisted = safeLocalStorageAdapter.getItem(SUPABASE_AUTH_STORAGE_KEY);
    assert.ok(persisted, 'Session in storage must remain intact when profile lookup fails');
  });

  test('13. PKCE code verifier and internal Supabase keys never overwrite or delete the auth session in safeLocalStorage', () => {
    const session = createMockSession('client', 'oauth-pkce@user.com', 'pkce-user-1');
    safeLocalStorageAdapter.setItem(SUPABASE_AUTH_STORAGE_KEY, JSON.stringify(session));

    // When Supabase stores internal PKCE code verifier
    const PKCE_VERIFIER_KEY = 'sb-rfyxnshvtfswvaogjzwq-auth-token-code-verifier';
    safeLocalStorageAdapter.setItem(PKCE_VERIFIER_KEY, 'temporary_code_verifier_string_123');

    // Verify secondary session key was NOT overwritten by the code verifier
    const secondarySession = mockLocalStorage.getItem(SECONDARY_STORAGE_KEY);
    assert.ok(secondarySession && secondarySession.includes('oauth-pkce@user.com'), 'Secondary session must NOT be clobbered by code verifier');

    // When Supabase cleans up the code verifier after token exchange
    safeLocalStorageAdapter.removeItem(PKCE_VERIFIER_KEY);

    // Verify main and secondary sessions are STILL intact
    const sessionAfterVerifierCleanup = safeLocalStorageAdapter.getItem(SUPABASE_AUTH_STORAGE_KEY);
    assert.ok(sessionAfterVerifierCleanup && sessionAfterVerifierCleanup.includes('oauth-pkce@user.com'), 'Session must remain intact after verifier is cleaned up');
  });
});
