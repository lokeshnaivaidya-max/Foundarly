import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/database.types';
import type { UserRole } from '@/lib/authorization';

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
    if (!email) return null;
    const cleanEmail = email.toLowerCase().trim();
    try {
      const { data: cons } = await supabase
        .from('consultants')
        .select('user_id')
        .ilike('email', cleanEmail)
        .not('user_id', 'is', null)
        .limit(1);
      if (cons && cons.length > 0 && cons[0].user_id) {
        return { id: cons[0].user_id };
      }
    } catch {
      // ignore
    }
    return null;
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

  async updateRole(id: string, role: UserRole) {
    return this.update(id, { role });
  },
};
