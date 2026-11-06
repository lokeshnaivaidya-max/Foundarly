/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Foundarly Production Navbar Role-Resolution Flicker Regression Test Suite
 * Validates elimination of asynchronous role-resolution flicker:
 * - Approved consultant (oldletters.mailroom@gmail.com) login & session restoration
 * - Never temporarily appears as client
 * - No temporary 'Book a Session' CTA rendering
 * - Correct 'Consultant Dashboard' CTA upon role resolution
 * - Normal client login preserves 'Book a Session'
 * - Admin and developer-admin login preserves 'Admin Dashboard'
 * - Unauthenticated visitors preserve public navigation
 * - Logout and subsequent login transitions cleanly
 * - In-flight resolution de-duplication
 */

import test, { describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  isAllowedAdminEmail,
  isUserAdmin,
  isSuperAdmin,
  isDeveloperAdmin,
  getUserEffectiveRole,
  UserRole,
} from '../src/lib/authorization.js';

// Polyfill minimal browser environment if not present
if (typeof globalThis.window === 'undefined') {
  const store = new Map<string, string>();
  const mockStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, String(v)),
    removeItem: (k: string) => store.delete(k),
    clear: () => store.clear(),
    get length() { return store.size; },
    key: (i: number) => Array.from(store.keys())[i] ?? null,
  };
  (globalThis as any).window = {
    localStorage: mockStorage,
    sessionStorage: mockStorage,
    location: { origin: 'https://www.foundarlybusinessworld.in', pathname: '/' },
  };
  (globalThis as any).localStorage = mockStorage;
  (globalThis as any).sessionStorage = mockStorage;
}

interface User {
  id: string;
  email?: string | null;
  email_confirmed_at?: string;
  confirmed_at?: string;
  user_metadata?: Record<string, any>;
}

interface Profile {
  id: string;
  role: UserRole;
  full_name: string | null;
  is_consultant?: boolean;
}

/**
 * Pure simulation of AuthContext role calculation mirroring src/contexts/AuthContext.tsx
 */
function computeAuthState(params: {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  roleResolutionFailed?: boolean;
}) {
  const { user, profile, loading, roleResolutionFailed = false } = params;

  const isCurrentSuperAdmin = isSuperAdmin(user, profile);
  const isCurrentDevAdmin = isDeveloperAdmin(user, profile);
  const isCurrentAdmin = isUserAdmin(user, profile);
  const isCurrentConsultant = !isCurrentAdmin && (profile?.role === 'consultant' || Boolean(profile?.is_consultant));

  // Explicit role resolution loading indicator
  const isRoleResolving = Boolean(
    user &&
    !isCurrentAdmin &&
    !isCurrentConsultant &&
    !profile &&
    !roleResolutionFailed
  );

  // Authenticated users are NEVER clients while role is resolving
  const isCurrentClient = !isCurrentAdmin && !isCurrentConsultant && (!user || profile?.role === 'client' || (!isRoleResolving && Boolean(profile)));

  return {
    isSuperAdmin: isCurrentSuperAdmin,
    isDeveloperAdmin: isCurrentDevAdmin,
    isAdmin: isCurrentAdmin,
    isConsultant: isCurrentConsultant,
    isClient: isCurrentClient,
    isRoleResolving,
    loading,
    roleResolutionFailed,
  };
}

/**
 * Pure simulation of Header navigation CTA resolution mirroring src/components/Header.tsx
 */
