import { supabase } from '@/lib/supabase';

export interface Category {
  id: string;
  name: string;
  description: string | null;
  display_order: number;
  created_at: string;
}

export const OFFICIAL_CATEGORIES = [
  "Lodging / Hotel",
  "Artificial Intelligence",
  "Education",
  "Healthcare",
  "Finance & Insurance",
  "Transport & Logistics",
  "Information Technology",
  "Agriculture & Forestry",
  "Construction",
  "Real Estate",
  "Jewellery (Artificial)",
  "Jewellery (Original)",
  "Media & Entertainment",
  "Plastic",
  "Packaging",
  "Steel, Aluminium & Copper",
  "Electrical",
  "Electronics",
  "Skincare & Body Care",
  "Travelling",
  "Import & Export",
  "Manufacturing",
  "Wholesale & Retail",
  "Food Processing",
  "Spices & Dry Fruits",
  "Fashion",
  "Wood & Hardware",
  "Automobile",
  "Engineering Equipment"
];

export const FALLBACK_CATEGORIES: Category[] = OFFICIAL_CATEGORIES.map((catName, index) => ({
  id: `cat-${index + 1}`,
  name: catName,
  description: `Expert consultation in ${catName}`,
  display_order: index + 1,
  created_at: new Date().toISOString()
}));

export const categoriesService = {
  async getAll(): Promise<Category[]> {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('display_order', { ascending: true });

      if (error || !data || data.length === 0) {
        return FALLBACK_CATEGORIES;
      }
      return data as Category[];
    } catch {
      return FALLBACK_CATEGORIES;
    }
  },

  async create(name: string, description?: string): Promise<Category> {
    const { data, error } = await (supabase as any)
      .from('categories')
      .insert({
        name,
        description: description || null,
        display_order: 100
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating category:', error);
      throw error;
    }
    return data as Category;
  },

  async update(id: string, updates: { name?: string; description?: string; display_order?: number }): Promise<Category> {
    const { data, error } = await (supabase as any)
      .from('categories')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating category:', error);
      throw error;
    }
    return data as Category;
  },

  async delete(id: string): Promise<void> {
    const { error } = await (supabase as any)
      .from('categories')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting category:', error);
      throw error;
    }
  }
};
