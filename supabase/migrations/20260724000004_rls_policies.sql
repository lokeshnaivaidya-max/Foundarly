-- =====================================================
-- MIGRATION 4: ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultant_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.page_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.startup_showcases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.upi_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.earnings_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payout_requests ENABLE ROW LEVEL SECURITY;

-- 1. PROFILES
CREATE POLICY "Public profiles read" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins manage profiles" ON public.profiles FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- 2. CONSULTANTS
CREATE POLICY "Public read active consultants" ON public.consultants FOR SELECT USING (is_active = true OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admins manage consultants" ON public.consultants FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- 3. BOOKINGS
CREATE POLICY "Read bookings" ON public.bookings FOR SELECT USING (user_id = auth.uid() OR consultant_id IN (SELECT id FROM public.consultants WHERE user_id = auth.uid()) OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Anyone create booking" ON public.bookings FOR INSERT WITH CHECK (true);
CREATE POLICY "Users/Consultants/Admins update bookings" ON public.bookings FOR UPDATE USING (user_id = auth.uid() OR consultant_id IN (SELECT id FROM public.consultants WHERE user_id = auth.uid()) OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- 4. TESTIMONIALS
CREATE POLICY "Public read published testimonials" ON public.testimonials FOR SELECT USING (status = 'published' OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admins manage testimonials" ON public.testimonials FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- 5. BLOG
CREATE POLICY "Public read published blog" ON public.blog FOR SELECT USING (status = 'published' OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admins manage blog" ON public.blog FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- 6. CONTENT SECTIONS
CREATE POLICY "Public read content sections" ON public.content_sections FOR SELECT USING (true);
CREATE POLICY "Admins manage content sections" ON public.content_sections FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- 7. SITE SETTINGS
CREATE POLICY "Public read site settings" ON public.site_settings FOR SELECT USING (true);
CREATE POLICY "Admins manage site settings" ON public.site_settings FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- 8. CONSULTANT APPLICATIONS
CREATE POLICY "Anyone apply consultant" ON public.consultant_applications FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins view consultant applications" ON public.consultant_applications FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admins manage consultant applications" ON public.consultant_applications FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- 9. FAQS
CREATE POLICY "Public read faqs" ON public.faqs FOR SELECT USING (true);
CREATE POLICY "Admins manage faqs" ON public.faqs FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- 10. PAGE CONTENT
CREATE POLICY "Public read page content" ON public.page_content FOR SELECT USING (true);
CREATE POLICY "Admins manage page content" ON public.page_content FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- 11. PRICING TIERS
CREATE POLICY "Public read active pricing" ON public.pricing_tiers FOR SELECT USING (is_active = true OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admins manage pricing" ON public.pricing_tiers FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- 12-20. NETWORKING TABLES
CREATE POLICY "Public read channels" ON public.channels FOR SELECT USING (is_active = true OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admins manage channels" ON public.channels FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Read channel members" ON public.channel_members FOR SELECT USING (true);
CREATE POLICY "User join leave channel" ON public.channel_members FOR ALL USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Read channel messages" ON public.channel_messages FOR SELECT USING (true);
CREATE POLICY "Authenticated post messages" ON public.channel_messages FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Update own messages" ON public.channel_messages FOR UPDATE USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Delete own messages" ON public.channel_messages FOR DELETE USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Read user groups" ON public.user_groups FOR SELECT USING (is_disabled = false OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Create user groups" ON public.user_groups FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Owner update group" ON public.user_groups FOR UPDATE USING (created_by = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Read group members" ON public.group_members FOR SELECT USING (true);
CREATE POLICY "Manage group membership" ON public.group_members FOR ALL USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Read group posts" ON public.group_posts FOR SELECT USING (true);
CREATE POLICY "Post group content" ON public.group_posts FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Read startup showcases" ON public.startup_showcases FOR SELECT USING (status = 'approved' OR user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Create startup showcase" ON public.startup_showcases FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Owner/Admin manage showcase" ON public.startup_showcases FOR ALL USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Read message reactions" ON public.message_reactions FOR SELECT USING (true);
CREATE POLICY "Manage message reactions" ON public.message_reactions FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Create report" ON public.reports FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Admins view manage reports" ON public.reports FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- 21. REFERRALS
CREATE POLICY "Read referrals" ON public.referrals FOR SELECT USING (referrer_id = auth.uid() OR referred_user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Insert referrals" ON public.referrals FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins manage referrals" ON public.referrals FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- 22. UPI PAYMENTS
CREATE POLICY "Insert UPI payment" ON public.upi_payments FOR INSERT WITH CHECK (true);
CREATE POLICY "Read UPI payment" ON public.upi_payments FOR SELECT USING (true);
CREATE POLICY "Admins manage UPI payments" ON public.upi_payments FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- 23-24. EARNINGS & PAYOUTS
CREATE POLICY "Consultant/Admin read earnings" ON public.earnings_history FOR SELECT USING (consultant_id IN (SELECT id FROM public.consultants WHERE user_id = auth.uid()) OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admins manage earnings" ON public.earnings_history FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Consultant/Admin read payouts" ON public.payout_requests FOR SELECT USING (consultant_id IN (SELECT id FROM public.consultants WHERE user_id = auth.uid()) OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Consultant insert payout" ON public.payout_requests FOR INSERT WITH CHECK (consultant_id IN (SELECT id FROM public.consultants WHERE user_id = auth.uid()));
CREATE POLICY "Admins manage payouts" ON public.payout_requests FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
