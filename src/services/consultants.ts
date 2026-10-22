import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/database.types';
import {
  parseAvailabilitySettings,
  serializeAvailabilitySettings,
  validateAvailabilitySettings,
  generateAvailableSlots,
  ConsultantAvailabilitySettings,
} from '@/utils/timeSlots';

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

  async getAvailabilitySettings(consultantId: string) {
    const consultant = await this.getById(consultantId);
    if (!consultant) return null;
    return parseAvailabilitySettings(consultant);
  },

  async updateAvailabilityAndPricing(consultantId: string, settings: ConsultantAvailabilitySettings) {
    const validation = validateAvailabilitySettings(settings);
    if (!validation.valid) {
      throw new Error(validation.error || 'Invalid availability settings');
    }

    const serialized = serializeAvailabilitySettings(settings);

    // Try server API first if token available in Supabase session
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        const res = await fetch(`/api/admin/consultants/${encodeURIComponent(consultantId)}/availability-pricing`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ settings }),
        });

        if (res.ok) {
          const json = await res.json();
          if (json.success && json.consultant) {
            return json.consultant as Consultant;
          }
        }
      }
    } catch (apiErr) {
      console.warn('[ConsultantsService] Direct API update failed, falling back to Supabase client:', apiErr);
    }

    // Direct Supabase update fallback
    const consultant = await this.getById(consultantId);
    const existingSocial = (consultant?.social_links && typeof consultant.social_links === 'object')
      ? (consultant.social_links as Record<string, any>)
      : {};

    const payload: Record<string, any> = {
      pricing_30: serialized.pricing_30,
      pricing_60: serialized.pricing_60,
      preferred_time: serialized.preferredTimeText,
      availability: serialized.availabilityJson,
      social_links: {
        ...existingSocial,
        availability_settings: settings,
      },
    };

    return this.update(consultantId, payload);
  },

  async fetchAvailableSlots(consultantId: string, date: string, duration: number = 60) {
    try {
      const res = await fetch(`/api/consultants/${encodeURIComponent(consultantId)}/available-slots?date=${encodeURIComponent(date)}&duration=${duration}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.slots)) {
          return json;
        }
      }
    } catch (e) {
      console.warn('[ConsultantsService] Failed to fetch slots from server API, falling back to local computation:', e);
    }

    // Fallback: local computation using consultant record
    const consultant = await this.getById(consultantId);
    if (!consultant) return { success: false, slots: [] };

    const settings = parseAvailabilitySettings(consultant);
    const slots = generateAvailableSlots({
      dateStr: date,
      availabilitySettings: settings,
      sessionDuration: duration,
    });

    return {
      success: true,
      consultant_id: consultantId,
      date,
      timezone: 'Asia/Kolkata (IST, UTC+05:30)',
      slots,
    };
  },
};
