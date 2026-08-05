import { supabase } from "@/lib/supabase";

export interface PageContent {
  id: string;
  page_key: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export const pageContentService = {
  async getByPageKey(pageKey: string): Promise<PageContent | null> {
    const { data, error } = await supabase
      .from('page_content')
      .select('*')
      .eq('page_key', pageKey)
      .single();

    if (error) {
      console.error('Error fetching page content:', error);
      return null;
    }

    return data;
  },

  async upsert(pageKey: string, title: string, content: string): Promise<void> {
    const { error } = await supabase
      .from('page_content')
      .upsert({
        page_key: pageKey,
        title,
        content,
        updated_at: new Date().toISOString()
      } as any, {
        onConflict: 'page_key'
      });

    if (error) {
      throw error;
    }
  }
};
