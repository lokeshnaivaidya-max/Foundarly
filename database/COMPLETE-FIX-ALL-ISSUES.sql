-- =====================================================
-- COMPLETE FIX - All Data Not Showing After Login
-- =====================================================
-- This fixes ALL RLS issues at once
-- Run this in Supabase SQL Editor while logged in
-- =====================================================

-- =====================================================
-- STEP 1: Check your current user and profile
-- =====================================================

DO $$
DECLARE
  current_user_id UUID;
  profile_exists BOOLEAN;
  user_role TEXT;
  user_email TEXT;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RAISE NOTICE '❌ ERROR: You are not logged in!';
    RAISE NOTICE '   Please log in to your app first, then run this script.';
    RETURN;
  END IF;
  
  -- Get user email
  SELECT email INTO user_email FROM auth.users WHERE id = current_user_id;
  RAISE NOTICE '✅ Logged in as: % (ID: %)', user_email, current_user_id;
  
  -- Check if profile exists
  SELECT EXISTS(SELECT 1 FROM profiles WHERE id = current_user_id) INTO profile_exists;
  
  IF NOT profile_exists THEN
    RAISE NOTICE '⚠️  Creating missing profile...';
    INSERT INTO profiles (id, role, full_name)
    VALUES (current_user_id, 'client', COALESCE((SELECT raw_user_meta_data->>'full_name' FROM auth.users WHERE id = current_user_id), 'User'));
    RAISE NOTICE '✅ Profile created!';
  ELSE
    SELECT role INTO user_role FROM profiles WHERE id = current_user_id;
    RAISE NOTICE '✅ Profile exists with role: %', user_role;
  END IF;
END $$;

-- =====================================================
-- STEP 2: Drop ALL existing policies
-- =====================================================

-- Profiles
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;

-- Consultants
DROP POLICY IF EXISTS "Anyone can view active consultants" ON consultants;
DROP POLICY IF EXISTS "Admins can view all consultants" ON consultants;
DROP POLICY IF EXISTS "Consultants are viewable by everyone" ON consultants;
DROP POLICY IF EXISTS "Only admins can insert consultants" ON consultants;
DROP POLICY IF EXISTS "Admins can insert consultants" ON consultants;
DROP POLICY IF EXISTS "Only admins can update consultants" ON consultants;
DROP POLICY IF EXISTS "Admins can update consultants" ON consultants;
DROP POLICY IF EXISTS "Only admins can delete consultants" ON consultants;
DROP POLICY IF EXISTS "Admins can delete consultants" ON consultants;

-- Testimonials
DROP POLICY IF EXISTS "Anyone can view published testimonials" ON testimonials;
DROP POLICY IF EXISTS "Admins can view all testimonials" ON testimonials;
DROP POLICY IF EXISTS "Published testimonials are viewable by everyone" ON testimonials;
DROP POLICY IF EXISTS "Only admins can insert testimonials" ON testimonials;
DROP POLICY IF EXISTS "Admins can insert testimonials" ON testimonials;
DROP POLICY IF EXISTS "Only admins can update testimonials" ON testimonials;
DROP POLICY IF EXISTS "Admins can update testimonials" ON testimonials;
DROP POLICY IF EXISTS "Only admins can delete testimonials" ON testimonials;
DROP POLICY IF EXISTS "Admins can delete testimonials" ON testimonials;

-- Pricing
DROP POLICY IF EXISTS "Anyone can view active pricing tiers" ON pricing_tiers;
DROP POLICY IF EXISTS "Admins can view all pricing tiers" ON pricing_tiers;
DROP POLICY IF EXISTS "Admins can insert pricing tiers" ON pricing_tiers;
DROP POLICY IF EXISTS "Admins can update pricing tiers" ON pricing_tiers;
DROP POLICY IF EXISTS "Admins can delete pricing tiers" ON pricing_tiers;

-- FAQs
DROP POLICY IF EXISTS "Anyone can view FAQs" ON faqs;
DROP POLICY IF EXISTS "FAQs are viewable by everyone" ON faqs;
DROP POLICY IF EXISTS "Admins can insert FAQs" ON faqs;
DROP POLICY IF EXISTS "Admins can update FAQs" ON faqs;
DROP POLICY IF EXISTS "Admins can delete FAQs" ON faqs;

