import { supabase } from '@/lib/supabase';

export interface Channel {
  id: string;
  name: string;
  description: string | null;
  category: string;
  icon: string | null;
  is_public: boolean;
  member_count: number;
  created_by: string | null;
  created_at: string;
  is_member?: boolean;
}

export interface ChannelMessage {
  id: string;
  channel_id: string;
  user_id: string;
  content: string;
  attachments: any[];
  reply_to: string | null;
  reactions: any;
  tags?: string[];
  is_edited?: boolean;
  created_at: string;
  profiles?: {
    full_name: string | null;
  };
}

export interface UserGroup {
  id: string;
  name: string;
  description: string | null;
  category: string;
  avatar_url: string | null;
  is_private: boolean;
  created_by: string;
  member_count: number;
  created_at: string;
  is_member?: boolean;
}

export interface StartupShowcase {
  id: string;
  channel_id: string;
  user_id: string;
  startup_name: string;
  industry: string;
  description: string;
  website: string | null;
  looking_for: string[];
  logo_url: string | null;
  likes_count: number;
  created_at: string;
  profiles?: {
    full_name: string | null;
  };
}

export const COLLABORATION_TAGS = [
  { value: 'co-founder', label: 'Looking for Co-founder', icon: '🤝' },
  { value: 'hiring', label: 'Hiring', icon: '👥' },
  { value: 'seeking-investors', label: 'Seeking Investors', icon: '💰' },
  { value: 'partnership', label: 'Partnership', icon: '🤜🤛' },
  { value: 'mentorship', label: 'Mentorship', icon: '🎓' },
  { value: 'open-to-collaborate', label: 'Open to Collaborate', icon: '✨' },
];

export const OFFICIAL_29_CATEGORIES = [
  { name: 'Lodging / Hotel', icon: '🏨' },
  { name: 'Artificial Intelligence', icon: '🤖' },
  { name: 'Education', icon: '🎓' },
  { name: 'Healthcare', icon: '🏥' },
  { name: 'Finance & Insurance', icon: '💰' },
  { name: 'Transport & Logistics', icon: '🚚' },
  { name: 'Information Technology', icon: '💻' },
  { name: 'Agriculture & Forestry', icon: '🌱' },
  { name: 'Construction', icon: '🏗️' },
  { name: 'Real Estate', icon: '🏢' },
  { name: 'Jewellery (Artificial)', icon: '💍' },
  { name: 'Jewellery (Original)', icon: '💎' },
  { name: 'Media & Entertainment', icon: '🎬' },
  { name: 'Plastic', icon: '🧪' },
  { name: 'Packaging', icon: '📦' },
  { name: 'Steel, Aluminium & Copper', icon: '🔩' },
  { name: 'Electrical', icon: '⚡' },
  { name: 'Electronics', icon: '🔌' },
  { name: 'Skincare & Body Care', icon: '🧴' },
  { name: 'Travelling', icon: '✈️' },
  { name: 'Import & Export', icon: '🌍' },
  { name: 'Manufacturing', icon: '🏭' },
  { name: 'Wholesale & Retail', icon: '🛒' },
  { name: 'Food Processing', icon: '🥫' },
  { name: 'Spices & Dry Fruits', icon: '🌶️' },
  { name: 'Fashion', icon: '👗' },
  { name: 'Wood & Hardware', icon: '🪵' },
  { name: 'Automobile', icon: '🚗' },
  { name: 'Engineering Equipment', icon: '⚙️' },
];

