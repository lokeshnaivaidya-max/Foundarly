import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const env = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : (process.env as unknown as Record<string, string | undefined>);
const supabaseUrl = env?.VITE_SUPABASE_URL || 'https://rfyxnshvtfswvaogjzwq.supabase.co';
const supabaseAnonKey = env?.VITE_SUPABASE_ANON_KEY || 'sb_publishable_QPkFtczpj8_WzxPf4ZoENw_ZpnfN9vd';

if (!env?.VITE_SUPABASE_URL || !env?.VITE_SUPABASE_ANON_KEY) {
  console.warn('VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variables are missing. Using fallback configuration.');
}

console.log('[Supabase Initialization]', {
  url: supabaseUrl,
  anonKeyPrefix: supabaseAnonKey ? `${supabaseAnonKey.substring(0, 15)}...` : 'MISSING',
  environment: env?.MODE || 'development',
  timestamp: new Date().toISOString()
});

export const isSupabaseConfigured = Boolean(
  (env?.VITE_SUPABASE_URL || supabaseUrl) && (env?.VITE_SUPABASE_ANON_KEY || supabaseAnonKey)
);

// Resilient browser storage adapter that persists across browser & tab sessions
export const PRIMARY_AUTH_KEY = 'sb-rfyxnshvtfswvaogjzwq-auth-token';
export const FALLBACK_AUTH_KEY = 'foundarly_supabase_auth_session';

const isAuthSessionKey = (key: string): boolean => {
  return key === PRIMARY_AUTH_KEY || key === FALLBACK_AUTH_KEY;
};

export const safeLocalStorage = {
  getItem: (key: string): string | null => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const value = window.localStorage.getItem(key);
        if (value) return value;
        // Check secondary/legacy keys for backwards compatibility when reading main session
        if (isAuthSessionKey(key)) {
          const alternateKey = key === PRIMARY_AUTH_KEY ? FALLBACK_AUTH_KEY : PRIMARY_AUTH_KEY;
          const altValue = window.localStorage.getItem(alternateKey);
          if (altValue) return altValue;
        }
      }
    } catch (e) {
      console.warn('[Supabase Storage] Failed to read from localStorage:', e);
    }
    return null;
  },
  setItem: (key: string, value: string): void => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
        // Strictly mirror auth session token (never overwrite with PKCE code verifiers or non-session values)
        if (key === PRIMARY_AUTH_KEY) {
          window.localStorage.setItem(FALLBACK_AUTH_KEY, value);
        }
      }
    } catch (e) {
      console.warn('[Supabase Storage] Failed to write to localStorage:', e);
    }
  },
  removeItem: (key: string): void => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
        if (key === PRIMARY_AUTH_KEY) {
          window.localStorage.removeItem(FALLBACK_AUTH_KEY);
        } else if (key === FALLBACK_AUTH_KEY) {
          window.localStorage.removeItem(PRIMARY_AUTH_KEY);
        }
      }
    } catch (e) {
      console.warn('[Supabase Storage] Failed to remove from localStorage:', e);
    }
  },
};

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    storageKey: 'sb-rfyxnshvtfswvaogjzwq-auth-token',
    storage: safeLocalStorage,
  },
});

