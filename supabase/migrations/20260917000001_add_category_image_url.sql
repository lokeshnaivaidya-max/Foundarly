-- Migration: Add image_url to categories table and initialize category-images storage bucket
ALTER TABLE IF EXISTS public.categories 
ADD COLUMN IF NOT EXISTS image_url TEXT;

ALTER TABLE IF EXISTS public.categories 
ADD COLUMN IF NOT EXISTS slug TEXT;

INSERT INTO storage.buckets (id, name, public)
VALUES ('category-images', 'category-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

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
