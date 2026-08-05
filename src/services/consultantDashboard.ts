import { supabase } from "@/lib/supabase";

export interface DashboardStats {
  total_bookings: number;
  completed_sessions: number;
  upcoming_sessions: number;
  total_earnings: number;
  pending_earnings: number;
  paid_earnings: number;
  average_rating: number | null;
  total_reviews: number;
}

export interface ConsultantBooking {
  id: string;
  user_id: string;
  date: string;
  time: string;
  status: string;
  session_duration: number;
  meeting_room_id: string;
  consultant_earnings: number;
  payout_status: string;
  reschedule_status: string;
  reschedule_requested_by: string | null;
  reschedule_reason: string | null;
  name: string;
  email: string;
  phone: string;
}

export interface PayoutRequest {
  id: string;
  amount: number;
  status: string;
  payment_method: string;
  payment_details: any;
  requested_at: string;
  processed_at: string | null;
  admin_notes: string | null;
}

export interface EarningsHistory {
  id: string;
  booking_id: string;
  amount: number;
  platform_fee: number;
  net_amount: number;
  earned_at: string;
  booking?: {
    date: string;
    time: string;
    user_name: string;
  };
}

export const consultantDashboardService = {
  // Get dashboard statistics
  async getDashboardStats(userId: string): Promise<DashboardStats | null> {
    try {
      const { data: consultant } = await supabase
        .from("consultants")
        .select("id")
        .eq("user_id", userId)
        .single();

      if (!consultant) return null;

      const { data, error } = await supabase
        .from("consultant_dashboard_stats")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (error) {
        // Handle missing table gracefully
        if (error.code === 'PGRST116' || error.message?.includes('relation "consultant_dashboard_stats" does not exist')) {
          console.warn("Consultant dashboard stats table not found. Database migration needed.");
          // Return default stats
          return {
            total_bookings: 0,
            completed_sessions: 0,
            upcoming_sessions: 0,
            total_earnings: 0,
            pending_earnings: 0,
            paid_earnings: 0,
            average_rating: null,
            total_reviews: 0
          };
        }
        console.error("Error fetching dashboard stats:", error);
        return null;
      }

      return data;
    } catch (error) {
      console.error("Error in getDashboardStats:", error);
      return null;
    }
  },

  // Get consultant's bookings
  async getConsultantBookings(userId: string): Promise<ConsultantBooking[]> {
    const { data: consultant } = await supabase
      .from("consultants")
      .select("id")
      .eq("user_id", userId)
      .single();

    if (!consultant) return [];

    const { data, error } = await supabase
      .from("bookings")
      .select("*")
      .eq("consultant_id", consultant.id)
      .order("date", { ascending: false })
      .order("time", { ascending: false });

    if (error) {
      console.error("Error fetching consultant bookings:", error);
      return [];
    }

    return data || [];
  },

  // Get earnings history
  async getEarningsHistory(userId: string): Promise<EarningsHistory[]> {
    const { data: consultant } = await supabase
      .from("consultants")
      .select("id")
      .eq("user_id", userId)
      .single();

    if (!consultant) return [];

    const { data, error } = await supabase
      .from("consultant_earnings")
      .select(`
        *,
        booking:bookings(date, time, name)
      `)
      .eq("consultant_id", consultant.id)
      .order("earned_at", { ascending: false });

    if (error) {
      console.error("Error fetching earnings history:", error);
      return [];
    }

    return data || [];
  },

  // Create payout request
  async createPayoutRequest(
    userId: string,
    amount: number,
    paymentMethod: string,
    paymentDetails: any
  ): Promise<{ success: boolean; error?: string }> {
    const { data: consultant } = await supabase
      .from("consultants")
      .select("id")
      .eq("user_id", userId)
      .single();

    if (!consultant) {
      return { success: false, error: "Consultant not found" };
    }

    // Check if there's enough pending earnings
    const stats = await this.getDashboardStats(userId);
    if (!stats || stats.pending_earnings < amount) {
      return { success: false, error: "Insufficient pending earnings" };
    }

    const { error } = await supabase.from("payout_requests").insert({
      consultant_id: consultant.id,
      amount,
      payment_method: paymentMethod,
      payment_details: paymentDetails,
      status: "pending",
    });

    if (error) {
      console.error("Error creating payout request:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  },

  // Get payout requests
  async getPayoutRequests(userId: string): Promise<PayoutRequest[]> {
    try {
      const { data: consultant } = await supabase
        .from("consultants")
        .select("id")
        .eq("user_id", userId)
        .single();

      if (!consultant) return [];

      const { data, error } = await supabase
        .from("payout_requests")
        .select("*")
        .eq("consultant_id", consultant.id)
        .order("requested_at", { ascending: false });

      if (error) {
        // Handle missing table gracefully
        if (error.code === 'PGRST116' || error.message?.includes('relation "payout_requests" does not exist')) {
          console.warn("Payout requests table not found. Database migration needed.");
          return [];
        }
        console.error("Error fetching payout requests:", error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error("Error in getPayoutRequests:", error);
      return [];
    }
  },

  // Request reschedule
  async requestReschedule(
    bookingId: string,
    userId: string,
    reason: string,
    newDate: string,
    newTime: string
  ): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase
      .from("bookings")
      .update({
        reschedule_requested_by: userId,
        reschedule_requested_at: new Date().toISOString(),
        reschedule_reason: reason,
        reschedule_status: "requested",
        original_date: supabase.sql`date`,
        original_time: supabase.sql`time`,
      })
      .eq("id", bookingId);

    if (error) {
      console.error("Error requesting reschedule:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  },

  // Approve reschedule (for the other party)
  async approveReschedule(
    bookingId: string,
    newDate: string,
    newTime: string
  ): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase
      .from("bookings")
      .update({
        date: newDate,
        time: newTime,
        reschedule_status: "approved",
        reschedule_count: supabase.sql`reschedule_count + 1`,
      })
      .eq("id", bookingId);

    if (error) {
      console.error("Error approving reschedule:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  },

  // Reject reschedule
  async rejectReschedule(
    bookingId: string
  ): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase
      .from("bookings")
      .update({
        reschedule_status: "rejected",
      })
      .eq("id", bookingId);

    if (error) {
      console.error("Error rejecting reschedule:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  },
};
