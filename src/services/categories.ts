import { supabase } from '@/lib/supabase';
import { storageService } from '@/services/storage';

export interface Category {
  id: string;
  name: string;
  slug?: string | null;
  description: string | null;
  display_order: number;
  image_url?: string | null;
  icon?: string | null;
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

// Initial default images for sample industries (Instagram-style visual demo)
const SAMPLE_CATEGORY_IMAGES: Record<string, string> = {
  "Artificial Intelligence": "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=300&auto=format&fit=crop&q=80",
  "Healthcare": "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=300&auto=format&fit=crop&q=80",
  "Finance & Insurance": "https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?w=300&auto=format&fit=crop&q=80",
  "Information Technology": "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=300&auto=format&fit=crop&q=80",
  "Fashion": "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=300&auto=format&fit=crop&q=80",
  "Real Estate": "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=300&auto=format&fit=crop&q=80",
  "Lodging / Hotel": "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=300&auto=format&fit=crop&q=80",
  "Education": "https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=300&auto=format&fit=crop&q=80"
};

export const FALLBACK_CATEGORIES: Category[] = OFFICIAL_CATEGORIES.map((catName, index) => ({
  id: `cat-${index + 1}`,
  name: catName,
  slug: catName.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
  description: `Expert consultation in ${catName}`,
  display_order: index + 1,
  image_url: SAMPLE_CATEGORY_IMAGES[catName] || null,
  icon: "Briefcase",
  created_at: new Date().toISOString()
}));

const LOCAL_STORAGE_KEY = 'foundarly_categories_store_v1';

function getLocalCategories(): Category[] {
  if (typeof window === 'undefined') return FALLBACK_CATEGORIES;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Error reading local categories:', err);
  }
  return FALLBACK_CATEGORIES;
}

function saveLocalCategories(cats: Category[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cats));
  } catch (err) {
    console.error('Error saving local categories:', err);
  }
}

export const categoriesService = {
  async getAll(): Promise<Category[]> {
    let remoteData: Category[] | null = null;
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('display_order', { ascending: true });

      if (!error && data && data.length > 0) {
        remoteData = data as Category[];
      }
    } catch {
      // Remote table might not exist yet
    }

    const localList = getLocalCategories();

    if (remoteData) {
      // Merge remote data with any local image uploads or modifications
      const localMap = new Map(localList.map(c => [c.id, c]));
      const localNameMap = new Map(localList.map(c => [c.name.toLowerCase(), c]));

      const merged = remoteData.map(remote => {
        const local = localMap.get(remote.id) || localNameMap.get(remote.name.toLowerCase());
        return {
          ...remote,
          slug: remote.slug || local?.slug || remote.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
          image_url: remote.image_url ?? local?.image_url ?? null,
          icon: remote.icon || local?.icon || "Briefcase",
        };
      });
      saveLocalCategories(merged);
      return merged;
    }

    return localList;
  },

  async create(
    dataOrName: string | { name: string; slug?: string; description?: string | null; display_order?: number; image_url?: string | null; icon?: string },
    description?: string
  ): Promise<Category> {
    const payload = typeof dataOrName === 'string'
      ? {
          name: dataOrName,
          slug: dataOrName.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
          description: description || null,
          display_order: 100,
          image_url: null,
          icon: "Briefcase"
        }
      : {
          name: dataOrName.name,
          slug: dataOrName.slug || dataOrName.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
          description: dataOrName.description || null,
          display_order: dataOrName.display_order ?? 100,
          image_url: dataOrName.image_url || null,
          icon: dataOrName.icon || "Briefcase"
        };

    let createdCategory: Category = {
      id: `cat-${Date.now()}`,
      created_at: new Date().toISOString(),
      ...payload
    };

    // Try Supabase
    try {
      const { data, error } = await (supabase as any)
        .from('categories')
        .insert(payload)
        .select()
        .single();

      if (!error && data) {
        createdCategory = data as Category;
      }
    } catch (err) {
      console.warn('Supabase categories table not accessible, saving locally:', err);
    }

    // Persist locally
    const current = getLocalCategories();
    const updated = [...current, createdCategory];
    saveLocalCategories(updated);

    return createdCategory;
  },

  async update(
    id: string,
    updates: { name?: string; slug?: string; description?: string | null; display_order?: number; image_url?: string | null; icon?: string }
  ): Promise<Category> {
    let updatedCategory: Category | null = null;

    // Try Supabase
    try {
      const { data, error } = await (supabase as any)
        .from('categories')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (!error && data) {
        updatedCategory = data as Category;
      }
    } catch (err) {
      console.warn('Supabase categories update failed, applying locally:', err);
    }

    // Persist locally
    const current = getLocalCategories();
    const index = current.findIndex(c => c.id === id || c.name.toLowerCase() === (updates.name || "").toLowerCase());
    
    if (index >= 0) {
      const existing = current[index];
      const merged: Category = {
        ...existing,
        ...updates,
      };
      current[index] = merged;
      updatedCategory = merged;
      saveLocalCategories([...current]);
    } else if (!updatedCategory) {
      const newCat: Category = {
        id,
        name: updates.name || "Unnamed Category",
        slug: updates.slug || (updates.name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        description: updates.description || null,
        display_order: updates.display_order || 100,
        image_url: updates.image_url || null,
        icon: updates.icon || "Briefcase",
        created_at: new Date().toISOString()
      };
      saveLocalCategories([...current, newCat]);
      updatedCategory = newCat;
    }

    return updatedCategory!;
  },

  async delete(id: string): Promise<void> {
    try {
      await (supabase as any)
        .from('categories')
        .delete()
        .eq('id', id);
    } catch (err) {
      console.warn('Supabase category delete failed:', err);
    }

    const current = getLocalCategories();
    const filtered = current.filter(c => c.id !== id);
    saveLocalCategories(filtered);
  },

  async uploadImage(file: File, categoryId?: string): Promise<string> {
    const publicUrl = await storageService.uploadCategoryPhoto(file);
    if (categoryId) {
      await this.update(categoryId, { image_url: publicUrl });
    }
    return publicUrl;
  },

  async removeImage(id: string): Promise<Category> {
    return await this.update(id, { image_url: null });
  }
};
