-- =====================================================
-- FIX NETWORKING TABLES & RLS POLICIES FOR ADMIN & PUBLIC
-- =====================================================

-- 1. Ensure Networking Tables Exist
CREATE TABLE IF NOT EXISTS public.channels (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  icon TEXT,
  is_public BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  member_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.channel_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id TEXT NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(channel_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.channel_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id TEXT NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  attachments JSONB DEFAULT '[]'::jsonb,
  reply_to UUID REFERENCES public.channel_messages(id) ON DELETE SET NULL,
  reactions JSONB DEFAULT '{}'::jsonb,
  tags TEXT[] DEFAULT '{}'::text[],
  is_edited BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  avatar_url TEXT,
  is_private BOOLEAN DEFAULT false,
  is_disabled BOOLEAN DEFAULT false,
  member_count INTEGER DEFAULT 1,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.user_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member',
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.group_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.user_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  attachments JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.startup_showcases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id TEXT NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  startup_name TEXT NOT NULL,
  industry TEXT NOT NULL,
  description TEXT NOT NULL,
  website TEXT,
  looking_for TEXT[] DEFAULT '{}'::text[],
  logo_url TEXT,
  likes_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending',
  is_featured BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message_id UUID REFERENCES public.channel_messages(id) ON DELETE CASCADE,
  showcase_id UUID REFERENCES public.startup_showcases(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- RLS POLICIES FOR CHANNELS
-- =====================================================
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public channels viewable by all" ON public.channels;
DROP POLICY IF EXISTS "Authenticated users can view active channels" ON public.channels;
DROP POLICY IF EXISTS "Admins can manage channels" ON public.channels;
DROP POLICY IF EXISTS "allow_read_channels" ON public.channels;
DROP POLICY IF EXISTS "allow_all_channels_admin" ON public.channels;

CREATE POLICY "allow_read_channels"
  ON public.channels FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "allow_all_channels_admin"
  ON public.channels FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- RLS POLICIES FOR CHANNEL MEMBERS
-- =====================================================
ALTER TABLE public.channel_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view channel members" ON public.channel_members;
DROP POLICY IF EXISTS "Users can join channels" ON public.channel_members;
DROP POLICY IF EXISTS "Users can leave channels" ON public.channel_members;
DROP POLICY IF EXISTS "Admins can manage memberships" ON public.channel_members;
DROP POLICY IF EXISTS "allow_read_channel_members" ON public.channel_members;
DROP POLICY IF EXISTS "allow_all_channel_members" ON public.channel_members;

CREATE POLICY "allow_read_channel_members"
  ON public.channel_members FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "allow_all_channel_members"
  ON public.channel_members FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- RLS POLICIES FOR CHANNEL MESSAGES
-- =====================================================
ALTER TABLE public.channel_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members can view channel messages" ON public.channel_messages;
DROP POLICY IF EXISTS "Members can post messages" ON public.channel_messages;
DROP POLICY IF EXISTS "Users can update own messages" ON public.channel_messages;
DROP POLICY IF EXISTS "Users can delete own messages" ON public.channel_messages;
DROP POLICY IF EXISTS "Admins can delete any message" ON public.channel_messages;
DROP POLICY IF EXISTS "allow_read_channel_messages" ON public.channel_messages;
DROP POLICY IF EXISTS "allow_all_channel_messages" ON public.channel_messages;

CREATE POLICY "allow_read_channel_messages"
  ON public.channel_messages FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "allow_all_channel_messages"
  ON public.channel_messages FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- RLS POLICIES FOR USER GROUPS
-- =====================================================
ALTER TABLE public.user_groups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public groups viewable by all" ON public.user_groups;
DROP POLICY IF EXISTS "Members can view their groups" ON public.user_groups;
DROP POLICY IF EXISTS "Users can create groups" ON public.user_groups;
DROP POLICY IF EXISTS "Owners can update groups" ON public.user_groups;
DROP POLICY IF EXISTS "Admins can manage groups" ON public.user_groups;
DROP POLICY IF EXISTS "allow_read_user_groups" ON public.user_groups;
DROP POLICY IF EXISTS "allow_all_user_groups" ON public.user_groups;

CREATE POLICY "allow_read_user_groups"
  ON public.user_groups FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "allow_all_user_groups"
  ON public.user_groups FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- RLS POLICIES FOR GROUP MEMBERS & POSTS
-- =====================================================
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_read_group_members" ON public.group_members;
DROP POLICY IF EXISTS "allow_all_group_members" ON public.group_members;

CREATE POLICY "allow_read_group_members"
  ON public.group_members FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "allow_all_group_members"
  ON public.group_members FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

ALTER TABLE public.group_posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_read_group_posts" ON public.group_posts;
DROP POLICY IF EXISTS "allow_all_group_posts" ON public.group_posts;

CREATE POLICY "allow_read_group_posts"
  ON public.group_posts FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "allow_all_group_posts"
  ON public.group_posts FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- RLS POLICIES FOR STARTUP SHOWCASES
-- =====================================================
ALTER TABLE public.startup_showcases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members can view approved showcases" ON public.startup_showcases;
DROP POLICY IF EXISTS "Users can create showcases" ON public.startup_showcases;
DROP POLICY IF EXISTS "Users can update own showcases" ON public.startup_showcases;
DROP POLICY IF EXISTS "allow_read_startup_showcases" ON public.startup_showcases;
DROP POLICY IF EXISTS "allow_all_startup_showcases" ON public.startup_showcases;

CREATE POLICY "allow_read_startup_showcases"
  ON public.startup_showcases FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "allow_all_startup_showcases"
  ON public.startup_showcases FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- RLS POLICIES FOR REPORTS
-- =====================================================
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can create reports" ON public.reports;
DROP POLICY IF EXISTS "Users can view own reports" ON public.reports;
DROP POLICY IF EXISTS "Admins can view all reports" ON public.reports;
DROP POLICY IF EXISTS "Admins can update reports" ON public.reports;
DROP POLICY IF EXISTS "allow_read_reports" ON public.reports;
DROP POLICY IF EXISTS "allow_all_reports" ON public.reports;

CREATE POLICY "allow_read_reports"
  ON public.reports FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "allow_all_reports"
  ON public.reports FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- GRANT PERMISSIONS TO authenticated & anon
GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, anon;
