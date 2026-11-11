import { supabase } from '@/lib/supabase';
import { getStoredSession } from '@/contexts/AuthContext';
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

    // Get current authenticated user session with synchronous fallback
    const { data: sessionData } = await supabase.auth.getSession();
    let token = sessionData?.session?.access_token;
    let currentUser = sessionData?.session?.user;

    if (!token || !currentUser) {
      const stored = getStoredSession();
      if (stored?.access_token && stored?.user) {
        token = stored.access_token;
        currentUser = stored.user;
      }
    }

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

      let booking: any = null;
      let consultantObj: any = null;

      // 1. Prioritize SECURITY DEFINER RPC lookup (bypasses RLS safely and joins consultant details)
      try {
        const { data: rpcData, error: rpcError } = await supabase
          .rpc('lookup_meeting_room', { p_room_id: normalizedRoomId });
        if (!rpcError && Array.isArray(rpcData) && rpcData.length > 0) {
          const row = rpcData[0];
          booking = {
            id: row.id,
            user_id: row.user_id,
            consultant_id: row.consultant_id,
            name: row.name,
            email: row.email,
            date: row.date,
            time: row.time,
            message: row.message,
            status: row.status,
            payment_status: row.payment_status,
            session_duration: row.session_duration,
            session_price: row.session_price,
            meeting_room_id: row.meeting_room_id || normalizedRoomId,
            participants_count: row.participants_count,
            meeting_started_at: row.meeting_started_at,
            meeting_ended_at: row.meeting_ended_at,
            created_at: row.created_at,
            updated_at: row.updated_at,
          };
          if (row.consultant_name || row.consultant_email || row.consultant_user_id) {
            consultantObj = {
              id: row.consultant_id,
              name: row.consultant_name,
              email: row.consultant_email,
              title: row.consultant_title,
              user_id: row.consultant_user_id,
            };
          }
        }
      } catch {
        // Non-blocking: proceed to direct table queries
      }

      if (!booking) {
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

        booking = bookings?.[0];
      }

      if (!booking) {
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

      if (!consultantObj) {
        consultantObj = Array.isArray(booking.consultants)
          ? booking.consultants[0]
          : booking.consultants;
      }

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

      let authCheck = validateParticipantAccess(
        currentUser,
        booking,
        consultantObj,
        false
      );

      if (!authCheck.authorized && booking.consultant_id) {
        const userEmailClean = (currentUser.email || '').toLowerCase().trim();
        const { data: matchedCons } = await supabase
          .from('consultants')
          .select('id, name, title, email, user_id')
          .eq('id', booking.consultant_id)
          .maybeSingle();

        if (matchedCons) {
          const consEmail = (matchedCons.email || '').toLowerCase().trim();
          const matchesId = Boolean(matchedCons.user_id && matchedCons.user_id === currentUser.id);
          const matchesEmail = Boolean(userEmailClean && consEmail && userEmailClean === consEmail);

          if (matchesId || matchesEmail) {
            consultantObj = matchedCons;
            authCheck = { authorized: true, role: 'consultant' };
            if (matchedCons.user_id !== currentUser.id) {
              supabase
                .from('consultants')
                .update({ user_id: currentUser.id })
                .eq('id', matchedCons.id)
                .then();
            }
          }
        }
      }

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

      // Auto-link guest booking user_id if client is now logged in with strictly matching verified email
      const authUserEmail = (currentUser.email || '').trim().toLowerCase();
      const bookingEmailClean = (booking.email || '').trim().toLowerCase();
      if (
        !booking.user_id &&
        currentUser.id &&
        authCheck.role === 'client' &&
        authUserEmail &&
        bookingEmailClean &&
        authUserEmail === bookingEmailClean
      ) {
        supabase
          .from('bookings')
          .update({ user_id: currentUser.id })
          .eq('id', booking.id)
          .is('user_id', null)
          .then();
        booking.user_id = currentUser.id;
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
    const token = session?.access_token || getStoredSession()?.access_token;
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

