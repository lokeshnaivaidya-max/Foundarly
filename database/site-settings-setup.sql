-- =====================================================
-- SITE SETTINGS TABLE SETUP & RLS POLICIES
-- =====================================================
-- Run this in your Supabase SQL Editor to create table and configure RLS
-- =====================================================

-- 1. Create site_settings table if it doesn't exist
CREATE TABLE IF NOT EXISTS site_settings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  setting_key TEXT UNIQUE NOT NULL,
  setting_value TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Insert default site settings
INSERT INTO site_settings (setting_key, setting_value) VALUES
  ('site_logo_text', 'Foundarly'),
  ('site_logo_url', NULL),
  ('platform_name', 'Foundarly'),
  ('support_email', 'support@foundarly.com'),
  ('default_session_duration', '60'),
  ('cancellation_window', '24'),
  ('currency', 'USD')
ON CONFLICT (setting_key) DO NOTHING;

-- 3. Enable Row Level Security (RLS)
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

-- 4. Clean up any existing conflicting policies
DROP POLICY IF EXISTS "Anyone can view site settings" ON site_settings;
DROP POLICY IF EXISTS "Site settings are viewable by everyone" ON site_settings;
DROP POLICY IF EXISTS "public_read_site_settings" ON site_settings;
DROP POLICY IF EXISTS "Only admins can update site settings" ON site_settings;
DROP POLICY IF EXISTS "Only admins can insert site settings" ON site_settings;
DROP POLICY IF EXISTS "Admins can insert site settings" ON site_settings;
DROP POLICY IF EXISTS "Admins can update site settings" ON site_settings;
DROP POLICY IF EXISTS "Admins can delete site settings" ON site_settings;
DROP POLICY IF EXISTS "admins_full_access_site_settings" ON site_settings;
DROP POLICY IF EXISTS "auth_write_site_settings" ON site_settings;
DROP POLICY IF EXISTS "allow_read_site_settings" ON site_settings;
DROP POLICY IF EXISTS "allow_write_site_settings" ON site_settings;
DROP POLICY IF EXISTS "auth_manage_site_settings" ON site_settings;

-- 5. Create Public Read Policy (all users can view platform settings)
CREATE POLICY "public_read_site_settings"
  ON site_settings FOR SELECT
  USING (true);

-- 6. Create Authenticated Write Policy (all authenticated users / admins can insert/update settings)
CREATE POLICY "auth_manage_site_settings"
  ON site_settings FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 7. Create site-assets storage bucket if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('site-assets', 'site-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Verify setup
SELECT 'Site settings table & RLS policies configured successfully!' as status;
SELECT * FROM site_settings;

