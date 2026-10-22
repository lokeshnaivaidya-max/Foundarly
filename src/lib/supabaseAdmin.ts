/**
 * Client-Side Guarded Supabase Admin Module
 * 
 * SECURITY AUDIT NOTICE:
 * A Supabase service-role key must NEVER be referenced through VITE_* variables
 * or bundled into client-side browser code.
 *
 * All privileged operations requiring the service-role key are strictly isolated
 * to authenticated backend server routes (/api/*) running in Node.js.
 */

import { supabase } from './supabase';

/**
 * In browser runtime, supabaseAdmin aliases the standard authenticated client
 * governed by Postgres Row-Level Security (RLS).
 * Under no circumstances does this bundle or leak the Supabase Service Role Key.
 */
export const supabaseAdmin = supabase;

export default supabaseAdmin;
