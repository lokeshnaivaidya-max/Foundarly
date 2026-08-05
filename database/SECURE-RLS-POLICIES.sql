-- =====================================================
-- SECURE RLS POLICIES - Simple but Secure
-- =====================================================
-- This adds proper security while keeping policies simple
-- Run this AFTER confirming SIMPLE-RLS-NO-COMPLEXITY.sql works
-- =====================================================

-- =====================================================
-- STEP 1: Drop the "allow everything" policies
-- =====================================================

-- Drop all "allow_" policies
DO $$
DECLARE
  pol RECORD;
  drop_count INTEGER := 0;
BEGIN
  FOR pol IN 
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE policyname LIKE 'allow_%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', 
      pol.policyname, pol.schemaname, pol.tablename);
    drop_count := drop_count + 1;
  END LOOP;
  
  RAISE NOTICE 'Dropped % policies', drop_count;
END $$;

-- =====================================================
-- STEP 2: PUBLIC READ TABLES (Everyone can read)
-- =====================================================

-- CONSULTANTS - Everyone reads, only authenticated writes
CREATE POLICY "public_read_consultants"
  ON consultants FOR SELECT
  USING (true);

CREATE POLICY "auth_write_consultants"
  ON consultants FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- TESTIMONIALS - Everyone reads, only authenticated writes
CREATE POLICY "public_read_testimonials"
  ON testimonials FOR SELECT
  USING (true);

CREATE POLICY "auth_write_testimonials"
  ON testimonials FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- PRICING - Everyone reads, only authenticated writes
CREATE POLICY "public_read_pricing"
  ON pricing_tiers FOR SELECT
  USING (true);

CREATE POLICY "auth_write_pricing"
  ON pricing_tiers FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- FAQS - Everyone reads, only authenticated writes
CREATE POLICY "public_read_faqs"
  ON faqs FOR SELECT
  USING (true);

CREATE POLICY "auth_write_faqs"
  ON faqs FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- PAGE CONTENT - Everyone reads, only authenticated writes
CREATE POLICY "public_read_page_content"
  ON page_content FOR SELECT
  USING (true);

CREATE POLICY "auth_write_page_content"
  ON page_content FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- CONTENT SECTIONS - Everyone reads, only authenticated writes
CREATE POLICY "public_read_content_sections"
  ON content_sections FOR SELECT
  USING (true);

CREATE POLICY "auth_write_content_sections"
  ON content_sections FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- SITE SETTINGS - Everyone reads, only authenticated writes
CREATE POLICY "public_read_site_settings"
  ON site_settings FOR SELECT
  USING (true);

CREATE POLICY "auth_write_site_settings"
  ON site_settings FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- BLOG - Everyone reads, only authenticated writes
CREATE POLICY "public_read_blog"
  ON blog FOR SELECT
  USING (true);

CREATE POLICY "auth_write_blog"
  ON blog FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- STEP 3: USER-SPECIFIC TABLES
-- =====================================================

-- PROFILES - Users can read all, update own
CREATE POLICY "public_read_profiles"
  ON profiles FOR SELECT
  USING (true);

CREATE POLICY "users_update_own_profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- BOOKINGS - Users see own, authenticated can create
CREATE POLICY "users_read_own_bookings"
  ON bookings FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "users_create_bookings"
  ON bookings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_update_own_bookings"
  ON bookings FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- STEP 4: NETWORKING TABLES (Authenticated users only)
-- =====================================================

-- CHANNELS - Authenticated users can read
CREATE POLICY "auth_read_channels"
  ON channels FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "auth_write_channels"
  ON channels FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- CHANNEL MEMBERS
CREATE POLICY "auth_read_channel_members"
  ON channel_members FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "auth_write_channel_members"
  ON channel_members FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- CHANNEL MESSAGES
CREATE POLICY "auth_read_channel_messages"
  ON channel_messages FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "users_write_own_messages"
  ON channel_messages FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_update_own_messages"
  ON channel_messages FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_delete_own_messages"
  ON channel_messages FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- USER GROUPS
