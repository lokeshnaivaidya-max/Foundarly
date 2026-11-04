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
      // Forward the session token (when signed in) so the server can capture the
      // authenticated UUID on the application for authoritative approval linking.
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          headers['Authorization'] = `Bearer ${session.access_token}`;
        }
      } catch {
        // Anonymous submissions remain fully supported without the token
      }
      const res = await fetch('/api/consultant-applications', {
        method: 'POST',
        headers,
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

  async approve(
    applicationId: string,
    adminNotes?: string,
    pricing30?: number,
    pricing60?: number,
    applicationData?: ConsultantApplication | null
  ) {
    let app = applicationData || null;
    if (!app) {
      try {
        app = await this.getById(applicationId);
      } catch (e) {
        console.warn('[consultantApplicationsService] Pre-fetch application warning:', e);
      }
    }

    // 1. Try authoritative serverless endpoint first (passing verified application data)
    let serverSuccess = false;
    let serverResult: any = null;
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
          application: app || undefined,
        }),
      });

      if (res.ok) {
        const json = await res.json().catch(() => null);
        if (json?.success) {
          serverSuccess = true;
          serverResult = json;
        }
      } else {
        const errJson = await res.json().catch(() => null);
        console.warn('[consultantApplicationsService] Server approve endpoint notice, activating direct authenticated client flow:', errJson?.error || res.statusText);
      }
    } catch (apiErr: any) {
      console.warn('[consultantApplicationsService] Server approve endpoint unreachable, activating direct authenticated client flow:', apiErr?.message);
    }

    if (serverSuccess && serverResult) {
      return serverResult;
    }

    // 2. Client-side approval fallback using the admin's verified authenticated session (identical to rejection pattern)
    if (!app) {
      app = await this.getById(applicationId);
    }
    if (!app) {
      throw new Error('Consultant application not found');
    }

    const cleanEmail = (app.email || '').toLowerCase().trim();

    // Identity Mapping: check for linked user account by consultant email, profile name, or auth session
    let linkedUserId: string | null = null;
    try {
      const { data: existingConsultants } = await supabase
        .from('consultants')
        .select('id, user_id, email')
        .ilike('email', cleanEmail)
        .limit(1);

      if (existingConsultants?.[0]?.user_id) {
        linkedUserId = existingConsultants[0].user_id;
      }
    } catch {
      // ignore
    }

    if (!linkedUserId && app.name) {
      try {
        const { data: matchedProfiles } = await supabase
          .from('profiles')
          .select('id, full_name, role')
          .ilike('full_name', app.name.trim())
          .limit(1);

        if (matchedProfiles?.[0]?.id) {
          linkedUserId = matchedProfiles[0].id;
        }
      } catch {
        // ignore
      }
    }

    // If an auth user profile exists, promote role to 'consultant' and set is_consultant = true
    if (linkedUserId) {
      try {
        const { data: currentProfile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', linkedUserId)
          .maybeSingle();

        const isSuperAdminUser = currentProfile?.role === 'super_admin' || currentProfile?.role === 'developer_admin';

        if (!isSuperAdminUser) {
          await (supabase as any)
            .from('profiles')
            .update({
              role: 'consultant',
              is_consultant: true,
              updated_at: new Date().toISOString(),
            })
            .eq('id', linkedUserId);
          console.log(`[consultantApplicationsService] Updated profile role to consultant for user ${linkedUserId}`);
        }
      } catch (profErr) {
        console.warn('[consultantApplicationsService] Profile role update warning:', profErr);
      }
    }

    // Idempotent consultant creation / activation in 'consultants' table
    const genderValue = (app.gender?.toLowerCase() === 'female' ? 'female' : 'male') as 'male' | 'female';
    const parsedPricing30 = Number(pricing30) || 1000;
    const parsedPricing60 = Number(pricing60) || 1800;

    let existingConsultant = null;
    try {
      let query = supabase.from('consultants').select('*');
      if (linkedUserId) {
        query = query.or(`user_id.eq.${linkedUserId},email.ilike.${cleanEmail}`);
      } else {
        query = query.ilike('email', cleanEmail);
      }
      const { data: matched } = await query.limit(1);
      existingConsultant = matched?.[0] || null;
    } catch {
      // ignore
    }

    let consultant = existingConsultant;

    if (consultant) {
      const updateData: Record<string, any> = {
        name: app.name,
        title: app.current_job || consultant.title || 'Consultant',
        bio: app.experience || consultant.bio || '',
        gender: genderValue,
        is_active: true,
        email: cleanEmail,
        preferred_time: app.preferred_session_timing || consultant.preferred_time || 'Morning (8 AM – 12 PM)',
      };
      if (linkedUserId) {
        updateData.user_id = linkedUserId;
      }
      const { data: updated, error: uErr } = await (supabase as any)
        .from('consultants')
        .update(updateData)
        .eq('id', consultant.id)
        .select()
        .single();
      if (!uErr && updated) {
        consultant = updated;
      }
    } else {
      const { data: created, error: cErr } = await (supabase as any)
        .from('consultants')
        .insert({
          name: app.name,
          title: app.current_job || 'Consultant',
          bio: app.experience || '',
          expertise: ['Consulting', app.qualification || 'Advisory'].filter(Boolean),
          pricing_30: parsedPricing30,
          pricing_60: parsedPricing60,
          gender: genderValue,
          is_active: true,
          email: cleanEmail,
          preferred_time: app.preferred_session_timing || 'Morning (8 AM – 12 PM)',
          user_id: linkedUserId || null,
        })
        .select()
        .single();
      if (cErr) {
        console.error('[consultantApplicationsService] Error inserting consultant:', cErr);
        throw cErr;
      }
      consultant = created;
    }

    // Update application status to 'approved' using exact same update pattern as rejection flow
    await this.update(applicationId, {
      status: 'approved',
      admin_notes: adminNotes || app.admin_notes || null,
    });

    // Send email notification non-fatally
    let emailSent = false;
    let emailNotice: string | null = null;
    try {
      const mailRes = await emailService.sendApplicationApproval({
        applicantName: app.name,
        applicantEmail: cleanEmail,
        qualification: app.qualification,
        currentJob: app.current_job,
        preferredTiming: app.preferred_session_timing,
        adminNotes: adminNotes || null,
      });
      emailSent = mailRes.success;
      if (!mailRes.success) {
        emailNotice = mailRes.error || 'SMTP delivery not completed';
      }
    } catch (mErr: any) {
      emailNotice = mErr?.message || 'Email delivery failed';
    }

    return {
      success: true,
      consultant,
      linkedUserId,
      emailSent,
      emailNotice,
    };
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

