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

  /**
   * Submit a client review for a completed consultation.
   * Tries server proxy /api/reviews/submit first with fallback to direct Supabase RLS.
   */
  async submitReview(params: {
    bookingId: string;
    consultantId: string;
    rating: number;
    review: string;
    displayName: string;
  }): Promise<{ success: boolean; data?: any; error?: string; code?: string }> {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    const user = sessionData?.session?.user;

    if (!user) {
      return { success: false, error: 'You must be logged in to submit a review.', code: 'UNAUTHENTICATED' };
    }

    // Attempt 1: Call server API route /api/reviews/submit if available
    if (token) {
      try {
        const response = await fetch('/api/reviews/submit', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify(params),
        });

        const resData = await response.json().catch(() => null);
        if (response.ok && resData?.success) {
          return resData;
        }
        if (resData && !resData.success) {
          return { success: false, error: resData.error, code: resData.code };
        }
      } catch {
        // Fall through to direct Supabase client call
      }
    }

    // Attempt 2: Direct Supabase client insert using RLS policy
    try {
      const payload = {
        client_name: params.displayName.trim() || 'Client',
        designation: 'Client',
        review: params.review.trim(),
        rating: params.rating,
        status: 'draft' as const,
        consultant_id: params.consultantId || null,
        booking_id: params.bookingId,
      };

      const { data, error } = await (supabase as any)
        .from('testimonials')
        .insert(payload)
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          return { success: false, error: 'You have already submitted a review for this session.', code: 'DUPLICATE_REVIEW' };
        }
        return { success: false, error: error.message, code: error.code };
      }

      return { success: true, data };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Failed to submit review.', code: 'UNKNOWN_ERROR' };
    }
  },
};

