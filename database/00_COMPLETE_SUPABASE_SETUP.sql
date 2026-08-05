-- ==============================================================================
-- FOUNDARLY COMPLETE MASTER SUPABASE BACKEND MIGRATION
-- ==============================================================================
-- Project Reference: rfyxnshvtfswvaogjzwq
-- Admin Email: admin@foundarly.com
-- ONE SELF-CONTAINED MASTER FILE WITH ALL 23 TABLES, INDEXES, TRIGGERS, BUCKETS, RLS, & SEED DATA
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================================================
-- 2. ALL DATABASE TABLES
-- ==============================================================================

-- 1) PROFILES (User accounts and role assignment)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  role TEXT NOT NULL DEFAULT 'client' CHECK (role IN ('admin', 'consultant', 'client')),
  full_name TEXT,
  is_consultant BOOLEAN DEFAULT FALSE,
  consultant_bio TEXT,
  consultant_hourly_rate DECIMAL(10,2),
  total_earnings DECIMAL(10,2) DEFAULT 0,
  available_balance DECIMAL(10,2) DEFAULT 0,
  withdrawn_amount DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2) CONSULTANTS
CREATE TABLE IF NOT EXISTS public.consultants (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  title TEXT NOT NULL,
  bio TEXT NOT NULL,
  expertise TEXT[] DEFAULT '{}',
  pricing_30 NUMERIC(10, 2) NOT NULL,
  pricing_60 NUMERIC(10, 2) NOT NULL,
  image_url TEXT,
  gender TEXT CHECK (gender IN ('male', 'female')),
  is_active BOOLEAN DEFAULT true,
  email_notifications BOOLEAN DEFAULT true,
  notification_preferences JSONB DEFAULT '{"email_booking_confirmed": true, "email_booking_cancelled": true, "email_booking_rescheduled": true}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3) BOOKINGS
CREATE TABLE IF NOT EXISTS public.bookings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  consultant_id UUID REFERENCES public.consultants(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  date DATE NOT NULL,
  time TEXT NOT NULL,
  message TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled', 'missed')),
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'refunded', 'rejected')),
  session_duration INTEGER DEFAULT 60,
  session_price NUMERIC(10, 2),
  meeting_room_id TEXT,
  participants_count INTEGER DEFAULT 0,
  reschedule_requested_by UUID REFERENCES auth.users(id),
  reschedule_reason TEXT,
  original_date DATE,
  original_time TEXT,
  reschedule_count INTEGER DEFAULT 0,
  reschedule_status TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4) UPI PAYMENTS
CREATE TABLE IF NOT EXISTS public.upi_payments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  transaction_id TEXT NOT NULL,
  payment_amount NUMERIC(10, 2) NOT NULL,
  payment_method TEXT DEFAULT 'UPI',
  consultant_id UUID REFERENCES public.consultants(id) ON DELETE SET NULL,
  session_duration INTEGER DEFAULT 60,
  booking_date DATE,
  booking_time TEXT,
  booking_message TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected')),
  admin_notes TEXT,
  verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5) TESTIMONIALS
CREATE TABLE IF NOT EXISTS public.testimonials (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  client_name TEXT NOT NULL,
  designation TEXT NOT NULL,
  company TEXT,
  review TEXT NOT NULL,
  rating INTEGER DEFAULT 5 CHECK (rating >= 1 AND rating <= 5),
  image_url TEXT,
  status TEXT DEFAULT 'published' CHECK (status IN ('published', 'draft')),
  consultant_id UUID REFERENCES public.consultants(id) ON DELETE SET NULL,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6) BLOG
CREATE TABLE IF NOT EXISTS public.blog (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  featured_image TEXT,
  meta_title TEXT,
  meta_description TEXT,
  status TEXT DEFAULT 'published' CHECK (status IN ('published', 'draft')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7) CONTENT SECTIONS
CREATE TABLE IF NOT EXISTS public.content_sections (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  section_name TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT,
  description TEXT,
  button_text TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8) SITE SETTINGS
CREATE TABLE IF NOT EXISTS public.site_settings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  setting_key TEXT UNIQUE NOT NULL,
  setting_value TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9) CONSULTANT APPLICATIONS
