import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/database.types';

type BlogPost = Database['public']['Tables']['blog']['Row'];
type BlogPostInsert = Database['public']['Tables']['blog']['Insert'];
type BlogPostUpdate = Database['public']['Tables']['blog']['Update'];

export const blogService = {
  async getAll(publishedOnly = false) {
    let query = supabase.from('blog').select('*').order('created_at', { ascending: false });
    
    if (publishedOnly) {
      query = query.eq('status', 'published');
    }
    
    const { data, error } = await query;
    if (error) throw error;
    return data as BlogPost[];
  },

  async getById(id: string) {
    const { data, error } = await supabase
      .from('blog')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data as BlogPost;
  },

  async create(post: BlogPostInsert) {
    const { data, error } = await (supabase as any)
      .from('blog')
      .insert(post)
      .select()
      .single();
    
    if (error) throw error;
    return data as BlogPost;
  },

  async update(id: string, updates: BlogPostUpdate) {
    const { data, error } = await (supabase as any)
      .from('blog')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data as BlogPost;
  },

  async delete(id: string) {
    const { error } = await supabase
      .from('blog')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },

  async toggleStatus(id: string, status: 'published' | 'draft') {
    return this.update(id, { status });
  },
};
