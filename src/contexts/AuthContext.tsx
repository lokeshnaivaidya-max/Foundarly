import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase, PRIMARY_AUTH_KEY, FALLBACK_AUTH_KEY } from '@/lib/supabase';
import { secureLog } from '@/utils/security';
import { 
  isAllowedAdminEmail, 
  isUserAdmin, 
  isSuperAdmin, 
  isDeveloperAdmin, 
  UserRole 
} from '@/lib/authorization';

export interface Profile {
  id: string;
  role: UserRole;
  full_name: string | null;
  is_consultant?: boolean;
}

// How often an ordinary client's resolved role is re-checked. A client role can
// transition to 'consultant' when an application is approved mid-session; the
// transition is picked up on the next auth event (e.g. TOKEN_REFRESHED, which
// also fires on tab focus) once this window has elapsed. This bounds refetch
// frequency for ordinary clients instead of re-resolving on every event, while
// still detecting same-session Client → Consultant approvals.
const CLIENT_ROLE_RECHECK_MS = 5 * 60 * 1000;

// Every profile-resolution DB operation is bounded so fetchProfile ALWAYS
// settles. An unbounded awaited write (e.g. a profiles upsert) that hangs would
// wedge AuthContext `loading` on true forever — the exact cause of production
// pages stuck on "Authenticating...".
const withDbTimeout = <T,>(
  operation: PromiseLike<T>,
  label: string,
  ms = 8000
): Promise<T> =>
  Promise.race([
    Promise.resolve(operation),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`[AuthContext] ${label} timed out after ${ms}ms`)), ms)
    ),
  ]);

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName: string) => Promise<{
    error: AuthError | null;
    user?: User | null;
    session?: Session | null;
    emailConfirmationRequired?: boolean;
  }>;
  signIn: (email: string, password: string) => Promise<{
    error: AuthError | null;
    user?: User | null;
    session?: Session | null;
    profile: Profile | null;
  }>;
  signInWithGoogle: () => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>;
  updateUserPassword: (newPassword: string) => Promise<{ error: AuthError | null }>;
  isSuperAdmin: boolean;
  isDeveloperAdmin: boolean;
  isAdmin: boolean;
  isClient: boolean;
  isConsultant: boolean;
  hasRole: (role: UserRole) => boolean;
  /**
   * True when an authenticated user's role resolution definitively FAILED
   * (network/RLS after retries). Authorization must never be decided from a
   * null profile — callers must wait or show an explicit error/retry state.
   */
  roleResolutionFailed: boolean;
  /** Re-run authoritative role resolution for the current user. */
  retryProfileResolution: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Synchronously retrieve cached profile from localStorage to prevent role flicker/kicking
const getCachedProfile = (userId: string): Profile | null => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(`foundarly_profile_${userId}`);
      if (raw) return JSON.parse(raw);
    }
  } catch {
    // ignore
  }
  return null;
};

// DEGRADED-MODE ROLE CACHE: when the authoritative profiles lookup hangs or
// fails (server-side RLS/policy evaluation incident), the last
// authoritatively-resolved role for THIS authenticated user is reused so the
// session keeps working. Hard rules:
// - Entries are keyed by the authenticated userId and were ONLY ever written
//   by a prior successful authoritative resolution in this browser.
// - ELEVATED ROLES (super_admin / admin / developer_admin) are NEVER served
//   from cache — administrator authorization must come from the env allowlist
//   or an authoritative server read, never from localStorage.
// - consultant requires the live consultants lookup to NOT have positively
//   returned empty (a 200 empty result revokes the cached consultant role).
// - Stale beyond ROLE_CACHE_TTL_MS → discarded (verification-failed state).
const ROLE_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const isElevatedCacheRole = (role?: string | null): boolean =>
  role === 'super_admin' || role === 'admin' || role === 'developer_admin';

const getCachedRoleProfile = (userId: string): Profile | null => {
  const cached = getCachedProfile(userId);
  if (!cached) return null;
  const cachedAt = (cached as { cachedAt?: number }).cachedAt;
  if (typeof cachedAt === 'number' && Date.now() - cachedAt > ROLE_CACHE_TTL_MS) {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(`foundarly_profile_${userId}`);
      }
    } catch {
      // ignore
    }
    return null;
  }
  return cached;
};

// Fail-closed variant for authorization decisions: elevated roles are NEVER
// served from cache. A revoked admin/developer_admin gets the explicit
// verification-failed state, never retained access.
const getDegradedCachedRole = (userId: string): Profile | null => {
  const cached = getCachedRoleProfile(userId);
  if (!cached) return null;
  if (isElevatedCacheRole(cached.role)) {
    return null;
  }
  return cached;
};

// SIGNED_OUT purges the per-user cached profile so an account that is logged
// out never regains a stale cached role from a previous device session.
const purgeCachedProfile = (userId?: string | null) => {
  try {
    if (userId && typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(`foundarly_profile_${userId}`);
    }
  } catch {
    // ignore
  }
};

const setCachedProfile = (userId: string, p: Profile | null) => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      if (p) {
        // cachedAt: written ONLY on authoritative resolution — the degraded
        // fallback never refreshes it, so prolonged outages still expire.
        window.localStorage.setItem(
          `foundarly_profile_${userId}`,
          JSON.stringify({ ...p, cachedAt: Date.now() })
        );
      } else {
        window.localStorage.removeItem(`foundarly_profile_${userId}`);
      }
    }
  } catch {
    // ignore
  }
};

