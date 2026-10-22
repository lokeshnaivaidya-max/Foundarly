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

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

