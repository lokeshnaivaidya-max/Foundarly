import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/database.types';

type ContentSection = Database['public']['Tables']['content_sections']['Row'];
type ContentSectionUpdate = Database['public']['Tables']['content_sections']['Update'];

export const contentService = {
  async getAll() {
    const { data, error } = await supabase
      .from('content_sections')
      .select('*')
      .order('section_name');
    
    if (error) throw error;
    return data as ContentSection[];
  },

  async getBySection(sectionName: string) {
    const { data, error } = await supabase
      .from('content_sections')
      .select('*')
      .eq('section_name', sectionName)
      .single();
    
    if (error) throw error;
    return data as ContentSection;
  },

  async update(id: string, updates: ContentSectionUpdate) {
    const { data, error } = await supabase
      .from('content_sections')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data as ContentSection;
  },
};
