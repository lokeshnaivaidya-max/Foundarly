-- Fix RLS policies for testimonials table to allow review submissions

-- Drop existing policies if any
DROP POLICY IF EXISTS "Allow authenticated users to insert testimonials" ON testimonials;
DROP POLICY IF EXISTS "Allow users to insert their own reviews" ON testimonials;
DROP POLICY IF EXISTS "Public can view published testimonials" ON testimonials;
DROP POLICY IF EXISTS "Admins can manage all testimonials" ON testimonials;

-- Enable RLS
ALTER TABLE testimonials ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to insert reviews
CREATE POLICY "Allow authenticated users to insert testimonials"
ON testimonials
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow public to view published testimonials
CREATE POLICY "Public can view published testimonials"
ON testimonials
FOR SELECT
TO public
USING (status = 'published');

-- Allow authenticated users to view all testimonials (for checking duplicates)
CREATE POLICY "Authenticated users can view all testimonials"
ON testimonials
FOR SELECT
TO authenticated
USING (true);

-- Allow admins to manage all testimonials
CREATE POLICY "Admins can manage all testimonials"
ON testimonials
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);
