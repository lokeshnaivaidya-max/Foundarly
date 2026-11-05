-- Atomic consultant deletion: permanently remove consultant listinng + downgrade profile
-- in a single PostgreSQL transaction. If ANY step fails, the entire operation is rolled back.
-- Callers must NEVER pass a user_id from the client — the RPC resolves it from the consultants table.
--
-- Security model:
--   - SECURITY DEFINER runs with owner privileges (service-role equivalent).
--   - Authentication and authorization checks enforced by the calling API handler.
--   - Caller MUST be authenticated admin/super_admin before invocation.
--   - RPC operates atomically: either both deletion and profile downgrade happen, or neither does.
--   - Admin/Developer Admin profiles are NEVER downgraded.
--   - Only profiles.role = 'consultant' are downgraded to 'client'.
--   - Bookings and application history are preserved.

CREATE OR REPLACE FUNCTION public.delete_consultant_atomically(consultant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  consultant_user_id UUID;
  consultant_email TEXT;
  profile_role TEXT;
  result JSONB;
  profile_downgraded BOOLEAN := FALSE;
BEGIN
  -- Step 1: Resolve the consultant's linked user_id and email (never trust client input)
  SELECT user_id, email INTO consultant_user_id, consultant_email
  FROM public.consultants
  WHERE id = consultant_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Consultant record not found.',
      'deleted', FALSE,
      'profile_downgraded', FALSE,
      'user_id', NULL
    );
  END IF;

  -- Step 2: Check the associated profile's current role
  IF consultant_user_id IS NOT NULL THEN
    SELECT role INTO profile_role
    FROM public.profiles
    WHERE id = consultant_user_id;
  END IF;

  -- Step 3: Safely clean up foreign-key dependencies to avoid constraint violations
  BEGIN
    UPDATE public.testimonials SET consultant_id = NULL WHERE consultant_id = consultant_id;
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    NULL;
  END;

  BEGIN
    UPDATE public.bookings SET consultant_id = NULL WHERE consultant_id = consultant_id;
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    NULL;
  END;

  BEGIN
    DELETE FROM public.consultant_earnings WHERE consultant_id = consultant_id;
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    NULL;
  END;

  BEGIN
    DELETE FROM public.payout_requests WHERE consultant_id = consultant_id;
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    NULL;
  END;

  BEGIN
    DELETE FROM public.earnings_history WHERE consultant_id = consultant_id;
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    NULL;
  END;

  BEGIN
    DELETE FROM public.follow_up_requests WHERE consultant_id = consultant_id;
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    NULL;
  END;

  BEGIN
    DELETE FROM public.consultant_availability_settings WHERE consultant_id = consultant_id;
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    NULL;
  END;

  BEGIN
    DELETE FROM public.consultant_time_off WHERE consultant_id = consultant_id;
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    NULL;
  END;

  -- Demote/reject any matching approved applications so they cannot resurrect the consultant
  BEGIN
    IF consultant_email IS NOT NULL AND consultant_user_id IS NOT NULL THEN
      UPDATE public.consultant_applications
      SET status = 'rejected'
      WHERE (email ILIKE consultant_email OR user_id = consultant_user_id)
        AND status = 'approved';
    ELSIF consultant_email IS NOT NULL THEN
      UPDATE public.consultant_applications
      SET status = 'rejected'
      WHERE email ILIKE consultant_email
        AND status = 'approved';
    ELSIF consultant_user_id IS NOT NULL THEN
      UPDATE public.consultant_applications
      SET status = 'rejected'
      WHERE user_id = consultant_user_id
        AND status = 'approved';
    END IF;
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    NULL;
  END;

  -- Step 4: Delete the consultant record (inside same transaction)
  DELETE FROM public.consultants WHERE id = consultant_id;

  -- Step 5: Downgrade profile role from consultant to client in the SAME transaction
  IF consultant_user_id IS NOT NULL THEN
    IF profile_role = 'consultant' THEN
      UPDATE public.profiles
      SET role = 'client'
      WHERE id = consultant_user_id
        AND role = 'consultant';

      -- Check if the update actually affected a row
      IF FOUND THEN
        profile_downgraded := TRUE;
      END IF;
    END IF;
    -- If role is NOT consultant, preserve it (could be admin/developer_admin)
  END IF;

  SELECT jsonb_build_object(
    'success', TRUE,
    'deleted', TRUE,
    'profile_downgraded', profile_downgraded,
    'user_id', consultant_user_id,
    'original_profile_role', COALESCE(profile_role, NULL)
  ) INTO result;

  RETURN result;
END;
$$;

COMMENT ON FUNCTION public.delete_consultant_atomically(UUID) IS
  'Atomic consultant deletion. Deletes listing AND downgrades associated profiles.role from consultant to client in ONE transaction. Resolves linked user server-side. Preserves bookings/applications. Admin/Developer Admin roles never downgraded.';

-- SECURITY MODEL:
--   - SECURITY DEFINER with pg_temp in search_path.
--   - REVOKE direct execute from PUBLIC, anon, and authenticated roles.
--   - Only service_role (server-side API with admin + developer-admin verification before invocation) may EXECUTE.
--   - This RPC may NEVER be invoked by an ordinary authenticated client.
REVOKE ALL ON FUNCTION public.delete_consultant_atomically(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_consultant_atomically(UUID) FROM anon;
REVOKE ALL ON FUNCTION public.delete_consultant_atomically(UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.delete_consultant_atomically(UUID) TO service_role;

-- Sanity check: verify only service_role retains execution rights
-- (information_schema.routine_privileges should show only service_role after this migration)
