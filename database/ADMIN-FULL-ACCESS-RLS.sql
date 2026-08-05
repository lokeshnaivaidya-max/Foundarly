-- =====================================================
-- ADMIN FULL ACCESS RLS POLICIES
-- =====================================================
-- This gives admins complete control over all tables
-- Based on your actual admin features and services
-- =====================================================

-- =====================================================
-- HELPER FUNCTION: Check if user is admin
-- =====================================================

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- =====================================================
-- DROP ALL EXISTING POLICIES
-- =====================================================

DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN 
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', 
      pol.policyname, pol.schemaname, pol.tablename);
  END LOOP;
END $$;

-- =====================================================
-- PROFILES - Admin can manage all users
-- =====================================================

CREATE POLICY "public_read_profiles"
  ON profiles FOR SELECT
  USING (true);

CREATE POLICY "users_update_own_profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "admins_full_access_profiles"
  ON profiles FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- =====================================================
-- CONSULTANTS - Admin full CRUD
-- =====================================================

CREATE POLICY "public_read_consultants"
  ON consultants FOR SELECT
  USING (true);

CREATE POLICY "admins_full_access_consultants"
  ON consultants FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- =====================================================
-- BOOKINGS - Admin can see and manage all
-- =====================================================

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

CREATE POLICY "admins_full_access_bookings"
  ON bookings FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- =====================================================
-- TESTIMONIALS - Admin full CRUD
-- =====================================================

CREATE POLICY "public_read_testimonials"
  ON testimonials FOR SELECT
  USING (true);

CREATE POLICY "admins_full_access_testimonials"
  ON testimonials FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- =====================================================
-- BLOG - Admin full CRUD
-- =====================================================

CREATE POLICY "public_read_blog"
  ON blog FOR SELECT
  USING (true);

CREATE POLICY "admins_full_access_blog"
  ON blog FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- =====================================================
-- CONTENT SECTIONS - Admin full CRUD
-- =====================================================

CREATE POLICY "public_read_content_sections"
  ON content_sections FOR SELECT
  USING (true);

CREATE POLICY "admins_full_access_content_sections"
  ON content_sections FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- =====================================================
-- SITE SETTINGS - Admin full CRUD
-- =====================================================

CREATE POLICY "public_read_site_settings"
  ON site_settings FOR SELECT
  USING (true);

CREATE POLICY "admins_full_access_site_settings"
  ON site_settings FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- =====================================================
-- FAQS - Admin full CRUD
-- =====================================================

CREATE POLICY "public_read_faqs"
  ON faqs FOR SELECT
  USING (true);

CREATE POLICY "admins_full_access_faqs"
  ON faqs FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- =====================================================
-- PAGE CONTENT - Admin full CRUD
-- =====================================================

CREATE POLICY "public_read_page_content"
  ON page_content FOR SELECT
  USING (true);

CREATE POLICY "admins_full_access_page_content"
  ON page_content FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- =====================================================
-- PRICING TIERS - Admin full CRUD
-- =====================================================

CREATE POLICY "public_read_pricing"
  ON pricing_tiers FOR SELECT
  USING (true);

CREATE POLICY "admins_full_access_pricing"
  ON pricing_tiers FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- =====================================================
-- CHANNELS - Admin full CRUD
-- =====================================================

CREATE POLICY "auth_read_channels"
  ON channels FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "admins_full_access_channels"
  ON channels FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- =====================================================
-- CHANNEL MEMBERS - Admin full CRUD
-- =====================================================

CREATE POLICY "auth_read_channel_members"
  ON channel_members FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "users_join_channels"
  ON channel_members FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_leave_channels"
  ON channel_members FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "admins_full_access_channel_members"
  ON channel_members FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- =====================================================
-- CHANNEL MESSAGES - Admin can delete any
-- =====================================================

CREATE POLICY "auth_read_channel_messages"
  ON channel_messages FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "users_create_messages"
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

CREATE POLICY "admins_full_access_channel_messages"
  ON channel_messages FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- =====================================================
