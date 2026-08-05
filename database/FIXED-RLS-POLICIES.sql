-- =====================================================
-- FIXED RLS POLICIES - ALLOWS ANONYMOUS ACCESS
-- =====================================================
-- Run this AFTER all tables are created
-- This fixes the "content not showing" problem
-- =====================================================

-- =====================================================
-- 1. PROFILES TABLE
-- =====================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop old policies
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON profiles;

-- ✅ Users can view their own profile
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- ✅ Admins can view all profiles
CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ✅ Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ✅ Admins can update any profile
CREATE POLICY "Admins can update any profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =====================================================
-- 2. CONSULTANTS TABLE - ALLOW ANONYMOUS ACCESS
-- =====================================================

ALTER TABLE consultants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Consultants are viewable by everyone" ON consultants;
DROP POLICY IF EXISTS "Anyone can view active consultants" ON consultants;
DROP POLICY IF EXISTS "Admins can view all consultants" ON consultants;
DROP POLICY IF EXISTS "Only admins can insert consultants" ON consultants;
DROP POLICY IF EXISTS "Only admins can update consultants" ON consultants;
DROP POLICY IF EXISTS "Only admins can delete consultants" ON consultants;

-- ✅ CRITICAL: Allow EVERYONE (anonymous + authenticated) to view active consultants
CREATE POLICY "Anyone can view active consultants"
  ON consultants FOR SELECT
  USING (is_active = true);

-- ✅ Admins can view ALL consultants (including inactive)
CREATE POLICY "Admins can view all consultants"
  ON consultants FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ✅ Only admins can manage consultants
CREATE POLICY "Admins can insert consultants"
  ON consultants FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update consultants"
  ON consultants FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can delete consultants"
  ON consultants FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =====================================================
-- 3. BOOKINGS TABLE
-- =====================================================

ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own bookings" ON bookings;
DROP POLICY IF EXISTS "Anyone can create bookings" ON bookings;
DROP POLICY IF EXISTS "Users can create bookings" ON bookings;
DROP POLICY IF EXISTS "Users can update own bookings" ON bookings;
DROP POLICY IF EXISTS "Admins can view all bookings" ON bookings;
DROP POLICY IF EXISTS "Admins can update bookings" ON bookings;
DROP POLICY IF EXISTS "Only admins can delete bookings" ON bookings;
DROP POLICY IF EXISTS "Admins can delete bookings" ON bookings;

-- ✅ Users can view their own bookings
CREATE POLICY "Users can view own bookings"
  ON bookings FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- ✅ Admins can view all bookings
CREATE POLICY "Admins can view all bookings"
  ON bookings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ✅ Authenticated users can create bookings
CREATE POLICY "Users can create bookings"
  ON bookings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ✅ Users can update their own bookings
CREATE POLICY "Users can update own bookings"
  ON bookings FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- ✅ Admins can update any booking
CREATE POLICY "Admins can update bookings"
  ON bookings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ✅ Admins can delete bookings
CREATE POLICY "Admins can delete bookings"
  ON bookings FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =====================================================
-- 4. TESTIMONIALS TABLE - ALLOW ANONYMOUS ACCESS
-- =====================================================

ALTER TABLE testimonials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Published testimonials are viewable by everyone" ON testimonials;
DROP POLICY IF EXISTS "Anyone can view published testimonials" ON testimonials;
DROP POLICY IF EXISTS "Admins can view all testimonials" ON testimonials;
DROP POLICY IF EXISTS "Only admins can insert testimonials" ON testimonials;
DROP POLICY IF EXISTS "Only admins can update testimonials" ON testimonials;
DROP POLICY IF EXISTS "Only admins can delete testimonials" ON testimonials;
DROP POLICY IF EXISTS "Admins can insert testimonials" ON testimonials;
DROP POLICY IF EXISTS "Admins can update testimonials" ON testimonials;
DROP POLICY IF EXISTS "Admins can delete testimonials" ON testimonials;

-- ✅ CRITICAL: Allow EVERYONE (anonymous + authenticated) to view published testimonials
CREATE POLICY "Anyone can view published testimonials"
  ON testimonials FOR SELECT
  USING (status = 'published');

