-- ============================================================================
-- 08_FIX_BLOG_AND_STORAGE_ADMIN_ACCESS.sql
-- ============================================================================
-- Description:
--   Resolves blog creation, update, deletion, and image upload failures for
--   both Super Admin ('super_admin') and Developer Admin ('developer_admin').
--
-- Root Cause Identified:
--   Legacy policies in database/FIXED-RLS-POLICIES.sql and initial schema scripts
--   checked `profiles.role = 'admin'`. Following the introduction of the
--   super_admin and developer_admin role hierarchy (04 and 07 migrations),
--   administrators hold roles 'super_admin' or 'developer_admin', causing:
--     1. storage.objects INSERT/UPDATE/DELETE on bucket 'blog-images' to fail with 403 (RLS violation)
--     2. public.blog INSERT/UPDATE/DELETE to fail with 42501 (RLS violation)
--
-- Security Hardening Rules Applied:
--   1. Ensures public.is_admin() recognizes 'super_admin', 'developer_admin', and legacy 'admin'.
--   2. Replaces restrictive/outdated role = 'admin' policies on public.blog with public.is_admin().
--   3. Explicitly drops all legacy policies (including overly permissive ones like
--      "Authenticated users upload Blog Images") to prevent permissive OR bypasses.
--   4. Grants Super Admin and Developer Admin SELECT, INSERT, UPDATE, and DELETE on public.blog.
--   5. Grants Super Admin and Developer Admin secure upload, update, and delete on storage.objects
--      for bucket 'blog-images'.
--   6. Preserves public read access for published blog posts and public read access for blog images.
--   7. Denies non-admin users (clients, consultants, and anonymous visitors) from managing blog posts
--      or uploading to the 'blog-images' bucket.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. ENSURE HELPER FUNCTION public.is_admin() COVERS ALL ADMIN TIERS
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('super_admin', 'developer_admin', 'admin')
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role, anon;

