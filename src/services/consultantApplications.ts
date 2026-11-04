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
    const cleanPhone = String(application.phone || '').trim();
    const cleanWhatsapp = (application.whatsapp ? String(application.whatsapp).trim() : cleanPhone) || cleanPhone;
    const sanitizedApp = {
      ...application,
      name: String(application.name || '').trim(),
      email: String(application.email || '').trim().toLowerCase(),
      phone: cleanPhone,
      whatsapp: cleanWhatsapp,
    };

    // 1. Try authoritative server API first (Vercel serverless / Express endpoint)
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      const res = await fetch('/api/consultant-applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sanitizedApp),
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
      // If server returned a business validation or rate limit error, throw it directly
      if (apiErr?.message && !apiErr.message.includes('fetch') && !apiErr.message.includes('abort') && !apiErr.message.includes('Failed to fetch')) {
        throw apiErr;
      }
      console.warn('[consultantApplicationsService] Server API notice, falling back to direct DB insert:', apiErr?.message);
    }

    // 2. Fallback to direct Supabase client insert with a resilient 15s timeout race
    const dbPromise = supabase
      .from('consultant_applications')
      .insert(sanitizedApp);

    const timeoutPromise = new Promise<{ error: Error }>((resolve) =>
      setTimeout(
        () => resolve({ error: new Error('Submission timed out after 15 seconds. Please check your network connection and try again.') }),
        15000
      )
    );

    const { error } = (await Promise.race([dbPromise, timeoutPromise])) as any;

    if (error) {
      console.error('Supabase error creating consultant_application:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
      throw new Error(error.message || 'Failed to submit application. Please check your details and try again.');
    }

    return { success: true };
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

  async approve(applicationId: string, adminNotes?: string, pricing30?: number, pricing60?: number) {
    // 1. Try authoritative serverless endpoint first
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const res = await fetch('/api/admin/approve-consultant-application', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          applicationId,
          adminNotes,
          pricing30,
          pricing60,
        }),
      });

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
      if (apiErr?.message && !apiErr.message.includes('fetch') && !apiErr.message.includes('Failed to fetch')) {
        throw apiErr;
      }
      console.warn('[consultantApplicationsService] Server API error on approve, using resilient fallback:', apiErr?.message);
    }

    // 2. Client-side fallback if server API is unreachable
    const app = await this.getById(applicationId);
    if (!app) throw new Error('Application not found');

    const cleanEmail = (app.email || '').toLowerCase().trim();

    // Check if consultant already exists to ensure idempotency
    let existingConsultant = null;
    try {
      const { data: matched } = await supabase
        .from('consultants')
        .select('*')
        .ilike('email', cleanEmail)
        .limit(1);
      existingConsultant = matched?.[0] || null;
    } catch (e) {
      console.warn('Consultant lookup error:', e);
    }

    const genderValue = (app.gender?.toLowerCase() === 'female' ? 'female' : 'male') as 'male' | 'female';
    let consultant = existingConsultant;

    if (consultant) {
      const { data: updated } = await (supabase as any)
        .from('consultants')
        .update({
          name: app.name,
          title: app.current_job || consultant.title || 'Consultant',
          bio: app.experience || consultant.bio || '',
          gender: genderValue,
          is_active: true,
          email: cleanEmail,
          preferred_time: app.preferred_session_timing || consultant.preferred_time,
        })
        .eq('id', consultant.id)
        .select()
        .single();
      consultant = updated || consultant;
    } else {
      const { data: created, error: cErr } = await (supabase as any)
        .from('consultants')
        .insert({
          name: app.name,
          title: app.current_job || 'Consultant',
          bio: app.experience || '',
          expertise: ['Consulting', app.qualification || 'Advisory'].filter(Boolean),
          pricing_30: pricing30 || 1000,
          pricing_60: pricing60 || 1800,
          gender: genderValue,
          is_active: true,
          email: cleanEmail,
          preferred_time: app.preferred_session_timing || 'Morning (8 AM – 12 PM)',
        })
        .select()
        .single();
      if (cErr) throw cErr;
      consultant = created;
    }

    // Update application status
    await this.update(applicationId, {
      status: 'approved',
      admin_notes: adminNotes || app.admin_notes || null,
    });

    return { success: true, consultant };
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

