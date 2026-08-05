import { supabase } from '@/lib/supabase';
import { Channel, UserGroup, ChannelMessage, StartupShowcase } from './networking';

export interface Report {
  id: string;
  reporter_id: string;
  message_id: string | null;
  showcase_id: string | null;
  reason: string;
  status: 'pending' | 'resolved' | 'dismissed';
  created_at: string;
  reporter?: {
    full_name: string | null;
  };
  message?: ChannelMessage;
  showcase?: StartupShowcase;
}

export const adminNetworkingService = {
  // Channels Management
  async getAllChannelsAdmin() {
    try {
      const { data, error } = await supabase
        .from('channels')
        .select('*, created_by_profile:profiles!created_by(full_name)')
        .order('created_at', { ascending: false });
      
      if (!error && data) {
        return data;
      }

      if (error) {
        console.warn('getAllChannelsAdmin primary query warning:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });
      }

      const { data: fallbackData, error: fallbackError } = await supabase
        .from('channels')
        .select('*')
        .order('created_at', { ascending: false });

      if (fallbackError) {
        console.error('getAllChannelsAdmin fallback error:', {
          code: fallbackError.code,
          message: fallbackError.message,
          details: fallbackError.details,
          hint: fallbackError.hint
        });
        throw fallbackError;
      }

      return fallbackData || [];
    } catch (err: any) {
      console.error('getAllChannelsAdmin error:', err);
      throw err;
    }
  },

  async createChannelAdmin(channel: Partial<Channel>) {
    const { data: { user } } = await supabase.auth.getUser();
    
    const { data, error } = await supabase
      .from('channels')
      .insert({
        ...channel,
        created_by: user?.id,
        member_count: 0,
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async updateChannelAdmin(id: string, updates: Partial<Channel>) {
    const { data, error } = await supabase
      .from('channels')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async deleteChannelAdmin(id: string) {
    // Delete related data first
    await supabase.from('channel_members').delete().eq('channel_id', id);
    await supabase.from('channel_messages').delete().eq('channel_id', id);
    await supabase.from('startup_showcases').delete().eq('channel_id', id);
    
    const { error } = await supabase
      .from('channels')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },

  async toggleChannelStatus(id: string, isActive: boolean) {
    const { data, error } = await supabase
      .from('channels')
      .update({ is_active: isActive })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Groups Management
  async getAllGroupsAdmin() {
    try {
      const { data, error } = await supabase
        .from('user_groups')
        .select('*, creator:profiles!created_by(full_name)')
        .order('created_at', { ascending: false });
      
      if (!error && data) {
        return data;
      }

      if (error) {
        console.warn('getAllGroupsAdmin primary query warning:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });
      }

      const { data: fallbackData, error: fallbackError } = await supabase
        .from('user_groups')
        .select('*')
        .order('created_at', { ascending: false });

      if (fallbackError) {
        console.error('getAllGroupsAdmin fallback error:', {
          code: fallbackError.code,
          message: fallbackError.message,
          details: fallbackError.details,
          hint: fallbackError.hint
        });
        throw fallbackError;
      }

      return fallbackData || [];
    } catch (err: any) {
      console.error('getAllGroupsAdmin error:', err);
      throw err;
    }
  },

  async deleteGroupAdmin(id: string) {
    // Delete related data
    await supabase.from('group_members').delete().eq('group_id', id);
    await supabase.from('group_posts').delete().eq('group_id', id);
    
    const { error } = await supabase
      .from('user_groups')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },

  async toggleGroupStatus(id: string, isDisabled: boolean) {
    const { data, error } = await supabase
      .from('user_groups')
      .update({ is_disabled: isDisabled })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Messages Management
  async getAllMessagesAdmin(limit = 200) {
    try {
      const { data, error } = await supabase
        .from('channel_messages')
        .select('*, profiles!user_id(full_name), channels!channel_id(name)')
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (!error && data) {
        return data;
      }

      if (error) {
        console.warn('getAllMessagesAdmin primary query warning:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });
      }

      const { data: fallbackData, error: fallbackError } = await supabase
        .from('channel_messages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (fallbackError) {
        console.error('getAllMessagesAdmin fallback error:', {
          code: fallbackError.code,
          message: fallbackError.message,
          details: fallbackError.details,
          hint: fallbackError.hint
        });
        throw fallbackError;
      }

      return fallbackData || [];
    } catch (err: any) {
      console.error('getAllMessagesAdmin error:', err);
      throw err;
    }
  },

  async getMessagesByChannel(channelId: string) {
    try {
      const { data, error } = await supabase
        .from('channel_messages')
        .select('*, profiles!user_id(full_name)')
        .eq('channel_id', channelId)
        .order('created_at', { ascending: false });
      
      if (!error && data) {
        return data;
      }

      const { data: fallbackData, error: fallbackError } = await supabase
        .from('channel_messages')
        .select('*')
        .eq('channel_id', channelId)
        .order('created_at', { ascending: false });

      if (fallbackError) {
        console.error('getMessagesByChannel fallback error:', fallbackError);
        throw fallbackError;
      }

      return fallbackData || [];
    } catch (err: any) {
      console.error('getMessagesByChannel error:', err);
      throw err;
    }
  },

  async deleteMessageAdmin(id: string) {
    // Delete replies first
    await supabase
      .from('channel_messages')
      .delete()
      .eq('reply_to', id);
    
    const { error } = await supabase
      .from('channel_messages')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },

  // Showcases Management
  async getAllShowcasesAdmin() {
    try {
      const { data, error } = await supabase
        .from('startup_showcases')
        .select('*, profiles!user_id(full_name), channels!channel_id(name)')
        .order('created_at', { ascending: false });
      
      if (!error && data) {
        return data;
      }

      if (error) {
        console.warn('getAllShowcasesAdmin primary query warning:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });
      }

      const { data: fallbackData, error: fallbackError } = await supabase
        .from('startup_showcases')
        .select('*')
        .order('created_at', { ascending: false });

      if (fallbackError) {
        console.error('getAllShowcasesAdmin fallback error:', {
          code: fallbackError.code,
          message: fallbackError.message,
          details: fallbackError.details,
          hint: fallbackError.hint
        });
        throw fallbackError;
      }

      return fallbackData || [];
    } catch (err: any) {
      console.error('getAllShowcasesAdmin error:', err);
      throw err;
    }
  },

  async updateShowcaseStatus(id: string, status: 'pending' | 'approved' | 'rejected') {
    const { data, error } = await supabase
      .from('startup_showcases')
      .update({ status })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async deleteShowcaseAdmin(id: string) {
    const { error } = await supabase
      .from('startup_showcases')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },

  async featureShowcase(id: string, isFeatured: boolean) {
    const { data, error } = await supabase
      .from('startup_showcases')
      .update({ is_featured: isFeatured })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Reports Management
  async getAllReports() {
    try {
      const { data, error } = await supabase
        .from('reports')
        .select(`
          *,
          reporter:profiles!reporter_id(full_name),
          message:channel_messages!message_id(id, content, user_id),
          showcase:startup_showcases!showcase_id(id, startup_name, user_id)
        `)
        .order('created_at', { ascending: false });
      
      if (!error && data) {
        return data as Report[];
      }

      if (error) {
        console.warn('getAllReports primary query warning:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });
      }

      const { data: fallbackData, error: fallbackError } = await supabase
        .from('reports')
        .select('*')
        .order('created_at', { ascending: false });

      if (fallbackError) {
        console.error('getAllReports fallback error:', {
          code: fallbackError.code,
          message: fallbackError.message,
          details: fallbackError.details,
          hint: fallbackError.hint
        });
        throw fallbackError;
      }

      return (fallbackData || []) as Report[];
    } catch (err: any) {
      console.error('getAllReports error:', err);
      throw err;
    }
  },

  async updateReportStatus(id: string, status: 'pending' | 'resolved' | 'dismissed') {
    const { data, error } = await supabase
      .from('reports')
      .update({ status })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async createReport(report: {
    message_id?: string;
    showcase_id?: string;
    reason: string;
  }) {
    const { data: { user } } = await supabase.auth.getUser();
    
    const { data, error } = await supabase
      .from('reports')
      .insert({
        ...report,
        reporter_id: user?.id,
        status: 'pending',
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Statistics
  async getNetworkingStats() {
    try {
      const [channels, groups, messages, showcases, reports] = await Promise.all([
        supabase.from('channels').select('id', { count: 'exact', head: true }),
        supabase.from('user_groups').select('id', { count: 'exact', head: true }),
        supabase.from('channel_messages').select('id', { count: 'exact', head: true }),
        supabase.from('startup_showcases').select('id', { count: 'exact', head: true }),
        supabase.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      ]);

      return {
        totalChannels: channels.count || 0,
        totalGroups: groups.count || 0,
        totalMessages: messages.count || 0,
        totalShowcases: showcases.count || 0,
        pendingReports: reports.count || 0,
      };
    } catch (err: any) {
      console.error('getNetworkingStats error:', err);
      return {
        totalChannels: 0,
        totalGroups: 0,
        totalMessages: 0,
        totalShowcases: 0,
        pendingReports: 0,
      };
    }
  },
};

