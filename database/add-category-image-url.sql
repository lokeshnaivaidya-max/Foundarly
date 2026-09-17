-- Migration: Add image_url to categories table and initialize category-images storage bucket
-- Foundarly Industry Filter & Category Image Enhancement

-- 1. Add image_url column to categories table if not present
ALTER TABLE IF EXISTS public.categories 
ADD COLUMN IF NOT EXISTS image_url TEXT;

ALTER TABLE IF EXISTS public.categories 
ADD COLUMN IF NOT EXISTS slug TEXT;

-- 2. Ensure storage bucket for category images exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('category-images', 'category-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 3. Public read policy for category-images
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Public read category images'
  ) THEN
    CREATE POLICY "Public read category images" ON storage.objects
      FOR SELECT USING (bucket_id = 'category-images');
  END IF;
END $$;

-- 4. Admin upload/manage policies for category-images
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Admin upload category images'
  ) THEN
    CREATE POLICY "Admin upload category images" ON storage.objects
      FOR INSERT WITH CHECK (
        bucket_id = 'category-images' AND
        (
          auth.role() = 'service_role' OR
          EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Admin update category images'
  ) THEN
    CREATE POLICY "Admin update category images" ON storage.objects
      FOR UPDATE USING (
        bucket_id = 'category-images' AND
        (
          auth.role() = 'service_role' OR
          EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Admin delete category images'
  ) THEN
    CREATE POLICY "Admin delete category images" ON storage.objects
      FOR DELETE USING (
        bucket_id = 'category-images' AND
        (
          auth.role() = 'service_role' OR
          EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
        )
      );
  END IF;
END $$;
