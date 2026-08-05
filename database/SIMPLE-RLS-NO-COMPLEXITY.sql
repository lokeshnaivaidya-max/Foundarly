-- =====================================================
-- SIMPLE RLS POLICIES - NO COMPLEXITY
-- =====================================================
-- This uses the SIMPLEST possible policies
-- No EXISTS, no subqueries, just basic checks
-- =====================================================

-- =====================================================
-- DISABLE RLS TEMPORARILY TO TEST
-- =====================================================
-- Uncomment these lines to disable RLS and test if data shows:
-- ALTER TABLE consultants DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE testimonials DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE pricing_tiers DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE faqs DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE page_content DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE content_sections DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE site_settings DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE blog DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE channels DISABLE ROW LEVEL SECURITY;

-- If data shows after disabling RLS, then the problem is the policies!
-- Re-enable and continue with simple policies below:

-- =====================================================
-- STEP 1: Drop ALL policies
-- =====================================================

-- Drop all consultants policies
DO $$ 
BEGIN
  EXECUTE (
    SELECT string_agg('DROP POLICY IF EXISTS "' || policyname || '" ON ' || tablename || ';', ' ')
    FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'consultants'
  );
END $$;

-- Drop all testimonials policies
DO $$ 
BEGIN
  EXECUTE (
    SELECT string_agg('DROP POLICY IF EXISTS "' || policyname || '" ON ' || tablename || ';', ' ')
    FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'testimonials'
  );
END $$;

-- Drop all pricing policies
DO $$ 
BEGIN
  EXECUTE (
    SELECT string_agg('DROP POLICY IF EXISTS "' || policyname || '" ON ' || tablename || ';', ' ')
    FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'pricing_tiers'
  );
END $$;

-- Drop all faqs policies
DO $$ 
BEGIN
  EXECUTE (
    SELECT string_agg('DROP POLICY IF EXISTS "' || policyname || '" ON ' || tablename || ';', ' ')
    FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'faqs'
  );
END $$;

-- Drop all page_content policies
DO $$ 
BEGIN
  EXECUTE (
    SELECT string_agg('DROP POLICY IF EXISTS "' || policyname || '" ON ' || tablename || ';', ' ')
    FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'page_content'
  );
END $$;

-- Drop all content_sections policies
DO $$ 
BEGIN
  EXECUTE (
    SELECT string_agg('DROP POLICY IF EXISTS "' || policyname || '" ON ' || tablename || ';', ' ')
    FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'content_sections'
  );
END $$;

-- Drop all site_settings policies
DO $$ 
BEGIN
  EXECUTE (
    SELECT string_agg('DROP POLICY IF EXISTS "' || policyname || '" ON ' || tablename || ';', ' ')
    FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'site_settings'
  );
END $$;

-- Drop all blog policies
DO $$ 
BEGIN
  EXECUTE (
    SELECT string_agg('DROP POLICY IF EXISTS "' || policyname || '" ON ' || tablename || ';', ' ')
    FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'blog'
  );
END $$;

-- Drop all profiles policies
DO $$ 
BEGIN
  EXECUTE (
    SELECT string_agg('DROP POLICY IF EXISTS "' || policyname || '" ON ' || tablename || ';', ' ')
    FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'profiles'
  );
END $$;

-- Drop all bookings policies
DO $$ 
BEGIN
  EXECUTE (
    SELECT string_agg('DROP POLICY IF EXISTS "' || policyname || '" ON ' || tablename || ';', ' ')
    FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'bookings'
  );
END $$;

-- Drop all channels policies
DO $$ 
BEGIN
  EXECUTE (
    SELECT string_agg('DROP POLICY IF EXISTS "' || policyname || '" ON ' || tablename || ';', ' ')
    FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'channels'
  );
END $$;

-- =====================================================
-- STEP 2: Create SUPER SIMPLE policies
-- =====================================================

-- CONSULTANTS - Allow everyone to read
CREATE POLICY "allow_read_consultants"
  ON consultants FOR SELECT
  USING (true);

CREATE POLICY "allow_write_consultants"
  ON consultants FOR ALL
  USING (true)
  WITH CHECK (true);

-- TESTIMONIALS - Allow everyone to read
CREATE POLICY "allow_read_testimonials"
  ON testimonials FOR SELECT
  USING (true);

CREATE POLICY "allow_write_testimonials"
  ON testimonials FOR ALL
  USING (true)
  WITH CHECK (true);

-- PRICING - Allow everyone to read
CREATE POLICY "allow_read_pricing"
  ON pricing_tiers FOR SELECT
  USING (true);

CREATE POLICY "allow_write_pricing"
  ON pricing_tiers FOR ALL
  USING (true)
  WITH CHECK (true);

-- FAQS - Allow everyone to read
CREATE POLICY "allow_read_faqs"
  ON faqs FOR SELECT
  USING (true);

CREATE POLICY "allow_write_faqs"
  ON faqs FOR ALL
  USING (true)
  WITH CHECK (true);

-- PAGE CONTENT - Allow everyone to read
CREATE POLICY "allow_read_page_content"
  ON page_content FOR SELECT
  USING (true);

CREATE POLICY "allow_write_page_content"
  ON page_content FOR ALL
  USING (true)
  WITH CHECK (true);

-- CONTENT SECTIONS - Allow everyone to read
CREATE POLICY "allow_read_content_sections"
  ON content_sections FOR SELECT
  USING (true);

CREATE POLICY "allow_write_content_sections"
  ON content_sections FOR ALL
  USING (true)
  WITH CHECK (true);

-- SITE SETTINGS - Allow everyone to read
CREATE POLICY "allow_read_site_settings"
  ON site_settings FOR SELECT
  USING (true);

