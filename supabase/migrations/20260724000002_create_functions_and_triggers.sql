-- =====================================================
-- MIGRATION 2: FUNCTIONS & TRIGGERS
-- =====================================================

-- 1. Handle New User Creation in Auth Trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'client'
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Generic updated_at Column Trigger Function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to relevant tables
DROP TRIGGER IF EXISTS update_content_sections_updated_at ON public.content_sections;
CREATE TRIGGER update_content_sections_updated_at BEFORE UPDATE ON public.content_sections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_site_settings_updated_at ON public.site_settings;
CREATE TRIGGER update_site_settings_updated_at BEFORE UPDATE ON public.site_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_consultant_applications_updated_at ON public.consultant_applications;
CREATE TRIGGER update_consultant_applications_updated_at BEFORE UPDATE ON public.consultant_applications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_faqs_updated_at ON public.faqs;
CREATE TRIGGER update_faqs_updated_at BEFORE UPDATE ON public.faqs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_page_content_updated_at ON public.page_content;
CREATE TRIGGER update_page_content_updated_at BEFORE UPDATE ON public.page_content FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_pricing_tiers_updated_at ON public.pricing_tiers;
CREATE TRIGGER update_pricing_tiers_updated_at BEFORE UPDATE ON public.pricing_tiers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_channels_updated_at ON public.channels;
CREATE TRIGGER update_channels_updated_at BEFORE UPDATE ON public.channels FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_channel_messages_updated_at ON public.channel_messages;
CREATE TRIGGER update_channel_messages_updated_at BEFORE UPDATE ON public.channel_messages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_groups_updated_at ON public.user_groups;
CREATE TRIGGER update_user_groups_updated_at BEFORE UPDATE ON public.user_groups FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_startup_showcases_updated_at ON public.startup_showcases;
CREATE TRIGGER update_startup_showcases_updated_at BEFORE UPDATE ON public.startup_showcases FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_reports_updated_at ON public.reports;
CREATE TRIGGER update_reports_updated_at BEFORE UPDATE ON public.reports FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_upi_payments_updated_at ON public.upi_payments;
CREATE TRIGGER update_upi_payments_updated_at BEFORE UPDATE ON public.upi_payments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_payout_requests_updated_at ON public.payout_requests;
CREATE TRIGGER update_payout_requests_updated_at BEFORE UPDATE ON public.payout_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Automatic Channel Member Count Sync
CREATE OR REPLACE FUNCTION public.update_channel_member_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.channels SET member_count = member_count + 1 WHERE id = NEW.channel_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.channels SET member_count = GREATEST(member_count - 1, 0) WHERE id = OLD.channel_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_channel_member_count_trigger ON public.channel_members;
CREATE TRIGGER update_channel_member_count_trigger AFTER INSERT OR DELETE ON public.channel_members FOR EACH ROW EXECUTE FUNCTION public.update_channel_member_count();

-- 4. Automatic Group Member Count Sync
CREATE OR REPLACE FUNCTION public.update_group_member_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.user_groups SET member_count = member_count + 1 WHERE id = NEW.group_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.user_groups SET member_count = GREATEST(member_count - 1, 0) WHERE id = OLD.group_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_group_member_count_trigger ON public.group_members;
CREATE TRIGGER update_group_member_count_trigger AFTER INSERT OR DELETE ON public.group_members FOR EACH ROW EXECUTE FUNCTION public.update_group_member_count();

-- 5. Helper Function for Networking Stats
CREATE OR REPLACE FUNCTION public.get_networking_stats()
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_channels', (SELECT COUNT(*) FROM public.channels),
    'active_channels', (SELECT COUNT(*) FROM public.channels WHERE is_active = true),
    'total_groups', (SELECT COUNT(*) FROM public.user_groups),
    'active_groups', (SELECT COUNT(*) FROM public.user_groups WHERE is_disabled = false),
    'total_messages', (SELECT COUNT(*) FROM public.channel_messages),
    'total_showcases', (SELECT COUNT(*) FROM public.startup_showcases),
    'approved_showcases', (SELECT COUNT(*) FROM public.startup_showcases WHERE status = 'approved'),
    'pending_reports', (SELECT COUNT(*) FROM public.reports WHERE status = 'pending'),
    'total_members', (SELECT COUNT(DISTINCT user_id) FROM public.channel_members)
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