-- ----------------------------------------------------------------------------
-- 2. HARDEN AND FIX public.blog TABLE RLS POLICIES
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'blog') THEN
    ALTER TABLE public.blog ENABLE ROW LEVEL SECURITY;

    -- Drop all legacy, conflicting, or outdated policies to avoid permissive OR union
    DROP POLICY IF EXISTS "Published blog posts are viewable by everyone" ON public.blog;
    DROP POLICY IF EXISTS "Anyone can view published blog posts" ON public.blog;
    DROP POLICY IF EXISTS "Public read published blog" ON public.blog;
    DROP POLICY IF EXISTS "Public read blog" ON public.blog;
    DROP POLICY IF EXISTS "Public can view published blog" ON public.blog;
    DROP POLICY IF EXISTS "Anyone can read published blog" ON public.blog;
    DROP POLICY IF EXISTS "Admins can view all blog posts" ON public.blog;
    DROP POLICY IF EXISTS "Admins can view all blog" ON public.blog;
    DROP POLICY IF EXISTS "Admins can insert blog posts" ON public.blog;
    DROP POLICY IF EXISTS "Admins can update blog posts" ON public.blog;
    DROP POLICY IF EXISTS "Admins can delete blog posts" ON public.blog;
    DROP POLICY IF EXISTS "Only admins can insert blog posts" ON public.blog;
    DROP POLICY IF EXISTS "Only admins can update blog posts" ON public.blog;
    DROP POLICY IF EXISTS "Only admins can delete blog posts" ON public.blog;
    DROP POLICY IF EXISTS "Admins manage blog" ON public.blog;
    DROP POLICY IF EXISTS "Admin manage blog" ON public.blog;
    DROP POLICY IF EXISTS "Admins can manage all blog" ON public.blog;
    DROP POLICY IF EXISTS "Admins manage blog posts" ON public.blog;
    DROP POLICY IF EXISTS "Admin blog access" ON public.blog;
    DROP POLICY IF EXISTS "Super admin manage blog" ON public.blog;

    -- 2a. SELECT: Public can view published blog posts (guests + authenticated users)
    CREATE POLICY "Anyone can view published blog posts" ON public.blog
      FOR SELECT
      USING (status = 'published');

    -- 2b. SELECT: Privileged administrators (Super Admin + Developer Admin) can view all posts (including drafts)
    CREATE POLICY "Admins can view all blog posts" ON public.blog
      FOR SELECT
      TO authenticated
      USING (public.is_admin());

    -- 2c. INSERT: Privileged administrators can insert new blog posts
    CREATE POLICY "Admins can insert blog posts" ON public.blog
      FOR INSERT
      TO authenticated
      WITH CHECK (public.is_admin());

    -- 2d. UPDATE: Privileged administrators can update existing blog posts
    CREATE POLICY "Admins can update blog posts" ON public.blog
      FOR UPDATE
      TO authenticated
      USING (public.is_admin())
      WITH CHECK (public.is_admin());

    -- 2e. DELETE: Privileged administrators can delete blog posts
    CREATE POLICY "Admins can delete blog posts" ON public.blog
      FOR DELETE
      TO authenticated
      USING (public.is_admin());

    RAISE NOTICE '✅ public.blog RLS policies updated successfully for Super Admin and Developer Admin.';
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 3. HARDEN AND FIX storage.objects POLICIES FOR 'blog-images' BUCKET
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  -- 3a. Ensure blog-images bucket exists, is public, with 5MB limit and image MIME types
  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES (
    'blog-images',
    'blog-images',
    true,
    5242880, -- 5MB limit
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
  )
  ON CONFLICT (id) DO UPDATE
  SET public = true,
      file_size_limit = COALESCE(storage.buckets.file_size_limit, EXCLUDED.file_size_limit),
      allowed_mime_types = COALESCE(storage.buckets.allowed_mime_types, EXCLUDED.allowed_mime_types);

  -- 3b. Drop all legacy, conflicting, or outdated policies on storage.objects for blog-images
  DROP POLICY IF EXISTS "Blog images are publicly accessible" ON storage.objects;
  DROP POLICY IF EXISTS "Anyone can view blog images" ON storage.objects;
  DROP POLICY IF EXISTS "Public can view blog images" ON storage.objects;
  DROP POLICY IF EXISTS "Public can view Blog Images" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated users upload Blog Images" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated users can upload blog images" ON storage.objects;
  DROP POLICY IF EXISTS "Only admins can upload blog images" ON storage.objects;
  DROP POLICY IF EXISTS "Admins can upload blog images" ON storage.objects;
  DROP POLICY IF EXISTS "Only admins can delete blog images" ON storage.objects;
  DROP POLICY IF EXISTS "Admins can delete blog images" ON storage.objects;
  DROP POLICY IF EXISTS "Admins can update blog images" ON storage.objects;
  DROP POLICY IF EXISTS "Admin Upload Blog Images" ON storage.objects;
  DROP POLICY IF EXISTS "Admin Update Blog Images" ON storage.objects;
  DROP POLICY IF EXISTS "Admin Delete Blog Images" ON storage.objects;
  DROP POLICY IF EXISTS "Admins manage blog images" ON storage.objects;

  -- 3c. SELECT: Anyone can view blog images (public bucket)
  CREATE POLICY "Anyone can view blog images" ON storage.objects
    FOR SELECT
    USING (bucket_id = 'blog-images');

  -- 3d. INSERT: Strictly privileged administrators can upload blog images
  CREATE POLICY "Admins can upload blog images" ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'blog-images' AND
      public.is_admin()
    );

  -- 3e. UPDATE: Strictly privileged administrators can update blog images
  CREATE POLICY "Admins can update blog images" ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (
      bucket_id = 'blog-images' AND
      public.is_admin()
    )
    WITH CHECK (
      bucket_id = 'blog-images' AND
      public.is_admin()
    );

  -- 3f. DELETE: Strictly privileged administrators can delete blog images
  CREATE POLICY "Admins can delete blog images" ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
      bucket_id = 'blog-images' AND
      public.is_admin()
    );

  RAISE NOTICE '✅ storage.objects policies updated successfully for blog-images bucket.';
END $$;
