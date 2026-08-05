-- Add gender field to consultants table
ALTER TABLE consultants 
ADD COLUMN gender VARCHAR(20) CHECK (gender IN ('male', 'female')) DEFAULT 'male';

-- Add comment to explain the field
COMMENT ON COLUMN consultants.gender IS 'Gender of the consultant for appropriate avatar display';
