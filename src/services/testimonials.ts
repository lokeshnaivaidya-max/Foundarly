import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/database.types';

type Testimonial = Database['public']['Tables']['testimonials']['Row'];
type TestimonialInsert = Database['public']['Tables']['testimonials']['Insert'];
type TestimonialUpdate = Database['public']['Tables']['testimonials']['Update'];

export const testimonialsService = {
  async getAll(publishedOnly = false) {
    let query = supabase.from('testimonials').select('*').order('created_at', { ascending: false });
    if (publishedOnly) query = query.eq('status', 'published');
    const { data, error } = await query;
    if (error) throw error;
    return data as Testimonial[];
  },

  async getAllWithConsultant(publishedOnly = true) {
    // Fetch testimonials first
    let query = (supabase as any)
      .from('testimonials')
      .select('*')
      .order('created_at', { ascending: false });
    if (publishedOnly) query = query.eq('status', 'published');
    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) return [];

    // Fetch consultant names for any linked consultant_ids
    const consultantIds = [...new Set(data.map((t: any) => t.consultant_id).filter(Boolean))];
    let consultantMap: Record<string, string> = {};
    if (consultantIds.length > 0) {
      const { data: consultants } = await (supabase as any)
        .from('consultants')
        .select('id, name')
        .in('id', consultantIds);
      if (consultants) {
        consultantMap = Object.fromEntries(consultants.map((c: any) => [c.id, c.name]));
      }
    }

    return data.map((t: any) => ({
      ...t,
      consultant_name: t.consultant_id ? (consultantMap[t.consultant_id] || null) : null,
    }));
  },

  async getById(id: string) {
    const { data, error } = await supabase
      .from('testimonials')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data as Testimonial;
  },

  async create(testimonial: TestimonialInsert) {
    const { data, error } = await (supabase as any)
      .from('testimonials')
      .insert(testimonial)
      .select()
      .single();
    
    if (error) throw error;
    return data as Testimonial;
  },

  async update(id: string, updates: TestimonialUpdate) {
    const { data, error } = await (supabase as any)
      .from('testimonials')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data as Testimonial;
  },

  async delete(id: string) {
    const { error } = await supabase
      .from('testimonials')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },

  async toggleStatus(id: string, status: 'published' | 'draft') {
    return this.update(id, { status });
  },
};