-- Page Content
DROP POLICY IF EXISTS "Anyone can view page content" ON page_content;
DROP POLICY IF EXISTS "Page content is viewable by everyone" ON page_content;
DROP POLICY IF EXISTS "Admins can insert page content" ON page_content;
DROP POLICY IF EXISTS "Admins can update page content" ON page_content;
DROP POLICY IF EXISTS "Admins can delete page content" ON page_content;

-- Content Sections
DROP POLICY IF EXISTS "Anyone can view content sections" ON content_sections;
DROP POLICY IF EXISTS "Content sections are viewable by everyone" ON content_sections;
DROP POLICY IF EXISTS "Admins can insert content sections" ON content_sections;
DROP POLICY IF EXISTS "Admins can update content sections" ON content_sections;

-- Site Settings
DROP POLICY IF EXISTS "Anyone can view site settings" ON site_settings;
DROP POLICY IF EXISTS "Site settings are viewable by everyone" ON site_settings;
DROP POLICY IF EXISTS "Admins can insert site settings" ON site_settings;
DROP POLICY IF EXISTS "Admins can update site settings" ON site_settings;
DROP POLICY IF EXISTS "Admins can delete site settings" ON site_settings;

-- Blog
DROP POLICY IF EXISTS "Anyone can view published blog posts" ON blog;
DROP POLICY IF EXISTS "Admins can view all blog posts" ON blog;
DROP POLICY IF EXISTS "Published blog posts are viewable by everyone" ON blog;
DROP POLICY IF EXISTS "Admins can insert blog posts" ON blog;
DROP POLICY IF EXISTS "Admins can update blog posts" ON blog;
DROP POLICY IF EXISTS "Admins can delete blog posts" ON blog;

-- Bookings
DROP POLICY IF EXISTS "Users can view own bookings" ON bookings;
DROP POLICY IF EXISTS "Admins can view all bookings" ON bookings;
DROP POLICY IF EXISTS "Users can create bookings" ON bookings;
DROP POLICY IF EXISTS "Anyone can create bookings" ON bookings;
DROP POLICY IF EXISTS "Users can update own bookings" ON bookings;
DROP POLICY IF EXISTS "Admins can update bookings" ON bookings;
DROP POLICY IF EXISTS "Admins can delete bookings" ON bookings;

-- Channels
DROP POLICY IF EXISTS "Authenticated users can view active channels" ON channels;
DROP POLICY IF EXISTS "Public channels viewable by all" ON channels;
DROP POLICY IF EXISTS "Admins can manage channels" ON channels;

-- =====================================================
-- STEP 3: Create CORRECT policies (works for everyone)
-- =====================================================

-- PROFILES - Users can see their own, admins see all
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id OR EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Admins can update any profile"
  ON profiles FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ));

-- CONSULTANTS - Everyone can see active, admins see all
CREATE POLICY "Everyone can view active consultants"
  ON consultants FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can view all consultants"
  ON consultants FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "Admins can manage consultants"
  ON consultants FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ));

-- TESTIMONIALS - Everyone can see published, admins see all
CREATE POLICY "Everyone can view published testimonials"
  ON testimonials FOR SELECT
  USING (status = 'published');

CREATE POLICY "Admins can view all testimonials"
  ON testimonials FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "Admins can manage testimonials"
  ON testimonials FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ));

-- PRICING - Everyone can see active, admins see all
CREATE POLICY "Everyone can view active pricing"
  ON pricing_tiers FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can view all pricing"
  ON pricing_tiers FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "Admins can manage pricing"
  ON pricing_tiers FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ));

-- FAQS - Everyone can see
CREATE POLICY "Everyone can view FAQs"
  ON faqs FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage FAQs"
  ON faqs FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ));

-- PAGE CONTENT - Everyone can see
CREATE POLICY "Everyone can view page content"
  ON page_content FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage page content"
  ON page_content FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ));

