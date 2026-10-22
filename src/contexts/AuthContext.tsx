import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
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
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: AuthError | null }>;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null; profile: Profile | null }>;
  signInWithGoogle: () => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  isSuperAdmin: boolean;
  isDeveloperAdmin: boolean;
  isAdmin: boolean;
  isClient: boolean;
  isConsultant: boolean;
  hasRole: (role: UserRole) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const inFlightFetchRef = useRef<Map<string, Promise<Profile | null>>>(new Map());

  useEffect(() => {
    // Clean up any legacy localStorage admin sessions
    localStorage.removeItem('foundarly_admin_active_session');
    localStorage.removeItem('foundarly_admin_auth');

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSession(session);
        setUser(session.user);
        fetchProfile(session.user.id, session.user);
      } else {
        setSession(null);
        setUser(null);
        setProfile(null);
        setLoading(false);
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setSession(session);
        setUser(session.user);
        fetchProfile(session.user.id, session.user);
      } else {
        setSession(null);
        setUser(null);
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
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

        // Query profile row from public.profiles table
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle();

        let profileData = (data as Profile) || null;

        // 1. Check if user is an allowlisted Super Admin
        if (isAllowlistedAdmin) {
          if (!profileData) {
            profileData = {
              id: userId,
              role: 'super_admin',
              full_name: targetUser?.user_metadata?.full_name || targetUser?.email?.split('@')[0] || 'Super Admin',
              is_consultant: false,
            };
          } else {
            profileData = { ...profileData, role: 'super_admin' };
          }

          // Ensure database profile is upgraded to super_admin only if not already
          if (!data || data.role !== 'super_admin' || data.full_name !== profileData.full_name) {
            supabase.from('profiles').upsert({ 
              id: userId, 
              role: 'super_admin', 
              full_name: profileData.full_name 
            }).then();
          }
          
          setProfile(profileData);
          return profileData;
        }

      // 2. Check if user is assigned Developer Admin role in DB
      if (profileData && profileData.role === 'developer_admin') {
        const resolvedDevProfile: Profile = {
          id: userId,
          role: 'developer_admin',
          full_name: profileData.full_name || targetUser?.user_metadata?.full_name || 'Developer Admin',
          is_consultant: false,
        };
        setProfile(resolvedDevProfile);
        return resolvedDevProfile;
      }

      // 3. Defense-in-depth: If profile had super_admin or admin in DB but email is NOT allowlisted, revoke immediately
      if (profileData && (profileData.role === 'admin' || profileData.role === 'super_admin') && !isAllowlistedAdmin) {
        secureLog.warn(`[Security] Revoking unauthorized admin role for non-allowlist email (${userEmail}).`);
        profileData = { ...profileData, role: 'client' };
      }

      // 4. Check if user is a consultant (by user_id OR email in consultants table)
      let isConsultantUser = Boolean(profileData?.role === 'consultant' || profileData?.is_consultant);
      let consultantName = profileData?.full_name;

      try {
        let consultantQuery = supabase
          .from('consultants')
          .select('id, name, email, user_id, is_active')
          .eq('is_active', true);

        if (userEmail) {
          consultantQuery = consultantQuery.or(`user_id.eq.${userId},email.ilike.${userEmail}`);
        } else {
          consultantQuery = consultantQuery.eq('user_id', userId);
        }

        const { data: matchedConsultants } = await consultantQuery.limit(1);
        const matchedConsultant = matchedConsultants?.[0];

        if (matchedConsultant) {
          isConsultantUser = true;
          consultantName = consultantName || matchedConsultant.name;

          // If consultant.user_id is not linked to current user, link it now
          if (matchedConsultant.user_id !== userId) {
            supabase
              .from('consultants')
              .update({ user_id: userId })
              .eq('id', matchedConsultant.id)
              .then();

            // Also notify server sync endpoint asynchronously
            fetch('/api/consultant/sync', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token || ''}`,
              },
              body: JSON.stringify({ consultantId: matchedConsultant.id }),
            }).catch(() => {});
          }
        }
      } catch (consErr) {
        console.warn('[AuthContext] Consultant check non-fatal warning:', consErr);
      }

      const finalRole: UserRole = isConsultantUser ? 'consultant' : 'client';
      const fallbackName = consultantName || targetUser?.user_metadata?.full_name || targetUser?.email?.split('@')[0] || 'User';

      const resolvedProfile: Profile = {
        id: userId,
        role: finalRole,
        full_name: fallbackName,
        is_consultant: isConsultantUser,
      };

      // Persist / update profile in public.profiles table ONLY if missing or changed
      if (!profileData || profileData.role !== finalRole || profileData.full_name !== fallbackName) {
        try {
          await supabase
            .from('profiles')
            .upsert({
              id: userId,
              full_name: fallbackName,
              role: finalRole,
            });
        } catch (upsertErr) {
          console.warn('[AuthContext] Could not upsert profile in DB:', upsertErr);
        }
      }

      setProfile(resolvedProfile);
      return resolvedProfile;
    } catch (error) {
      secureLog.error('Error in fetchProfile:', error);
      const fallbackProfile: Profile = {
        id: userId,
        role: 'client',
        full_name: user?.email?.split('@')[0] || 'User',
        is_consultant: false,
      };
      setProfile(fallbackProfile);
      return fallbackProfile;
    } finally {
      setLoading(false);
      inFlightFetchRef.current.delete(userId);
    }
  })();

  inFlightFetchRef.current.set(userId, fetchPromise);
  return fetchPromise;
};

  const signUp = async (email: string, password: string, fullName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });

    if (!error && data.user) {
      if (data.session) setSession(data.session);
      setUser(data.user);
      await fetchProfile(data.user.id, data.user);
    }

    return { error };
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
      return { error, profile: null };
    }

    if (data?.user) {
      if (data.session) setSession(data.session);
      setUser(data.user);
      const userProfile = await fetchProfile(data.user.id, data.user);
      return { error: null, profile: userProfile };
    }

    return { error, profile: null };
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

  const signOut = async () => {
    localStorage.removeItem('foundarly_admin_active_session');
    localStorage.removeItem('foundarly_admin_auth');
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setSession(null);
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
