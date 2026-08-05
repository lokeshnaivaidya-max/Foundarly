-- =====================================================
-- MIGRATION 3: STORAGE BUCKETS & STORAGE POLICIES
-- =====================================================

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('consultant-images', 'consultant-images', true),
  ('testimonial-images', 'testimonial-images', true),
  ('blog-images', 'blog-images', true),
  ('site-assets', 'site-assets', true),
  ('showcase-logos', 'showcase-logos', true),
  ('group-avatars', 'group-avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Public bucket read access policies
CREATE POLICY "Public Read Access for Consultant Images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'consultant-images');

CREATE POLICY "Public Read Access for Testimonial Images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'testimonial-images');

CREATE POLICY "Public Read Access for Blog Images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'blog-images');

CREATE POLICY "Public Read Access for Site Assets"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'site-assets');

CREATE POLICY "Public Read Access for Showcase Logos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'showcase-logos');

CREATE POLICY "Public Read Access for Group Avatars"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'group-avatars');

-- Authenticated upload policies
CREATE POLICY "Authenticated users upload Consultant Images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'consultant-images' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users upload Testimonial Images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'testimonial-images' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users upload Blog Images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'blog-images' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users upload Site Assets"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'site-assets' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users upload Showcase Logos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'showcase-logos' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users upload Group Avatars"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'group-avatars' AND auth.role() = 'authenticated');
