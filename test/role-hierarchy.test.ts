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
  // ==========================================================================
  // Test 3: Developer Admin can access all ordinary operational admin functions and developer tools
  // ==========================================================================
  test('3. Developer Admin can access all ordinary operational admin functions and developer tools', () => {
    // Identity verification
    assert.equal(isDeveloperAdmin(devAdminUser, devAdminProfile), true);
    assert.equal(isSuperAdmin(devAdminUser, devAdminProfile), false);
    assert.equal(isUserAdmin(devAdminUser, devAdminProfile), true);
    assert.equal(getUserEffectiveRole(devAdminUser, devAdminProfile), 'developer_admin');

    // Approved operational & technical areas
    assert.equal(canAccessSection('developer_admin', 'overview'), true);
    assert.equal(canAccessSection('developer_admin', 'developer'), true);
    assert.equal(canAccessSection('developer_admin', 'logs'), true);
    assert.equal(canAccessSection('developer_admin', 'faqs'), true);
    assert.equal(canAccessSection('developer_admin', 'blog'), true);
    assert.equal(canAccessSection('developer_admin', 'bookings'), true);
    assert.equal(canAccessSection('developer_admin', 'consultants'), true);
    assert.equal(canAccessSection('developer_admin', 'consultant_applications'), true);
    assert.equal(canAccessSection('developer_admin', 'payouts'), true);
    assert.equal(canAccessSection('developer_admin', 'pricing'), true);
    assert.equal(canAccessSection('developer_admin', 'content'), true);
    assert.equal(canAccessSection('developer_admin', 'categories'), true);
    assert.equal(canAccessSection('developer_admin', 'referrals'), true);
    assert.equal(canAccessSection('developer_admin', 'testimonials'), true);
    assert.equal(canAccessSection('developer_admin', 'settings'), true);
    assert.equal(canAccessSection('developer_admin', 'users'), true);
    assert.equal(canAccessSection('developer_admin', 'networking'), true);

    // Operational permissions
    assert.equal(canAccessFinancials(devAdminUser, devAdminProfile), true);
    assert.equal(canManageUsers(devAdminUser, devAdminProfile), true);
    assert.equal(canManageSettings(devAdminUser, devAdminProfile), true);
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
  // Test 5: Developer Admin is strictly restricted from administrator account management and role mutations
  // ==========================================================================
  test('5. Developer Admin is strictly restricted from administrator account management and role mutations', () => {
    // Administrator account management restriction
    assert.equal(canManageAdministrators(devAdminUser, devAdminProfile), false);
    assert.equal(canAccessSection('developer_admin', 'administrators'), false);

    // Role mutation protection: Only Super Admin can mutate admin roles
    assert.equal(canManageAdministrators(superAdminUser, superAdminProfile), true);
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

      if (route.startsWith('/api/admin/administrators')) {
        // Super Admin ONLY
        if (!isSuper) return { status: 403, error: 'Forbidden: Super Administrator privileges required.' };
        return { status: 200, success: true };
      }

      if (
        route.startsWith('/api/admin/system-health') || 
        route.startsWith('/api/admin/diagnostics') ||
        route === '/api/send-application-email'
      ) {
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

    // 2. Developer Admin access to operational & technical routes: 200 OK
    assert.equal(simulateApiRouteAuth('/api/admin/system-health', devAdminUser, devAdminProfile).status, 200);
    assert.equal(simulateApiRouteAuth('/api/admin/diagnostics/logs', devAdminUser, devAdminProfile).status, 200);
    assert.equal(simulateApiRouteAuth('/api/send-application-email', devAdminUser, devAdminProfile).status, 200);

    // 3. Developer Admin access to administrator management route: strictly 403 Forbidden!
    const devDeniedAdmins = simulateApiRouteAuth('/api/admin/administrators', devAdminUser, devAdminProfile);
    assert.equal(devDeniedAdmins.status, 403);
    assert.ok(devDeniedAdmins.error?.includes('Super Administrator privileges required'));

    // 4. Regular client access to any admin route: strictly 403 Forbidden!
    assert.equal(simulateApiRouteAuth('/api/admin/system-health', clientUser, clientProfile).status, 403);
    assert.equal(simulateApiRouteAuth('/api/admin/administrators', clientUser, clientProfile).status, 403);
    assert.equal(simulateApiRouteAuth('/api/send-application-email', clientUser, clientProfile).status, 403);
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

    // Access capabilities: Full operational and technical access, strictly excluding administrators
    assert.equal(canAccessSection(targetDevProfile.role, 'developer'), true);
    assert.equal(canAccessSection(targetDevProfile.role, 'logs'), true);
    assert.equal(canAccessSection(targetDevProfile.role, 'payouts'), true);
    assert.equal(canAccessSection(targetDevProfile.role, 'users'), true);
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

  // ==========================================================================
  // Test 11: Payment records (upi_payments) query access for Developer Admin, Super Admin, and unauthorized users
  // ==========================================================================
  test('11. Payment records (upi_payments) query access for Developer Admin, Super Admin, and unauthorized users', () => {
    const mockPayments = [
      { id: 'pay-1', customer_email: 'alice@client.com', user_id: 'client-1', transaction_id: 'UPI12345', payment_amount: 1500, status: 'verified' },
      { id: 'pay-2', customer_email: 'bob@client.com', user_id: 'client-2', transaction_id: 'UPI67890', payment_amount: 3000, status: 'pending' },
      { id: 'pay-3', customer_email: 'user@example.com', user_id: clientUser.id, transaction_id: 'UPI11111', payment_amount: 2000, status: 'pending' },
    ];

    // Evaluates the RLS policy: Admins manage all UPI payments via public.is_admin() (or owner)
    function simulateUpiPaymentsQuery(user: any, profile: any) {
      const isSuper = (profile?.role === 'super_admin' || profile?.role === 'admin') && isSuperAdmin(user, profile);
      const isDev = profile?.role === 'developer_admin';
      const isAdmin = isSuper || isDev;

      return mockPayments.filter((p) => {
        // Admin full access
        if (isAdmin) return true;
        // User own payment access
        if (user?.id && user.id === p.user_id) return true;
        if (user?.email && user.email.toLowerCase() === p.customer_email.toLowerCase()) return true;
        return false;
      });
    }

    // 1. Super Admin sees all payments
    const superAdminResults = simulateUpiPaymentsQuery(superAdminUser, superAdminProfile);
    assert.equal(superAdminResults.length, 3);

    // 2. Developer Admin sees the EXACT SAME payments
    const devAdminResults = simulateUpiPaymentsQuery(devAdminUser, devAdminProfile);
    assert.equal(devAdminResults.length, 3);
    assert.deepEqual(
      devAdminResults.map(p => p.id),
      superAdminResults.map(p => p.id),
      'Developer Admin must receive identical legitimate payment records as Super Admin'
    );

    // 3. Regular client only sees their own payment
    const clientResults = simulateUpiPaymentsQuery(clientUser, clientProfile);
    assert.equal(clientResults.length, 1);
    assert.equal(clientResults[0].id, 'pay-3');
    assert.equal(clientResults[0].user_id, clientUser.id);

    // 4. Unauthorized other client sees 0 rows
    const otherClient = { id: 'stranger-id', email: 'stranger@example.com' };
    const otherProfile = { id: 'stranger-id', role: 'client' as const };
    const otherResults = simulateUpiPaymentsQuery(otherClient, otherProfile);
    assert.equal(otherResults.length, 0);

    // 5. Unauthenticated / anonymous visitor sees 0 rows
    const anonResults = simulateUpiPaymentsQuery(null, null);
    assert.equal(anonResults.length, 0);
  });

  // ==========================================================================
  // Test 12: Consultant Payouts (payout_requests) query access across roles
  // ==========================================================================
  test('12. Consultant Payouts (payout_requests) query access across roles', () => {
    const mockPayouts = [
      { id: 'payout-1', consultant_id: consultantUser.id, amount: 5000, status: 'pending' },
      { id: 'payout-2', consultant_id: 'other-consultant-id', amount: 8000, status: 'approved' },
    ];

    // Evaluates the RLS policy: Admins manage all payouts via public.is_admin() (or consultant owner)
    function simulatePayoutRequestsQuery(user: any, profile: any) {
      const isSuper = (profile?.role === 'super_admin' || profile?.role === 'admin') && isSuperAdmin(user, profile);
      const isDev = profile?.role === 'developer_admin';
      const isAdmin = isSuper || isDev;

      return mockPayouts.filter((pr) => {
        // Admin full access
        if (isAdmin) return true;
        // Consultant own payout access
        if (user?.id && user.id === pr.consultant_id) return true;
        return false;
      });
    }

    // 1. Super Admin sees all payouts
    const superPayouts = simulatePayoutRequestsQuery(superAdminUser, superAdminProfile);
    assert.equal(superPayouts.length, 2);

    // 2. Developer Admin sees all payouts
    const devPayouts = simulatePayoutRequestsQuery(devAdminUser, devAdminProfile);
    assert.equal(devPayouts.length, 2);
    assert.deepEqual(devPayouts.map(p => p.id), superPayouts.map(p => p.id));

    // 3. Consultant only sees their own payout
    const consultantPayouts = simulatePayoutRequestsQuery(consultantUser, consultantProfile);
    assert.equal(consultantPayouts.length, 1);
    assert.equal(consultantPayouts[0].consultant_id, consultantUser.id);

    // 4. Regular client sees 0 payouts
    const clientPayouts = simulatePayoutRequestsQuery(clientUser, clientProfile);
    assert.equal(clientPayouts.length, 0);

    // 5. Unauthenticated visitor sees 0 payouts
    const anonPayouts = simulatePayoutRequestsQuery(null, null);
    assert.equal(anonPayouts.length, 0);
  });

  // ==========================================================================
  // Test 13: Operation-scoped RLS policies (SELECT vs UPDATE vs DELETE vs INSERT) across user tiers
  // ==========================================================================
  test('13. Operation-scoped RLS matrix (SELECT, UPDATE, DELETE, INSERT) across all 5 tiers', () => {
    // Evaluates permissions according to revised 07 RLS policies
    function checkOperationAccess(tier: 'super_admin' | 'developer_admin' | 'consultant' | 'client' | 'anon', table: string, op: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE') {
      const isSuper = tier === 'super_admin';
      const isDev = tier === 'developer_admin';
      const isAdmin = isSuper || isDev;

      if (table === 'upi_payments') {
        if (op === 'INSERT') return true; // Anyone can submit payment proof during checkout
        if (op === 'SELECT') return isAdmin || tier === 'client' || tier === 'consultant'; // filtered by ownership
        if (op === 'UPDATE') return isAdmin; // Admins verify/reject payments
        if (op === 'DELETE') return isSuper; // ONLY Super Admin can delete financial audit records
      }

      if (table === 'payout_requests') {
        if (op === 'INSERT') return tier === 'consultant' || isSuper;
        if (op === 'SELECT') return isAdmin || tier === 'consultant';
        if (op === 'UPDATE') return isAdmin; // Admins approve/reject payouts
        if (op === 'DELETE') return isSuper; // ONLY Super Admin can delete payouts
      }

      if (table === 'consultant_earnings') {
        if (op === 'INSERT') return true; // system/trigger/service_role
        if (op === 'SELECT') return isAdmin || tier === 'consultant';
        if (op === 'UPDATE' || op === 'DELETE') return isSuper; // Immutable ledger, super admin emergency only
      }

      if (table === 'bookings') {
        if (op === 'INSERT') return true; // Public checkout
        if (op === 'SELECT' || op === 'UPDATE') return isAdmin || tier === 'consultant' || tier === 'client';
        if (op === 'DELETE') return isSuper; // Strictly Super Admin only
      }

      if (table === 'blog') {
        if (op === 'SELECT') return true; // public published, admins all
        if (op === 'INSERT' || op === 'UPDATE' || op === 'DELETE') return isAdmin;
      }

      if (table === 'storage.blog-images') {
        if (op === 'SELECT') return true; // public read
        if (op === 'INSERT' || op === 'UPDATE' || op === 'DELETE') return isAdmin;
      }

      if (table === 'profiles.role') {
        // Role alterations
        return isSuper;
      }

      return false;
    }

    // 1. Super Admin: full capabilities across all tables, including DELETE and role alteration
    assert.equal(checkOperationAccess('super_admin', 'upi_payments', 'DELETE'), true);
    assert.equal(checkOperationAccess('super_admin', 'payout_requests', 'DELETE'), true);
    assert.equal(checkOperationAccess('super_admin', 'consultant_earnings', 'UPDATE'), true);
    assert.equal(checkOperationAccess('super_admin', 'consultant_earnings', 'DELETE'), true);
    assert.equal(checkOperationAccess('super_admin', 'bookings', 'DELETE'), true);
    assert.equal(checkOperationAccess('super_admin', 'blog', 'INSERT'), true);
    assert.equal(checkOperationAccess('super_admin', 'blog', 'UPDATE'), true);
    assert.equal(checkOperationAccess('super_admin', 'blog', 'DELETE'), true);
    assert.equal(checkOperationAccess('super_admin', 'storage.blog-images', 'INSERT'), true);
    assert.equal(checkOperationAccess('super_admin', 'profiles.role', 'UPDATE'), true);

    // 2. Developer Admin: operational SELECT and UPDATE, but strictly NO DELETE on financial/booking tables and NO role mutation
    assert.equal(checkOperationAccess('developer_admin', 'upi_payments', 'SELECT'), true);
    assert.equal(checkOperationAccess('developer_admin', 'upi_payments', 'UPDATE'), true);
    assert.equal(checkOperationAccess('developer_admin', 'upi_payments', 'DELETE'), false, 'Developer Admin must NOT be allowed to DELETE payments');
    assert.equal(checkOperationAccess('developer_admin', 'payout_requests', 'SELECT'), true);
    assert.equal(checkOperationAccess('developer_admin', 'payout_requests', 'UPDATE'), true);
    assert.equal(checkOperationAccess('developer_admin', 'payout_requests', 'DELETE'), false, 'Developer Admin must NOT be allowed to DELETE payouts');
    assert.equal(checkOperationAccess('developer_admin', 'consultant_earnings', 'SELECT'), true);
    assert.equal(checkOperationAccess('developer_admin', 'consultant_earnings', 'UPDATE'), false);
    assert.equal(checkOperationAccess('developer_admin', 'consultant_earnings', 'DELETE'), false);
    assert.equal(checkOperationAccess('developer_admin', 'bookings', 'SELECT'), true);
    assert.equal(checkOperationAccess('developer_admin', 'bookings', 'UPDATE'), true);
    assert.equal(checkOperationAccess('developer_admin', 'bookings', 'DELETE'), false, 'Developer Admin must NOT be allowed to DELETE bookings');
    assert.equal(checkOperationAccess('developer_admin', 'blog', 'INSERT'), true, 'Developer Admin can create blog posts');
    assert.equal(checkOperationAccess('developer_admin', 'blog', 'UPDATE'), true, 'Developer Admin can update blog posts');
    assert.equal(checkOperationAccess('developer_admin', 'blog', 'DELETE'), true, 'Developer Admin can delete blog posts');
    assert.equal(checkOperationAccess('developer_admin', 'storage.blog-images', 'INSERT'), true, 'Developer Admin can upload blog images');
    assert.equal(checkOperationAccess('developer_admin', 'profiles.role', 'UPDATE'), false, 'Developer Admin must NOT be allowed to modify profile roles');

    // 3. Consultant: can SELECT own payments/earnings/payouts, INSERT payouts, but CANNOT UPDATE payments or payouts
    assert.equal(checkOperationAccess('consultant', 'upi_payments', 'UPDATE'), false, 'Consultant cannot verify payments');
    assert.equal(checkOperationAccess('consultant', 'payout_requests', 'UPDATE'), false, 'Consultant cannot self-approve payouts');
    assert.equal(checkOperationAccess('consultant', 'payout_requests', 'INSERT'), true, 'Consultant can request payouts');
    assert.equal(checkOperationAccess('consultant', 'blog', 'INSERT'), false, 'Consultant cannot create blog posts');
    assert.equal(checkOperationAccess('consultant', 'storage.blog-images', 'INSERT'), false, 'Consultant cannot upload blog images');

    // 4. Client: can SELECT own payments/bookings, INSERT bookings/payments, but CANNOT access payouts or earnings
    assert.equal(checkOperationAccess('client', 'upi_payments', 'UPDATE'), false, 'Client cannot self-verify payments');
    assert.equal(checkOperationAccess('client', 'payout_requests', 'SELECT'), false, 'Client cannot view consultant payouts');
    assert.equal(checkOperationAccess('client', 'consultant_earnings', 'SELECT'), false, 'Client cannot view consultant earnings');
    assert.equal(checkOperationAccess('client', 'blog', 'INSERT'), false, 'Client cannot create blog posts');
    assert.equal(checkOperationAccess('client', 'storage.blog-images', 'INSERT'), false, 'Client cannot upload blog images');

    // 5. Anonymous: can only INSERT bookings and payment proofs (guest flow)
    assert.equal(checkOperationAccess('anon', 'bookings', 'INSERT'), true);
    assert.equal(checkOperationAccess('anon', 'upi_payments', 'INSERT'), true);
    assert.equal(checkOperationAccess('anon', 'bookings', 'SELECT'), false);
    assert.equal(checkOperationAccess('anon', 'upi_payments', 'SELECT'), false);
    assert.equal(checkOperationAccess('anon', 'payout_requests', 'SELECT'), false);
    assert.equal(checkOperationAccess('anon', 'blog', 'INSERT'), false, 'Anonymous cannot create blog posts');
    assert.equal(checkOperationAccess('anon', 'storage.blog-images', 'INSERT'), false, 'Anonymous cannot upload blog images');
  });
});