CREATE POLICY "allow_write_site_settings"
  ON site_settings FOR ALL
  USING (true)
  WITH CHECK (true);

-- BLOG - Allow everyone to read
CREATE POLICY "allow_read_blog"
  ON blog FOR SELECT
  USING (true);

CREATE POLICY "allow_write_blog"
  ON blog FOR ALL
  USING (true)
  WITH CHECK (true);

-- PROFILES - Allow everyone to read
CREATE POLICY "allow_read_profiles"
  ON profiles FOR SELECT
  USING (true);

CREATE POLICY "allow_write_profiles"
  ON profiles FOR ALL
  USING (true)
  WITH CHECK (true);

-- BOOKINGS - Allow everyone to read
CREATE POLICY "allow_read_bookings"
  ON bookings FOR SELECT
  USING (true);

CREATE POLICY "allow_write_bookings"
  ON bookings FOR ALL
  USING (true)
  WITH CHECK (true);

-- CHANNELS - Allow everyone to read
CREATE POLICY "allow_read_channels"
  ON channels FOR SELECT
  USING (true);

CREATE POLICY "allow_write_channels"
  ON channels FOR ALL
  USING (true)
  WITH CHECK (true);

-- CHANNEL MEMBERS
CREATE POLICY "allow_read_channel_members"
  ON channel_members FOR SELECT
  USING (true);

CREATE POLICY "allow_write_channel_members"
  ON channel_members FOR ALL
  USING (true)
  WITH CHECK (true);

-- CHANNEL MESSAGES
CREATE POLICY "allow_read_channel_messages"
  ON channel_messages FOR SELECT
  USING (true);

CREATE POLICY "allow_write_channel_messages"
  ON channel_messages FOR ALL
  USING (true)
  WITH CHECK (true);

-- USER GROUPS
CREATE POLICY "allow_read_user_groups"
  ON user_groups FOR SELECT
  USING (true);

CREATE POLICY "allow_write_user_groups"
  ON user_groups FOR ALL
  USING (true)
  WITH CHECK (true);

-- GROUP MEMBERS
CREATE POLICY "allow_read_group_members"
  ON group_members FOR SELECT
  USING (true);

CREATE POLICY "allow_write_group_members"
  ON group_members FOR ALL
  USING (true)
  WITH CHECK (true);

-- GROUP POSTS
CREATE POLICY "allow_read_group_posts"
  ON group_posts FOR SELECT
  USING (true);

CREATE POLICY "allow_write_group_posts"
  ON group_posts FOR ALL
  USING (true)
  WITH CHECK (true);

-- STARTUP SHOWCASES
CREATE POLICY "allow_read_startup_showcases"
  ON startup_showcases FOR SELECT
  USING (true);

CREATE POLICY "allow_write_startup_showcases"
  ON startup_showcases FOR ALL
  USING (true)
  WITH CHECK (true);

-- MESSAGE REACTIONS
CREATE POLICY "allow_read_message_reactions"
  ON message_reactions FOR SELECT
  USING (true);

CREATE POLICY "allow_write_message_reactions"
  ON message_reactions FOR ALL
  USING (true)
  WITH CHECK (true);

-- REPORTS
CREATE POLICY "allow_read_reports"
  ON reports FOR SELECT
  USING (true);

CREATE POLICY "allow_write_reports"
  ON reports FOR ALL
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- STORAGE POLICIES - Allow everyone
-- =====================================================

-- Drop all storage policies
DO $$
BEGIN
  EXECUTE (
    SELECT string_agg('DROP POLICY IF EXISTS "' || policyname || '" ON storage.objects;', ' ')
    FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects'
  );
END $$;

-- Allow everyone to read all storage
CREATE POLICY "allow_read_storage"
  ON storage.objects FOR SELECT
  USING (true);

-- Allow everyone to upload
CREATE POLICY "allow_upload_storage"
  ON storage.objects FOR INSERT
  WITH CHECK (true);

-- Allow everyone to update
CREATE POLICY "allow_update_storage"
  ON storage.objects FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Allow everyone to delete
CREATE POLICY "allow_delete_storage"
  ON storage.objects FOR DELETE
  USING (true);

-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
DECLARE
  consultant_count INTEGER;
  testimonial_count INTEGER;
  faq_count INTEGER;
  pricing_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO consultant_count FROM consultants;
  SELECT COUNT(*) INTO testimonial_count FROM testimonials;
  SELECT COUNT(*) INTO faq_count FROM faqs;
  SELECT COUNT(*) INTO pricing_count FROM pricing_tiers;
  
  RAISE NOTICE '';
  RAISE NOTICE '✅ =====================================================';
  RAISE NOTICE '✅ SIMPLE RLS POLICIES APPLIED!';
  RAISE NOTICE '✅ =====================================================';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  WARNING: These policies allow EVERYONE to do EVERYTHING!';
  RAISE NOTICE '   This is for TESTING ONLY to confirm RLS was the issue.';
  RAISE NOTICE '   Once confirmed, you should add proper security.';
  RAISE NOTICE '';
  RAISE NOTICE '📊 Data counts:';
  RAISE NOTICE '   Consultants: %', consultant_count;
  RAISE NOTICE '   Testimonials: %', testimonial_count;
  RAISE NOTICE '   FAQs: %', faq_count;
  RAISE NOTICE '   Pricing: %', pricing_count;
  RAISE NOTICE '';
  RAISE NOTICE '🎯 Next steps:';
  RAISE NOTICE '   1. Refresh your app (Ctrl+Shift+R)';
  RAISE NOTICE '   2. Check if data now shows';
  RAISE NOTICE '   3. If YES: RLS was the problem, add proper policies later';
  RAISE NOTICE '   4. If NO: The problem is elsewhere (check browser console)';
  RAISE NOTICE '';
END $$;
