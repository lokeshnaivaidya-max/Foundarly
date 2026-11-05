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
  profile_role TEXT;
  result JSONB;
  profile_downgraded BOOLEAN := FALSE;
BEGIN
  -- Step 1: Resolve the consultant's linked user_id (never trust client input)
  SELECT user_id INTO consultant_user_id
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

  -- Step 3: Delete the consultant record FIRST (inside same transaction)
  DELETE FROM public.consultants WHERE id = consultant_id;

  -- Step 4: Downgrade profile role from consultant to client in the SAME transaction
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
  'Atomic consultant deletion. Deletes listing AND downgrades associated profiles.role from consultant to client in ONE transaction. Never trusts client-supplied user_id. Never downgrades admin/developer_admin. Preserves bookings/applications.';
