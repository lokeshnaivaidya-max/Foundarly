import { supabase } from "@/lib/supabase";

export interface ConsultantEarnings {
  total_earnings: number;
  available_balance: number;
  withdrawn_amount: number;
  pending_payouts: number;
  completed_bookings: number;
  upcoming_bookings: number;
}

export interface PayoutRequest {
  id: string;
  consultant_id: string;
  amount: number;
  payment_method: string;
  payment_details: any;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  admin_notes?: string;
  requested_at: string;
  processed_at?: string;
  processed_by?: string;
}

export interface EarningsHistory {
  id: string;
  consultant_id: string;
  booking_id: string;
  amount: number;
  platform_fee: number;
  net_amount: number;
  status: string;
  earned_at: string;
  bookings?: {
    name: string;
    date: string;
    time: string;
  };
}

export const consultantService = {
  // Get consultant earnings summary
  async getEarnings(consultantId: string): Promise<ConsultantEarnings> {
    const { data, error } = await supabase.rpc('calculate_consultant_earnings', {
      consultant_uuid: consultantId
    });

    if (error) throw error;
    return data[0] || {
      total_earnings: 0,
      available_balance: 0,
      withdrawn_amount: 0,
      pending_payouts: 0,
      completed_bookings: 0,
      upcoming_bookings: 0
    };
  },

  // Get consultant's bookings
  async getConsultantBookings(consultantId: string) {
    const { data, error } = await supabase
      .from('bookings')
      .select(`
        *,
        profiles:user_id (
          full_name,
          email,
          avatar_url
        )
      `)
      .eq('consultant_id', consultantId)
      .order('date', { ascending: true })
      .order('time', { ascending: true });

    if (error) throw error;
    return data;
  },

  // Get earnings history
  async getEarningsHistory(consultantId: string): Promise<EarningsHistory[]> {
    const { data, error } = await supabase
      .from('earnings_history')
      .select(`
        *,
        bookings (
          name,
          date,
          time
        )
      `)
      .eq('consultant_id', consultantId)
      .order('earned_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Create payout request
  async createPayoutRequest(
    consultantId: string,
    amount: number,
    paymentMethod: string,
    paymentDetails: any
  ): Promise<PayoutRequest> {
    const { data, error } = await supabase
      .from('payout_requests')
      .insert({
        consultant_id: consultantId,
        amount,
        payment_method: paymentMethod,
        payment_details: paymentDetails,
        status: 'pending'
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Get payout requests
  async getPayoutRequests(consultantId: string): Promise<PayoutRequest[]> {
    const { data, error } = await supabase
      .from('payout_requests')
      .select('*')
      .eq('consultant_id', consultantId)
      .order('requested_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Get all payout requests (admin)
  async getAllPayoutRequests(): Promise<PayoutRequest[]> {
    const { data, error } = await supabase
      .from('payout_requests')
      .select(`
        *,
        profiles:consultant_id (
          full_name,
          email
        )
      `)
      .order('requested_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Approve payout request (admin)
  async approvePayoutRequest(requestId: string, adminId: string) {
    const { error } = await supabase.rpc('approve_payout_request', {
      request_uuid: requestId,
      admin_uuid: adminId
    });

    if (error) throw error;
  },

  // Reject payout request (admin)
  async rejectPayoutRequest(requestId: string, adminNotes: string) {
    const { error } = await supabase
      .from('payout_requests')
      .update({
        status: 'rejected',
        admin_notes: adminNotes,
        processed_at: new Date().toISOString()
      })
      .eq('id', requestId);

    if (error) throw error;
  },

  // Request reschedule
  async requestReschedule(
    bookingId: string,
    userId: string,
    newDate: string,
    newTime: string,
    reason: string
  ) {
    // Get current booking details
    const { data: booking, error: fetchError } = await supabase
      .from('bookings')
      .select('date, time')
      .eq('id', bookingId)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!booking) throw new Error('Booking not found');

    // Update booking with reschedule request
    const { error } = await supabase
      .from('bookings')
      .update({
        original_date: booking.date,
        original_time: booking.time,
        date: newDate,
        time: newTime,
        reschedule_requested_by: userId,
        reschedule_reason: reason,
        reschedule_status: 'pending',
        reschedule_count: booking.reschedule_count || 0 + 1
      })
      .eq('id', bookingId);

    if (error) throw error;
  },

  // Approve reschedule
  async approveReschedule(bookingId: string) {
    const { error } = await supabase
      .from('bookings')
      .update({
        reschedule_status: 'approved',
        original_date: null,
        original_time: null
      })
      .eq('id', bookingId);

    if (error) throw error;
  },

  // Reject reschedule
  async rejectReschedule(bookingId: string) {
    // Get original date/time
    const { data: booking, error: fetchError } = await supabase
      .from('bookings')
      .select('original_date, original_time')
      .eq('id', bookingId)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!booking) throw new Error('Booking not found');

    // Restore original date/time
    const { error } = await supabase
      .from('bookings')
      .update({
        date: booking.original_date,
        time: booking.original_time,
        reschedule_status: 'rejected',
        original_date: null,
        original_time: null,
        reschedule_requested_by: null,
        reschedule_reason: null
      })
      .eq('id', bookingId);

    if (error) throw error;
  },

  // Mark booking as completed and process earnings
  async completeBooking(bookingId: string) {
    // Update booking status
    const { error: updateError } = await supabase
      .from('bookings')
      .update({ status: 'completed' })
      .eq('id', bookingId);

    if (updateError) throw updateError;

    // Process earnings
    const { error: earningsError } = await supabase.rpc('process_booking_completion', {
      booking_uuid: bookingId
    });

    if (earningsError) throw earningsError;
  }
};
