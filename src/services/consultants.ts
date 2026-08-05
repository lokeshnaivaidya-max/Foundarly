import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/database.types';

type Consultant = Database['public']['Tables']['consultants']['Row'];
type ConsultantInsert = Database['public']['Tables']['consultants']['Insert'];
type ConsultantUpdate = Database['public']['Tables']['consultants']['Update'];

export const consultantsService = {
  async getAll(activeOnly = false) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        let query = supabase.from('consultants').select('*').order('created_at', { ascending: false });
        
        if (activeOnly) {
          query = query.eq('is_active', true);
        }
        
        const { data, error } = await query;
        if (error) {
          if (attempt === 0) {
            await new Promise(r => setTimeout(r, 300));
            continue;
          }
          console.warn('Unable to fetch consultants:', error.message || error);
          return [];
        }
        return (data || []) as Consultant[];
      } catch (err: any) {
        if (attempt === 0) {
          await new Promise(r => setTimeout(r, 300));
          continue;
        }
        console.warn('Error fetching consultants:', err?.message || err);
        return [];
      }
    }
    return [];
  },

  async getById(id: string) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const { data, error } = await supabase
          .from('consultants')
          .select('*')
          .eq('id', id)
          .maybeSingle();
        
        if (error) {
          if (attempt === 0) {
            await new Promise(r => setTimeout(r, 300));
            continue;
          }
          return null;
        }
        return data as Consultant | null;
      } catch {
        if (attempt === 0) {
          await new Promise(r => setTimeout(r, 300));
          continue;
        }
        return null;
      }
    }
    return null;
  },

  async create(consultant: Record<string, any>) {
    let payload = { ...consultant };

    for (let attempt = 0; attempt < 3; attempt++) {
      const { data, error } = await (supabase as any)
        .from('consultants')
        .insert(payload)
        .select()
        .single();

      if (!error) {
        return data as Consultant;
      }

      const errorLog = {
        httpStatus: (error as any)?.status || 400,
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
        attempt: attempt + 1,
        payload
      };
      console.error('[Supabase Consultant Insert Failure Log]:', JSON.stringify(errorLog, null, 2));

      if (error.code === 'PGRST204') {
        const missingColumnMatch = error.message.match(/Could not find the '([^']+)' column/);
        if (missingColumnMatch && missingColumnMatch[1]) {
          const missingColumn = missingColumnMatch[1];
          console.warn(`[Supabase Consultant Insert] Stripping missing column '${missingColumn}' from payload and retrying...`);
          delete payload[missingColumn];
          continue;
        }
      }

      throw error;
    }

    throw new Error('Failed to create consultant after retries');
  },

  async update(id: string, updates: Record<string, any>) {
    let payload = { ...updates };

    for (let attempt = 0; attempt < 3; attempt++) {
      const { data, error } = await (supabase as any)
        .from('consultants')
        .update(payload)
        .eq('id', id)
        .select()
        .maybeSingle();

      if (!error) {
        return data as Consultant;
      }

      const errorLog = {
        httpStatus: (error as any)?.status || 400,
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
        attempt: attempt + 1,
        consultantId: id,
        payload
      };
      console.error('[Supabase Consultant Update Failure Log]:', JSON.stringify(errorLog, null, 2));

      if (error.code === 'PGRST204') {
        const missingColumnMatch = error.message.match(/Could not find the '([^']+)' column/);
        if (missingColumnMatch && missingColumnMatch[1]) {
          const missingColumn = missingColumnMatch[1];
          console.warn(`[Supabase Consultant Update] Stripping missing column '${missingColumn}' from payload and retrying...`);
          delete payload[missingColumn];
          continue;
        }
      }

      throw error;
    }

    throw new Error('Failed to update consultant after retries');
  },

  async delete(id: string) {
    const { error } = await supabase
      .from('consultants')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('Supabase error deleting consultant:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });
      throw error;
    }
  },

  async toggleActive(id: string, isActive: boolean) {
    return this.update(id, { is_active: isActive });
  },
};
