import { supabase } from '@/lib/supabase';

export interface PricingTier {
  id: string;
  name: string;
  description: string | null;
  price: number;
  duration_minutes: number | null;
  features: string[];
  is_popular: boolean;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export const pricingService = {
  async getAll(activeOnly = false) {
    let query = (supabase as any)
      .from('pricing_tiers')
      .select('*')
      .order('display_order', { ascending: true });
    
    if (activeOnly) {
      query = query.eq('is_active', true);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    return data as PricingTier[];
  },

  async getById(id: string) {
    const { data, error } = await (supabase as any)
      .from('pricing_tiers')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data as PricingTier;
  },

  async create(tier: Omit<PricingTier, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await (supabase as any)
      .from('pricing_tiers')
      .insert(tier)
      .select()
      .single();
    
    if (error) throw error;
    return data as PricingTier;
  },

  async update(id: string, updates: Partial<PricingTier>) {
    const { data, error } = await (supabase as any)
      .from('pricing_tiers')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data as PricingTier;
  },

  async delete(id: string) {
    const { error } = await (supabase as any)
      .from('pricing_tiers')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },

  async toggleActive(id: string, isActive: boolean) {
    return this.update(id, { is_active: isActive });
  },

  async togglePopular(id: string, isPopular: boolean) {
    return this.update(id, { is_popular: isPopular });
  },
};