CREATE TABLE IF NOT EXISTS public.consultant_applications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  age INTEGER NOT NULL,
  gender TEXT NOT NULL CHECK (gender IN ('male', 'female')),
  qualification TEXT NOT NULL,
  current_job TEXT NOT NULL,
  location TEXT NOT NULL,
  experience TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  whatsapp TEXT NOT NULL,
  linkedin_url TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10) FAQS
CREATE TABLE IF NOT EXISTS public.faqs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11) PAGE CONTENT
CREATE TABLE IF NOT EXISTS public.page_content (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  page_key TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12) PRICING TIERS
CREATE TABLE IF NOT EXISTS public.pricing_tiers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10, 2) NOT NULL,
  duration_minutes INTEGER,
  features TEXT[] DEFAULT '{}',
  is_popular BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13) PAYOUT REQUESTS
CREATE TABLE IF NOT EXISTS public.payout_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  consultant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  payment_method TEXT NOT NULL,
  payment_details JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
  admin_notes TEXT,
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  processed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14) EARNINGS HISTORY
CREATE TABLE IF NOT EXISTS public.earnings_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  consultant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  platform_fee DECIMAL(10,2) DEFAULT 0,
  net_amount DECIMAL(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'refunded')),
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 15) CHANNELS
CREATE TABLE IF NOT EXISTS public.channels (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'general',
  is_public BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  member_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 16) CHANNEL MEMBERS
CREATE TABLE IF NOT EXISTS public.channel_members (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  channel_id UUID REFERENCES public.channels(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(channel_id, user_id)
);

-- 17) CHANNEL MESSAGES
CREATE TABLE IF NOT EXISTS public.channel_messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  channel_id UUID REFERENCES public.channels(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  media_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 18) USER GROUPS
CREATE TABLE IF NOT EXISTS public.user_groups (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_private BOOLEAN DEFAULT false,
  is_disabled BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 19) GROUP MEMBERS
CREATE TABLE IF NOT EXISTS public.group_members (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  group_id UUID REFERENCES public.user_groups(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);

-- 20) GROUP POSTS
CREATE TABLE IF NOT EXISTS public.group_posts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  group_id UUID REFERENCES public.user_groups(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 21) STARTUP SHOWCASES
CREATE TABLE IF NOT EXISTS public.startup_showcases (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  channel_id UUID REFERENCES public.channels(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  logo_url TEXT,
  website_url TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 22) MESSAGE REACTIONS
CREATE TABLE IF NOT EXISTS public.message_reactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  message_id UUID REFERENCES public.channel_messages(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(message_id, user_id, emoji)
);

-- 23) REPORTS
CREATE TABLE IF NOT EXISTS public.reports (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  reporter_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  target_type TEXT NOT NULL,
  target_id UUID NOT NULL,
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 3. INDEXES FOR HIGH PERFORMANCE
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_bookings_user ON public.bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_consultant ON public.bookings(consultant_id);
CREATE INDEX IF NOT EXISTS idx_bookings_date ON public.bookings(date);
CREATE INDEX IF NOT EXISTS idx_upi_payments_booking ON public.upi_payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_upi_payments_user ON public.upi_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payout_requests_consultant ON public.payout_requests(consultant_id);
CREATE INDEX IF NOT EXISTS idx_payout_requests_status ON public.payout_requests(status);
CREATE INDEX IF NOT EXISTS idx_earnings_consultant ON public.earnings_history(consultant_id);
CREATE INDEX IF NOT EXISTS idx_channel_messages_channel ON public.channel_messages(channel_id);
CREATE INDEX IF NOT EXISTS idx_group_posts_group ON public.group_posts(group_id);

-- ==============================================================================
-- 4. STORAGE BUCKETS
-- ==============================================================================
INSERT INTO storage.buckets (id, name, public) VALUES
  ('consultant-images', 'consultant-images', true),
  ('testimonial-images', 'testimonial-images', true),
  ('blog-images', 'blog-images', true),
  ('site-assets', 'site-assets', true),
  ('payment-proofs', 'payment-proofs', true)
ON CONFLICT (id) DO NOTHING;

-- ==============================================================================
-- 5. AUTOMATIC USER TRIGGER & ADMIN CREATION
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    CASE 
      WHEN LOWER(NEW.email) = 'admin@foundarly.com' THEN 'admin'
      ELSE 'client'
    END
  )
  ON CONFLICT (id) DO UPDATE
  SET role = EXCLUDED.role, full_name = EXCLUDED.full_name;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- 6. ENABLE ROW LEVEL SECURITY (RLS) ON ALL TABLES
