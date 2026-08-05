-- =====================================================
-- CONTENT MANAGEMENT TABLES SETUP
-- =====================================================
-- Run this in your Supabase SQL Editor
-- =====================================================

-- 1. FAQs Table
CREATE TABLE IF NOT EXISTS faqs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS will be enabled separately
-- See FIXED-RLS-POLICIES.sql for all RLS policies

-- Insert default FAQs
INSERT INTO faqs (question, answer, order_index) VALUES
  ('How do I book a consultation?', 'Simply browse our experts, select one that matches your needs, and choose a date and session type. You''ll receive a confirmation email with all the details.', 1),
  ('What payment methods do you accept?', 'We accept all major credit cards and process payments through secure, encrypted channels. Your financial information is never stored on our servers.', 2),
  ('Can I reschedule or cancel a session?', 'Yes, you can reschedule up to 24 hours before your session at no charge. Cancellations within 24 hours may be subject to our refund policy.', 3),
  ('What video platform is used?', 'Sessions are conducted via secure, encrypted video conferencing. You''ll receive a private link before your session — no downloads required.', 4),
  ('Is my consultation confidential?', 'Absolutely. All sessions are private and confidential. We do not share, record, or distribute any session content without explicit consent.', 5),
  ('What is your refund policy?', 'If you''re not satisfied with your session, contact us within 48 hours for a full review. We''re committed to delivering real value in every consultation.', 6)
ON CONFLICT DO NOTHING;

-- 2. Page Content Table (for About page and other static content)
CREATE TABLE IF NOT EXISTS page_content (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  page_key TEXT UNIQUE NOT NULL,
  title TEXT,
  content TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS will be enabled separately
-- See FIXED-RLS-POLICIES.sql for all RLS policies

-- Insert default About page content
INSERT INTO page_content (page_key, title, content) VALUES
  ('about', 'The Vision Behind Foundarly', 'Foundarly was born from a simple observation: the most transformative conversations in a founder''s journey happen one-on-one, behind closed doors, with someone who''s been there before.

We saw a gap in the market — not for another marketplace of generic advice, but for a curated, premium environment where ambitious professionals could access real expertise from verified leaders.

Every consultant on Foundarly is handpicked. Every session is private. Every interaction is designed to deliver clarity, strategy, and forward momentum.

By the Founders. For the Founders.

We believe that the right conversation at the right time can change everything. That''s the experience we''re committed to delivering — one session at a time.')
ON CONFLICT (page_key) DO NOTHING;

-- Verify setup
SELECT 'Content management tables created successfully!' as status;
SELECT COUNT(*) as faq_count FROM faqs;
SELECT COUNT(*) as page_count FROM page_content;
