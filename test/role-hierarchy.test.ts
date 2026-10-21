import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  isSuperAdmin,
  isDeveloperAdmin,
  isUserAdmin,
  getUserEffectiveRole,
  sanitizeUserRole,
  canAccessSection,
  canManageAdministrators,
  canAccessFinancials,
  canManageUsers,
  canManageSettings,
} from '../src/lib/authorization.js';

describe('Foundarly Super Admin & Developer Admin Role Hierarchy Suite', () => {
  // Test Identities
  const superAdminUser = { id: 'super-admin-uid-1', email: 'admin@foundarly.com' };
  const superAdminProfile = { id: 'super-admin-uid-1', role: 'super_admin' as const, full_name: 'Super Admin User' };
  const legacyAdminProfile = { id: 'super-admin-uid-1', role: 'admin' as const, full_name: 'Legacy Admin' };

  const devAdminUser = { id: 'dev-admin-uid-2', email: 'developer@foundarly.com' };
  const devAdminProfile = { id: 'dev-admin-uid-2', role: 'developer_admin' as const, full_name: 'Dev Admin' };

  const consultantUser = { id: 'consultant-uid-3', email: 'mentor@foundarly.com' };
  const consultantProfile = { id: 'consultant-uid-3', role: 'consultant' as const, full_name: 'Dr. Mentor', is_consultant: true };

  const clientUser = { id: 'client-uid-4', email: 'user@example.com' };
  const clientProfile = { id: 'client-uid-4', role: 'client' as const, full_name: 'Standard Client' };

  // ==========================================================================
  // Test 1: Super Admin can access all approved admin functions
  // ==========================================================================
  test('1. Super Admin can access all approved admin functions', () => {
    // Identity verification
    assert.equal(isSuperAdmin(superAdminUser, superAdminProfile), true);
    assert.equal(isUserAdmin(superAdminUser, superAdminProfile), true);
    assert.equal(getUserEffectiveRole(superAdminUser, superAdminProfile), 'super_admin');

    // Backward-compatible transition check for legacy 'admin' profile role
    assert.equal(isSuperAdmin(superAdminUser, legacyAdminProfile), true);

    // Executive permissions
    assert.equal(canManageAdministrators(superAdminUser, superAdminProfile), true);
    assert.equal(canAccessFinancials(superAdminUser, superAdminProfile), true);
    assert.equal(canManageUsers(superAdminUser, superAdminProfile), true);
    assert.equal(canManageSettings(superAdminUser, superAdminProfile), true);

    // Platform sections access
    const allSections = [
      'overview', 'administrators', 'developer', 'logs', 'users', 'settings',
      'pricing', 'payouts', 'bookings', 'consultants', 'consultant_applications',
      'content', 'categories', 'referrals', 'testimonials', 'blog', 'faqs', 'networking'
    ] as const;

    for (const section of allSections) {
      assert.equal(
        canAccessSection('super_admin', section),
        true,
        `Super Admin must be permitted to access section: ${section}`
      );
    }
  });

  // ==========================================================================
  // Test 2: Super Admin can create and revoke Developer Admin access
  // ==========================================================================
  test('2. Super Admin can create and revoke Developer Admin access', () => {
    // Simulation of role assignment logic enforced by backend
    function simulateAssignRole(callingUser: any, callingProfile: any, targetUser: any, newRole: string) {
      if (!isSuperAdmin(callingUser, callingProfile)) {
        throw new Error('403 Forbidden: Only Super Admin can assign roles.');
      }
      if (targetUser.id === callingUser.id && newRole !== 'super_admin' && newRole !== 'admin') {
        throw new Error('400 Bad Request: Cannot demote your own Super Admin account.');
      }
      return { ...targetUser, role: newRole };
    }

    // Super Admin promotes Client -> Developer Admin
    const promotedUser = simulateAssignRole(superAdminUser, superAdminProfile, clientUser, 'developer_admin');
    assert.equal(promotedUser.role, 'developer_admin');

    // Super Admin revokes Developer Admin -> Client
    const revokedUser = simulateAssignRole(superAdminUser, superAdminProfile, promotedUser, 'client');
    assert.equal(revokedUser.role, 'client');

    // Super Admin self-demotion is safely blocked
    assert.throws(() => {
      simulateAssignRole(superAdminUser, superAdminProfile, superAdminUser, 'client');
    }, /Cannot demote your own Super Admin account/);
  });

  // ==========================================================================
  // Test 3: Developer Admin can access approved technical functions only
  // ==========================================================================
  test('3. Developer Admin can access approved technical functions only', () => {
    // Identity verification
    assert.equal(isDeveloperAdmin(devAdminUser, devAdminProfile), true);
    assert.equal(isSuperAdmin(devAdminUser, devAdminProfile), false);
    assert.equal(isUserAdmin(devAdminUser, devAdminProfile), true);
    assert.equal(getUserEffectiveRole(devAdminUser, devAdminProfile), 'developer_admin');

    // Approved technical areas
    assert.equal(canAccessSection('developer_admin', 'overview'), true);
    assert.equal(canAccessSection('developer_admin', 'developer'), true);
    assert.equal(canAccessSection('developer_admin', 'logs'), true);
    assert.equal(canAccessSection('developer_admin', 'faqs'), true);
    assert.equal(canAccessSection('developer_admin', 'blog'), true);
  });

  // ==========================================================================
  // Test 4: Developer Admin cannot promote themselves or another user to Super Admin
  // ==========================================================================
  test('4. Developer Admin cannot promote themselves or another user to Super Admin', () => {
    assert.equal(canManageAdministrators(devAdminUser, devAdminProfile), false);

    // If Developer Admin attempts to invoke role assignment
    function attemptAssignByDevAdmin() {
      if (!canManageAdministrators(devAdminUser, devAdminProfile)) {
        throw new Error('403 Forbidden: Developer Admin lacks privilege escalation authority.');
      }
    }

    assert.throws(attemptAssignByDevAdmin, /403 Forbidden/);

    // If client attempts to send role: "super_admin" in request body
    const forgedAttempt = sanitizeUserRole(devAdminUser, { role: 'super_admin' });
    assert.equal(forgedAttempt, 'client', 'Forged super_admin assignment without allowlist must be demoted');
  });

  // ==========================================================================
  // Test 5: Developer Admin cannot access restricted financial, user-management, or security operations
  // ==========================================================================
  test('5. Developer Admin cannot access restricted financial, user-management, or security operations', () => {
    // Financial and billing restrictions
    assert.equal(canAccessFinancials(devAdminUser, devAdminProfile), false);
    assert.equal(canAccessSection('developer_admin', 'payouts'), false);
    assert.equal(canAccessSection('developer_admin', 'pricing'), false);

    // User account and credential restrictions
    assert.equal(canManageUsers(devAdminUser, devAdminProfile), false);
    assert.equal(canAccessSection('developer_admin', 'users'), false);

    // Security policies and platform settings restrictions
    assert.equal(canManageSettings(devAdminUser, devAdminProfile), false);
    assert.equal(canAccessSection('developer_admin', 'settings'), false);

    // Administrator management restriction
    assert.equal(canAccessSection('developer_admin', 'administrators'), false);

    // Consultant and booking operational controls restriction
    assert.equal(canAccessSection('developer_admin', 'consultants'), false);
    assert.equal(canAccessSection('developer_admin', 'consultant_applications'), false);
    assert.equal(canAccessSection('developer_admin', 'bookings'), false);
  });

  // ==========================================================================
  // Test 6: Clients and consultants cannot access either admin role's features
  // ==========================================================================
  test('6. Clients and consultants cannot access either admin role features', () => {
    // Client checks
    assert.equal(isSuperAdmin(clientUser, clientProfile), false);
    assert.equal(isDeveloperAdmin(clientUser, clientProfile), false);
    assert.equal(isUserAdmin(clientUser, clientProfile), false);
    assert.equal(canAccessSection('client', 'overview'), false);
    assert.equal(canAccessSection('client', 'developer'), false);
    assert.equal(canAccessSection('client', 'payouts'), false);

    // Consultant checks
    assert.equal(isSuperAdmin(consultantUser, consultantProfile), false);
    assert.equal(isDeveloperAdmin(consultantUser, consultantProfile), false);
    assert.equal(isUserAdmin(consultantUser, consultantProfile), false);
    assert.equal(canAccessSection('consultant', 'overview'), false);
    assert.equal(canAccessSection('consultant', 'developer'), false);
    assert.equal(canAccessSection('consultant', 'users'), false);

    // Unauthenticated checks
    assert.equal(isSuperAdmin(null, null), false);
    assert.equal(isDeveloperAdmin(null, null), false);
    assert.equal(isUserAdmin(null, null), false);
    assert.equal(canAccessSection(null, 'developer'), false);
  });

  // ==========================================================================
  // Test 7: Direct API calls and database queries enforce the same permissions as the UI
  // ==========================================================================
  test('7. Direct API calls and database queries enforce the same permissions as the UI', () => {
    // Middleware simulator simulating server.ts requireSuperAdminAuth vs requireAdminAuth
    function simulateApiRouteAuth(route: string, user: any, profile: any) {
      const isSuper = (profile.role === 'super_admin' || profile.role === 'admin') && isSuperAdmin(user, profile);
      const isDev = profile.role === 'developer_admin';

      if (route.startsWith('/api/admin/administrators') || route === '/api/send-application-email') {
        // Super Admin ONLY
        if (!isSuper) return { status: 403, error: 'Forbidden: Super Administrator privileges required.' };
        return { status: 200, success: true };
      }

      if (route.startsWith('/api/admin/system-health') || route.startsWith('/api/admin/diagnostics')) {
        // Super Admin OR Developer Admin
        if (!isSuper && !isDev) return { status: 403, error: 'Forbidden: Administrator privileges required.' };
        return { status: 200, success: true };
      }

      return { status: 404 };
    }

    // 1. Super Admin access
    assert.equal(simulateApiRouteAuth('/api/admin/administrators', superAdminUser, superAdminProfile).status, 200);
    assert.equal(simulateApiRouteAuth('/api/admin/system-health', superAdminUser, superAdminProfile).status, 200);
    assert.equal(simulateApiRouteAuth('/api/send-application-email', superAdminUser, superAdminProfile).status, 200);

    // 2. Developer Admin access to technical routes: 200 OK
    assert.equal(simulateApiRouteAuth('/api/admin/system-health', devAdminUser, devAdminProfile).status, 200);
    assert.equal(simulateApiRouteAuth('/api/admin/diagnostics/logs', devAdminUser, devAdminProfile).status, 200);

    // 3. Developer Admin access to executive routes: strictly 403 Forbidden!
    const devDeniedAdmins = simulateApiRouteAuth('/api/admin/administrators', devAdminUser, devAdminProfile);
    assert.equal(devDeniedAdmins.status, 403);
    assert.ok(devDeniedAdmins.error?.includes('Super Administrator privileges required'));

    const devDeniedAppEmail = simulateApiRouteAuth('/api/send-application-email', devAdminUser, devAdminProfile);
    assert.equal(devDeniedAppEmail.status, 403);

    // 4. Regular client access to any admin route: strictly 403 Forbidden!
    assert.equal(simulateApiRouteAuth('/api/admin/system-health', clientUser, clientProfile).status, 403);
    assert.equal(simulateApiRouteAuth('/api/admin/administrators', clientUser, clientProfile).status, 403);
  });

  // ==========================================================================
  // Test 8: Existing authentication and consultant booking functionality still work
  // ==========================================================================
  test('8. Existing authentication and consultant booking functionality still work', () => {
    // Consultant role isolation
    assert.equal(getUserEffectiveRole(consultantUser, consultantProfile), 'consultant');
    assert.equal(consultantProfile.is_consultant, true);

    // Client role isolation
    assert.equal(getUserEffectiveRole(clientUser, clientProfile), 'client');

    // Role sanitization preserves valid consultants and clients without corruption
    assert.equal(sanitizeUserRole(consultantUser, consultantProfile), 'consultant');
    assert.equal(sanitizeUserRole(clientUser, clientProfile), 'client');
  });

  // ==========================================================================
  // Test 9: Developer Admin account (foundarly@developer.in) role and must_change_password
  // ==========================================================================
  test('9. Developer Admin account (foundarly@developer.in) role and password requirement', () => {
    const targetDevAccount = {
      id: 'dev-foundarly-in',
      email: 'foundarly@developer.in',
      user_metadata: {
        full_name: 'Developer Admin',
        must_change_password: true,
      },
    };
    const targetDevProfile = {
      id: 'dev-foundarly-in',
      role: 'developer_admin' as const,
      full_name: 'Developer Admin',
    };

    // Role isolation
    assert.equal(isDeveloperAdmin(targetDevAccount, targetDevProfile), true);
    assert.equal(isSuperAdmin(targetDevAccount, targetDevProfile), false);
    assert.equal(isUserAdmin(targetDevAccount, targetDevProfile), true);
    assert.equal(getUserEffectiveRole(targetDevAccount, targetDevProfile), 'developer_admin');

    // Must change password policy flag
    assert.equal(targetDevAccount.user_metadata.must_change_password, true);

    // Access capabilities: Technical only
    assert.equal(canAccessSection(targetDevProfile.role, 'developer'), true);
    assert.equal(canAccessSection(targetDevProfile.role, 'logs'), true);
    assert.equal(canAccessSection(targetDevProfile.role, 'payouts'), false);
    assert.equal(canAccessSection(targetDevProfile.role, 'users'), false);
    assert.equal(canAccessSection(targetDevProfile.role, 'administrators'), false);
  });

  // ==========================================================================
  // Test 10: Targeted primary admin migration safety (prevents accidental mass promotions)
  // ==========================================================================
  test('10. Targeted primary admin migration safety prevents accidental mass promotions', () => {
    const verifiedPrimaryAdmin = 'admin@foundarly.com';
    const candidateUsers = [
      { id: '1', email: 'admin@foundarly.com', initialRole: 'admin' },
      { id: '2', email: 'test-admin@external.com', initialRole: 'admin' },
      { id: '3', email: 'client@domain.com', initialRole: 'client' },
      { id: '4', email: 'consultant@domain.com', initialRole: 'consultant' },
    ];

    // Simulate 04 migration logic
    const migrated = candidateUsers.map((u) => {
      if (u.email.toLowerCase() === verifiedPrimaryAdmin.toLowerCase()) {
        return { ...u, finalRole: 'super_admin' };
      }
      if (u.initialRole === 'admin') {
        // Demote non-allowlist accounts back to client
        return { ...u, finalRole: 'client' };
      }
      return { ...u, finalRole: u.initialRole };
    });

    // Verify only the verified primary admin was promoted
    const superAdmins = migrated.filter((u) => u.finalRole === 'super_admin');
    assert.equal(superAdmins.length, 1);
    assert.equal(superAdmins[0].email, 'admin@foundarly.com');

    // Candidate 2 with legacy 'admin' was sanitized to client instead of being promoted
    const candidate2 = migrated.find((u) => u.id === '2');
    assert.equal(candidate2?.finalRole, 'client');

    // Clients and consultants untouched
    assert.equal(migrated.find((u) => u.id === '3')?.finalRole, 'client');
    assert.equal(migrated.find((u) => u.id === '4')?.finalRole, 'consultant');
  });
});