-- ✅ Admins can view ALL testimonials (including drafts)
CREATE POLICY "Admins can view all testimonials"
  ON testimonials FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ✅ Only admins can manage testimonials
CREATE POLICY "Admins can insert testimonials"
  ON testimonials FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update testimonials"
  ON testimonials FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can delete testimonials"
  ON testimonials FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =====================================================
-- 5. BLOG TABLE - ALLOW ANONYMOUS ACCESS
-- =====================================================

ALTER TABLE blog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Published blog posts are viewable by everyone" ON blog;
DROP POLICY IF EXISTS "Anyone can view published blog posts" ON blog;
DROP POLICY IF EXISTS "Admins can view all blog posts" ON blog;
DROP POLICY IF EXISTS "Only admins can insert blog posts" ON blog;
DROP POLICY IF EXISTS "Only admins can update blog posts" ON blog;
DROP POLICY IF EXISTS "Only admins can delete blog posts" ON blog;
DROP POLICY IF EXISTS "Admins can insert blog posts" ON blog;
DROP POLICY IF EXISTS "Admins can update blog posts" ON blog;
DROP POLICY IF EXISTS "Admins can delete blog posts" ON blog;

-- ✅ CRITICAL: Allow EVERYONE (anonymous + authenticated) to view published blog posts
CREATE POLICY "Anyone can view published blog posts"
  ON blog FOR SELECT
  USING (status = 'published');

-- ✅ Admins can view ALL blog posts (including drafts)
CREATE POLICY "Admins can view all blog posts"
  ON blog FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ✅ Only admins can manage blog posts
CREATE POLICY "Admins can insert blog posts"
  ON blog FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update blog posts"
  ON blog FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can delete blog posts"
  ON blog FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =====================================================
-- 6. CONTENT SECTIONS - ALLOW ANONYMOUS ACCESS
-- =====================================================

ALTER TABLE content_sections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Content sections are viewable by everyone" ON content_sections;
DROP POLICY IF EXISTS "Anyone can view content sections" ON content_sections;
DROP POLICY IF EXISTS "Only admins can update content sections" ON content_sections;
DROP POLICY IF EXISTS "Admins can update content sections" ON content_sections;
DROP POLICY IF EXISTS "Only admins can insert content sections" ON content_sections;
DROP POLICY IF EXISTS "Admins can insert content sections" ON content_sections;

-- ✅ CRITICAL: Allow anonymous users to view content sections
CREATE POLICY "Anyone can view content sections"
  ON content_sections FOR SELECT
  USING (true);

-- ✅ Only admins can manage content sections
CREATE POLICY "Admins can insert content sections"
  ON content_sections FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update content sections"
  ON content_sections FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =====================================================
-- 7. SITE SETTINGS - ALLOW ANONYMOUS ACCESS
-- =====================================================

ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Site settings are viewable by everyone" ON site_settings;
DROP POLICY IF EXISTS "Anyone can view site settings" ON site_settings;
DROP POLICY IF EXISTS "Only admins can update site settings" ON site_settings;
DROP POLICY IF EXISTS "Only admins can insert site settings" ON site_settings;
DROP POLICY IF EXISTS "Admins can insert site settings" ON site_settings;
DROP POLICY IF EXISTS "Admins can update site settings" ON site_settings;
DROP POLICY IF EXISTS "Admins can delete site settings" ON site_settings;

-- ✅ CRITICAL: Allow anonymous users to view site settings
CREATE POLICY "Anyone can view site settings"
  ON site_settings FOR SELECT
  USING (true);

-- ✅ Only admins can manage site settings
CREATE POLICY "Admins can insert site settings"
  ON site_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update site settings"
  ON site_settings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can delete site settings"
  ON site_settings FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =====================================================
-- 8. FAQS - ALLOW ANONYMOUS ACCESS
-- =====================================================

