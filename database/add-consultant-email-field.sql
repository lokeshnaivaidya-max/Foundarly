-- Add email field to consultants table if it doesn't exist
-- This allows storing consultant email directly without relying on auth.users

-- Add email column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'consultants' AND column_name = 'email'
    ) THEN
        ALTER TABLE consultants ADD COLUMN email TEXT;
        COMMENT ON COLUMN consultants.email IS 'Consultant email address for notifications';
    END IF;
END $$;

-- Update existing consultants with email from auth.users
-- This is a one-time migration to populate the email field
UPDATE consultants c
SET email = u.email
FROM auth.users u
WHERE c.user_id = u.id
  AND c.email IS NULL
  AND u.email IS NOT NULL;

-- Create index for faster email lookups
CREATE INDEX IF NOT EXISTS idx_consultants_email ON consultants(email);

-- Show results
SELECT 
    id,
    name,
    email,
    user_id,
    CASE 
        WHEN email IS NOT NULL THEN '✓ Has email'
        WHEN user_id IS NOT NULL THEN '⚠ Has user_id but no email'
        ELSE '✗ Missing both'
    END as status
FROM consultants
ORDER BY created_at DESC;
