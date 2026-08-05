import { supabase } from '@/lib/supabase';

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
   * Mark meeting as ended
   */
  async endMeeting(bookingId: string, participantCount: number): Promise<void> {
    const updates: Record<string, any> = {
      meeting_ended_at: new Date().toISOString(),
      participants_count: participantCount,
    };

    // If 2+ people joined and meeting lasted 10+ minutes, mark as completed
    const { data: booking } = await supabase
      .from('bookings')
      .select('meeting_started_at')
      .eq('id', bookingId)
      .maybeSingle();

    if (!booking) return;

    const bookingData = booking as BookingData;
    if (bookingData.meeting_started_at && participantCount >= 2) {
      const startTime = new Date(bookingData.meeting_started_at);
      const endTime = new Date();
      const durationMinutes = (endTime.getTime() - startTime.getTime()) / (1000 * 60);

      if (durationMinutes >= 10) {
        updates.status = 'completed';
      }
    }

    await supabase
      .from('bookings')
      .update(updates as any)
      .eq('id', bookingId);
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