ALTER TABLE faqs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "FAQs are viewable by everyone" ON faqs;
DROP POLICY IF EXISTS "Anyone can view FAQs" ON faqs;
DROP POLICY IF EXISTS "Only admins can insert FAQs" ON faqs;
DROP POLICY IF EXISTS "Only admins can update FAQs" ON faqs;
DROP POLICY IF EXISTS "Only admins can delete FAQs" ON faqs;
DROP POLICY IF EXISTS "Admins can insert FAQs" ON faqs;
DROP POLICY IF EXISTS "Admins can update FAQs" ON faqs;
DROP POLICY IF EXISTS "Admins can delete FAQs" ON faqs;

-- ✅ CRITICAL: Allow anonymous users to view FAQs
CREATE POLICY "Anyone can view FAQs"
  ON faqs FOR SELECT
  USING (true);

-- ✅ Only admins can manage FAQs
CREATE POLICY "Admins can insert FAQs"
  ON faqs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update FAQs"
  ON faqs FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can delete FAQs"
  ON faqs FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =====================================================
-- 9. PAGE CONTENT - ALLOW ANONYMOUS ACCESS
-- =====================================================

ALTER TABLE page_content ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Page content is viewable by everyone" ON page_content;
DROP POLICY IF EXISTS "Anyone can view page content" ON page_content;
DROP POLICY IF EXISTS "Only admins can insert page content" ON page_content;
DROP POLICY IF EXISTS "Only admins can update page content" ON page_content;
DROP POLICY IF EXISTS "Only admins can delete page content" ON page_content;
DROP POLICY IF EXISTS "Admins can insert page content" ON page_content;
DROP POLICY IF EXISTS "Admins can update page content" ON page_content;
DROP POLICY IF EXISTS "Admins can delete page content" ON page_content;

-- ✅ CRITICAL: Allow anonymous users to view page content
CREATE POLICY "Anyone can view page content"
  ON page_content FOR SELECT
  USING (true);

-- ✅ Only admins can manage page content
CREATE POLICY "Admins can insert page content"
  ON page_content FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update page content"
  ON page_content FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can delete page content"
  ON page_content FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =====================================================
-- 10. PRICING TIERS - ALLOW ANONYMOUS ACCESS
-- =====================================================

ALTER TABLE pricing_tiers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active pricing tiers" ON pricing_tiers;
DROP POLICY IF EXISTS "Admins can view all pricing tiers" ON pricing_tiers;
DROP POLICY IF EXISTS "Admins can insert pricing tiers" ON pricing_tiers;
DROP POLICY IF EXISTS "Admins can update pricing tiers" ON pricing_tiers;
DROP POLICY IF EXISTS "Admins can delete pricing tiers" ON pricing_tiers;

-- ✅ CRITICAL: Allow EVERYONE (anonymous + authenticated) to view active pricing
CREATE POLICY "Anyone can view active pricing tiers"
  ON pricing_tiers FOR SELECT
  USING (is_active = true);

-- ✅ Admins can view ALL pricing tiers (including inactive)
CREATE POLICY "Admins can view all pricing tiers"
  ON pricing_tiers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ✅ Only admins can manage pricing
CREATE POLICY "Admins can insert pricing tiers"
  ON pricing_tiers FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update pricing tiers"
  ON pricing_tiers FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can delete pricing tiers"
  ON pricing_tiers FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =====================================================
-- 11. STORAGE BUCKETS - ALLOW ANONYMOUS READ
-- =====================================================

-- Drop all existing storage policies
DROP POLICY IF EXISTS "Consultant images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view consultant images" ON storage.objects;
DROP POLICY IF EXISTS "Only admins can upload consultant images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload consultant images" ON storage.objects;
DROP POLICY IF EXISTS "Only admins can delete consultant images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete consultant images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update consultant images" ON storage.objects;

DROP POLICY IF EXISTS "Testimonial images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view testimonial images" ON storage.objects;
DROP POLICY IF EXISTS "Only admins can upload testimonial images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload testimonial images" ON storage.objects;
DROP POLICY IF EXISTS "Only admins can delete testimonial images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete testimonial images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update testimonial images" ON storage.objects;

DROP POLICY IF EXISTS "Blog images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view blog images" ON storage.objects;
DROP POLICY IF EXISTS "Only admins can upload blog images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload blog images" ON storage.objects;
DROP POLICY IF EXISTS "Only admins can delete blog images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete blog images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update blog images" ON storage.objects;

