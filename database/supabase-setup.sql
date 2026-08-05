-- =====================================================
-- FOUNDARLY SUPABASE DATABASE SETUP
-- =====================================================
-- Run this script in your Supabase SQL Editor
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. PROFILES TABLE (User Roles)
-- =====================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  role TEXT NOT NULL DEFAULT 'client' CHECK (role IN ('admin', 'consultant', 'client')),
  full_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS will be enabled separately
-- See FIXED-RLS-POLICIES.sql for all RLS policies

-- =====================================================
-- 2. CONSULTANTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS consultants (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  title TEXT NOT NULL,
  bio TEXT NOT NULL,
  expertise TEXT[] DEFAULT '{}',
  pricing_30 INTEGER NOT NULL,
  pricing_60 INTEGER NOT NULL,
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS will be enabled separately
-- See FIXED-RLS-POLICIES.sql for all RLS policies

-- =====================================================
-- 3. BOOKINGS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS bookings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  consultant_id UUID REFERENCES consultants(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  date DATE NOT NULL,
  time TEXT NOT NULL,
  message TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'refunded')),
  session_duration INTEGER,
  session_price NUMERIC(10, 2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS will be enabled separately
-- See FIXED-RLS-POLICIES.sql for all RLS policies

-- =====================================================
-- 4. TESTIMONIALS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS testimonials (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  client_name TEXT NOT NULL,
  designation TEXT NOT NULL,
  company TEXT,
  review TEXT NOT NULL,
  rating INTEGER DEFAULT 5 CHECK (rating >= 1 AND rating <= 5),
  image_url TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('published', 'draft')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS will be enabled separately
-- See FIXED-RLS-POLICIES.sql for all RLS policies

-- =====================================================
-- 5. BLOG TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS blog (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  featured_image TEXT,
  meta_title TEXT,
  meta_description TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('published', 'draft')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS will be enabled separately
-- See FIXED-RLS-POLICIES.sql for all RLS policies

-- =====================================================
-- 6. CONTENT SECTIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS content_sections (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  section_name TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT,
  description TEXT,
  button_text TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS will be enabled separately
-- See FIXED-RLS-POLICIES.sql for all RLS policies

-- =====================================================
-- 7. TRIGGERS
-- =====================================================

-- Function to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'client'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- 8. STORAGE BUCKETS
-- =====================================================

-- Create storage buckets (run these in Supabase Dashboard > Storage or via SQL)
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('consultant-images', 'consultant-images', true),
  ('testimonial-images', 'testimonial-images', true),
  ('blog-images', 'blog-images', true),
  ('site-assets', 'site-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies will be set separately
-- See FIXED-RLS-POLICIES.sql for all storage policies

-- =====================================================
-- 9. SEED DATA
-- =====================================================

-- Insert default content sections
INSERT INTO content_sections (section_name, title, subtitle, description, button_text) VALUES
  ('hero', 'Expert Guidance, On Demand', 'Connect with world-class consultants', 'Get personalized advice from industry leaders who have been where you want to go.', 'Book Your Session'),
  ('services', 'How We Help You Succeed', 'Our Services', 'Tailored consulting services designed to accelerate your growth.', NULL),
  ('how-it-works', 'Simple. Fast. Effective.', 'How It Works', 'Get expert guidance in three easy steps.', NULL)
ON CONFLICT (section_name) DO NOTHING;

-- Insert sample consultants
INSERT INTO consultants (name, title, bio, expertise, pricing_30, pricing_60, is_active) VALUES
  ('Alexandra Chen', 'CEO & Growth Strategist', 'Former Fortune 500 executive with 15+ years scaling businesses from startup to IPO.', ARRAY['Business Strategy', 'Growth', 'Leadership'], 150, 250, true),
  ('Marcus Williams', 'Executive Leadership Coach', 'Certified executive coach helping leaders unlock their full potential.', ARRAY['Leadership', 'Career Development', 'Executive Coaching'], 120, 200, true),
  ('Dr. Sarah Patel', 'Performance Psychologist', 'PhD in Organizational Psychology, specializing in high-performance mindset.', ARRAY['Personal Growth', 'Psychology', 'Performance'], 100, 180, true),
  ('James Hartley', 'Serial Entrepreneur & Advisor', 'Built and exited 3 successful startups. Now helping others do the same.', ARRAY['Entrepreneurship', 'Startups', 'Business Strategy'], 180, 300, true)
ON CONFLICT DO NOTHING;

-- Insert sample testimonials
INSERT INTO testimonials (client_name, designation, company, review, rating, status) VALUES
  ('Daniel Rivera', 'Startup Founder', 'TechVentures Inc', 'One session with my consultant completely reframed how I think about scaling. Worth every dollar.', 5, 'published'),
  ('Lisa Nakamura', 'VP of Product', 'InnovateCo', 'The clarity I got in 60 minutes surpassed months of internal meetings. Foundarly connects you with people who have been there.', 5, 'published'),
  ('Omar Hassan', 'Career Changer', NULL, 'I was stuck for years. My consultant gave me a concrete roadmap, and I landed my dream role within 3 months.', 5, 'published')
ON CONFLICT DO NOTHING;

-- =====================================================
-- 10. SITE SETTINGS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS site_settings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  setting_key TEXT UNIQUE NOT NULL,
  setting_value TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS will be enabled separately
-- See FIXED-RLS-POLICIES.sql for all RLS policies

-- Insert default site settings
INSERT INTO site_settings (setting_key, setting_value) VALUES
  ('site_logo_text', 'Foundarly'),
  ('site_logo_url', NULL)
ON CONFLICT (setting_key) DO NOTHING;

-- =====================================================
-- 11. CREATE ADMIN USER (Run after creating your account)
-- =====================================================
-- Replace 'YOUR_USER_EMAIL@example.com' with your actual email
-- Run this AFTER you've signed up through the app

UPDATE profiles 
SET role = 'admin' 
WHERE id = (
 SELECT id FROM auth.users 
  WHERE email = 'starkcloudie@gmail.com'
 );

-- =====================================================
-- SETUP COMPLETE!
-- =====================================================