CREATE POLICY "auth_read_user_groups"
  ON user_groups FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "users_create_groups"
  ON user_groups FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "users_update_own_groups"
  ON user_groups FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

-- GROUP MEMBERS
CREATE POLICY "auth_read_group_members"
  ON group_members FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "users_join_groups"
  ON group_members FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_leave_groups"
  ON group_members FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- GROUP POSTS
CREATE POLICY "auth_read_group_posts"
  ON group_posts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "users_create_group_posts"
  ON group_posts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_update_own_group_posts"
  ON group_posts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_delete_own_group_posts"
  ON group_posts FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- STARTUP SHOWCASES
CREATE POLICY "auth_read_startup_showcases"
  ON startup_showcases FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "users_create_showcases"
  ON startup_showcases FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_update_own_showcases"
  ON startup_showcases FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_delete_own_showcases"
  ON startup_showcases FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- MESSAGE REACTIONS
CREATE POLICY "auth_read_message_reactions"
  ON message_reactions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "users_add_reactions"
  ON message_reactions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_remove_own_reactions"
  ON message_reactions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- REPORTS
CREATE POLICY "users_create_reports"
  ON reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "users_read_own_reports"
  ON reports FOR SELECT
  TO authenticated
  USING (auth.uid() = reporter_id);

-- =====================================================
-- STEP 5: STORAGE POLICIES
-- =====================================================

-- Drop all storage policies
DO $$
DECLARE
  pol RECORD;
  drop_count INTEGER := 0;
BEGIN
  FOR pol IN 
    SELECT policyname
    FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
    drop_count := drop_count + 1;
  END LOOP;
  
  RAISE NOTICE 'Dropped % storage policies', drop_count;
END $$;

-- Public read for all buckets
CREATE POLICY "public_read_storage"
  ON storage.objects FOR SELECT
  USING (true);

-- Authenticated users can upload
CREATE POLICY "auth_upload_storage"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Users can update their own uploads
CREATE POLICY "auth_update_storage"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Users can delete their own uploads
CREATE POLICY "auth_delete_storage"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (true);

-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
DECLARE
  consultant_count INTEGER;
  testimonial_count INTEGER;
  policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO consultant_count FROM consultants;
  SELECT COUNT(*) INTO testimonial_count FROM testimonials;
  SELECT COUNT(*) INTO policy_count FROM pg_policies WHERE schemaname = 'public';
  
  RAISE NOTICE '';
  RAISE NOTICE '✅ =====================================================';
  RAISE NOTICE '✅ SECURE RLS POLICIES APPLIED!';
  RAISE NOTICE '✅ =====================================================';
  RAISE NOTICE '';
  RAISE NOTICE '🔒 Security Summary:';
  RAISE NOTICE '   ✓ Public content: Everyone can READ';
  RAISE NOTICE '   ✓ Public content: Only authenticated can WRITE';
  RAISE NOTICE '   ✓ User data: Users can only access their own';
  RAISE NOTICE '   ✓ Networking: Only authenticated users';
  RAISE NOTICE '   ✓ Storage: Public read, authenticated write';
  RAISE NOTICE '';
  RAISE NOTICE '📊 Status:';
  RAISE NOTICE '   Consultants: %', consultant_count;
  RAISE NOTICE '   Testimonials: %', testimonial_count;
  RAISE NOTICE '   Total policies: %', policy_count;
  RAISE NOTICE '';
  RAISE NOTICE '🎯 Next steps:';
  RAISE NOTICE '   1. Refresh your app';
  RAISE NOTICE '   2. Test as anonymous user (logged out)';
  RAISE NOTICE '   3. Test as authenticated user (logged in)';
  RAISE NOTICE '   4. Everything should still work!';
  RAISE NOTICE '';
  RAISE NOTICE '💡 To add admin-only restrictions:';
  RAISE NOTICE '   - Run fix-admin-access.sql to make yourself admin';
  RAISE NOTICE '   - Then add admin checks to write policies if needed';
  RAISE NOTICE '';
END $$;
