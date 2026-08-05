import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://rfyxnshvtfswvaogjzwq.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_QPkFtczpj8_WzxPf4ZoENw_ZpnfN9vd';

if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
  console.warn('VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variables are missing. Using fallback configuration.');
}

console.log('[Supabase Initialization]', {
  url: supabaseUrl,
  anonKeyPrefix: supabaseAnonKey ? `${supabaseAnonKey.substring(0, 15)}...` : 'MISSING',
  environment: import.meta.env.MODE,
  timestamp: new Date().toISOString()
});

export const isSupabaseConfigured = Boolean(
  (import.meta.env.VITE_SUPABASE_URL || 'https://rfyxnshvtfswvaogjzwq.supabase.co') &&
  (import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_QPkFtczpj8_WzxPf4ZoENw_ZpnfN9vd')
);

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

