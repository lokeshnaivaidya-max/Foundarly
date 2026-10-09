import { supabase } from '@/lib/supabase';
import {
  MeetingSessionStatus,
  calculateRejoinEligibility,
  validateParticipantAccess,
} from '@/utils/meetingRejoin';

export interface MeetingAccessResponse {
  success: boolean;
  authorized: boolean;
  canJoin: boolean;
  isRejoin: boolean;
  sessionStatus: MeetingSessionStatus;
  role?: 'client' | 'consultant' | 'admin' | null;
  error?: string;
  code?: string;
  booking?: Record<string, unknown>;
  timing?: {
    scheduledStart: string;
    scheduledEnd: string;
    rejoinDeadline: string;
    rejoinTimeRemainingMs: number;
    rejoinDaysRemaining: number;
    serverTime: string;
  };
}

export const meetingService = {
  /**
   * Authoritatively validate access to a meeting room via server API.
   * Enforces 7-day rejoin expiration, participant ownership, and status on the backend.
   */
  async validateAccess(roomId: string): Promise<MeetingAccessResponse> {
    if (!roomId || typeof roomId !== 'string' || !roomId.trim()) {
      return {
        success: false,
        authorized: false,
        canJoin: false,
        isRejoin: false,
        sessionStatus: 'expired',
        error: 'Invalid meeting room ID',
        code: 'INVALID_ROOM_ID',
      };
    }

    const cleanRoomId = roomId.trim();

    // Get current authenticated user session
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    const currentUser = sessionData?.session?.user;

    if (!token || !currentUser) {
      return {
        success: false,
        authorized: false,
        canJoin: false,
        isRejoin: false,
        sessionStatus: 'expired',
        error: 'Authentication required. Please sign in to access the meeting room.',
        code: 'UNAUTHENTICATED',
      };
    }

    try {
      const response = await fetch('/api/meeting/validate-access', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ roomId: cleanRoomId }),
      });

      const data = await response.json().catch(() => null);

      if (response.ok && data?.success) {
        return data as MeetingAccessResponse;
      }

      // Return server-provided error if available
      if (data && !data.success) {
        return {
          success: false,
          authorized: false,
          canJoin: false,
          isRejoin: false,
          sessionStatus: data.sessionStatus || 'expired',
          error: data.error || 'Access to meeting room was denied by server.',
          code: data.code || 'SERVER_DENIED',
          timing: data.timing,
          booking: data.booking,
        };
      }

      // In case of non-OK response with no JSON
      return {
        success: false,
        authorized: false,
        canJoin: false,
        isRejoin: false,
        sessionStatus: 'expired',
        error: `Server returned error (${response.status}): ${response.statusText}`,
        code: 'HTTP_ERROR',
      };
    } catch (networkErr: unknown) {
      console.warn('[MeetingService] Server endpoint unreachable, verifying via Supabase query:', networkErr);

      // Fallback: Query Supabase directly if Express server API is unreachable
      try {
        const rawBookingId = cleanRoomId.startsWith('foundarly-') ? cleanRoomId.replace('foundarly-', '') : cleanRoomId;
        const isRawUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawBookingId);

        const baseQuery = supabase
          .from('bookings')
          .select('*, consultants(id, name, title, email, user_id)');

        const { data: booking, error: bookingErr } = await (
          isRawUuid
            ? baseQuery.or(`meeting_room_id.eq.${cleanRoomId},id.eq.${rawBookingId}`).maybeSingle()
            : baseQuery.eq('meeting_room_id', cleanRoomId).maybeSingle()
        );

        if (bookingErr || !booking) {
          return {
            success: false,
            authorized: false,
            canJoin: false,
            isRejoin: false,
            sessionStatus: 'expired',
            error: 'Meeting room not found or invalid session link.',
            code: 'ROOM_NOT_FOUND',
          };
        }

        let consultantObj = Array.isArray(booking.consultants)
          ? booking.consultants[0]
          : booking.consultants;

        if (!consultantObj && booking.consultant_id) {
          const { data: directConsultant } = await supabase
            .from('consultants')
            .select('id, name, title, email, user_id')
            .eq('id', booking.consultant_id)
            .maybeSingle();
          if (directConsultant) {
            consultantObj = directConsultant;
          }
        }

        const authCheck = validateParticipantAccess(
          currentUser,
          booking,
          consultantObj,
          false
        );

        if (!authCheck.authorized) {
          return {
            success: false,
            authorized: false,
            canJoin: false,
            isRejoin: false,
            sessionStatus: 'expired',
            error: authCheck.reason || 'You are not authorized to access this meeting.',
            code: authCheck.code || 'UNAUTHORIZED_PARTICIPANT',
          };
        }

        const eligibility = calculateRejoinEligibility(booking, new Date());

        return {
          success: true,
          authorized: true,
          canJoin: eligibility.canJoin,
          isRejoin: eligibility.isRejoin,
          sessionStatus: eligibility.sessionStatus,
          role: authCheck.role,
          booking: {
            ...booking,
            consultants: consultantObj,
          },
          timing: {
            scheduledStart: new Date(booking.date).toISOString(),
            scheduledEnd: new Date(booking.date).toISOString(),
            rejoinDeadline: eligibility.rejoinDeadline.toISOString(),
            rejoinTimeRemainingMs: eligibility.rejoinTimeRemainingMs,
            rejoinDaysRemaining: eligibility.rejoinDaysRemaining,
            serverTime: new Date().toISOString(),
          },
        };
      } catch (fallbackErr: unknown) {
        return {
          success: false,
          authorized: false,
          canJoin: false,
          isRejoin: false,
          sessionStatus: 'expired',
          error: (fallbackErr as Error)?.message || 'Failed to verify meeting session.',
          code: 'VERIFICATION_FAILED',
        };
      }
    }
  },
};
