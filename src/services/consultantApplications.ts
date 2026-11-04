import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/database.types';

type ConsultantApplication = Database['public']['Tables']['consultant_applications']['Row'];
type ConsultantApplicationInsert = Database['public']['Tables']['consultant_applications']['Insert'];
type ConsultantApplicationUpdate = Database['public']['Tables']['consultant_applications']['Update'];

export const consultantApplicationsService = {
  async getAll(status?: 'pending' | 'approved' | 'rejected') {
    let query = supabase
      .from('consultant_applications')
      .select('*')
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Supabase error fetching consultant_applications:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
      throw error;
    }
    return data as ConsultantApplication[];
  },

  async getById(id: string) {
    const { data, error } = await supabase
      .from('consultant_applications')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('Supabase error fetching consultant_application by id:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
      throw error;
    }
    return data as ConsultantApplication | null;
  },

  async create(application: ConsultantApplicationInsert) {
    // 1. Try authoritative server API first
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      const res = await fetch('/api/consultant-applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(application),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const json = await res.json().catch(() => null);
        if (json?.success) {
          return json;
        }
      } else {
        const errJson = await res.json().catch(() => null);
        if (errJson?.error) {
          throw new Error(errJson.error);
        }
      }
    } catch (apiErr: any) {
      if (apiErr?.message && !apiErr.message.includes('fetch') && !apiErr.message.includes('abort')) {
        throw apiErr;
      }
      console.warn('[consultantApplicationsService] Server API notice, falling back to direct DB insert:', apiErr?.message);
    }

    // 2. Fallback to direct Supabase client insert with a strict timeout race
    const dbPromise = supabase
      .from('consultant_applications')
      .insert(application);

    const timeoutPromise = new Promise<{ error: Error }>((resolve) =>
      setTimeout(() => resolve({ error: new Error('Submission timed out. Please check your network and try again.') }), 6000)
    );

    const { error } = (await Promise.race([dbPromise, timeoutPromise])) as any;

    if (error) {
      console.error('Supabase error creating consultant_application:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
      throw error;
    }
  },

  async update(id: string, updates: ConsultantApplicationUpdate) {
    const payload = { ...updates, updated_at: new Date().toISOString() };

    const { data, error } = await (supabase as any)
      .from('consultant_applications')
      .update(payload)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) {
      const logData = {
        tableName: 'consultant_applications',
        applicationId: id,
        payload,
        supabaseErrorObject: {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        }
      };
      console.error('[Supabase Consultant Application Update Failure Log]: Complete Supabase Error Object:', JSON.stringify(logData, null, 2));
      throw error;
    }

    return data as ConsultantApplication;
  },

  async delete(id: string) {
    const { error } = await supabase
      .from('consultant_applications')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Supabase error deleting consultant_application:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
      throw error;
    }
  }
};

