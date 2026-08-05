-- =====================================================
-- MIGRATION 5: SEED DATA
-- =====================================================

-- Content Sections
INSERT INTO public.content_sections (section_name, title, subtitle, description, button_text) VALUES
  ('hero', 'Expert Guidance, On Demand', 'Connect with world-class consultants', 'Get personalized advice from industry leaders who have been where you want to go.', 'Book Your Session'),
  ('services', 'How We Help You Succeed', 'Our Services', 'Tailored consulting services designed to accelerate your growth.', NULL),
  ('how-it-works', 'Simple. Fast. Effective.', 'How It Works', 'Get expert guidance in three easy steps.', NULL)
ON CONFLICT (section_name) DO NOTHING;

-- Default Site Settings
INSERT INTO public.site_settings (setting_key, setting_value) VALUES
  ('site_logo_text', 'Foundarly'),
  ('site_logo_url', NULL)
ON CONFLICT (setting_key) DO NOTHING;

-- Default Sample Consultants
INSERT INTO public.consultants (name, title, bio, expertise, pricing_30, pricing_60, gender, is_active) VALUES
  ('Alexandra Chen', 'CEO & Growth Strategist', 'Former Fortune 500 executive with 15+ years scaling businesses from startup to IPO.', ARRAY['Business Strategy', 'Growth', 'Leadership'], 150, 250, 'female', true),
  ('Marcus Williams', 'Executive Leadership Coach', 'Certified executive coach helping leaders unlock their full potential.', ARRAY['Leadership', 'Career Development', 'Executive Coaching'], 120, 200, 'male', true),
  ('Dr. Sarah Patel', 'Performance Psychologist', 'PhD in Organizational Psychology, specializing in high-performance mindset.', ARRAY['Personal Growth', 'Psychology', 'Performance'], 100, 180, 'female', true),
  ('James Hartley', 'Serial Entrepreneur & Advisor', 'Built and exited 3 successful startups. Now helping others do the same.', ARRAY['Entrepreneurship', 'Startups', 'Business Strategy'], 180, 300, 'male', true)
ON CONFLICT DO NOTHING;

-- Sample Testimonials
INSERT INTO public.testimonials (client_name, designation, company, review, rating, status) VALUES
  ('Daniel Rivera', 'Startup Founder', 'TechVentures Inc', 'One session with my consultant completely reframed how I think about scaling. Worth every dollar.', 5, 'published'),
  ('Lisa Nakamura', 'VP of Product', 'InnovateCo', 'The clarity I got in 60 minutes surpassed months of internal meetings. Foundarly connects you with people who have been there.', 5, 'published'),
  ('Omar Hassan', 'Career Changer', NULL, 'I was stuck for years. My consultant gave me a concrete roadmap, and I landed my dream role within 3 months.', 5, 'published')
ON CONFLICT DO NOTHING;

-- Sample Blog Posts
INSERT INTO public.blog (title, slug, content, category, tags, author_name, author_role, status) VALUES
  ('5 Strategies to Scale Your Startup in 2026', '5-strategies-to-scale-your-startup-2026', 'Scaling a startup requires a strategic mix of product market fit, capital efficiency, and clear leadership...', 'Strategy & Growth', ARRAY['Strategy', 'Startups', 'Scaling'], 'Foundarly Team', 'Senior Editor', 'published'),
  ('Mastering Executive Communication', 'mastering-executive-communication', 'Effective communication is the cornerstone of great leadership. Learn how top executives articulate vision...', 'Leadership', ARRAY['Leadership', 'Communication'], 'Marcus Williams', 'Leadership Coach', 'published')
ON CONFLICT (slug) DO NOTHING;

-- Default Networking Channels
INSERT INTO public.channels (name, description, category, icon, is_public, member_count) VALUES
  ('welcome', 'Welcome to Foundarly Network! Introduce yourself here.', 'General', '👋', true, 0),
  ('announcements', 'Official announcements and updates', 'General', '📢', true, 0),
  ('startup-founders', 'Connect with fellow startup founders', 'Founders', '🚀', true, 0),
  ('funding-discussions', 'Discuss funding strategies and investor relations', 'Founders', '💰', true, 0),
  ('tech-ai', 'AI, Machine Learning, and emerging technologies', 'Technology', '🤖', true, 0),
  ('dev-tools', 'Development tools, frameworks, and best practices', 'Technology', '⚙️', true, 0),
  ('growth-marketing', 'Marketing strategies and growth hacking', 'Marketing', '📈', true, 0),
  ('content-strategy', 'Content creation and marketing strategies', 'Marketing', '✍️', true, 0),
  ('investment-opportunities', 'Investment opportunities and financial discussions', 'Finance', '💵', true, 0),
  ('financial-planning', 'Business finance and planning', 'Finance', '📊', true, 0),
  ('job-board', 'Job opportunities and career discussions', 'Career', '💼', true, 0),
  ('talent-acquisition', 'Hiring and talent management', 'Career', '🎯', true, 0),
  ('product-design', 'Product design and UX discussions', 'Product', '🎨', true, 0),
  ('product-management', 'Product strategy and management', 'Product', '🛠️', true, 0),
  ('freelance-gigs', 'Freelance opportunities and discussions', 'Freelance', '💻', true, 0),
  ('startup-showcase', 'Showcase your startup to the community', 'Showcase', '⭐', true, 0)
ON CONFLICT DO NOTHING;

-- Sample FAQs
INSERT INTO public.faqs (question, answer, order_index) VALUES
  ('How do I book a consultation session?', 'Browse our list of verified consultants, select your preferred time slot, and complete the booking form.', 1),
  ('Can I reschedule or cancel a booking?', 'Yes, you can manage or reschedule your bookings directly from your user dashboard up to 24 hours in advance.', 2),
  ('What payment methods are supported?', 'We support credit/debit cards, UPI transfers, Razorpay, and direct bank options.', 3)
ON CONFLICT DO NOTHING;