-- CONTENT SECTIONS - Everyone can see
CREATE POLICY "Everyone can view content sections"
  ON content_sections FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage content sections"
  ON content_sections FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ));

-- SITE SETTINGS - Everyone can see
CREATE POLICY "Everyone can view site settings"
  ON site_settings FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage site settings"
  ON site_settings FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ));

-- BLOG - Everyone can see published, admins see all
CREATE POLICY "Everyone can view published blog"
  ON blog FOR SELECT
  USING (status = 'published');

CREATE POLICY "Admins can view all blog"
  ON blog FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "Admins can manage blog"
  ON blog FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ));

-- BOOKINGS - Users see own, admins see all
CREATE POLICY "Users can view own bookings"
  ON bookings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all bookings"
  ON bookings FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "Authenticated users can create bookings"
  ON bookings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own bookings"
  ON bookings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage bookings"
  ON bookings FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ));

-- CHANNELS - Authenticated users can see active channels
CREATE POLICY "Authenticated users can view channels"
  ON channels FOR SELECT
  TO authenticated
  USING (is_public = true AND is_active = true);

CREATE POLICY "Admins can manage channels"
  ON channels FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ));

-- =====================================================
-- STEP 4: Verify everything works
-- =====================================================

DO $$
DECLARE
  consultant_count INTEGER;
  testimonial_count INTEGER;
  faq_count INTEGER;
  pricing_count INTEGER;
  channel_count INTEGER;
  user_role TEXT;
BEGIN
  -- Get user role
  SELECT role INTO user_role FROM profiles WHERE id = auth.uid();
  
  -- Test visibility
  SELECT COUNT(*) INTO consultant_count FROM consultants WHERE is_active = true;
  SELECT COUNT(*) INTO testimonial_count FROM testimonials WHERE status = 'published';
  SELECT COUNT(*) INTO faq_count FROM faqs;
  SELECT COUNT(*) INTO pricing_count FROM pricing_tiers WHERE is_active = true;
  SELECT COUNT(*) INTO channel_count FROM channels WHERE is_active = true AND is_public = true;
  
  RAISE NOTICE '';
  RAISE NOTICE '✅ =====================================================';
  RAISE NOTICE '✅ COMPLETE FIX APPLIED!';
  RAISE NOTICE '✅ =====================================================';
  RAISE NOTICE '';
  RAISE NOTICE '👤 Your Role: %', user_role;
  RAISE NOTICE '';
  RAISE NOTICE '📊 Data Visibility Test:';
  RAISE NOTICE '   Consultants: % (expected: 4)', consultant_count;
  RAISE NOTICE '   Testimonials: % (expected: 3)', testimonial_count;
  RAISE NOTICE '   FAQs: % (expected: 6)', faq_count;
  RAISE NOTICE '   Pricing: % (expected: 3)', pricing_count;
  RAISE NOTICE '   Channels: % (expected: 16)', channel_count;
  RAISE NOTICE '';
  
  IF consultant_count > 0 AND testimonial_count > 0 AND pricing_count > 0 THEN
    RAISE NOTICE '✅ SUCCESS! All data is now visible!';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 Next steps:';
    RAISE NOTICE '   1. Refresh your browser (Ctrl+Shift+R or Cmd+Shift+R)';
    RAISE NOTICE '   2. Clear browser cache if needed';
    RAISE NOTICE '   3. Log out and log back in';
    RAISE NOTICE '   4. All pages should now show data correctly';
    RAISE NOTICE '';
    IF user_role = 'admin' THEN
      RAISE NOTICE '👑 Admin access: You can access /admin panel';
    ELSE
      RAISE NOTICE '💡 To get admin access, run fix-admin-access.sql';
    END IF;
  ELSE
    RAISE NOTICE '⚠️  Some data is still not visible!';
    RAISE NOTICE '';
    RAISE NOTICE '🔍 Troubleshooting:';
    RAISE NOTICE '   1. Check if seed data exists: SELECT COUNT(*) FROM consultants;';
    RAISE NOTICE '   2. If count is 0, run supabase-setup.sql again';
    RAISE NOTICE '   3. Check browser console for errors';
  END IF;
  RAISE NOTICE '';
END $$;