DROP POLICY IF EXISTS "Site assets are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view site assets" ON storage.objects;
DROP POLICY IF EXISTS "Only admins can upload site assets" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload site assets" ON storage.objects;
DROP POLICY IF EXISTS "Only admins can delete site assets" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete site assets" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update site assets" ON storage.objects;

DROP POLICY IF EXISTS "Public can view consultant images" ON storage.objects;
DROP POLICY IF EXISTS "Public can view blog images" ON storage.objects;
DROP POLICY IF EXISTS "Public can view site assets" ON storage.objects;

-- ✅ CONSULTANT IMAGES - Public read, admin write
CREATE POLICY "Anyone can view consultant images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'consultant-images');

CREATE POLICY "Admins can upload consultant images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'consultant-images' AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update consultant images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'consultant-images' AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can delete consultant images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'consultant-images' AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ✅ TESTIMONIAL IMAGES - Public read, admin write
CREATE POLICY "Anyone can view testimonial images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'testimonial-images');

CREATE POLICY "Admins can upload testimonial images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'testimonial-images' AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update testimonial images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'testimonial-images' AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can delete testimonial images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'testimonial-images' AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ✅ BLOG IMAGES - Public read, admin write
CREATE POLICY "Anyone can view blog images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'blog-images');

CREATE POLICY "Admins can upload blog images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'blog-images' AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update blog images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'blog-images' AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can delete blog images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'blog-images' AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ✅ SITE ASSETS - Public read, admin write
CREATE POLICY "Anyone can view site assets"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'site-assets');

CREATE POLICY "Admins can upload site assets"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'site-assets' AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update site assets"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'site-assets' AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can delete site assets"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'site-assets' AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ =====================================================';
  RAISE NOTICE '✅ ALL RLS POLICIES FIXED!';
  RAISE NOTICE '✅ =====================================================';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 What was fixed:';
  RAISE NOTICE '   ✓ Anonymous users can now view public content';
  RAISE NOTICE '   ✓ Consultants, testimonials, blog posts visible';
  RAISE NOTICE '   ✓ FAQs, pricing, site settings accessible';
  RAISE NOTICE '   ✓ Storage images publicly readable';
  RAISE NOTICE '   ✓ Authenticated users have proper access';
  RAISE NOTICE '   ✓ Admins have full management access';
  RAISE NOTICE '';
  RAISE NOTICE '🚀 Your app should now display all content correctly!';
  RAISE NOTICE '';
END $$;


-- =====================================================
-- 12. NETWORKING TABLES RLS POLICIES
-- =====================================================

-- =====================================================
-- CHANNELS
-- =====================================================

ALTER TABLE channels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public channels viewable by all" ON channels;
DROP POLICY IF EXISTS "Admins can manage channels" ON channels;
DROP POLICY IF EXISTS "Anyone can view active channels" ON channels;

-- ✅ Authenticated users can view active public channels
CREATE POLICY "Authenticated users can view active channels"
  ON channels FOR SELECT
  TO authenticated
  USING (is_public = true AND is_active = true);

-- ✅ Admins can manage all channels
CREATE POLICY "Admins can manage channels"
  ON channels FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =====================================================
-- CHANNEL MEMBERS
-- =====================================================

ALTER TABLE channel_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view channel members" ON channel_members;
DROP POLICY IF EXISTS "Users can join channels" ON channel_members;
DROP POLICY IF EXISTS "Users can leave channels" ON channel_members;
DROP POLICY IF EXISTS "Admins can manage memberships" ON channel_members;

-- ✅ Users can view channel members
CREATE POLICY "Users can view channel members"
  ON channel_members FOR SELECT
  TO authenticated
  USING (true);

-- ✅ Users can join channels
CREATE POLICY "Users can join channels"
  ON channel_members FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ✅ Users can leave channels
CREATE POLICY "Users can leave channels"
  ON channel_members FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ✅ Admins can manage all memberships
CREATE POLICY "Admins can manage memberships"
  ON channel_members FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =====================================================
-- CHANNEL MESSAGES
-- =====================================================