-- USER GROUPS - Admin full CRUD
-- =====================================================

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

CREATE POLICY "admins_full_access_user_groups"
  ON user_groups FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- =====================================================
-- GROUP MEMBERS - Admin full CRUD
-- =====================================================

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

CREATE POLICY "admins_full_access_group_members"
  ON group_members FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- =====================================================
-- GROUP POSTS - Admin can delete any
-- =====================================================

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

CREATE POLICY "admins_full_access_group_posts"
  ON group_posts FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- =====================================================
-- STARTUP SHOWCASES - Admin full CRUD
-- =====================================================

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

CREATE POLICY "admins_full_access_startup_showcases"
  ON startup_showcases FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- =====================================================
-- MESSAGE REACTIONS
-- =====================================================

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

CREATE POLICY "admins_full_access_message_reactions"
  ON message_reactions FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- =====================================================
-- REPORTS - Admin can see and manage all
-- =====================================================

CREATE POLICY "users_create_reports"
  ON reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "users_read_own_reports"
  ON reports FOR SELECT
  TO authenticated
  USING (auth.uid() = reporter_id);

CREATE POLICY "admins_full_access_reports"
  ON reports FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- =====================================================
-- STORAGE - Admin full access
-- =====================================================

-- Drop all storage policies
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN 
    SELECT policyname
    FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
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

-- Admins can do everything
CREATE POLICY "admins_full_access_storage"
  ON storage.objects FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
DECLARE
  current_user_role TEXT;
  policy_count INTEGER;
  admin_policy_count INTEGER;
BEGIN
  -- Get current user's role
  SELECT role INTO current_user_role FROM profiles WHERE id = auth.uid();
  
  -- Count total policies
  SELECT COUNT(*) INTO policy_count 
  FROM pg_policies 
  WHERE schemaname = 'public';
  
  -- Count admin policies
  SELECT COUNT(*) INTO admin_policy_count 
  FROM pg_policies 
  WHERE schemaname = 'public' AND policyname LIKE '%admin%';
  
  RAISE NOTICE '';
  RAISE NOTICE '✅ =====================================================';
  RAISE NOTICE '✅ ADMIN FULL ACCESS RLS APPLIED!';
  RAISE NOTICE '✅ =====================================================';
  RAISE NOTICE '';
  RAISE NOTICE '👤 Your role: %', COALESCE(current_user_role, 'Not logged in');
  RAISE NOTICE '📊 Total policies: %', policy_count;
  RAISE NOTICE '👑 Admin policies: %', admin_policy_count;
  RAISE NOTICE '';
  RAISE NOTICE '🔒 Security Summary:';
  RAISE NOTICE '   ✓ Public content: Everyone can READ';
  RAISE NOTICE '   ✓ User content: Users can manage their own';
  RAISE NOTICE '   ✓ Admin access: Full CRUD on ALL tables';
  RAISE NOTICE '';
  RAISE NOTICE '👑 Admin Can:';
  RAISE NOTICE '   ✓ Manage all users and change roles';
  RAISE NOTICE '   ✓ CRUD consultants, testimonials, blog';
  RAISE NOTICE '   ✓ View and manage all bookings';
  RAISE NOTICE '   ✓ Edit content sections, FAQs, pricing';
  RAISE NOTICE '   ✓ Manage channels, groups, messages';
  RAISE NOTICE '   ✓ Approve/reject showcases';
  RAISE NOTICE '   ✓ View and resolve reports';
  RAISE NOTICE '   ✓ Delete any content';
  RAISE NOTICE '   ✓ Full storage access';
  RAISE NOTICE '';
  
  IF current_user_role = 'admin' THEN
    RAISE NOTICE '✅ You are an admin - you have full access!';
  ELSIF current_user_role IS NOT NULL THEN
    RAISE NOTICE '⚠️  You are not an admin. To become admin:';
    RAISE NOTICE '   Run: SELECT make_user_admin(''your@email.com'');';
  ELSE
    RAISE NOTICE '⚠️  You are not logged in.';
  END IF;
  RAISE NOTICE '';
END $$;
