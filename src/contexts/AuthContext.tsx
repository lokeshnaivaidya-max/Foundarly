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

const setCachedProfile = (userId: string, p: Profile | null) => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      if (p) {
        window.localStorage.setItem(`foundarly_profile_${userId}`, JSON.stringify(p));
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
  const profileResolvedRef = useRef<{ userId: string; role: string } | null>(null);

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
    const resolveProfile = async (userId: string, currentUser: User | null) => {
      try {
        // Skip re-resolution if profile already resolved for this user/role
        const existing = profileResolvedRef.current;
        if (existing && existing.userId === userId) {
          // Role already resolved; no need to re-fetch on TOKEN_REFRESHED
          return;
        }
        secureLog.info('[AuthContext] resolveProfile: starting authoritative role resolution');
        const resolved = await fetchProfile(userId, currentUser);
        profileResolvedRef.current = { userId, role: resolved?.role ?? 'null' };
        secureLog.info(
          '[AuthContext] resolveProfile: role resolution complete',
          { role: resolved?.role ?? 'null', isConsultant: resolved?.is_consultant ?? false }
        );
      } catch (err) {
        console.warn('[AuthContext] Authoritative profile resolution failed:', err);
        const cached = getCachedProfile(userId);
        if (cached) setProfile(cached);
      }
    };

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
        applyAuth(null, null);
        setProfile(null);
        setLoading(false);
        setAuthError(null);
        profileResolvedRef.current = null;
        return;
      }

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        if (currentSession?.user) {
          applyAuth(currentSession, currentSession.user);
          setLoading(true);
          setAuthError(null);
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
          setLoading(true);
          setAuthError(null);
          await resolveProfile(currentSession.user.id, currentSession.user);
        } else {
          // Non-destructive fallback: Only clear if no stored session or active user exists
          const stored = getStoredSession();
          if (stored?.user) {
            applyAuth(stored, stored.user);
            setLoading(true);
            setAuthError(null);
            await resolveProfile(stored.user.id, stored.user);
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
        setLoading(true);
        setAuthError(null);
        await resolveProfile(data.session.user.id, data.session.user);
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

    // Safety timeout: loading will never block the UI past 2000ms, even if an
    // authoritative profile fetch is still in flight. The profile will continue
    // resolving in the background and update state when complete.
    const safetyTimer = setTimeout(() => {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }, 2000);

    return () => {
      isMountedRef.current = false;
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, []);

  const fetchProfile = async (userId: string, currentUser?: User | null): Promise<Profile | null> => {
    if (inFlightFetchRef.current.has(userId)) {
      return inFlightFetchRef.current.get(userId)!;
    }

    const fetchPromise = (async () => {
      try {
        const targetUser = currentUser || user;
        const userEmail = (targetUser?.email || '').toLowerCase().trim();
        const isAllowlistedAdmin = isAllowedAdminEmail(userEmail);

        // 1. Allowlisted Super Admin check — return immediately without waiting
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
          profileResolvedRef.current = { userId, role: 'super_admin' };
          secureLog.info('[AuthContext] fetchProfile: resolved role=super_admin (allowlisted)');
          return superProfile;
        }

        // Fetch DB profile with a 6-second timeout promise race so it never hangs
        const dbQueryPromise = supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle();

        const timeoutPromise = new Promise<{ data: null; error: Error }>((resolve) =>
          setTimeout(() => resolve({ data: null, error: new Error('Profile fetch timeout') }), 6000)
        );

        const { data } = await Promise.race([dbQueryPromise, timeoutPromise]);
        const profileData = (data as Profile) || null;

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
          profileResolvedRef.current = { userId, role: 'super_admin' };
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
          profileResolvedRef.current = { userId, role: 'admin' };
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
            supabase.from('profiles').upsert({
              id: userId,
              role: 'developer_admin',
              full_name: resolvedDevProfile.full_name,
            }).then();
          }
          setCachedProfile(userId, resolvedDevProfile);
          setProfile(resolvedDevProfile);
          profileResolvedRef.current = { userId, role: 'developer_admin' };
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

        secureLog.info('[AuthContext] fetchProfile: consultant check initial state', {
          userId,
          profileRole: profileData?.role ?? 'null',
          profileIsConsultant: profileData?.is_consultant ?? false,
          isConsultantUser: isConsultantUser,
        });

        // Try server-side authoritative check first
        try {
          const session = (await supabase.auth.getSession()).data.session;
          if (session?.access_token) {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3500);
            const meRes = await fetch('/api/consultant/me', {
              headers: { Authorization: `Bearer ${session.access_token}` },
              signal: controller.signal,
            });
            clearTimeout(timeoutId);
            if (meRes.ok) {
              const meJson = await meRes.json().catch(() => null);
              if (meJson?.success && meJson?.isConsultant) {
                isConsultantUser = true;
                consultantName = consultantName || meJson.consultant?.name;
              }
            }
          }
        } catch (apiErr) {
          console.warn('[AuthContext] /api/consultant/me notice:', apiErr);
        }

        secureLog.info('[AuthContext] fetchProfile: after /api/consultant/me', {
          userId,
          isConsultantUser: isConsultantUser,
        });

        // Direct query check if not yet confirmed
        if (!isConsultantUser) {
          try {
            let consultantQuery = supabase
              .from('consultants')
              .select('id, name, email, user_id, is_active');

            if (userEmail) {
              consultantQuery = consultantQuery.or(`user_id.eq.${userId},email.ilike.${userEmail}`);
            } else {
              consultantQuery = consultantQuery.eq('user_id', userId);
            }

            const { data: matchedConsultants } = await Promise.race([
              consultantQuery.limit(1),
              new Promise<{ data: null }>((r) => setTimeout(() => r({ data: null }), 3000)),
            ]);

            const matchedConsultant = matchedConsultants?.[0];
            if (matchedConsultant) {
              isConsultantUser = true;
              consultantName = consultantName || matchedConsultant.name;

              if (matchedConsultant.user_id !== userId) {
                supabase
                  .from('consultants')
                  .update({ user_id: userId })
                  .eq('id', matchedConsultant.id)
                  .then();
              }
            }

            secureLog.info('[AuthContext] fetchProfile: after direct consultant query', {
              userId,
              matchedConsultantId: matchedConsultant?.id ?? null,
              matchedConsultantUserId: matchedConsultant?.user_id ?? null,
              isConsultantUser: isConsultantUser,
            });
          } catch (consErr) {
            console.warn('[AuthContext] Consultant check non-fatal warning:', consErr);
          }
        }

        // Check approved application in consultant_applications if not yet confirmed
        if (!isConsultantUser && userEmail) {
          try {
            const { data: approvedApps } = await supabase
              .from('consultant_applications')
              .select('id, name, status, email')
              .ilike('email', userEmail)
              .eq('status', 'approved')
              .limit(1);

            if (approvedApps && approvedApps.length > 0) {
              isConsultantUser = true;
              consultantName = consultantName || approvedApps[0].name;
            }
          } catch (appErr) {
            console.warn('[AuthContext] Approved application check notice:', appErr);
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
            supabase.from('profiles').upsert({
              id: userId,
              full_name: consultantProfile.full_name,
              role: 'consultant',
              is_consultant: true,
            }).then();
          }

          setCachedProfile(userId, consultantProfile);
          setProfile(consultantProfile);
          profileResolvedRef.current = { userId, role: 'consultant' };
          secureLog.info('[AuthContext] fetchProfile: resolved role=consultant');
          return consultantProfile;
        }

        // 6. Regular Client
        const fallbackName = targetUser?.user_metadata?.full_name || targetUser?.email?.split('@')[0] || 'User';
        secureLog.warn('[AuthContext] fetchProfile: falling through to role=client', {
          userId,
          profileRole: profileData?.role ?? 'null',
          isConsultantUser: isConsultantUser,
        });
        const clientProfile: Profile = {
          id: userId,
          role: 'client',
          full_name: profileData?.full_name || fallbackName,
          is_consultant: false,
        };

        if (!profileData) {
          try {
            await supabase.from('profiles').upsert({
              id: userId,
              full_name: fallbackName,
              role: 'client',
            });
          } catch {
            // ignore
          }
        }

        setCachedProfile(userId, clientProfile);
        setProfile(clientProfile);
        profileResolvedRef.current = { userId, role: 'client' };
        secureLog.info('[AuthContext] fetchProfile: resolved role=client');
        return clientProfile;
      } catch (error) {
        secureLog.error('Error in fetchProfile:', error);
        // Resilient fallback: Check cached profile or user metadata
        const cached = getCachedProfile(userId);
        if (cached) {
          secureLog.warn('[AuthContext] fetchProfile: error fallback to cached profile', {
            userId,
            cachedRole: cached.role ?? 'null',
          });
          setProfile(cached);
          return cached;
        }

        const fallbackProfile: Profile = {
          id: userId,
          role: 'client',
          full_name: currentUser?.user_metadata?.full_name || currentUser?.email?.split('@')[0] || user?.email?.split('@')[0] || 'User',
          is_consultant: false,
        };
        setProfile(fallbackProfile);
        return fallbackProfile;
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
