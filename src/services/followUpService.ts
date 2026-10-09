import { supabase } from '@/lib/supabase';
import { FollowUpRequest, FollowUpStatus } from '@/utils/meetingRejoin';

export interface FollowUpResponse<T = unknown> {
  success: boolean;
  message?: string;
  error?: string;
  code?: string;
  followUp?: T;
  followUps?: T[];
}

export const followUpService = {
  /**
   * Submit a new follow-up request from the client within the 7-day window.
   */
  async requestFollowUp(params: {
    bookingId: string;
    reason: string;
    preferredDate: string;
    preferredTime: string;
  }): Promise<FollowUpResponse<FollowUpRequest>> {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    const user = sessionData?.session?.user;

    if (!token || !user) {
      return {
        success: false,
        error: 'You must be logged in to request a follow-up consultation.',
        code: 'UNAUTHENTICATED',
      };
    }

    try {
      const response = await fetch('/api/follow-ups/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(params),
      });

      const data = await response.json().catch(() => null);
      if (response.ok && data?.success) {
        return data;
      }

      // If business failure returned by API
      if (data && !data.success) {
        return {
          success: false,
          error: data.error || 'Failed to submit follow-up request.',
          code: data.code || 'REQUEST_FAILED',
        };
      }
    } catch {
      // Server route unreachable, proceed to Supabase fallback
    }

    // Resilient Fallback: Create directly via Supabase using RLS
    try {
      const { data: booking, error: bErr } = await supabase
        .from('bookings')
        .select('*, consultants(id, name, email)')
        .eq('id', params.bookingId)
        .maybeSingle();

      if (bErr || !booking) {
        return { success: false, error: 'Original booking record not found.', code: 'BOOKING_NOT_FOUND' };
      }

      const consultantObj = Array.isArray(booking.consultants) ? booking.consultants[0] : booking.consultants;
      const scheduledStart = new Date(`${booking.date}T${booking.time || '10:00:00'}`);
      const rejoinDeadline = new Date(scheduledStart.getTime() + 7 * 24 * 60 * 60 * 1000);

      const payload = {
        booking_id: booking.id,
        client_id: user.id,
        client_name: booking.name || user.email || 'Client',
        client_email: booking.email || user.email,
        consultant_id: booking.consultant_id,
        consultant_name: consultantObj?.name || 'Consultant',
        consultant_email: consultantObj?.email || null,
        meeting_room_id: booking.meeting_room_id || `foundarly-${booking.id}`,
        reason: params.reason,
        preferred_date: params.preferredDate,
        preferred_time: params.preferredTime,
        status: 'pending_consultant' as FollowUpStatus,
        rejoin_deadline: rejoinDeadline.toISOString(),
      };

      const { data: inserted, error: insErr } = await supabase
        .from('follow_up_requests')
        .insert(payload)
        .select()
        .single();

      if (insErr) {
        return {
          success: false,
          error: insErr.message || 'Failed to persist follow-up request in Supabase. Check if database migration is applied.',
          code: 'DATABASE_ERROR',
        };
      }

      return {
        success: true,
        message: 'Follow-up consultation requested successfully!',
        followUp: inserted as FollowUpRequest,
      };
    } catch (e: unknown) {
      console.error('[FollowUpService] Fallback insert failed:', e);
      return {
        success: false,
        error: e instanceof Error ? e.message : 'Failed to request follow-up consultation.',
        code: 'NETWORK_ERROR',
      };
    }
  },

  /**
   * Fetch the active or latest follow-up for a specific booking.
   */
  async getByBookingId(bookingId: string): Promise<FollowUpResponse<FollowUpRequest>> {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;

    if (!token) {
      return { success: false, error: 'Authentication required' };
    }

    try {
      const response = await fetch(`/api/follow-ups/booking/${encodeURIComponent(bookingId)}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json().catch(() => null);
      if (response.ok && data?.success) {
        return data;
      }
    } catch {
      // Server unreachable, fallback to Supabase
    }

    // Supabase Direct Query Fallback
    try {
      const { data, error } = await supabase
        .from('follow_up_requests')
        .select('*')
        .eq('booking_id', bookingId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (!error && data && data.length > 0) {
        return { success: true, followUp: data[0] as FollowUpRequest };
      }
      return { success: true, followUp: undefined };
    } catch {
      return { success: false, error: 'Could not fetch follow-up information.' };
    }
  },

  /**
   * List follow-up requests for the current authenticated client.
   */
  async listClientFollowUps(): Promise<FollowUpResponse<FollowUpRequest[]>> {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    const user = sessionData?.session?.user;

    if (!token || !user) return { success: false, error: 'Authentication required', followUps: [] };

    try {
      const response = await fetch('/api/follow-ups/client', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json().catch(() => null);
      if (response.ok && data?.success) {
        return data;
      }
    } catch {
      // Fall through to Supabase query
    }

    // Direct Supabase query fallback
    try {
      const { data, error } = await supabase
        .from('follow_up_requests')
        .select('*')
        .or(`client_id.eq.${user.id},client_email.eq.${user.email}`)
        .order('created_at', { ascending: false });

      if (!error && data) {
        return { success: true, followUps: data as FollowUpRequest[] };
      }
      return { success: true, followUps: [] };
    } catch {
      return { success: false, error: 'Failed to list follow-ups', followUps: [] };
    }
  },

  /**
   * List follow-up requests for the current authenticated consultant.
   */
  async listConsultantFollowUps(): Promise<FollowUpResponse<FollowUpRequest[]>> {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    const user = sessionData?.session?.user;

    if (!token || !user) return { success: false, error: 'Authentication required', followUps: [] };

    try {
      const response = await fetch('/api/follow-ups/consultant', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json().catch(() => null);
      if (response.ok && data?.success) {
        return data;
      }
    } catch {
      // Fall through to Supabase
    }

    // Direct Supabase query fallback for consultant
    try {
      const { data: consultant } = await supabase
        .from('consultants')
        .select('id')
        .or(`user_id.eq.${user.id},email.eq.${user.email}`)
        .maybeSingle();

      if (!consultant) {
        return { success: true, followUps: [] };
      }

      const { data, error } = await supabase
        .from('follow_up_requests')
        .select('*')
        .eq('consultant_id', consultant.id)
        .order('created_at', { ascending: false });

      if (!error && data) {
        return { success: true, followUps: data as FollowUpRequest[] };
      }
      return { success: true, followUps: [] };
    } catch {
      return { success: false, error: 'Failed to fetch consultant follow-ups', followUps: [] };
    }
  },

  /**
   * Consultant responds to a follow-up request (accept, propose alternative, or decline).
   * Note: No admin approval is required.
   */
  async consultantRespond(
    requestId: string,
    params: {
      action: 'accept' | 'propose_alternative' | 'decline';
      alternativeDate?: string;
      alternativeTime?: string;
      consultantNote?: string;
      reason?: string;
    }
  ): Promise<FollowUpResponse<FollowUpRequest>> {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;

    if (!token) {
      return { success: false, error: 'Authentication required', code: 'UNAUTHENTICATED' };
    }

    try {
      const response = await fetch(`/api/follow-ups/${encodeURIComponent(requestId)}/respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(params),
      });

      const data = await response.json().catch(() => null);
      if (response.ok && data?.success) {
        return data;
      }

      if (data && !data.success) {
        return {
          success: false,
          error: data.error || 'Failed to submit response.',
          code: data.code || 'RESPONSE_FAILED',
        };
      }
    } catch {
      // Fall through to Supabase direct update
    }

    // Direct Supabase update fallback using RLS
    try {
      const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (params.action === 'accept') {
        const { data: current } = await supabase
          .from('follow_up_requests')
          .select('preferred_date, preferred_time')
          .eq('id', requestId)
          .single();
        updateData.status = 'confirmed';
        updateData.confirmed_date = current?.preferred_date;
        updateData.confirmed_time = current?.preferred_time;
      } else if (params.action === 'propose_alternative') {
        updateData.status = 'alternative_proposed';
        updateData.alternative_date = params.alternativeDate;
        updateData.alternative_time = params.alternativeTime;
        updateData.consultant_note = params.consultantNote;
      } else if (params.action === 'decline') {
        updateData.status = 'declined';
        updateData.declined_reason = params.reason || 'Consultant unavailable';
      }

      const { data: updated, error: uErr } = await supabase
        .from('follow_up_requests')
        .update(updateData)
        .eq('id', requestId)
        .select()
        .single();

      if (uErr) {
        return { success: false, error: uErr.message };
      }

      return {
        success: true,
        message: 'Response recorded successfully',
        followUp: updated as FollowUpRequest,
      };
    } catch (err: unknown) {
      console.error('[FollowUpService] Direct update fallback error:', err);
      return { success: false, error: err instanceof Error ? err.message : 'Failed to submit response.' };
    }
  },

  /**
   * Client responds to consultant's proposed alternative time (accept or decline).
   */
  async clientRespond(
    requestId: string,
    params: {
      action: 'accept' | 'decline';
    }
  ): Promise<FollowUpResponse<FollowUpRequest>> {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;

    if (!token) {
      return { success: false, error: 'Authentication required', code: 'UNAUTHENTICATED' };
    }

    try {
      const response = await fetch(`/api/follow-ups/${encodeURIComponent(requestId)}/client-respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(params),
      });

      const data = await response.json().catch(() => null);
      if (response.ok && data?.success) {
        return data;
      }

      if (data && !data.success) {
        return {
          success: false,
          error: data.error || 'Failed to submit response.',
          code: data.code || 'RESPONSE_FAILED',
        };
      }
    } catch {
      // Fall through to direct Supabase update
    }

    // Direct Supabase update fallback
    try {
      const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (params.action === 'accept') {
        const { data: current } = await supabase
          .from('follow_up_requests')
          .select('alternative_date, alternative_time')
          .eq('id', requestId)
          .single();
        updateData.status = 'confirmed';
        updateData.confirmed_date = current?.alternative_date;
        updateData.confirmed_time = current?.alternative_time;
      } else {
        updateData.status = 'declined';
        updateData.declined_reason = 'Client declined alternative proposed time';
      }

      const { data: updated, error: uErr } = await supabase
        .from('follow_up_requests')
        .update(updateData)
        .eq('id', requestId)
        .select()
        .single();

      if (uErr) {
        return { success: false, error: uErr.message };
      }

      return {
        success: true,
        message: 'Response recorded successfully',
        followUp: updated as FollowUpRequest,
      };
    } catch (err: unknown) {
      console.error('[FollowUpService] Direct client response fallback error:', err);
      return { success: false, error: err instanceof Error ? err.message : 'Failed to submit response.' };
    }
  },
};
