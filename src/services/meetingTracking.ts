import { supabase } from '@/lib/supabase';
import { emailService } from '@/services/email';
import {
  hasParticipantJoinedLocal,
  recordParticipantJoinLocal,
} from '@/utils/meetingRejoin';

interface BookingData {
  id: string;
  participants_count?: number | null;
  meeting_started_at?: string | null;
  meeting_ended_at?: string | null;
  status?: string;
  [key: string]: any;
}

export const meetingTrackingService = {
  /**
   * Checks whether a participant has joined this meeting before (local or cached)
   */
  hasJoined(
    bookingId: string,
    participantId?: string | null,
    email?: string | null,
    role?: string | null
  ): boolean {
    if (!bookingId) return false;
    return hasParticipantJoinedLocal(bookingId, participantId, email, role);
  },

  /**
   * Record when a participant joins the meeting room.
   * Records both locally and authoritatively via the server endpoint.
   */
  async recordJoin(
    bookingId: string,
    participantId: string,
    role?: string,
    roomId?: string,
    email?: string | null
  ): Promise<{ success: boolean; hasJoined: boolean; isFirstJoin: boolean }> {
    if (!bookingId) return { success: false, hasJoined: false, isFirstJoin: false };

    // 1. Record immediately in local storage for zero-latency UI consistency
    const previouslyJoinedLocally = hasParticipantJoinedLocal(bookingId, participantId, email, role);
    recordParticipantJoinLocal(bookingId, participantId, email, role);

    // 2. Dispatch to server API
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const response = await fetch('/api/meeting/record-join', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          bookingId,
          roomId: roomId || bookingId,
          role,
          email: email || undefined,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return {
          success: true,
          hasJoined: true,
          isFirstJoin: Boolean(data?.isFirstJoin),
        };
      }
    } catch (err) {
      console.warn('[MeetingTracking] Network error recording join on server:', err);
    }

    return {
      success: true,
      hasJoined: true,
      isFirstJoin: !previouslyJoinedLocally,
    };
  },

  /**
   * Update participant count when someone joins
   */
  async incrementParticipants(bookingId: string): Promise<void> {
    const { data: booking } = await supabase
      .from('bookings')
      .select('participants_count, meeting_started_at')
      .eq('id', bookingId)
      .maybeSingle();

    if (!booking) return;

    const bookingData = booking as BookingData;
    const updates: Record<string, any> = {
      participants_count: (bookingData.participants_count || 0) + 1,
    };

    // Set meeting start time if this is the first participant
    if (!bookingData.meeting_started_at) {
      updates.meeting_started_at = new Date().toISOString();
    }

    await supabase
      .from('bookings')
      .update(updates as any)
      .eq('id', bookingId);
  },

  /**
   * Mark meeting as ended and trigger post-session email if genuinely completed
   */
  async endMeeting(bookingId: string, participantCount: number, durationMinutes?: number): Promise<void> {
    if (!bookingId) return;

    const updates: Record<string, any> = {
      meeting_ended_at: new Date().toISOString(),
      participants_count: participantCount,
    };

    let genuinelyCompleted = false;

    // Check meeting history in Supabase
    const { data: booking } = await supabase
      .from('bookings')
      .select('meeting_started_at, participants_count, status')
      .eq('id', bookingId)
      .maybeSingle();

    const bookingData = (booking as BookingData) || {};
    const effectiveParticipants = Math.max(participantCount, bookingData.participants_count || 0);

    // Calculate duration if start time exists
    let elapsedMinutes = durationMinutes || 0;
    if (!elapsedMinutes && bookingData.meeting_started_at) {
      const startTime = new Date(bookingData.meeting_started_at);
      const endTime = new Date();
      elapsedMinutes = (endTime.getTime() - startTime.getTime()) / (1000 * 60);
    }

    // A meeting is genuinely completed if:
    // 1. Two or more participants joined and session was conducted, OR
    // 2. Already marked completed, OR
    // 3. Lasted a legitimate consultation duration (>= 5 minutes with active participant)
    if ((effectiveParticipants >= 2 && elapsedMinutes >= 3) || elapsedMinutes >= 10 || bookingData.status === 'completed') {
      updates.status = 'completed';
      genuinelyCompleted = true;
    }

    try {
      await supabase
        .from('bookings')
        .update(updates as any)
        .eq('id', bookingId);
    } catch (e) {
      console.warn('[MeetingTracking] Error updating booking end:', e);
    }

    // Send post-session completion email immediately if meeting was genuinely completed
    if (genuinelyCompleted) {
      console.log(`[MeetingTracking] Meeting ${bookingId} genuinely completed. Dispatching post-session email.`);
      emailService.sendSessionCompletedEmail(bookingId).catch((err) => {
        console.warn('[MeetingTracking] Warning sending post-session email:', err);
      });
    }
  },

  /**
   * Explicitly marks a meeting as completed (e.g. from admin panel or explicit end session)
   * and dispatches the post-session email immediately.
   */
  async completeMeeting(bookingId: string): Promise<{ success: boolean; emailSent?: boolean }> {
    if (!bookingId) return { success: false };

    try {
      await supabase
        .from('bookings')
        .update({
          status: 'completed',
          meeting_ended_at: new Date().toISOString(),
        })
        .eq('id', bookingId);

      // Send post-session completion email immediately
      const emailResult = await emailService.sendSessionCompletedEmail(bookingId);
      return { success: true, emailSent: emailResult.success };
    } catch (err) {
      console.error('[MeetingTracking] Error completing meeting:', err);
      return { success: false };
    }
  },

  /**
   * Check if meeting can be rescheduled
   * Returns true if:
   * - Only 1 person joined (no-show from other party)
   * - OR meeting hasn't started yet
   */
  async canReschedule(bookingId: string): Promise<{ canReschedule: boolean; reason?: string }> {
    const { data: booking } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .maybeSingle();

    if (!booking) {
      return { canReschedule: false, reason: 'Booking not found' };
    }

    const bookingData = booking as BookingData;

    // Already completed
    if (bookingData.status === 'completed') {
      return { canReschedule: false, reason: 'Meeting already completed' };
    }

    // Meeting started with 2+ people and lasted 10+ minutes
    const participantCount = bookingData.participants_count || 0;
    const meetingStarted = bookingData.meeting_started_at;
    
    if (participantCount >= 2 && meetingStarted) {
      const startTime = new Date(meetingStarted);
      const now = new Date();
      const durationMinutes = (now.getTime() - startTime.getTime()) / (1000 * 60);

      if (durationMinutes >= 10) {
        return { canReschedule: false, reason: 'Meeting already took place with both parties' };
      }
    }

    // Can reschedule if only 1 person joined (no-show) or meeting hasn't started
    return { canReschedule: true };
  },
};
