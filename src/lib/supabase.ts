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
  (env?.VITE_SUPABASE_URL || 'https://rfyxnshvtfswvaogjzwq.supabase.co') &&
  (env?.VITE_SUPABASE_ANON_KEY || 'sb_publishable_QPkFtczpj8_WzxPf4ZoENw_ZpnfN9vd')
);

// Resilient browser storage adapter that persists across browser & tab sessions
const safeLocalStorage = {
  getItem: (key: string): string | null => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const value = window.localStorage.getItem(key);
        if (value) return value;
        // Check secondary/legacy keys for backwards compatibility
        if (key.includes('auth-token') || key.includes('foundarly')) {
          const alternateKey = key.includes('rfyxnshvtfswvaogjzwq')
            ? 'foundarly_supabase_auth_session'
            : 'sb-rfyxnshvtfswvaogjzwq-auth-token';
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
        // Also persist to secondary fallback key so session is never lost across URL or domain updates
        if (key.includes('auth-token')) {
          window.localStorage.setItem('foundarly_supabase_auth_session', value);
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
        if (key.includes('auth-token')) {
          window.localStorage.removeItem('foundarly_supabase_auth_session');
        } else if (key.includes('foundarly')) {
          window.localStorage.removeItem('sb-rfyxnshvtfswvaogjzwq-auth-token');
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

