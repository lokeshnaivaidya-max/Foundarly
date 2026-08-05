import { createContext, useContext, useEffect, useState } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { secureLog } from '@/utils/security';

interface Profile {
  id: string;
  role: 'admin' | 'client' | 'consultant';
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
  isAdmin: boolean;
  isClient: boolean;
  isConsultant: boolean;
  hasRole: (role: 'admin' | 'client' | 'consultant') => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

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
    try {
      // Query profile row from public.profiles table
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (data) {
        setProfile(data as Profile);
        console.log("[AuthContext] Profile loaded from public.profiles:", data);
        return data as Profile;
      }

      if (error) {
        secureLog.error('Unable to fetch profile from public.profiles:', error);
      }

      // If profile does not exist in DB, construct a fallback and attempt creation
      const targetUser = currentUser || user;
      const fallbackName = targetUser?.user_metadata?.full_name || targetUser?.email?.split('@')[0] || 'User';
      const fallbackProfile: Profile = {
        id: userId,
        role: 'client',
        full_name: fallbackName,
        is_consultant: false,
      };

      // Try inserting into public.profiles
      try {
        const { data: created, error: createError } = await supabase
          .from('profiles')
          .insert({
            id: userId,
            full_name: fallbackName,
            email: targetUser?.email,
            role: 'client',
            is_consultant: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select('*')
          .maybeSingle();

        if (created && !createError) {
          setProfile(created as Profile);
          return created as Profile;
        }
      } catch (insertErr) {
        console.warn('[AuthContext] Could not auto-create missing profile in DB:', insertErr);
      }

      setProfile(fallbackProfile);
      return fallbackProfile;
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
    }
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

  const hasRole = (role: 'admin' | 'client' | 'consultant') => {
    return profile?.role === role;
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
    isAdmin: profile?.role === 'admin',
    isClient: profile?.role === 'client',
    isConsultant: profile?.role === 'consultant' || profile?.is_consultant === true,
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