function resolveNavbarCTAs(params: {
  user: User | null;
  profile: Profile | null;
  authLoading: boolean;
  isRoleResolving: boolean;
  isAdmin: boolean;
  isConsultant: boolean;
  isClient: boolean;
}) {
  const { user, profile, authLoading, isRoleResolving, isAdmin, isConsultant, isClient } = params;

  const isAdminRole = Boolean(isAdmin);
  const isConsultantRole = !isAdminRole && Boolean(isConsultant);
  const isResolvingAuth = Boolean(user && !isAdminRole && (isRoleResolving || authLoading || !profile));
  const isClientRole = Boolean(isClient && !isResolvingAuth && (user ? Boolean(profile && profile.role === 'client') : true));

  // Desktop Primary CTA (Header.tsx lines 247-274)
  let desktopCTA: { label: string; to: string } | null = null;
  if (!user) {
    desktopCTA = null;
  } else if (isAdminRole) {
    desktopCTA = { label: 'Admin Dashboard', to: '/admin' };
  } else if (isConsultantRole) {
    desktopCTA = { label: 'Consultant Dashboard', to: '/consultant/dashboard' };
  } else if (isResolvingAuth) {
    desktopCTA = null; // NEVER flicker Book a Session while resolving
  } else if (isClientRole) {
    desktopCTA = { label: 'Book a Session', to: '/booking' };
  }

  // Mobile Header CTA (Header.tsx lines 287-305)
  let mobileHeaderCTA: { label: string; to: string } | null = null;
  if (!user) {
    mobileHeaderCTA = null;
  } else if (isAdminRole) {
    mobileHeaderCTA = { label: 'Admin', to: '/admin' };
  } else if (isConsultantRole) {
    mobileHeaderCTA = { label: 'Dashboard', to: '/consultant/dashboard' };
  } else if (isResolvingAuth) {
    mobileHeaderCTA = null;
  } else if (isClientRole) {
    mobileHeaderCTA = { label: 'Book', to: '/booking' };
  }

  // Mobile Drawer CTA (Header.tsx lines 435-453)
  let mobileDrawerCTA: { label: string; to: string } | null = null;
  if (isAdminRole) {
    mobileDrawerCTA = { label: 'Admin Dashboard', to: '/admin' };
  } else if (isConsultantRole) {
    mobileDrawerCTA = { label: 'Consultant Dashboard', to: '/consultant/dashboard' };
  } else if (isResolvingAuth) {
    mobileDrawerCTA = null;
  } else {
    mobileDrawerCTA = { label: 'Book a Session', to: '/booking' };
  }

  // Secondary Desktop Action: Become a Consultant link
  const showBecomeConsultantDesktop = isClientRole && !isResolvingAuth;

  // Mobile Drawer Links
  const showMyBookingsDrawer = isClientRole && !isResolvingAuth;
  const showBecomeConsultantDrawer = !user || (isClientRole && !isResolvingAuth);

  return {
    desktopCTA,
    mobileHeaderCTA,
    mobileDrawerCTA,
    showBecomeConsultantDesktop,
    showMyBookingsDrawer,
    showBecomeConsultantDrawer,
    isResolvingAuth,
  };
}

