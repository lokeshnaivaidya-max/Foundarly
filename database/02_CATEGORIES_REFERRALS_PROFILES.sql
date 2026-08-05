-- Foundarly Database Migration: Categories, Referral System, Extended Consultant Profile Fields
-- Run this script in the Supabase SQL Editor

-- 1. Extend consultants table with rich profile fields
ALTER TABLE public.consultants 
ADD COLUMN IF NOT EXISTS location TEXT DEFAULT 'India',
ADD COLUMN IF NOT EXISTS qualification TEXT DEFAULT 'Industry Specialist',
ADD COLUMN IF NOT EXISTS experience TEXT DEFAULT '10+ Years',
ADD COLUMN IF NOT EXISTS preferred_time TEXT DEFAULT 'Mon - Sat (10:00 AM - 6:00 PM)',
ADD COLUMN IF NOT EXISTS languages TEXT[] DEFAULT ARRAY['English', 'Hindi'],
ADD COLUMN IF NOT EXISTS categories TEXT[] DEFAULT ARRAY['Information Technology'],
ADD COLUMN IF NOT EXISTS availability TEXT DEFAULT 'Available Today',
ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '{"linkedin": "", "twitter": "", "instagram": "", "youtube": ""}'::jsonb;

-- 2. Create Categories Table
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on categories
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- Allow public read access on categories
CREATE POLICY "Public categories access" ON public.categories 
  FOR SELECT USING (true);

-- Allow admins full access on categories
CREATE POLICY "Admin categories access" ON public.categories 
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Seed Categories
INSERT INTO public.categories (name, display_order) VALUES
  ('Lodging / Hotel', 1),
  ('Artificial Intelligence', 2),
  ('Education', 3),
  ('Healthcare', 4),
  ('Finance & Insurance', 5),
  ('Transport & Logistics', 6),
  ('Information Technology', 7),
  ('Agriculture & Forestry', 8),
  ('Construction', 9),
  ('Real Estate', 10),
  ('Jewellery (Artificial)', 11),
  ('Jewellery (Original)', 12),
  ('Media & Entertainment', 13),
  ('Plastic', 14),
  ('Packaging', 15),
  ('Steel, Aluminium & Copper', 16),
  ('Electrical', 17),
  ('Electronics', 18),
  ('Skincare & Body Care', 19),
  ('Travelling', 20),
  ('Import & Export', 21),
  ('Manufacturing', 22),
  ('Wholesale & Retail', 23),
  ('Food Processing', 24),
  ('Spices & Dry Fruits', 25),
  ('Fashion', 26),
  ('Wood & Hardware', 27),
  ('Automobile', 28),
  ('Engineering Equipment', 29)
ON CONFLICT (name) DO NOTHING;

-- 3. Create Referral Codes Table
CREATE TABLE IF NOT EXISTS public.referral_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value NUMERIC NOT NULL,
  created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  usage_limit INT DEFAULT NULL,
  times_used INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;

-- Anyone can read active referral codes (for code validation)
CREATE POLICY "Public referral validation access" ON public.referral_codes 
  FOR SELECT USING (is_active = true);

-- Admins full access on referral_codes
CREATE POLICY "Admin referral_codes access" ON public.referral_codes 
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Seed initial default referral codes
INSERT INTO public.referral_codes (code, discount_type, discount_value, is_active) VALUES
  ('FOUNDARLY10', 'percentage', 10, true),
  ('WELCOME100', 'fixed', 100, true),
  ('STARTUP20', 'percentage', 20, true)
ON CONFLICT (code) DO NOTHING;

-- 4. Create Referral Usages Table
CREATE TABLE IF NOT EXISTS public.referral_usages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_code_id UUID REFERENCES public.referral_codes(id) ON DELETE SET NULL,
  code TEXT NOT NULL,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  user_email TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  referrer_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  discount_amount NUMERIC NOT NULL DEFAULT 0,
  original_price NUMERIC NOT NULL,
  final_price NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.referral_usages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own referral usage" ON public.referral_usages
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view own referral usages" ON public.referral_usages
  FOR SELECT USING (auth.uid() = user_id OR auth.uid() = referrer_user_id);

CREATE POLICY "Admin referral_usages access" ON public.referral_usages 
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- 5. Site Settings default inserts for YouTube and Instagram links
INSERT INTO public.site_settings (setting_key, setting_value, updated_at) VALUES
  ('youtube_channel_url', 'https://youtube.com/@foundarly?si=ZHlc2Swj3Rtm37Kn', NOW()),
  ('youtube_intro_video_url', 'https://youtu.be/L2ndHKr9Q5Y?si=TE35364lR-3dY94F', NOW()),
  ('instagram_url', 'https://www.instagram.com/foundarlybusinessworld_in?utm_source=qr&igsh=dmVxNm8wNW93aHV5', NOW())
ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = NOW();