-- ==============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.upi_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultant_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.page_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payout_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.earnings_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.startup_showcases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- 7. RLS POLICIES
-- ==============================================================================

-- PROFILES
CREATE POLICY "Public read profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "User update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Admin manage all profiles" ON public.profiles FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- CONSULTANTS
CREATE POLICY "Public read consultants" ON public.consultants FOR SELECT USING (is_active = true OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admin manage consultants" ON public.consultants FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- BOOKINGS
CREATE POLICY "Anyone can insert bookings" ON public.bookings FOR INSERT WITH CHECK (true);
CREATE POLICY "Secure view bookings" ON public.bookings FOR SELECT USING (
  (auth.uid() IS NOT NULL AND auth.uid() = user_id)
  OR (auth.jwt() ->> 'email' IS NOT NULL AND LOWER(email) = LOWER(auth.jwt() ->> 'email'))
  OR EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  OR LOWER(auth.jwt() ->> 'email') = 'admin@foundarly.com'
);
CREATE POLICY "Secure update bookings" ON public.bookings FOR UPDATE USING (
  (auth.uid() IS NOT NULL AND auth.uid() = user_id)
  OR (auth.jwt() ->> 'email' IS NOT NULL AND LOWER(email) = LOWER(auth.jwt() ->> 'email'))
  OR EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  OR LOWER(auth.jwt() ->> 'email') = 'admin@foundarly.com'
);
CREATE POLICY "Admin delete bookings" ON public.bookings FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  OR LOWER(auth.jwt() ->> 'email') = 'admin@foundarly.com'
);