// Safely retrieve persistent Supabase session from localStorage synchronously on mount
export const getStoredSession = (): Session | null => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const primary = window.localStorage.getItem(PRIMARY_AUTH_KEY);
      const fallback = window.localStorage.getItem(FALLBACK_AUTH_KEY);
      const raw = primary || fallback;
      if (raw) {
        const parsed = JSON.parse(raw);
        const candidate = parsed?.currentSession || parsed;
        if (candidate && candidate.user && (candidate.access_token || candidate.token)) {
          return candidate as Session;
        }
      }
    }
  } catch {
    // ignore parse errors
  }
  return null;
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const initialSession = getStoredSession();
  const [session, setSession] = useState<Session | null>(initialSession);
  const [user, setUser] = useState<User | null>(initialSession?.user || null);
  // NOTE: Do NOT seed profile from the localStorage cache here. A cached Client
  // profile would be applied synchronously on the first render and could cause
  // ProtectedRoute to redirect an approved Consultant to /my-bookings before the
  // authoritative role fetch (profiles table + /api/consultant/me) completes.
  // The profile is resolved asynchronously in the mount effect below.
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);
  // Explicit terminal-unresolved flag: an authenticated user whose role
  // resolution definitively failed. ProtectedRoute must NEVER interpret a null
  // profile as 'client' — it waits or shows an explicit error/retry state.
  const [roleResolutionFailed, setRoleResolutionFailed] = useState<boolean>(false);

  // Active references to prevent stale asynchronous operations from clobbering state
  const activeUserRef = useRef<User | null>(initialSession?.user || null);
  const activeSessionRef = useRef<Session | null>(initialSession);
  const inFlightFetchRef = useRef<Map<string, Promise<Profile | null>>>(new Map());
  const isMountedRef = useRef(true);
  // Tracks whether initial session restoration has been processed, so we never
  // clear the user or flip loading=false before onAuthStateChange has had a
  // chance to deliver INITIAL_SESSION. This prevents a logged-in user from being
  // briefly routed to /login during a page refresh.
  const initialAuthProcessedRef = useRef(false);
  // Tracks whether the profile has been authoritatively resolved, so TOKEN_REFRESHED
  // events don't unnecessarily reset loading and re-fetch the same role.
  const profileResolvedRef = useRef<{ userId: string; role: string; resolvedAt: number } | null>(null);
  // Duplicate-resolution guard: concurrent auth events must not stack parallel
  // resolution loops (fetchProfile itself is de-duplicated; this guards the loop).
  const resolveInFlightRef = useRef<boolean>(false);
  // Component-scope handle to the effect-scoped resolveProfile so an explicit
  // retry can be offered when authoritative resolution definitively fails.
  const resolveProfileRef = useRef<((userId: string, currentUser: User | null, retryCount?: number) => Promise<void>) | null>(null);

  const applyAuth = (newSession: Session | null, newUser: User | null) => {
    activeSessionRef.current = newSession;
    activeUserRef.current = newUser;
    setSession(newSession);
    setUser(newUser);
  };

  useEffect(() => {
    isMountedRef.current = true;

    // Clean up any legacy localStorage admin sessions
    try {
      localStorage.removeItem('foundarly_admin_active_session');
      localStorage.removeItem('foundarly_admin_auth');
    } catch {
      // ignore
    }

    // Authoritatively resolve the user's profile (profiles table + /api/consultant/me).
    // The localStorage cache is only ever a fallback when the authoritative fetch
    // fails — it is never applied before the fresh fetch completes. This prevents an
    // approved Consultant from being routed to /my-bookings based on a stale cached
    // Client profile while the Consultant role is still being resolved.
    // Single source of truth for the controlled re-check decision (used by BOTH
    // resolveProfile and the auth listener so an already-authoritatively-resolved
    // role never re-resolves and never flashes the loading state on
    // TOKEN_REFRESHED / USER_UPDATED).
    const shouldSkipResolution = (userId: string): boolean => {
      const existing = profileResolvedRef.current;
      if (!existing || existing.userId !== userId) return false;
      if (existing.role !== 'client' && existing.role !== 'null') return true;
      return existing.role === 'client' && Date.now() - existing.resolvedAt < CLIENT_ROLE_RECHECK_MS;
    };

    const resolveProfile = async (
      userId: string,
      currentUser: User | null,
      retryCount = 0
    ) => {
      // Correlation ID: one ID per resolution CHAIN (all retries share it) so
      // structured logs can be traced end-to-end. Never logs tokens/secrets.
      const correlationId = `res_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      // Duplicate-resolution guard: concurrent auth events (SIGNED_IN +
      // INITIAL_SESSION + TOKEN_REFRESHED arriving together) must not stack
      // parallel resolution sequences for the same user. Retries (retryCount
      // > 0) are part of the SAME sequential loop and bypass this guard.
      if (resolveInFlightRef.current && retryCount === 0) {
        return;
      }
      resolveInFlightRef.current = true;
      try {
        if (shouldSkipResolution(userId)) {
          return;
        }
        secureLog.info('[AuthContext] resolveProfile: starting authoritative role resolution', {
          correlationId,
          userId,
          attempt: retryCount + 1,
          authEvent: retryCount === 0 ? 'event-driven' : 'retry',
        });
        setRoleResolutionFailed(false);
        const resolved = await fetchProfile(userId, currentUser, correlationId);
        if (resolved) {
          profileResolvedRef.current = { userId, role: resolved.role ?? 'null', resolvedAt: Date.now() };
          setRoleResolutionFailed(false);
          secureLog.info(
            '[AuthContext] resolveProfile: role resolution complete',
            { correlationId, userId, role: resolved.role ?? 'null', isConsultant: resolved.is_consultant ?? false }
          );
        } else if (retryCount < 2) {
          // Retry after a short delay to handle transient network/RLS errors
          // that could cause a consultant to be misclassified as a client
          secureLog.warn('[AuthContext] resolveProfile: attempt failed; scheduling retry', {
            correlationId, userId, nextAttempt: retryCount + 2,
          });
          await new Promise((r) => setTimeout(r, 500));
          return resolveProfile(userId, currentUser, retryCount + 1);
        } else {
          // Definitive failure: the profile is unresolved. Callers (ProtectedRoute,
          // Login) must wait or show an explicit error state — never route as client.
          setRoleResolutionFailed(true);
// Stale-request protection: only the active resolution operation may release loading
// or overwrite profile/role state. A resolution ID is tracked in resolveProfileRef; if a
// different resolution ID is detected, this catch/finally block preserves the currently-
// active chain's state and returns early so the active operation's setLoading(false) in
// the finally block can still execute.
const currentResolutionId = resolveProfileRef.current?.resolutionId;
if (currentResolutionId && currentResolutionId !== resolutionId) {
  console.warn('[AuthContext] Stale resolution request detected, preserving current state', { currentResolutionId, resolutionId });
  return;
}
const cached = getDegradedCachedRole(userId);
          secureLog.warn('[AuthContext] resolveProfile: profile resolution failed after retries', {
            correlationId, userId, attempts: retryCount + 1,
          });
        }
      } catch (err) {
        console.warn('[AuthContext] Authoritative profile resolution failed:', err);
        setRoleResolutionFailed(true);
      } finally {
        // Stale-request protection: only the active resolution operation may release
        // loading or overwrite profile/role state. A resolution ID is tracked in
        // resolveProfileRef; if a different resolution ID is detected, this finally
        // block preserves the currently-active chain's state and returns early so the
        // operation that originally set loading=true can still execute its setLoading(false).
        const currentResolutionId = resolveProfileRef.current?.resolutionId;
        if (currentResolutionId && currentResolutionId !== resolutionId) {
          console.warn('[AuthContext] Stale resolution request detected in finally, preserving current state', { currentResolutionId, resolutionId });
          return;
        }
        resolveInFlightRef.current = false;
      }
    };

    // Expose the effect-scoped resolver for explicit retries
    resolveProfileRef.current = resolveProfile;

    // Step 1: Listen for persistent auth state changes from Supabase
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      if (!isMountedRef.current) return;

      console.log(`[AuthContext] onAuthStateChange event: ${event}`, {
        hasSession: Boolean(currentSession),
        userId: currentSession?.user?.id,
      });

      if (event === 'SIGNED_OUT') {
        // Purge the per-user cached profile: a signed-out account never regains
        // a stale cached role from localStorage in this browser/device.
        purgeCachedProfile(currentSession?.user?.id ?? activeUserRef.current?.id ?? null);
        applyAuth(null, null);
        setProfile(null);
        setLoading(false);
        setAuthError(null);
        setRoleResolutionFailed(false);
        profileResolvedRef.current = null;
        return;
      }

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        if (currentSession?.user) {
          applyAuth(currentSession, currentSession.user);
          setAuthError(null);
          // STABILITY: an already-authoritatively-resolved role (privileged
          // roles, or a client within its re-check window) must NEVER restart
          // resolution nor flash the loading state when TOKEN_REFRESHED /
          // USER_UPDATED fire. The dashboard stays mounted and untouched.
          if (shouldSkipResolution(currentSession.user.id)) {
            return;
          }
          setLoading(true);
          await resolveProfile(currentSession.user.id, currentSession.user);
        }
        initialAuthProcessedRef.current = true;
        if (inFlightFetchRef.current.size === 0) {
          setLoading(false);
        }
        return;
      }

      if (event === 'INITIAL_SESSION') {
        if (currentSession?.user) {
          applyAuth(currentSession, currentSession.user);
          setAuthError(null);
          if (!shouldSkipResolution(currentSession.user.id)) {
            setLoading(true);
            await resolveProfile(currentSession.user.id, currentSession.user);
          }
        } else {
          // Non-destructive fallback: Only clear if no stored session or active user exists
          const stored = getStoredSession();
          if (stored?.user) {
            applyAuth(stored, stored.user);
            setAuthError(null);
            if (!shouldSkipResolution(stored.user.id)) {
              setLoading(true);
              await resolveProfile(stored.user.id, stored.user);
            }
          } else if (!activeUserRef.current) {
            applyAuth(null, null);
            setProfile(null);
          }
        }
        initialAuthProcessedRef.current = true;
        if (inFlightFetchRef.current.size === 0) {
          setLoading(false);
        }
      }
    });

    // Step 2: Authoritative session check via getSession without destructive racing
    supabase.auth.getSession().then(async ({ data, error }) => {
      if (!isMountedRef.current) return;
      if (error) {
        console.warn('[AuthContext] getSession notice:', error.message);
        setAuthError(error.message);
      }
      if (data?.session?.user) {
        applyAuth(data.session, data.session.user);
        setAuthError(null);
        if (!shouldSkipResolution(data.session.user.id)) {
          setLoading(true);
          await resolveProfile(data.session.user.id, data.session.user);
        }
      } else {
        // Non-destructive: check storage and active ref before clearing.
        // Do not clear the user if onAuthStateChange has not yet had a chance
        // to deliver INITIAL_SESSION; doing so could briefly route a logged-in
        // user to /login during a page refresh.
        const stored = getStoredSession();
        if (!initialAuthProcessedRef.current) {
          // onAuthStateChange has not yet processed the initial session;
          // defer to it rather than clearing user here.
          if (stored?.user && !activeUserRef.current) {
            applyAuth(stored, stored.user);
            setLoading(true);
            setAuthError(null);
            await resolveProfile(stored.user.id, stored.user);
          }
        } else if (!stored && !activeUserRef.current) {
          applyAuth(null, null);
          setProfile(null);
        }
      }
      initialAuthProcessedRef.current = true;
      if (inFlightFetchRef.current.size === 0) {
        setLoading(false);
      }
    }).catch((err) => {
      console.warn('[AuthContext] getSession error:', err);
      setAuthError(err?.message || 'Session check failed');
      initialAuthProcessedRef.current = true;
      if (inFlightFetchRef.current.size === 0) {
        setLoading(false);
      }
    });

    // Safety timeout: loading will never block the UI past 2000ms, but only when no
    // authoritative profile fetch is in flight so we never render with a stale /
    // unresolved role. ProtectedRoute must not make authorization decisions before
    // the user's role is resolved.
    const safetyTimer = setTimeout(() => {
      if (isMountedRef.current && inFlightFetchRef.current.size === 0) {
        setLoading(false);
      }
    }, 2000);

    // Hard cap: even if a profile fetch somehow outlives every individual bound,
    // release the loading state so ProtectedRoute never wedges on
    // "Authenticating..." indefinitely. Resolution completing later still
    // updates state and re-renders authorization.
    const hardCapTimer = setTimeout(() => {
      if (isMountedRef.current && inFlightFetchRef.current.size > 0) {
        secureLog.warn('[AuthContext] Profile resolution exceeded hard cap; releasing loading state');
        setLoading(false);
      }
    }, 12000);

    // Terminal watchdog: if resolution STILL has not authoritatively produced a
    // profile after 30s (e.g. supabase-js auth lock wedged by a hung startup
    // token refresh — the production incident), surface the EXPLICIT
    // verification-failed state instead of an indefinite "Verifying your
    // account...". Background resolution continues; a later success clears the
    // flag and the UI recovers automatically.
    const terminalWatchdogTimer = setTimeout(() => {
      const currentUser = activeUserRef.current;
      if (
        isMountedRef.current &&
        currentUser &&
        profileResolvedRef.current?.userId !== currentUser.id
      ) {
        secureLog.warn('[AuthContext] Profile resolution exceeded terminal watchdog; surfacing verification failure');
        setRoleResolutionFailed(true);
// Stale-request protection: only the active resolution operation may release loading
// or overwrite profile/role state. A resolution ID is tracked in resolveProfileRef; if a
// different resolution ID is detected, this catch/finally block preserves the currently-
// active chain's state and returns early so the active operation's setLoading(false) in
// the finally block can still execute.
const currentResolutionId = resolveProfileRef.current?.resolutionId;
if (currentResolutionId && currentResolutionId !== resolutionId) {
  console.warn('[AuthContext] Stale resolution request detected, preserving current state', { currentResolutionId, resolutionId });
  return;
}
const cached = getDegradedCachedRole(userId);
        setLoading(false);
      }
    }, 30000);

    return () => {
      isMountedRef.current = false;
      clearTimeout(safetyTimer);
      clearTimeout(hardCapTimer);
      clearTimeout(terminalWatchdogTimer);
      subscription.unsubscribe();
    };
  }, []);

  const fetchProfile = async (
    userId: string,
    currentUser?: User | null,
    correlationId = 'direct'
  ): Promise<Profile | null> => {
    if (inFlightFetchRef.current.has(userId)) {
      return inFlightFetchRef.current.get(userId)!;
    }

    const fetchPromise = (async () => {
      try {
        secureLog.info('[AuthContext] fetchProfile: start', { correlationId, userId });
        const targetUser = currentUser || user;
        const userEmail = (targetUser?.email || '').toLowerCase().trim();
        // Email-based consultant identity matching must only trust a VERIFIED
        // email (Supabase sets email_confirmed_at once the address is confirmed;
        // OAuth providers confirm on first sign-in). Unverified emails are never
        // used to grant consultant access.
        const emailVerified = Boolean(targetUser?.email_confirmed_at || targetUser?.confirmed_at);
        const isAllowlistedAdmin = isAllowedAdminEmail(userEmail);

        // 1a. Allowlisted Super Admin check — return immediately without waiting
        // for the DB query. Admins never need consultant role resolution.
        if (isAllowlistedAdmin) {
          const superProfile: Profile = {
            id: userId,
            role: 'super_admin',
            full_name: targetUser?.user_metadata?.full_name || targetUser?.email?.split('@')[0] || 'Super Admin',
            is_consultant: false,
          };
          setCachedProfile(userId, superProfile);
          setProfile(superProfile);
          profileResolvedRef.current = { userId, role: 'super_admin', resolvedAt: Date.now() };
          secureLog.info('[AuthContext] fetchProfile: resolved role=super_admin (allowlisted)', { correlationId, userId });
          return superProfile;
        }

        // 1b. Developer Admin (email-authoritative, per the existing
        // isDeveloperAdmin trust model): resolve immediately instead of waiting
        // on the profiles lookup, which can hang for minutes under degraded RLS.
        if (isDeveloperAdmin(targetUser ?? null, null)) {
          const resolvedDevProfile: Profile = {
            id: userId,
            role: 'developer_admin',
            full_name: targetUser?.user_metadata?.full_name || targetUser?.email?.split('@')[0] || 'Developer Admin',
            is_consultant: false,
          };
          setCachedProfile(userId, resolvedDevProfile);
          setProfile(resolvedDevProfile);
          profileResolvedRef.current = { userId, role: 'developer_admin', resolvedAt: Date.now() };
          secureLog.info('[AuthContext] fetchProfile: resolved role=developer_admin (email-authoritative)', { correlationId, userId });
          // Best-effort sync of profiles row without discarding resolution
          void (async () => {
            try {
              await withDbTimeout(
                supabase.from('profiles').upsert({
                  id: userId,
                  role: 'developer_admin',
                  full_name: resolvedDevProfile.full_name,
                }),
                'developer_admin profile upsert'
              );
            } catch {
              // ignore — resolution preserved
            }
          })();
          return resolvedDevProfile;
        }

        // Fetch DB profile AND consultant rescues CONCURRENTLY — the old
        // sequential chain blocked every dashboard behind a (sometimes hanging)
        // RLS-evaluated profiles query. Both rescue paths run against the same
        // data the sequential checks used, just in parallel with each other.
        const dbQueryPromise = supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle();

        const timeoutPromise = new Promise<{ data: null; error: Error }>((resolve) =>
          setTimeout(() => resolve({ data: null, error: new Error('Profile fetch timeout') }), 6000)
        );

        // Consultants rescue — fast server-side (~0.4s). Returns a definitive
        // outcome so a clean 200-empty response (revocation evidence) can be
        // distinguished from a timeout or network error.
        const consultantRescuePromise = (async () => {
          try {
            let q: any = supabase
              .from('consultants')
              .select('id, name, email, user_id, is_active');
            if (userEmail && emailVerified) {
              q = q.or(`user_id.eq.${userId},email.ilike.${userEmail}`);
            } else {
              q = q.eq('user_id', userId);
            }
            const outcome = await Promise.race([
              q.limit(1),
              new Promise<null>((r) => setTimeout(() => r(null), 3000)),
            ]);
            if (!outcome) return { matched: null as null, definitivelyEmpty: false };
            const outcomeWithData = outcome as { data?: Array<{ id: string; name: string | null; user_id: string | null }> };
            const rows = outcomeWithData?.data;
            if (Array.isArray(rows) && rows.length === 0) {
              return { matched: null as null, definitivelyEmpty: true };
            }
            return { matched: rows?.[0] ?? null, definitivelyEmpty: false };
          } catch {
            return { matched: null as null, definitivelyEmpty: false };
          }
        })();

        // Approved application rescue — needed only to elevate an account with
        // an approved consultant application but no linked consultants row.
        const applicationRescuePromise = (async () => {
          if (!userEmail || !emailVerified) return null;
          try {
            const outcome = await Promise.race([
              supabase
                .from('consultant_applications')
                .select('id, name, status, email')
                .ilike('email', userEmail)
                .eq('status', 'approved')
                .order('created_at', { ascending: false })
                .limit(1),
              new Promise<{ data: null }>((r) => setTimeout(() => r({ data: null }), 4000)),
            ]);
            if (!outcome) return null;
            const out = outcome as { data?: Array<{ id: string; name: string; email: string }> };
            return out?.data?.[0] ?? null;
          } catch {
            return null;
          }
        })();

        const [profilesOut, consultantOut] = await Promise.all([
          Promise.race([dbQueryPromise, timeoutPromise]),
          consultantRescuePromise,
        ]);
        const { data, error: profileFetchError } = profilesOut;
        const profileData = (data as Profile) || null;
        // A TIMED-OUT or errored profile lookup is a TRANSIENT failure, not
        // proof that the user has no profile. Treating it as "no profile"
        // misclassifies consultants as clients (the original redirect bug).
        const profilesLookupFailed = Boolean(profileFetchError);

        // 2. Existing database super_admin
        if (profileData && profileData.role === 'super_admin') {
          const superProfile: Profile = {
            id: userId,
            role: 'super_admin',
            full_name: profileData.full_name || targetUser?.user_metadata?.full_name || 'Super Admin',
            is_consultant: false,
          };
          setCachedProfile(userId, superProfile);
          setProfile(superProfile);
          profileResolvedRef.current = { userId, role: 'super_admin', resolvedAt: Date.now() };
          secureLog.info('[AuthContext] fetchProfile: resolved role=super_admin');
          return superProfile;
        }

        // 3. Existing database admin
        if (profileData && profileData.role === 'admin') {
          const adminProfile: Profile = {
            id: userId,
            role: 'admin',
            full_name: profileData.full_name || targetUser?.user_metadata?.full_name || 'Administrator',
            is_consultant: false,
          };
          setCachedProfile(userId, adminProfile);
          setProfile(adminProfile);
          profileResolvedRef.current = { userId, role: 'admin', resolvedAt: Date.now() };
          secureLog.info('[AuthContext] fetchProfile: resolved role=admin');
          return adminProfile;
        }

        // 4. Developer Admin check
        if ((profileData && profileData.role === 'developer_admin') || userEmail === 'foundarly@developer.in') {
          const resolvedDevProfile: Profile = {
            id: userId,
            role: 'developer_admin',
            full_name: profileData?.full_name || targetUser?.user_metadata?.full_name || 'Developer Admin',
            is_consultant: false,
          };
          if (!data || data.role !== 'developer_admin') {
            // BEST-EFFORT PROFILE SYNC — never discard a successful
            // developer_admin resolution because the upsert hung or failed.
            try {
              const { error: upsertErr } = await withDbTimeout(
                supabase.from('profiles').upsert({
                  id: userId,
                  role: 'developer_admin',
                  full_name: resolvedDevProfile.full_name,
                }),
                'developer_admin profile upsert'
              );
              if (upsertErr) {
                secureLog.warn('[AuthContext] Failed to upsert developer_admin profile:', {
                  correlationId,
                  userId,
                  error: upsertErr?.message || String(upsertErr),
                });
              }
            } catch (upsertFailure) {
              secureLog.warn(
                '[AuthContext] Developer_admin profile upsert did not complete; resolution preserved',
                {
                  correlationId,
                  userId,
                  error: upsertFailure instanceof Error ? upsertFailure.message : String(upsertFailure),
                }
              );
            }
          }
          setCachedProfile(userId, resolvedDevProfile);
          setProfile(resolvedDevProfile);
          profileResolvedRef.current = { userId, role: 'developer_admin', resolvedAt: Date.now() };
          secureLog.info('[AuthContext] fetchProfile: resolved role=developer_admin');
          return resolvedDevProfile;
        }

        // 5. Consultant check:
        // A user is a consultant if:
        // - profile in DB has role === 'consultant' or is_consultant === true
        // - OR /api/consultant/me returns isConsultant === true
        // - OR user is found in the consultants table by user_id OR email
        let isConsultantUser = Boolean(profileData?.role === 'consultant' || profileData?.is_consultant);
        let consultantName = profileData?.full_name;
        // Live consultants lookup outcome — a definitive 200-empty response
        // positively disconfirms a cached consultant role (fail-closed).
        let consultantLookupDefinitivelyEmpty = false;

        secureLog.info('[AuthContext] fetchProfile: consultant check initial state', {
          userId,
          profileRole: profileData?.role ?? 'null',
          profileIsConsultant: profileData?.is_consultant ?? false,
          isConsultantUser: isConsultantUser,
        });

        // IMMEDIATE consultant resolution: if profiles DB already confirms consultant role,
        // set profile immediately without waiting for /api/consultant/me or other lookups.
        // This prevents an approved Consultant from being treated as a Client due to
        // delayed or failed API calls.
        if (isConsultantUser) {
          const consultantProfile: Profile = {
            id: userId,
            role: 'consultant',
            full_name: consultantName || targetUser?.user_metadata?.full_name || 'Consultant',
            is_consultant: true,
          };

          if (!profileData || profileData.role !== 'consultant') {
            supabase.from('profiles').upsert({
              id: userId,
              full_name: consultantProfile.full_name,
              role: 'consultant',
              is_consultant: true,
            }).then();
          }

          setCachedProfile(userId, consultantProfile);
          setProfile(consultantProfile);
          profileResolvedRef.current = { userId, role: 'consultant', resolvedAt: Date.now() };
          secureLog.info('[AuthContext] fetchProfile: resolved role=consultant (from profiles DB)', { correlationId, userId });
          return consultantProfile;
        }

        // 5b. Both consultant rescues (consultants table + approved application)
        // already ran CONCURRENTLY with the profiles query — use their results.
        // The consultants rescue found the row (matched by verified email or
        // user_id). If it found nothing, its 200-empty response disconfirms a
        // cached consultant role (fail-closed).
        if (!isConsultantUser && consultantOut) {
          isConsultantUser = true;
          consultantName = consultantName || consultantOut.name;
          consultantLookupDefinitivelyEmpty = false;
          if (consultantOut.user_id !== userId) {
            supabase
              .from('consultants')
              .update({ user_id: userId } as any)
              .eq('id', consultantOut.id)
              .then();
          }
          secureLog.info('[AuthContext] fetchProfile: consultant resolved via concurrent consultants rescue', {
            correlationId, userId, consultantId: consultantOut.id,
          });
        } else if (!isConsultantUser) {
          consultantLookupDefinitivelyEmpty = true;
        }

        // The approved-application rescue also ran concurrently. It only awaits
        // here if the consultant account wasn't already resolved — healthy DBs
        // answer in <300ms; a degraded applications table costs at most 4s.
        if (!isConsultantUser) {
          const appOut = await applicationRescuePromise;
          if (appOut) {
            isConsultantUser = true;
            consultantName = consultantName || appOut.name;
            // Best-effort self-heal: ask the server to create the non-public
            // consultants draft row (bounded, non-fatal, never required).
            try {
              const sessionResult = await withDbTimeout(
                supabase.auth.getSession(),
                'self-heal session lookup',
                3000
              ).catch(() => null);
              const session = sessionResult?.data?.session ?? null;
              if (session?.access_token) {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 3500);
                await fetch('/api/consultant/me', {
                  headers: { Authorization: `Bearer ${session.access_token}` },
                  signal: controller.signal,
                }).catch(() => null);
                clearTimeout(timeoutId);
              }
            } catch (healErr) {
              console.warn('[AuthContext] Consultant self-heal notice:', healErr);
            }
          }
        }

        if (isConsultantUser) {
          const consultantProfile: Profile = {
            id: userId,
            role: 'consultant',
            full_name: consultantName || targetUser?.user_metadata?.full_name || 'Consultant',
            is_consultant: true,
          };

          if (!profileData || profileData.role !== 'consultant') {
            // BEST-EFFORT PROFILE SYNC: the consultant role was already
            // established above (profiles DB read OR consultants-table match OR
            // verified application). A hung or RLS-blocked upsert must NEVER
            // discard this successful resolution — withDbTimeout REJECTS on
            // timeout, so a bare await would throw into the outer catch and
            // convert a known consultant into an unresolved profile (the
            // "briefly visible then back to verification" production loop).
            try {
              const { error: upsertErr } = await withDbTimeout(
                supabase.from('profiles').upsert({
                  id: userId,
                  full_name: consultantProfile.full_name,
                  role: 'consultant',
                  is_consultant: true,
                }),
                'consultant profile upsert'
              );
              if (upsertErr) {
                secureLog.warn('[AuthContext] Failed to upsert consultant profile:', {
                  correlationId,
                  userId,
                  error: upsertErr?.message || String(upsertErr),
                });
              }
            } catch (upsertFailure) {
              secureLog.warn(
                '[AuthContext] Consultant profile upsert did not complete; resolution preserved',
                {
                  correlationId,
                  userId,
                  error: upsertFailure instanceof Error ? upsertFailure.message : String(upsertFailure),
                }
              );
            }
          }

          setCachedProfile(userId, consultantProfile);
          setProfile(consultantProfile);
          profileResolvedRef.current = { userId, role: 'consultant', resolvedAt: Date.now() };
          secureLog.info('[AuthContext] fetchProfile: resolved role=consultant', { correlationId, userId });
          return consultantProfile;
        }

        // 6. Regular Client — only reached if ALL consultant resolution paths failed.
        // Do NOT silently default to client if the profile fetch errored; instead,
        // return null so the caller can decide (keep loading=true, show error, etc.).
        const fallbackName = targetUser?.user_metadata?.full_name || targetUser?.email?.split('@')[0] || 'User';
        const clientProfile: Profile = {
          id: userId,
          role: 'client',
          full_name: profileData?.full_name || fallbackName,
          is_consultant: false,
        };

        // TRANSIENT FAILURE GUARD: if the profiles lookup timed out or errored,
        // the consultant checks above also ran against the same degraded
        // backend and their results are unreliable. Resolving to 'client' here
        // would misclassify an approved consultant (the original redirect bug)
        // and silently grant client-only routing. Return null instead so the
        // caller retries and — if it keeps failing — surfaces the explicit
        // verification-failed state.
        if (profilesLookupFailed && !isConsultantUser) {
          // DEGRADED-MODE FALLBACK: the authoritative profiles read hung or
          // failed. Never classify as client, but never elevate either:
          // elevated roles are NEVER served from cache (fail closed), and a
          // cached consultant role is not served when the live consultants
          // lookup positively returned empty. A verified cache entry for a
          // non-elevated role keeps this authenticated user's session working;
          // background retries and the Retry button recover the authoritative
          // state later.
          const cachedRoleProfile = getDegradedCachedRole(userId);
          const cachedRoleAllowed =
            cachedRoleProfile !== null &&
            (cachedRoleProfile.role !== 'consultant' || !consultantLookupDefinitivelyEmpty);

          if (cachedRoleProfile && cachedRoleAllowed) {
            setProfile(cachedRoleProfile);
            profileResolvedRef.current = {
              userId,
              role: cachedRoleProfile.role ?? 'null',
              resolvedAt: Date.now(),
            };
            secureLog.warn(
              '[AuthContext] fetchProfile: profile lookup failed; serving DEGRADED cached role for this authenticated user',
              { correlationId, userId, role: cachedRoleProfile.role ?? 'null' }
            );
            return cachedRoleProfile;
          }
          secureLog.warn('[AuthContext] fetchProfile: profile lookup failed; refusing client fallback', {
            correlationId,
            userId,
            profileError: profileFetchError?.message || String(profileFetchError),
          });
          return null;
        }

        if (!profileData) {
          try {
            await withDbTimeout(
              supabase.from('profiles').upsert({
                id: userId,
                full_name: fallbackName,
                role: 'client',
              }),
              'client profile upsert'
            );
          } catch {
            // ignore
          }
        }

        setCachedProfile(userId, clientProfile);
        setProfile(clientProfile);
        profileResolvedRef.current = { userId, role: 'client', resolvedAt: Date.now() };
        secureLog.info('[AuthContext] fetchProfile: resolved role=client', { correlationId, userId });
        return clientProfile;
      } catch (error) {
        secureLog.error('Error in fetchProfile:', { correlationId, userId, error: error instanceof Error ? error.message : String(error) });
        // On error, do NOT fall through to 'client'. Return null so the caller
        // can keep loading=true and retry, preventing a consultant from being
        // misclassified as a client due to a transient network/RLS error.
        return null;
      } finally {
        inFlightFetchRef.current.delete(userId);
      }
    })();

    inFlightFetchRef.current.set(userId, fetchPromise);
    return fetchPromise;
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: {
          full_name: fullName.trim(),
        },
      },
    });

    const emailConfirmationRequired = Boolean(!error && data.user && !data.session);

    if (!error && data.user) {
      applyAuth(data.session || null, data.user);
      await fetchProfile(data.user.id, data.user).catch(() => null);
    }

    return { error, user: data?.user || null, session: data?.session || null, emailConfirmationRequired };
  };

  const signIn = async (email: string, password: string) => {
    localStorage.removeItem('foundarly_admin_active_session');
    localStorage.removeItem('foundarly_admin_auth');

    const normalizedEmail = email.trim().toLowerCase();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (error) {
      return { error, user: null, session: null, profile: null };
    }

    if (data?.user) {
      applyAuth(data.session || null, data.user);
      const userProfile = await fetchProfile(data.user.id, data.user).catch(() => null);
      return { error: null, user: data.user, session: data.session || null, profile: userProfile };
    }

    return { error, user: null, session: null, profile: null };
  };

  const signInWithGoogle = async () => {
    try {
      const isIframe = window.self !== window.top;
      const redirectUrl = `${window.location.origin}/`;

      if (isIframe) {
        // Open target window synchronously during click event to bypass browser popup blockers
        const popup = window.open('about:blank', '_blank');
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: redirectUrl,
            skipBrowserRedirect: true,
          },
        });

        if (error || !data?.url) {
          if (popup) popup.close();
          return { error: error || new Error('Failed to retrieve Google OAuth authorization URL') };
        }

        if (popup) {
          popup.location.href = data.url;
        } else {
          window.location.href = data.url;
        }
        return { error: null };
      } else {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: redirectUrl,
          },
        });
        return { error };
      }
    } catch (err: any) {
      return { error: err };
    }
  };

  const resetPassword = async (email: string) => {
    try {
      const redirectTo = `${window.location.origin}/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo,
      });
      return { error };
    } catch (err: any) {
      return { error: err };
    }
  };

  const updateUserPassword = async (newPassword: string) => {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      return { error };
    } catch (err: any) {
      return { error: err };
    }
  };

  const signOut = async () => {
    try {
      localStorage.removeItem('foundarly_admin_active_session');
      localStorage.removeItem('foundarly_admin_auth');
      if (activeUserRef.current?.id) {
        setCachedProfile(activeUserRef.current.id, null);
      }
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(PRIMARY_AUTH_KEY);
        window.localStorage.removeItem(FALLBACK_AUTH_KEY);
      }
    } catch {
      // ignore
    }
    applyAuth(null, null);
    setProfile(null);
    setLoading(false);
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('[AuthContext] Supabase signOut notice:', e);
    }
  };

  const isCurrentSuperAdmin = isSuperAdmin(user, profile);
  const isCurrentDevAdmin = isDeveloperAdmin(user, profile);
  const isCurrentAdmin = isUserAdmin(user, profile);
  const isCurrentConsultant = !isCurrentAdmin && (profile?.role === 'consultant' || profile?.is_consultant === true);
  const isCurrentClient = !isCurrentAdmin && !isCurrentConsultant;

  const hasRole = (role: UserRole) => {
    if (role === 'super_admin') return isCurrentSuperAdmin;
    if (role === 'developer_admin') return isCurrentDevAdmin;
    if (role === 'admin') return isCurrentAdmin;
    if (role === 'consultant') return isCurrentConsultant;
    return isCurrentClient;
  };

  // Explicit retry after a definitive role-resolution failure. Bounded: uses the
  // same resolveProfile (all inner operations time-bounded) and always releases
  // the loading state.
  const retryProfileResolution = async () => {
    const current = activeUserRef.current;
    if (!current || !resolveProfileRef.current) return;
    setRoleResolutionFailed(false);
    setLoading(true);
    try {
      await resolveProfileRef.current(current.id, current, 0);
    } finally {
      if (inFlightFetchRef.current.size === 0) {
        setLoading(false);
      }
    }
  };

  const value = {
    user,
    profile,
    session,
    loading,
    signUp,
    signIn,
    signInWithGoogle,
    signOut,
    resetPassword,
    updateUserPassword,
    isSuperAdmin: isCurrentSuperAdmin,
    isDeveloperAdmin: isCurrentDevAdmin,
    isAdmin: isCurrentAdmin,
    isClient: isCurrentClient,
    isConsultant: isCurrentConsultant,
    hasRole,
    roleResolutionFailed,
    retryProfileResolution,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
