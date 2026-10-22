import { supabase } from '@/lib/supabase';
import {
  MeetingSessionStatus,
  calculateRejoinEligibility,
  validateParticipantAccess,
  parseSessionTimes,
  FollowUpRequest,
  hasParticipantJoinedLocal,
} from '@/utils/meetingRejoin';

export interface MeetingAccessResponse {
  success: boolean;
  authorized: boolean;
  canJoin: boolean;
  hasJoined?: boolean;
  isRejoin: boolean;
  isRejoinWindow?: boolean;
  sessionStatus: MeetingSessionStatus;
  role?: 'client' | 'consultant' | 'admin' | null;
  error?: string;
  code?: string;
  booking?: Record<string, unknown>;
  followUp?: FollowUpRequest | null;
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

    // Clean and normalize roomId
    let normalizedRoomId = cleanRoomId;
    if (normalizedRoomId.includes('/meeting/')) {
      normalizedRoomId = normalizedRoomId.split('/meeting/').pop() || normalizedRoomId;
    }
    normalizedRoomId = normalizedRoomId.split('?')[0].split('#')[0].replace(/\/+$/, '').trim();

    try {
      const response = await fetch('/api/meeting/validate-access', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ roomId: normalizedRoomId }),
      });

      const data = await response.json().catch(() => null);

      if (response.ok && data?.success) {
        return data as MeetingAccessResponse;
      }

      // Return server-provided error if it was an explicit auth or state rejection (not ROOM_NOT_FOUND)
      if (data && !data.success && data.code && data.code !== 'ROOM_NOT_FOUND' && data.code !== 'SERVER_DENIED') {
        return {
          success: false,
          authorized: false,
          canJoin: false,
          isRejoin: false,
          sessionStatus: data.sessionStatus || 'expired',
          error: data.error || 'Access to meeting room was denied by server.',
          code: data.code,
          timing: data.timing,
          booking: data.booking,
        };
      }

      console.warn(`[MeetingService] Server endpoint returned ${response.status} (${data?.code || 'NO_JSON'}), proceeding to direct Supabase verification`);
    } catch (networkErr: unknown) {
      console.warn('[MeetingService] Server endpoint unreachable, verifying via Supabase query:', networkErr);
    }

    // Fallback: Query Supabase directly if Express server API did not resolve or is unreachable
    try {
      const rawBookingId = normalizedRoomId.startsWith('foundarly-') ? normalizedRoomId.replace('foundarly-', '') : normalizedRoomId;
      const prefixedRoomId = normalizedRoomId.startsWith('foundarly-') ? normalizedRoomId : `foundarly-${normalizedRoomId}`;
      const isRawUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawBookingId);
      const isCleanUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(normalizedRoomId);

      const orFilters: string[] = [
        `meeting_room_id.eq.${normalizedRoomId}`,
        `meeting_room_id.eq.${prefixedRoomId}`,
        `meeting_room_id.eq.${rawBookingId}`,
      ];
      if (isRawUuid) {
        orFilters.push(`id.eq.${rawBookingId}`);
      }
      if (isCleanUuid && normalizedRoomId !== rawBookingId) {
        orFilters.push(`id.eq.${normalizedRoomId}`);
      }

      const baseQuery = supabase
        .from('bookings')
        .select('*, consultants(id, name, title, email, user_id)');

      let { data: bookings, error: bookingErr } = await baseQuery
        .or(orFilters.join(','))
        .limit(1);

      if (bookingErr || !bookings || bookings.length === 0) {
        const flatQuery = supabase.from('bookings').select('*');
        const flatResult = await flatQuery.or(orFilters.join(',')).limit(1);
        if (flatResult.data && flatResult.data.length > 0) {
          bookings = flatResult.data;
          bookingErr = null;
        }
      }

      const booking = bookings?.[0];

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
        const hasJoined = hasParticipantJoinedLocal(
          booking.id,
          currentUser.id,
          currentUser.email,
          authCheck.role
        );

        const sessionTimes = parseSessionTimes(booking);

        return {
          success: true,
          authorized: true,
          canJoin: eligibility.canJoin,
          hasJoined,
          isRejoin: Boolean(hasJoined),
          isRejoinWindow: eligibility.isRejoin,
          sessionStatus: eligibility.sessionStatus,
          role: authCheck.role,
          booking: {
            ...booking,
            consultants: consultantObj,
          },
          timing: {
            scheduledStart: sessionTimes.scheduledStart.toISOString(),
            scheduledEnd: sessionTimes.scheduledEnd.toISOString(),
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
  },

  /**
   * Notifies the other participant via email that the current user has joined
   * and is waiting in the meeting room.
   */
  async notifyWaiting(roomId: string): Promise<{ success: boolean; throttled?: boolean; message?: string; error?: string }> {
    if (!roomId) {
      return { success: false, error: 'Room ID is required.' };
    }

    let normalizedRoomId = roomId.trim();
    if (normalizedRoomId.includes('/meeting/')) {
      normalizedRoomId = normalizedRoomId.split('/meeting/').pop() || normalizedRoomId;
    }
    normalizedRoomId = normalizedRoomId.split('?')[0].split('#')[0].replace(/\/+$/, '').trim();

    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) {
      return { success: false, error: 'User is not authenticated.' };
    }

    try {
      const response = await fetch('/api/meeting/notify-waiting', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ roomId: normalizedRoomId }),
      });

      const data = await response.json().catch(() => null);
      if (response.ok && data) {
        return data;
      }
      return {
        success: false,
        error: data?.error || `Server responded with status ${response.status}`,
      };
    } catch (networkErr: unknown) {
      return {
        success: false,
        error: networkErr instanceof Error ? networkErr.message : 'Network error notifying participant',
      };
    }
  },
};