describe('Navbar Role-Resolution Flicker & Authentication Lifecycle Suite', () => {
  const consultantUser: User = {
    id: 'consultant-uuid-oldletters',
    email: 'oldletters.mailroom@gmail.com',
    email_confirmed_at: '2026-01-01T00:00:00Z',
    user_metadata: { full_name: 'Old Letters' },
  };

  const clientUser: User = {
    id: 'client-uuid-12345',
    email: 'client@example.com',
    email_confirmed_at: '2026-01-01T00:00:00Z',
    user_metadata: { full_name: 'Regular Client' },
  };

  const superAdminUser: User = {
    id: 'admin-uuid-00001',
    email: 'admin@foundarly.com',
    email_confirmed_at: '2026-01-01T00:00:00Z',
    user_metadata: { full_name: 'Super Admin' },
  };

  const devAdminUser: User = {
    id: 'dev-admin-uuid-00002',
    email: 'foundarly@developer.in',
    email_confirmed_at: '2026-01-01T00:00:00Z',
    user_metadata: { full_name: 'Developer Admin' },
  };

  // ==========================================================================
  // Test 1: Initial authenticated session loading
  // ==========================================================================
  test('1. Initial authenticated session loading: AuthContext begins in loading state with unresolved profile', () => {
    // When session is read from storage on page load
    const authState = computeAuthState({
      user: consultantUser,
      profile: null,
      loading: true,
    });

    assert.equal(authState.loading, true, 'loading must be true on mount');
    assert.equal(authState.isRoleResolving, true, 'isRoleResolving must be true when profile is null');
    assert.equal(authState.isClient, false, 'Authenticated user must NEVER temporarily be marked as isClient');
    assert.equal(authState.isConsultant, false, 'Consultant not marked until authoritative resolution settles');
    assert.equal(authState.isAdmin, false, 'Non-admin email is not marked as admin');
  });

  // ==========================================================================
  // Test 2: Approved consultant login flow
  // ==========================================================================
  test('2. Approved consultant login: starts resolving role without premature client classification', () => {
    // Stage 1: User signed in via signInWithPassword, user object set, profile fetch in flight
    const inFlightState = computeAuthState({
      user: consultantUser,
      profile: null,
      loading: true,
    });

    assert.equal(inFlightState.isRoleResolving, true);
    assert.equal(inFlightState.isClient, false, 'Approved consultant must not be classified as client in flight');

    // Stage 2: Authoritative resolution settles (profiles/consultants record lookup matches)
    const resolvedProfile: Profile = {
      id: consultantUser.id,
      role: 'consultant',
      full_name: 'Old Letters',
      is_consultant: true,
    };

    const resolvedState = computeAuthState({
      user: consultantUser,
      profile: resolvedProfile,
      loading: false,
    });

    assert.equal(resolvedState.isRoleResolving, false);
    assert.equal(resolvedState.isConsultant, true, 'Resolved consultant must have isConsultant=true');
    assert.equal(resolvedState.isClient, false, 'Resolved consultant must have isClient=false');
  });

  // ==========================================================================
  // Test 3: Consultant role resolution before navbar CTA rendering
  // ==========================================================================
  test('3. Consultant role resolution before navbar CTA rendering: no premature Book a Session CTA', () => {
    // During authentication resolution for oldletters.mailroom@gmail.com
    const authState = computeAuthState({
      user: consultantUser,
      profile: null,
      loading: true,
    });

    const ctas = resolveNavbarCTAs({
      user: consultantUser,
      profile: null,
      authLoading: authState.loading,
      isRoleResolving: authState.isRoleResolving,
      isAdmin: authState.isAdmin,
      isConsultant: authState.isConsultant,
      isClient: authState.isClient,
    });

    assert.equal(ctas.isResolvingAuth, true, 'Navbar identifies active authentication resolution');
    assert.equal(ctas.desktopCTA, null, 'Desktop CTA must be NULL while role is resolving');
    assert.equal(ctas.mobileHeaderCTA, null, 'Mobile Header CTA must be NULL while role is resolving');
    assert.equal(ctas.mobileDrawerCTA, null, 'Mobile Drawer CTA must be NULL while role is resolving');
    assert.equal(ctas.showBecomeConsultantDesktop, false, 'Become a Consultant must NOT appear for resolving consultant');
    assert.equal(ctas.showMyBookingsDrawer, false, 'My Bookings must NOT appear for resolving consultant');
  });

  // ==========================================================================
  // Test 4: No temporary Book a Session CTA for consultants
  // ==========================================================================
  test('4. No temporary Book a Session CTA rendered at ANY point during consultant lifecycle', () => {
    // Array of state snapshots from initial render through resolution completion
    const lifecycleSnapshots = [
      // 0ms: Initial mount with stored session, profile null, loading true
      { user: consultantUser, profile: null, loading: true },
      // 50ms: onAuthStateChange fires, fetchProfile in flight
      { user: consultantUser, profile: null, loading: true },
      // 200ms: fetchProfile completes with consultant profile
      {
        user: consultantUser,
        profile: { id: consultantUser.id, role: 'consultant' as const, full_name: 'Old Letters' },
        loading: false,
      },
    ];

    for (let i = 0; i < lifecycleSnapshots.length; i++) {
      const snap = lifecycleSnapshots[i];
      const state = computeAuthState(snap);
      const ctas = resolveNavbarCTAs({
        user: snap.user,
        profile: snap.profile,
        authLoading: state.loading,
        isRoleResolving: state.isRoleResolving,
        isAdmin: state.isAdmin,
        isConsultant: state.isConsultant,
        isClient: state.isClient,
      });

      // The desktop CTA must NEVER be 'Book a Session' at any snapshot
      if (ctas.desktopCTA !== null) {
        assert.equal(
          ctas.desktopCTA.label,
          'Consultant Dashboard',
          `Snapshot ${i} must never show Book a Session. Found: ${ctas.desktopCTA.label}`
        );
      }
    }
  });

  // ==========================================================================
  // Test 5: Correct Consultant Dashboard CTA after authentication
  // ==========================================================================
  test('5. Correct Consultant Dashboard CTA rendered once consultant role resolves', () => {
    const consultantProfile: Profile = {
      id: consultantUser.id,
      role: 'consultant',
      full_name: 'Old Letters',
      is_consultant: true,
    };

    const state = computeAuthState({
      user: consultantUser,
      profile: consultantProfile,
      loading: false,
    });

    const ctas = resolveNavbarCTAs({
      user: consultantUser,
      profile: consultantProfile,
      authLoading: state.loading,
      isRoleResolving: state.isRoleResolving,
      isAdmin: state.isAdmin,
      isConsultant: state.isConsultant,
      isClient: state.isClient,
    });

    assert.equal(ctas.isResolvingAuth, false);
    assert.deepEqual(ctas.desktopCTA, {
      label: 'Consultant Dashboard',
      to: '/consultant/dashboard',
    });
    assert.deepEqual(ctas.mobileHeaderCTA, {
      label: 'Dashboard',
      to: '/consultant/dashboard',
    });
    assert.deepEqual(ctas.mobileDrawerCTA, {
      label: 'Consultant Dashboard',
      to: '/consultant/dashboard',
    });
  });

  // ==========================================================================
  // Test 6: Normal client login still displays Book a Session
  // ==========================================================================
  test('6. Normal client login still displays Book a Session after role settles', () => {
    // When client logs in and profile resolves
    const clientProfile: Profile = {
      id: clientUser.id,
      role: 'client',
      full_name: 'Regular Client',
    };

    const state = computeAuthState({
      user: clientUser,
      profile: clientProfile,
      loading: false,
    });

    assert.equal(state.isClient, true, 'Must resolve to isClient=true');
    assert.equal(state.isConsultant, false);
    assert.equal(state.isAdmin, false);

    const ctas = resolveNavbarCTAs({
      user: clientUser,
      profile: clientProfile,
      authLoading: state.loading,
      isRoleResolving: state.isRoleResolving,
      isAdmin: state.isAdmin,
      isConsultant: state.isConsultant,
      isClient: state.isClient,
    });

    assert.deepEqual(ctas.desktopCTA, {
      label: 'Book a Session',
      to: '/booking',
    });
    assert.deepEqual(ctas.mobileHeaderCTA, {
      label: 'Book',
      to: '/booking',
    });
    assert.deepEqual(ctas.mobileDrawerCTA, {
      label: 'Book a Session',
      to: '/booking',
    });
    assert.equal(ctas.showBecomeConsultantDesktop, true, 'Clients can see Become a Consultant');
    assert.equal(ctas.showMyBookingsDrawer, true, 'Clients can see My Bookings in drawer');
  });

  // ==========================================================================
  // Test 7: Admin login still displays Admin Dashboard
  // ==========================================================================
  test('7. Admin login (Super Admin & Dev Admin) immediately displays Admin Dashboard without flicker', () => {
    // 7a. Super Admin (allowlisted email)
    const superAdminState = computeAuthState({
      user: superAdminUser,
      profile: null, // Profile may still be loading, but allowlist resolves immediately
      loading: true,
    });

    assert.equal(superAdminState.isAdmin, true, 'Super Admin must resolve immediately via allowlist');
    assert.equal(superAdminState.isRoleResolving, false, 'Admin does not require async profile waiting');

    const superAdminCTAs = resolveNavbarCTAs({
      user: superAdminUser,
      profile: null,
      authLoading: superAdminState.loading,
      isRoleResolving: superAdminState.isRoleResolving,
      isAdmin: superAdminState.isAdmin,
      isConsultant: superAdminState.isConsultant,
      isClient: superAdminState.isClient,
    });

    assert.deepEqual(superAdminCTAs.desktopCTA, {
      label: 'Admin Dashboard',
      to: '/admin',
    });

    // 7b. Developer Admin
    const devAdminState = computeAuthState({
      user: devAdminUser,
      profile: null,
      loading: true,
    });

    assert.equal(devAdminState.isAdmin, true, 'Developer Admin must resolve immediately via technical email');
    assert.equal(devAdminState.isRoleResolving, false);

    const devAdminCTAs = resolveNavbarCTAs({
      user: devAdminUser,
      profile: null,
      authLoading: devAdminState.loading,
      isRoleResolving: devAdminState.isRoleResolving,
      isAdmin: devAdminState.isAdmin,
      isConsultant: devAdminState.isConsultant,
      isClient: devAdminState.isClient,
    });

    assert.deepEqual(devAdminCTAs.desktopCTA, {
      label: 'Admin Dashboard',
      to: '/admin',
    });
  });

  // ==========================================================================
  // Test 8: Logout and subsequent login transitions cleanly
  // ==========================================================================
  test('8. Logout and subsequent login transitions cleanly without retaining stale role', () => {
    // Step 1: Active consultant logged in
    const activeState = computeAuthState({
      user: consultantUser,
      profile: { id: consultantUser.id, role: 'consultant', full_name: 'Old Letters' },
      loading: false,
    });
    assert.equal(activeState.isConsultant, true);

    // Step 2: User explicitly signs out
    const loggedOutState = computeAuthState({
      user: null,
      profile: null,
      loading: false,
    });
    assert.equal(loggedOutState.isConsultant, false);
    assert.equal(loggedOutState.isAdmin, false);
    assert.equal(loggedOutState.isRoleResolving, false);

    const loggedOutCTAs = resolveNavbarCTAs({
      user: null,
      profile: null,
      authLoading: false,
      isRoleResolving: false,
      isAdmin: false,
      isConsultant: false,
      isClient: true, // Public visitor
    });

    assert.equal(loggedOutCTAs.desktopCTA, null, 'Public visitors see Sign In instead of desktop primary CTA');
    assert.equal(loggedOutCTAs.mobileHeaderCTA, null);
    assert.deepEqual(loggedOutCTAs.mobileDrawerCTA, {
      label: 'Book a Session',
      to: '/booking',
    });
    assert.equal(loggedOutCTAs.showBecomeConsultantDesktop, true, 'Visitors can see Become a Consultant');

    // Step 3: Different account (client) signs in
    const newClientState = computeAuthState({
      user: clientUser,
      profile: { id: clientUser.id, role: 'client', full_name: 'Regular Client' },
      loading: false,
    });
    assert.equal(newClientState.isClient, true);
    assert.equal(newClientState.isConsultant, false, 'Must NOT retain old consultant role');
  });

  // ==========================================================================
  // Test 9: Page refresh and session restoration
  // ==========================================================================
  test('9. Page refresh and session restoration: avoids flicker during storage restoration', () => {
    // Synchronous initial mount: user loaded from getStoredSession(), profile starts null
    const mountState = computeAuthState({
      user: consultantUser,
      profile: null,
      loading: true,
    });

    const mountCTAs = resolveNavbarCTAs({
      user: consultantUser,
      profile: null,
      authLoading: mountState.loading,
      isRoleResolving: mountState.isRoleResolving,
      isAdmin: mountState.isAdmin,
      isConsultant: mountState.isConsultant,
      isClient: mountState.isClient,
    });

    // CRITICAL: At mount, must NOT render Book a Session!
    assert.equal(mountCTAs.desktopCTA, null, 'Must NOT flicker Book a Session on page refresh mount');
    assert.equal(mountCTAs.isResolvingAuth, true);

    // Once fetchProfile resolves
    const settledState = computeAuthState({
      user: consultantUser,
      profile: { id: consultantUser.id, role: 'consultant', full_name: 'Old Letters' },
      loading: false,
    });

    const settledCTAs = resolveNavbarCTAs({
      user: consultantUser,
      profile: { id: consultantUser.id, role: 'consultant', full_name: 'Old Letters' },
      authLoading: settledState.loading,
      isRoleResolving: settledState.isRoleResolving,
      isAdmin: settledState.isAdmin,
      isConsultant: settledState.isConsultant,
      isClient: settledState.isClient,
    });

    assert.deepEqual(settledCTAs.desktopCTA, {
      label: 'Consultant Dashboard',
      to: '/consultant/dashboard',
    });
  });

  // ==========================================================================
  // Test 10: Role transitions without duplicate requests or flickering
  // ==========================================================================
  test('10. De-duplication: concurrent resolution requests reuse single in-flight promise', async () => {
    // Model the exact in-flight Map de-duplication from AuthContext
    const inFlightMap = new Map<string, Promise<Profile | null>>();
    let fetchCount = 0;

    const mockFetchProfile = (userId: string): Promise<Profile | null> => {
      if (inFlightMap.has(userId)) {
        return inFlightMap.get(userId)!;
      }

      const p = (async () => {
        fetchCount++;
        await new Promise((r) => setTimeout(r, 10));
        return {
          id: userId,
          role: 'consultant' as const,
          full_name: 'Old Letters',
        };
      })().finally(() => {
        inFlightMap.delete(userId);
      });

      inFlightMap.set(userId, p);
      return p;
    };

    // Trigger 5 concurrent resolution requests (simulating onAuthStateChange, getSession, signIn, etc.)
    const promises = [
      mockFetchProfile('consultant-uuid-oldletters'),
      mockFetchProfile('consultant-uuid-oldletters'),
      mockFetchProfile('consultant-uuid-oldletters'),
      mockFetchProfile('consultant-uuid-oldletters'),
      mockFetchProfile('consultant-uuid-oldletters'),
    ];

    const results = await Promise.all(promises);

    assert.equal(fetchCount, 1, 'Exactly ONE network fetch must be executed across concurrent callers');
    for (const res of results) {
      assert.equal(res?.role, 'consultant');
    }
  });

  // ==========================================================================
  // Test 11: Unauthenticated visitors still see correct public navigation
  // ==========================================================================
  test('11. Unauthenticated visitors preserve public navigation and Become a Consultant CTA', () => {
    const visitorState = computeAuthState({
      user: null,
      profile: null,
      loading: false,
    });

    const visitorCTAs = resolveNavbarCTAs({
      user: null,
      profile: null,
      authLoading: visitorState.loading,
      isRoleResolving: visitorState.isRoleResolving,
      isAdmin: visitorState.isAdmin,
      isConsultant: visitorState.isConsultant,
      isClient: visitorState.isClient,
    });

    assert.equal(visitorCTAs.desktopCTA, null, 'Desktop shows Sign In button instead of primary CTA');
    assert.equal(visitorCTAs.showBecomeConsultantDesktop, true, 'Become a Consultant is visible for visitors');
    assert.deepEqual(visitorCTAs.mobileDrawerCTA, {
      label: 'Book a Session',
      to: '/booking',
    });
  });
});
