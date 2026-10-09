-- ============================================================================
-- MINIMAL SAFE SQL PATCH: SECURE RATE LIMITING INFRASTRUCTURE
-- Run this in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/rfyxnshvtfswvaogjzwq/sql
-- ============================================================================

-- 1. Revoke direct table privileges on public.rate_limit_entries from untrusted client roles
REVOKE ALL ON TABLE public.rate_limit_entries FROM anon, authenticated, PUBLIC;

-- 2. Grant full table privileges exclusively to service_role
GRANT ALL ON TABLE public.rate_limit_entries TO service_role;

-- 3. Remove unrestricted RLS policies
DROP POLICY IF EXISTS "Allow service role and system rate limiting" ON public.rate_limit_entries;
DROP POLICY IF EXISTS "Allow service role access" ON public.rate_limit_entries;

-- 4. Ensure RLS is active (default-deny for all roles without explicit policy)
ALTER TABLE public.rate_limit_entries ENABLE ROW LEVEL SECURITY;

-- 5. Restrict check_rate_limit() RPC function execution strictly to service_role
REVOKE ALL ON FUNCTION public.check_rate_limit(TEXT, INT, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(TEXT, INT, INT) TO service_role;
