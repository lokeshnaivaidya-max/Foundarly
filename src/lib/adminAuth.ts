/**
 * LEGACY ADMIN AUTHENTICATION HELPERS (DEPRECATED)
 * All authentication now strictly uses Supabase auth & RLS database profile roles.
 */

export function loginAdmin(_email: string, _password: string) {
  console.warn('loginAdmin is deprecated. Use Supabase auth via AuthContext.');
  return { success: false, message: 'Legacy auth disabled. Please sign in via Supabase.' };
}

export function logoutAdmin() {
  localStorage.removeItem('foundarly_admin_auth');
}

export function isAdminAuthenticated() {
  return false;
}