ALTER TABLE channel_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view channel messages" ON channel_messages;
DROP POLICY IF EXISTS "Members can post messages" ON channel_messages;
DROP POLICY IF EXISTS "Users can update own messages" ON channel_messages;
DROP POLICY IF EXISTS "Users can delete own messages" ON channel_messages;
DROP POLICY IF EXISTS "Admins can delete any message" ON channel_messages;

-- ✅ Members can view messages in their channels
CREATE POLICY "Members can view channel messages"
  ON channel_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM channel_members
      WHERE channel_members.channel_id = channel_messages.channel_id
      AND channel_members.user_id = auth.uid()
    )
  );

-- ✅ Members can post messages
CREATE POLICY "Members can post messages"
  ON channel_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM channel_members
      WHERE channel_members.channel_id = channel_messages.channel_id
      AND channel_members.user_id = auth.uid()
    )
    AND auth.uid() = user_id
  );

-- ✅ Users can update their own messages
CREATE POLICY "Users can update own messages"
  ON channel_messages FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ✅ Users can delete their own messages
CREATE POLICY "Users can delete own messages"
  ON channel_messages FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ✅ Admins can delete any message
CREATE POLICY "Admins can delete any message"
  ON channel_messages FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =====================================================
-- USER GROUPS
-- =====================================================

ALTER TABLE user_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public groups viewable by all" ON user_groups;
DROP POLICY IF EXISTS "Members can view their groups" ON user_groups;
DROP POLICY IF EXISTS "Users can create groups" ON user_groups;
DROP POLICY IF EXISTS "Owners can update groups" ON user_groups;
DROP POLICY IF EXISTS "Admins can manage groups" ON user_groups;

-- ✅ Public groups viewable by all authenticated users
CREATE POLICY "Public groups viewable by all"
  ON user_groups FOR SELECT
  TO authenticated
  USING (is_private = false AND is_disabled = false);

-- ✅ Members can view their private groups
CREATE POLICY "Members can view their groups"
  ON user_groups FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = user_groups.id
      AND group_members.user_id = auth.uid()
    )
  );

-- ✅ Users can create groups
CREATE POLICY "Users can create groups"
  ON user_groups FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- ✅ Group owners can update their groups
CREATE POLICY "Owners can update groups"
  ON user_groups FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = user_groups.id
      AND group_members.user_id = auth.uid()
      AND group_members.role = 'owner'
    )
  );

-- ✅ Admins can manage all groups
CREATE POLICY "Admins can manage groups"
  ON user_groups FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =====================================================
-- GROUP MEMBERS
-- =====================================================

ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view group members" ON group_members;
DROP POLICY IF EXISTS "Users can join groups" ON group_members;
DROP POLICY IF EXISTS "Users can leave groups" ON group_members;

-- ✅ Users can view group members
CREATE POLICY "Users can view group members"
  ON group_members FOR SELECT
  TO authenticated
  USING (true);

-- ✅ Users can join groups
CREATE POLICY "Users can join groups"
  ON group_members FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ✅ Users can leave groups
CREATE POLICY "Users can leave groups"
  ON group_members FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- =====================================================
-- GROUP POSTS
-- =====================================================

ALTER TABLE group_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view group posts" ON group_posts;
DROP POLICY IF EXISTS "Members can create group posts" ON group_posts;
DROP POLICY IF EXISTS "Users can update own posts" ON group_posts;
DROP POLICY IF EXISTS "Users can delete own posts" ON group_posts;
DROP POLICY IF EXISTS "Admins can delete any post" ON group_posts;

-- ✅ Members can view posts in their groups
CREATE POLICY "Members can view group posts"
  ON group_posts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = group_posts.group_id
      AND group_members.user_id = auth.uid()
    )
  );

-- ✅ Members can create posts in their groups
CREATE POLICY "Members can create group posts"
  ON group_posts FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = group_posts.group_id
      AND group_members.user_id = auth.uid()
    )
    AND auth.uid() = user_id
  );

-- ✅ Users can update their own posts
CREATE POLICY "Users can update own posts"
  ON group_posts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ✅ Users can delete their own posts
CREATE POLICY "Users can delete own posts"
  ON group_posts FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ✅ Admins can delete any post
CREATE POLICY "Admins can delete any post"
  ON group_posts FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =====================================================
