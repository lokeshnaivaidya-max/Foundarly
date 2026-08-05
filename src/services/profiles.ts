import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/database.types';

type Profile = Database['public']['Tables']['profiles']['Row'];
type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];

export const profilesService = {
  async getAll() {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data as Profile[];
  },

  async getById(id: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    
    if (error) throw error;
    return data as Profile;
  },

  async getByEmail(email: string) {
    try {
      const { data } = await (supabase as any)
        .from('profiles')
        .select('*')
        .ilike('full_name', `%${email.split('@')[0]}%`)
        .maybeSingle();

      return data ? { id: data.id } : null;
    } catch {
      return null;
    }
  },

  async update(id: string, updates: ProfileUpdate) {
    const { data, error } = await (supabase as any)
      .from('profiles')
      .update(updates)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) {
      console.error('[Profiles Service] Error updating profile:', error);
      throw error;
    }

    return data as Profile;
  },

  async updateRole(id: string, role: 'admin' | 'consultant' | 'client') {
    return this.update(id, { role });
  },
};

