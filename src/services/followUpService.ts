import { supabase } from '@/lib/supabase';
import { FollowUpRequest, FollowUpStatus } from '@/utils/meetingRejoin';

export interface FollowUpResponse<T = any> {
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

    if (!token) {
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

      return {
        success: false,
        error: data?.error || 'Failed to submit follow-up request.',
        code: data?.code || 'REQUEST_FAILED',
      };
    } catch (err: any) {
      console.error('[FollowUpService] Error submitting request:', err);
      return {
        success: false,
        error: 'Unable to connect to server. Please try again.',
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
      return {
        success: false,
        error: data?.error || 'Failed to fetch follow-up',
        followUp: undefined,
      };
    } catch (err) {
      console.error('[FollowUpService] Network error fetching booking follow-up:', err);
      return { success: false, error: 'Network error' };
    }
  },

  /**
   * List follow-up requests for the current authenticated client.
   */
  async listClientFollowUps(): Promise<FollowUpResponse<FollowUpRequest[]>> {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;

    if (!token) return { success: false, error: 'Authentication required', followUps: [] };

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
      return {
        success: false,
        error: data?.error || 'Failed to fetch client follow-ups',
        followUps: [],
      };
    } catch (err) {
      console.error('[FollowUpService] Error listing client follow-ups:', err);
      return { success: false, error: 'Network error', followUps: [] };
    }
  },

  /**
   * List follow-up requests for the current authenticated consultant.
   */
  async listConsultantFollowUps(): Promise<FollowUpResponse<FollowUpRequest[]>> {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;

    if (!token) return { success: false, error: 'Authentication required', followUps: [] };

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
      return {
        success: false,
        error: data?.error || 'Failed to fetch consultant follow-ups',
        followUps: [],
      };
    } catch (err) {
      console.error('[FollowUpService] Error listing consultant follow-ups:', err);
      return { success: false, error: 'Network error', followUps: [] };
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

      return {
        success: false,
        error: data?.error || 'Failed to submit response.',
        code: data?.code || 'RESPONSE_FAILED',
      };
    } catch (err) {
      console.error('[FollowUpService] Error submitting consultant response:', err);
      return { success: false, error: 'Network error. Please try again.' };
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

      return {
        success: false,
        error: data?.error || 'Failed to submit response.',
        code: data?.code || 'RESPONSE_FAILED',
      };
    } catch (err) {
      console.error('[FollowUpService] Error submitting client response:', err);
      return { success: false, error: 'Network error. Please try again.' };
    }
  },
};