-- UPI PAYMENTS
CREATE POLICY "Anyone can insert upi_payments" ON public.upi_payments FOR INSERT WITH CHECK (true);
CREATE POLICY "User view own upi_payments" ON public.upi_payments FOR SELECT USING (
  auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Admin manage upi_payments" ON public.upi_payments FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- PUBLIC TABLES READ ACCESS (Testimonials, Blog, Content, FAQs, Site Settings, Pricing Tiers, Page Content)
CREATE POLICY "Public read testimonials" ON public.testimonials FOR SELECT USING (status = 'published' OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admin manage testimonials" ON public.testimonials FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Public read blog" ON public.blog FOR SELECT USING (status = 'published' OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admin manage blog" ON public.blog FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Public read content_sections" ON public.content_sections FOR SELECT USING (true);
CREATE POLICY "Admin manage content_sections" ON public.content_sections FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Public read site_settings" ON public.site_settings FOR SELECT USING (true);
CREATE POLICY "Admin manage site_settings" ON public.site_settings FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Public read faqs" ON public.faqs FOR SELECT USING (true);
CREATE POLICY "Admin manage faqs" ON public.faqs FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Public read page_content" ON public.page_content FOR SELECT USING (true);
CREATE POLICY "Admin manage page_content" ON public.page_content FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Public read pricing_tiers" ON public.pricing_tiers FOR SELECT USING (is_active = true OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admin manage pricing_tiers" ON public.pricing_tiers FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- CONSULTANT APPLICATIONS
CREATE POLICY "Anyone submit consultant application" ON public.consultant_applications FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin manage consultant applications" ON public.consultant_applications FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- PAYOUT REQUESTS & EARNINGS
CREATE POLICY "Consultant view own payouts" ON public.payout_requests FOR SELECT TO authenticated USING (auth.uid() = consultant_id OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Consultant create payout" ON public.payout_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = consultant_id);
CREATE POLICY "Admin manage payouts" ON public.payout_requests FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Consultant view own earnings" ON public.earnings_history FOR SELECT TO authenticated USING (auth.uid() = consultant_id OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- NETWORKING TABLES RLS
CREATE POLICY "Public read channels" ON public.channels FOR SELECT USING (is_active = true);
CREATE POLICY "Admin manage channels" ON public.channels FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Auth read channel_members" ON public.channel_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth join channels" ON public.channel_members FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "User leave channel" ON public.channel_members FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Auth read channel_messages" ON public.channel_messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth send channel_messages" ON public.channel_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Public read user_groups" ON public.user_groups FOR SELECT USING (is_disabled = false);
CREATE POLICY "Auth create user_groups" ON public.user_groups FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Auth read group_members" ON public.group_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth join group" ON public.group_members FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Auth read group_posts" ON public.group_posts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth create group_post" ON public.group_posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Public read showcases" ON public.startup_showcases FOR SELECT USING (status = 'approved' OR auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Auth submit showcase" ON public.startup_showcases FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Auth reactions" ON public.message_reactions FOR ALL TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Auth create reports" ON public.reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_id);

-- STORAGE BUCKETS POLICIES
CREATE POLICY "Public read images" ON storage.objects FOR SELECT USING (bucket_id IN ('consultant-images', 'testimonial-images', 'blog-images', 'site-assets', 'payment-proofs'));
CREATE POLICY "Auth upload images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id IN ('consultant-images', 'testimonial-images', 'blog-images', 'site-assets', 'payment-proofs'));

-- ==============================================================================
-- 8. INITIAL SEED DATA
-- ==============================================================================

-- CONSULTANTS SEED DATA
INSERT INTO public.consultants (name, title, bio, expertise, pricing_30, pricing_60, image_url, gender, is_active)
VALUES
  (
    'Rajesh',
    'Chartered Accountant',
    'Experienced Chartered Accountant specializing in taxation, auditing, and comprehensive financial planning for businesses of all sizes.',
    ARRAY['Taxation', 'Auditing', 'Financial Planning', 'GST Compliance', 'Business Advisory'],
    799,
    1599,
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Rajesh',
    'male',
    true
  ),
  (
    'Ranjan Verma',
    'Jewellery Business Consultant',
    'Expert consultant in jewellery business operations, retail strategies, and market positioning with over 15 years of industry experience.',
    ARRAY['Jewellery Business', 'Retail Strategy', 'Market Analysis', 'Precious Metals Trading', 'Brand Development'],
    699,
    1299,
    'https://api.dicebear.com/7.x/avataaars/svg?seed=RanjanVerma',
    'male',
    true
  ),
  (
    'Puneet Sharma',
    'Petrol Pump Business Consultant',
    'Specialized consultant for petrol pump businesses, covering operations, compliance, and profitability optimization.',
    ARRAY['Fuel Retail', 'Operations Management', 'Compliance', 'Profitability Analysis', 'Safety Standards'],
    699,
    1299,
    'https://api.dicebear.com/7.x/avataaars/svg?seed=PuneetSharma',
    'male',
    true
  ),
  (
    'Sai Prasad Tiwari',
    'Real Estate Business Consultant',
    'Real estate expert providing guidance on property development, investment strategies, and market analysis.',
    ARRAY['Real Estate', 'Property Development', 'Investment Strategy', 'Market Analysis', 'Legal Compliance'],
    699,
    1299,
    'https://api.dicebear.com/7.x/avataaars/svg?seed=SaiPrasadTiwari',
    'male',
    true
  ),
  (
    'Akshat Birla',
    'Spices & Dry Fruits Business Consultant',
    'Consultant specializing in spices and dry fruits business, including sourcing, quality control, and distribution strategies.',
    ARRAY['Spices Trade', 'Dry Fruits Business', 'Supply Chain', 'Quality Control', 'Export-Import'],
    699,
    1299,
    'https://api.dicebear.com/7.x/avataaars/svg?seed=AkshatBirla',
    'male',
    true
  ),
  (
    'Sumeet Jain',
    'Cosmetic Business Consultant',
    'Expert in cosmetic business operations, brand development, and retail strategies for beauty products.',
    ARRAY['Cosmetics Industry', 'Brand Development', 'Retail Strategy', 'Product Formulation', 'Marketing'],
    699,
    1264,
    'https://api.dicebear.com/7.x/avataaars/svg?seed=SumeetJain',
    'male',
    true
  ),
  (
    'Hrishikesh Mishra',
    'IT Support Consultant',
    'IT consultant providing comprehensive technical support, infrastructure planning, and digital transformation guidance.',
    ARRAY['IT Infrastructure', 'Technical Support', 'Digital Transformation', 'Cybersecurity', 'Cloud Solutions'],
    699,
    1299,
    'https://api.dicebear.com/7.x/avataaars/svg?seed=HrishikeshMishra',
    'male',
    true
  )
ON CONFLICT DO NOTHING;

-- CONTENT SECTIONS SEED
INSERT INTO public.content_sections (section_name, title, subtitle, description, button_text)
VALUES
  ('hero', 'Connect with Industry Expert Consultants', 'Get 1-on-1 personalized guidance for your business growth', 'Book direct video consultations with top Chartered Accountants, Business Consultants, and Industry Specialists.', 'Book a Session'),
  ('about', 'Empowering Entrepreneurs and Business Leaders', 'Your trusted platform for direct expert consultations', 'Foundarly bridges the gap between ambitious business owners and seasoned industry experts.', 'Learn More'),
  ('cta', 'Ready to Elevate Your Business?', 'Schedule your session today with top-tier consultants', 'Take the next step in growing your startup or enterprise with actionable insights.', 'Get Started Now')
ON CONFLICT (section_name) DO NOTHING;

-- SITE SETTINGS SEED
INSERT INTO public.site_settings (setting_key, setting_value)
VALUES
  ('site_title', 'Foundarly - Expert Advisory Platform'),
  ('support_email', 'admin@foundarly.com'),
  ('support_phone', '+91 98765 43210'),
  ('upi_id', 'foundarly@upi'),
  ('upi_merchant_name', 'Foundarly Consultations'),
  ('currency_code', 'INR'),
  ('currency_symbol', '₹'),
  ('platform_fee_percent', '10')
ON CONFLICT (setting_key) DO NOTHING;

-- FAQS SEED
INSERT INTO public.faqs (question, answer, order_index)
VALUES
  ('How do I book a consultation session?', 'Select your preferred consultant from the directory, choose a date and time slot, select either a 30-minute or 60-minute session, and complete payment via UPI.', 1),
  ('How do online meetings work?', 'Once your payment is verified, you will receive a secure meeting link in your My Bookings section to join the direct video call at the scheduled time.', 2),
  ('Can I reschedule my booking?', 'Yes! You can request a session reschedule directly from your My Bookings dashboard prior to the session start time.', 3),
  ('What payment methods are supported?', 'We support direct Instant UPI payments (GPay, PhonePe, Paytm, BHIM) as well as online card payments.', 4)
ON CONFLICT DO NOTHING;

-- PRICING TIERS SEED
INSERT INTO public.pricing_tiers (name, description, price, duration_minutes, features, is_popular, is_active, display_order)
VALUES
  ('30-Minute Express Consultation', 'Ideal for focused questions, quick business advice, and targeted expert feedback.', 699, 30, ARRAY['Direct 1-on-1 Video Session', '30 Minutes Duration', 'Actionable Summary Notes', 'Flexible Rescheduling'], false, true, 1),
  ('60-Minute In-Depth Advisory', 'Best for comprehensive business strategy, financial auditing, and step-by-step roadmap execution.', 1299, 60, ARRAY['Direct 1-on-1 Video Session', '60 Minutes Duration', 'Full Strategy Roadmap', 'Follow-up Email Support', 'Priority Booking Slots'], true, true, 2)
ON CONFLICT DO NOTHING;

-- DEFAULT NETWORKING CHANNELS SEED
INSERT INTO public.channels (name, description, category, is_public, is_active)
VALUES
  ('General Discussion', 'Open forum for all entrepreneurs and consultants', 'general', true, true),
  ('Startup Showcase', 'Share your startup, product launches, and feedback', 'showcase', true, true),
  ('Tax & Legal Advice', 'Discuss GST, auditing, legal compliance, and business contracts', 'advisory', true, true),
  ('Technology & Growth', 'Scale your tech stack, digital marketing, and IT operations', 'growth', true, true)
ON CONFLICT DO NOTHING;

-- UPDATE ADMIN USER ROLE IF PRESENT
UPDATE public.profiles
SET role = 'admin'
WHERE id IN (
  SELECT id FROM auth.users WHERE LOWER(email) = 'admin@foundarly.com'
);

-- ==============================================================================
-- SETUP COMPLETED SUCCESSFULLY
-- ==============================================================================