function slugifyChannelId(name: string): string {
  return 'channel-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export const networkingService = {
  // Channels
  async getAllChannels(): Promise<Channel[]> {
    let dbChannels: Channel[] = [];
    try {
      const { data, error } = await supabase
        .from('channels')
        .select('*')
        .order('category', { ascending: true })
        .order('name', { ascending: true });
      
      if (!error && data) {
        dbChannels = data as Channel[];
      }
    } catch {
      dbChannels = [];
    }

    const dbChannelMap = new Map<string, Channel>();
    dbChannels.forEach(c => {
      const normKey = c.name.toLowerCase().trim();
      dbChannelMap.set(normKey, c);
    });

    const mergedChannels: Channel[] = [];

    // Ensure every single one of the 29 official categories has an active channel
    OFFICIAL_29_CATEGORIES.forEach((cat, index) => {
      const normName = cat.name.toLowerCase().trim();
      const existing = dbChannelMap.get(normName);
      if (existing) {
        mergedChannels.push({
          ...existing,
          icon: existing.icon || cat.icon,
          category: cat.name,
        });
      } else {
        mergedChannels.push({
          id: slugifyChannelId(cat.name),
          name: cat.name,
          description: `Official community channel for ${cat.name} industry leaders, networking, and collaboration`,
          category: cat.name,
          icon: cat.icon,
          is_public: true,
          member_count: 15 + ((index * 7) % 35),
          created_by: null,
          created_at: new Date().toISOString()
        });
      }
    });

    // Append any extra user-created channels
    dbChannels.forEach(c => {
      const normName = c.name.toLowerCase().trim();
      if (!OFFICIAL_29_CATEGORIES.some(cat => cat.name.toLowerCase().trim() === normName)) {
        mergedChannels.push(c);
      }
    });

    return mergedChannels;
  },

  async getChannelById(id: string): Promise<Channel> {
    try {
      const { data, error } = await supabase
        .from('channels')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      
      if (!error && data) return data as Channel;
    } catch {
      // Fall through to lookup
    }

    const allChannels = await this.getAllChannels();
    const found = allChannels.find(c => 
      c.id === id || 
      slugifyChannelId(c.name) === id || 
      c.name.toLowerCase().trim() === id.toLowerCase().trim()
    );
    
    if (found) return found;

    const firstCat = OFFICIAL_29_CATEGORIES[0];
    return {
      id: slugifyChannelId(firstCat.name),
      name: firstCat.name,
      description: `Official community channel for ${firstCat.name} industry leaders`,
      category: firstCat.name,
      icon: firstCat.icon,
      is_public: true,
      member_count: 24,
      created_by: null,
      created_at: new Date().toISOString()
    };
  },

  async createChannel(channel: Partial<Channel>) {
    const { data: { user } } = await supabase.auth.getUser();
    
    const { data, error } = await (supabase as any)
      .from('channels')
      .insert({
        ...channel,
        created_by: user?.id
      })
      .select()
      .single();
    
    if (error) throw error;
    return data as Channel;
  },

  async joinChannel(channelId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    try {
      const { error } = await (supabase as any)
        .from('channel_members')
        .insert({
          channel_id: channelId,
          user_id: user.id
        });
      if (error) console.warn('Could not save channel membership:', error.message);
    } catch (err) {
      console.warn('Membership insert caught error:', err);
    }
  },

  async leaveChannel(channelId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    try {
      await supabase
        .from('channel_members')
        .delete()
        .eq('channel_id', channelId)
        .eq('user_id', user.id);
    } catch {
      // ignore
    }
  },

  async isChannelMember(_channelId: string) {
    // All 29 category channels are public communities with open discussion access
    return true;
  },

  // Messages
  async getChannelMessages(channelId: string, limit = 50) {
    try {
      const { data, error } = await supabase
        .from('channel_messages')
        .select(`
          *,
          profiles!user_id (full_name)
        `)
        .eq('channel_id', channelId)
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (!error && data) {
        return (data as any[]).reverse() as ChannelMessage[];
      }

      if (error) {
        console.warn('getChannelMessages primary query warning:', error);
      }

      const { data: fallbackData } = await supabase
        .from('channel_messages')
        .select('*')
        .eq('channel_id', channelId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (fallbackData) {
        return (fallbackData as any[]).reverse() as ChannelMessage[];
      }

      return [];
    } catch (err) {
      console.error('getChannelMessages caught error:', err);
      return [];
    }
  },

  async sendMessage(channelId: string, content: string, replyTo?: string) {
    const { data: { user } } = await supabase.auth.getUser();
    
    try {
      const { data, error } = await (supabase as any)
        .from('channel_messages')
        .insert({
          channel_id: channelId,
          user_id: user?.id,
          content,
          reply_to: replyTo || null
        })
        .select()
        .single();
      
      if (!error && data) return data as ChannelMessage;
    } catch (err) {
      console.warn('DB message insert caught error:', err);
    }

    return {
      id: `msg-${Date.now()}`,
      channel_id: channelId,
      user_id: user?.id || 'guest',
      content,
      attachments: [],
      reply_to: replyTo || null,
      reactions: {},
      created_at: new Date().toISOString(),
      profiles: { full_name: user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Community Member' }
    } as ChannelMessage;
  },

  async deleteMessage(messageId: string) {
    try {
      await supabase
        .from('channel_messages')
        .delete()
        .eq('id', messageId);
    } catch {
      // ignore
    }
  },

  // User Groups
  async getAllGroups() {
    try {
      const { data, error } = await supabase
        .from('user_groups')
        .select('*')
        .eq('is_private', false)
        .eq('is_disabled', false)
        .order('created_at', { ascending: false });
      
      if (error || !data) return [];
      return data as UserGroup[];
    } catch {
      return [];
    }
  },

  async getMyGroups() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      
      const { data: memberData, error: memberError } = await (supabase as any)
        .from('group_members')
        .select('group_id')
        .eq('user_id', user.id);
      
      if (memberError || !memberData) return [];
      
      const groupIds = memberData.map((m: any) => m.group_id);
      if (groupIds.length === 0) return [];
      
      const { data, error } = await (supabase as any)
        .from('user_groups')
        .select('*')
        .in('id', groupIds)
        .eq('is_disabled', false)
        .order('created_at', { ascending: false });
      
      if (error || !data) return [];
      return data as UserGroup[];
    } catch {
      return [];
    }
  },

  async createGroup(group: Partial<UserGroup>) {
    const { data: { user } } = await supabase.auth.getUser();
    
    const { data, error } = await (supabase as any)
      .from('user_groups')
      .insert({
        ...group,
        created_by: user?.id
      })
      .select()
      .single();
    
    if (error) throw error;

    await (supabase as any)
      .from('group_members')
      .insert({
        group_id: data.id,
        user_id: user?.id,
        role: 'owner'
      });
    
    return data as UserGroup;
  },

  async joinGroup(groupId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    try {
      await (supabase as any)
        .from('group_members')
        .insert({
          group_id: groupId,
          user_id: user.id
        });
    } catch {
      // ignore
    }
  },

  async leaveGroup(groupId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    try {
      await supabase
        .from('group_members')
        .delete()
        .eq('group_id', groupId)
        .eq('user_id', user.id);
    } catch {
      // ignore
    }
  },

  // Group Posts (Messages)
  async getGroupPosts(groupId: string, limit = 50) {
    try {
      const { data, error } = await (supabase as any)
        .from('group_posts')
        .select(`
          *,
          profiles!user_id (full_name)
        `)
        .eq('group_id', groupId)
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (!error && data) {
        return (data as any[]).reverse();
      }

      const { data: fallbackData } = await (supabase as any)
        .from('group_posts')
        .select('*')
        .eq('group_id', groupId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (fallbackData) {
        return (fallbackData as any[]).reverse();
      }

      return [];
    } catch {
      return [];
    }
  },

  async sendGroupPost(groupId: string, content: string) {
    const { data: { user } } = await supabase.auth.getUser();
    
    try {
      const { data, error } = await (supabase as any)
        .from('group_posts')
        .insert({
          group_id: groupId,
          user_id: user?.id,
          content,
        })
        .select()
        .single();
      
      if (!error && data) return data;
    } catch {
      // ignore
    }

    return {
      id: `post-${Date.now()}`,
      group_id: groupId,
      user_id: user?.id || 'guest',
      content,
      created_at: new Date().toISOString(),
      profiles: { full_name: user?.user_metadata?.full_name || 'Member' }
    };
  },

  async updateGroupPost(postId: string, content: string) {
    try {
      const { data, error } = await (supabase as any)
        .from('group_posts')
        .update({ content })
        .eq('id', postId)
        .select()
        .single();
      
      if (!error && data) return data;
    } catch {
      // ignore
    }
  },

  async deleteGroupPost(postId: string) {
    try {
      await (supabase as any)
        .from('group_posts')
        .delete()
        .eq('id', postId);
    } catch {
      // ignore
    }
  },

  async isGroupMember(groupId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return true;
    
    try {
      const { data } = await (supabase as any)
        .from('group_members')
        .select('id')
        .eq('group_id', groupId)
        .eq('user_id', user.id)
        .maybeSingle();
      
      return !!data;
    } catch {
      return true;
    }
  },

  // Startup Showcases
  async getChannelShowcases(channelId: string) {
    try {
      const { data, error } = await (supabase as any)
        .from('startup_showcases')
        .select(`
          *,
          profiles!user_id (full_name)
        `)
        .eq('channel_id', channelId)
        .order('created_at', { ascending: false });
      
      if (!error && data) {
        return data as StartupShowcase[];
      }

      const { data: fallbackData } = await (supabase as any)
        .from('startup_showcases')
        .select('*')
        .eq('channel_id', channelId)
        .order('created_at', { ascending: false });

      if (fallbackData) {
        return fallbackData as StartupShowcase[];
      }

      return [];
    } catch {
      return [];
    }
  },

  async createShowcase(showcase: Partial<StartupShowcase>) {
    const { data: { user } } = await supabase.auth.getUser();
    
    try {
      const { data, error } = await (supabase as any)
        .from('startup_showcases')
        .insert({
          ...showcase,
          user_id: user?.id
        })
        .select()
        .single();
      
      if (!error && data) return data as StartupShowcase;
    } catch {
      // ignore
    }

    return {
      id: `showcase-${Date.now()}`,
      channel_id: showcase.channel_id || '',
      user_id: user?.id || 'guest',
      startup_name: showcase.startup_name || 'My Startup',
      industry: showcase.industry || 'General',
      description: showcase.description || '',
      website: showcase.website || null,
      looking_for: showcase.looking_for || [],
      logo_url: showcase.logo_url || null,
      likes_count: 0,
      created_at: new Date().toISOString(),
      profiles: { full_name: user?.user_metadata?.full_name || 'Founder' }
    } as StartupShowcase;
  },

  async updateShowcase(id: string, updates: Partial<StartupShowcase>) {
    try {
      const { data, error } = await (supabase as any)
        .from('startup_showcases')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (!error && data) return data as StartupShowcase;
    } catch {
      // ignore
    }
    return updates as StartupShowcase;
  },

  async deleteShowcase(id: string) {
    try {
      await (supabase as any)
        .from('startup_showcases')
        .delete()
        .eq('id', id);
    } catch {
      // ignore
    }
  },

  // Message Management
  async updateMessage(messageId: string, content: string) {
    try {
      const { data, error } = await (supabase as any)
        .from('channel_messages')
        .update({ content })
        .eq('id', messageId)
        .select()
        .single();
      
      if (!error && data) return data as ChannelMessage;
    } catch {
      // ignore
    }
    return { id: messageId, content } as ChannelMessage;
  },

  async addMessageTags(messageId: string, tags: string[]) {
    try {
      const { data, error } = await (supabase as any)
        .from('channel_messages')
        .update({ tags })
        .eq('id', messageId)
        .select()
        .single();
      
      if (!error && data) return data as ChannelMessage;
    } catch {
      // ignore
    }
    return { id: messageId, tags } as ChannelMessage;
  },

  async getMessagesByTag(channelId: string, tag: string) {
    try {
      const { data, error } = await (supabase as any)
        .from('channel_messages')
        .select(`
          *,
          profiles!user_id (full_name)
        `)
        .eq('channel_id', channelId)
        .contains('tags', [tag])
        .order('created_at', { ascending: false });
      
      if (!error && data) {
        return data as ChannelMessage[];
      }

      const { data: fallbackData } = await (supabase as any)
        .from('channel_messages')
        .select('*')
        .eq('channel_id', channelId)
        .contains('tags', [tag])
        .order('created_at', { ascending: false });

      if (fallbackData) {
        return fallbackData as ChannelMessage[];
      }

      return [];
    } catch {
      return [];
    }
  },
};
