-- Add email field to consultants table
-- This allows consultants to login with email

ALTER TABLE consultants 
ADD COLUMN IF NOT EXISTS email TEXT UNIQUE;

-- Create index for faster email lookups
CREATE INDEX IF NOT EXISTS idx_consultants_email ON consultants(email);

-- Add comment
COMMENT ON COLUMN consultants.email IS 'Consultant email for login and communication';

-- Optional: Update existing consultants with email from linked user
-- UPDATE consultants c
-- SET email = u.email
-- FROM auth.users u
-- WHERE c.user_id = u.id
-- AND c.email IS NULL;
