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

let consultantsCache: { data: Consultant[]; timestamp: number } | null = null;
const CACHE_TTL = 30000; // 30 seconds
// REQUEST DEADLINE: the acceptance target is a useful error within 8 seconds —
// the request itself must settle in 6s so a failure surfaces in time.
const REQUEST_DEADLINE_MS = 6000;
// CONCURRENT REQUEST DEDUPE: parallel callers (e.g. the Booking page and the
// chatbot widget) share ONE in-flight request instead of duplicating it.
let inFlightGetAll: { activeOnly: boolean; promise: Promise<Consultant[]> } | null = null;

export const consultantsService = {
  async getAll(activeOnly = false, forceRefresh = false) {
    if (!forceRefresh && consultantsCache && (Date.now() - consultantsCache.timestamp < CACHE_TTL)) {
      return activeOnly ? consultantsCache.data.filter(c => c.is_active) : consultantsCache.data;
    }

    // Dedupe concurrent identical requests (same activeOnly scope)
    if (inFlightGetAll && inFlightGetAll.activeOnly === activeOnly) {
      return inFlightGetAll.promise;
    }

    const request = this.performGetAll(activeOnly)
      .finally(() => {
        if (inFlightGetAll?.promise === request) inFlightGetAll = null;
      });
    inFlightGetAll = { activeOnly, promise: request };
    return request;
  },

  async performGetAll(activeOnly: boolean): Promise<Consultant[]> {
    // Direct Supabase query with timeout - no unnecessary admin API call for regular users
    for (let attempt = 0; attempt < 2; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_DEADLINE_MS);

      try {
        let query = supabase.from('consultants').select('*').order('created_at', { ascending: false });

        if (activeOnly) {
          query = query.eq('is_active', true);
        }

        // HARD SETTLE GUARANTEE: abortSignal alone cannot reject a request that
        // never dispatches (e.g. supabase-js waiting on a wedged auth lock
        // before fetch). Race the query against a rejecting timeout so getAll
        // ALWAYS settles and the Booking page reaches its error + retry state
        // instead of an indefinite "Loading consultants...".
        const { data, error } = await Promise.race([
          query.abortSignal(controller.signal),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Consultant list request timed out')), REQUEST_DEADLINE_MS)
          ),
        ]) as { data: Consultant[] | null; error: { message?: string } | null };
        clearTimeout(timeoutId);

        if (error) {
          if (attempt === 0) {
            await new Promise(r => setTimeout(r, 200));
            continue;
          }
          throw new Error(error.message || 'Failed to fetch consultants');
        }

        const result = (data || []) as Consultant[];
        consultantsCache = { data: result, timestamp: Date.now() };
        return result;
      } catch (err: any) {
        clearTimeout(timeoutId);
        if (attempt === 0) {
          await new Promise(r => setTimeout(r, 200));
          continue;
        }
        throw new Error(err?.message || 'Failed to fetch consultants');
      }
    }

    throw new Error('Failed to fetch consultants after retries');
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
    const payload = { ...consultant };

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
    const payload = { ...updates };

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
    // Step 1: Fetch the consultant record to get the linked user_id
    // before deletion so we can downgrade the associated profile role.
    const { data: existing, error: fetchError } = await supabase
      .from('consultants')
      .select('user_id')
      .eq('id', id)
      .maybeSingle();

    if (fetchError) {
      throw new Error(`Failed to fetch consultant before deletion: ${fetchError.message}`);
    }

    const linkedUserId = existing?.user_id || null;

    // Step 2: Delete the consultant record
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

    // Step 3: Downgrade the associated user's profile role to 'client'
    // if it is currently 'consultant'. Never downgrade admin/developer_admin.
    if (linkedUserId) {
      try {
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', linkedUserId)
          .maybeSingle();

        if (existingProfile?.role === 'consultant') {
          const { error: downgradeError } = await supabase
            .from('profiles')
            .update({ role: 'client' })
            .eq('id', linkedUserId);

          if (downgradeError) {
            console.error('[consultantsService.delete] CRITICAL: failed to downgrade profile from consultant to client', {
              userId: linkedUserId,
              error: downgradeError.message
            });
            // Return success since the consultant record was deleted, but warn about the
            // partial state so the UI can surface it honestly.
            return { deleted: true, profileDowngraded: false, userId: linkedUserId };
          }
          console.info('[consultantsService.delete] Downgraded profiles.role to client for user', {
            userId: linkedUserId
          });
          return { deleted: true, profileDowngraded: true, userId: linkedUserId };
        }

        // If already not consultant, don't upsert — preserve unrelated roles.
        if (existingProfile?.role) {
          console.info('[consultantsService.delete] Profile already not consultant; no downgrade needed', {
            userId: linkedUserId,
            currentRole: existingProfile.role
          });
          return { deleted: true, profileDowngraded: false, userId: linkedUserId };
        }
      } catch (profileErr) {
        console.error('[consultantsService.delete] Exception while downgrading profile', {
          userId: linkedUserId,
          error: profileErr
        });
        // Return success since consultant record is deleted, but report partial state
        return { deleted: true, profileDowngraded: false, userId: linkedUserId };
      }
    }

    // No linked user_id — deletion complete, no profile to downgrade
    console.info('[consultantsService.delete] Consultant deleted without linked user_id; no profile to downgrade');
    return { deleted: true, profileDowngraded: false, userId: null };
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
