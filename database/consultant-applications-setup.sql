-- Create consultant applications table
CREATE TABLE IF NOT EXISTS consultant_applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  age INTEGER NOT NULL,
  gender VARCHAR(20) CHECK (gender IN ('male', 'female')),
  qualification TEXT NOT NULL,
  current_job VARCHAR(255) NOT NULL,
  location VARCHAR(255) NOT NULL,
  experience TEXT NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  whatsapp VARCHAR(50) NOT NULL,
  linkedin_url TEXT,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX idx_applications_status ON consultant_applications(status);
CREATE INDEX idx_applications_created ON consultant_applications(created_at DESC);

-- Enable RLS
ALTER TABLE consultant_applications ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can insert (apply)
CREATE POLICY "Anyone can apply to be consultant"
  ON consultant_applications
  FOR INSERT
  TO public
  WITH CHECK (true);

-- Policy: Admins can view all applications
CREATE POLICY "Admins can view all applications"
  ON consultant_applications
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Policy: Admins can update applications
CREATE POLICY "Admins can update applications"
  ON consultant_applications
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Add comment
COMMENT ON TABLE consultant_applications IS 'Stores consultant application submissions for admin review';