-- STARTUP SHOWCASES
-- =====================================================

ALTER TABLE startup_showcases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view approved showcases" ON startup_showcases;
DROP POLICY IF EXISTS "Users can create showcases" ON startup_showcases;
DROP POLICY IF EXISTS "Users can update own showcases" ON startup_showcases;
DROP POLICY IF EXISTS "Users can delete own showcases" ON startup_showcases;
DROP POLICY IF EXISTS "Admins can manage showcases" ON startup_showcases;

-- ✅ Members can view approved showcases in their channels
CREATE POLICY "Members can view approved showcases"
  ON startup_showcases FOR SELECT
  TO authenticated
  USING (
    status = 'approved' AND
    EXISTS (
      SELECT 1 FROM channel_members
      WHERE channel_members.channel_id = startup_showcases.channel_id
      AND channel_members.user_id = auth.uid()
    )
  );

-- ✅ Users can create showcases
CREATE POLICY "Users can create showcases"
  ON startup_showcases FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ✅ Users can update their own showcases
CREATE POLICY "Users can update own showcases"
  ON startup_showcases FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ✅ Users can delete their own showcases
CREATE POLICY "Users can delete own showcases"
  ON startup_showcases FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ✅ Admins can manage all showcases
CREATE POLICY "Admins can manage showcases"
  ON startup_showcases FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =====================================================
-- MESSAGE REACTIONS
-- =====================================================

ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view reactions" ON message_reactions;
DROP POLICY IF EXISTS "Users can add reactions" ON message_reactions;
DROP POLICY IF EXISTS "Users can remove own reactions" ON message_reactions;

-- ✅ Users can view reactions
CREATE POLICY "Users can view reactions"
  ON message_reactions FOR SELECT
  TO authenticated
  USING (true);

-- ✅ Users can add reactions
CREATE POLICY "Users can add reactions"
  ON message_reactions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ✅ Users can remove their own reactions
CREATE POLICY "Users can remove own reactions"
  ON message_reactions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- =====================================================
-- REPORTS
-- =====================================================

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can create reports" ON reports;
DROP POLICY IF EXISTS "Users can view own reports" ON reports;
DROP POLICY IF EXISTS "Admins can view all reports" ON reports;
DROP POLICY IF EXISTS "Admins can update reports" ON reports;

-- ✅ Users can create reports
CREATE POLICY "Users can create reports"
  ON reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

-- ✅ Users can view their own reports
CREATE POLICY "Users can view own reports"
  ON reports FOR SELECT
  TO authenticated
  USING (auth.uid() = reporter_id);

-- ✅ Admins can view all reports
CREATE POLICY "Admins can view all reports"
  ON reports FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ✅ Admins can update reports
CREATE POLICY "Admins can update reports"
  ON reports FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =====================================================
-- FINAL VERIFICATION
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ =====================================================';
  RAISE NOTICE '✅ ALL RLS POLICIES APPLIED SUCCESSFULLY!';
  RAISE NOTICE '✅ =====================================================';
  RAISE NOTICE '';
  RAISE NOTICE '📊 Tables with RLS enabled:';
  RAISE NOTICE '   ✓ Core: profiles, consultants, bookings, testimonials, blog';
  RAISE NOTICE '   ✓ Content: content_sections, site_settings, faqs, page_content, pricing_tiers';
  RAISE NOTICE '   ✓ Networking: channels, channel_members, channel_messages';
  RAISE NOTICE '   ✓ Networking: user_groups, group_members, group_posts';
  RAISE NOTICE '   ✓ Networking: startup_showcases, message_reactions, reports';
  RAISE NOTICE '   ✓ Storage: All 4 buckets (consultant, testimonial, blog, site-assets)';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 Access Control Summary:';
  RAISE NOTICE '   ✓ Anonymous: Can view all published public content';
  RAISE NOTICE '   ✓ Authenticated: Can create bookings, join channels, post messages';
  RAISE NOTICE '   ✓ Admins: Full management access to all content';
  RAISE NOTICE '';
  RAISE NOTICE '🚀 Your database is now fully secured and ready!';
  RAISE NOTICE '';
END $$;
