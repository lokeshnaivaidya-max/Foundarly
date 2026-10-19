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
  consultant_name?: string;
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

export type UserIdentifier = { id: string; email?: string | null } | string;

function parseUserIdentifier(userParam: UserIdentifier): { userId: string; userEmail: string } {
  if (typeof userParam === "string") {
    return { userId: userParam, userEmail: "" };
  }
  return {
    userId: userParam.id,
    userEmail: (userParam.email || "").toLowerCase().trim(),
  };
}

async function getConsultant(userParam: UserIdentifier): Promise<{ id: string; name: string; email: string | null; user_id: string | null } | null> {
  const { userId, userEmail } = parseUserIdentifier(userParam);

  // 1. Try server API /api/consultant/me first (authoritative & auto-links)
  try {
    const session = (await supabase.auth.getSession()).data.session;
    if (session?.access_token) {
      const res = await fetch("/api/consultant/me", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success && json?.consultant) {
        return json.consultant;
      }
    }
  } catch (apiErr) {
    console.warn("[consultantDashboardService] API /api/consultant/me check error:", apiErr);
  }

  // 2. Direct Supabase query fallback (matching by user_id OR email)
  try {
    let query = supabase.from("consultants").select("id, name, email, user_id, is_active").eq("is_active", true);
    if (userEmail) {
      query = query.or(`user_id.eq.${userId},email.ilike.${userEmail}`);
    } else {
      query = query.eq("user_id", userId);
    }

    const { data: consultants, error } = await query.limit(1);
    if (!error && consultants && consultants.length > 0) {
      const c = consultants[0];
      if (c.user_id !== userId) {
        supabase.from("consultants").update({ user_id: userId }).eq("id", c.id).then();
      }
      return c;
    }
  } catch (dbErr) {
    console.error("[consultantDashboardService] Error looking up consultant in Supabase:", dbErr);
  }

  return null;
}

export const consultantDashboardService = {
  // Get linked consultant record for the user
  async getConsultantProfile(userParam: UserIdentifier) {
    return getConsultant(userParam);
  },

  // Get dashboard statistics
  async getDashboardStats(userParam: UserIdentifier): Promise<DashboardStats | null> {
    // 1. Try server API /api/consultant/stats first
    try {
      const session = (await supabase.auth.getSession()).data.session;
      if (session?.access_token) {
        const res = await fetch("/api/consultant/stats", {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });
        const json = await res.json().catch(() => null);
        if (res.ok && json?.success && json?.stats) {
          return json.stats;
        }
      }
    } catch (apiErr) {
      console.warn("[consultantDashboardService] Server stats endpoint error, falling back:", apiErr);
    }

    // 2. Fallback: calculate dynamically from bookings
    try {
      const consultant = await getConsultant(userParam);
      if (!consultant) return null;

      const bookings = await this.getConsultantBookings(userParam);
      const totalBookings = bookings.length;
      const completedSessions = bookings.filter((b) => b.status === "completed").length;
      const upcomingSessions = bookings.filter((b) => b.status === "confirmed").length;

      let totalEarnings = 0;
      let pendingEarnings = 0;
      let paidEarnings = 0;

      for (const b of bookings) {
        if (b.status === "completed") {
          const earnings = b.consultant_earnings || (b.session_duration ? 800 : 0);
          totalEarnings += earnings;
          if (b.payout_status === "paid") {
            paidEarnings += earnings;
          } else {
            pendingEarnings += earnings;
          }
        }
      }

      return {
        total_bookings: totalBookings,
        completed_sessions: completedSessions,
        upcoming_sessions: upcomingSessions,
        total_earnings: totalEarnings,
        pending_earnings: pendingEarnings,
        paid_earnings: paidEarnings,
        average_rating: completedSessions > 0 ? 5.0 : null,
        total_reviews: completedSessions,
      };
    } catch (error) {
      console.error("Error in getDashboardStats:", error);
      return {
        total_bookings: 0,
        completed_sessions: 0,
        upcoming_sessions: 0,
        total_earnings: 0,
        pending_earnings: 0,
        paid_earnings: 0,
        average_rating: null,
        total_reviews: 0,
      };
    }
  },

  // Get consultant's bookings
  async getConsultantBookings(userParam: UserIdentifier): Promise<ConsultantBooking[]> {
    // 1. Try server API /api/consultant/bookings first
    try {
      const session = (await supabase.auth.getSession()).data.session;
      if (session?.access_token) {
        const res = await fetch("/api/consultant/bookings", {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });
        const json = await res.json().catch(() => null);
        if (res.ok && json?.success && Array.isArray(json?.bookings)) {
          return json.bookings;
        }
      }
    } catch (apiErr) {
      console.warn("[consultantDashboardService] API /api/consultant/bookings error, falling back to direct query:", apiErr);
    }

    // 2. Direct Supabase query fallback
    const consultant = await getConsultant(userParam);
    if (!consultant) return [];

    const { data, error } = await supabase
      .from("bookings")
      .select("*")
      .eq("consultant_id", consultant.id)
      .order("date", { ascending: false })
      .order("time", { ascending: false });

    if (error) {
      console.error("Error fetching consultant bookings from Supabase:", error);
      return [];
    }

    return (data || []).map((b: any) => ({
      ...b,
      meeting_room_id: b.meeting_room_id || (b.id ? (b.id.startsWith("foundarly-") ? b.id : `foundarly-${b.id}`) : ""),
      consultant_name: consultant.name,
      consultant_earnings: b.consultant_earnings ?? (b.session_price ? Math.round(b.session_price * 0.8) : 0),
      payout_status: b.payout_status || "pending",
      reschedule_status: b.reschedule_status || "none",
    }));
  },

  // Get earnings history
  async getEarningsHistory(userParam: UserIdentifier): Promise<EarningsHistory[]> {
    const consultant = await getConsultant(userParam);
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
    userParam: UserIdentifier,
    amount: number,
    paymentMethod: string,
    paymentDetails: any
  ): Promise<{ success: boolean; error?: string }> {
    const consultant = await getConsultant(userParam);
    if (!consultant) {
      return { success: false, error: "Consultant not found" };
    }

    // Check if there's enough pending earnings
    const stats = await this.getDashboardStats(userParam);
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
  async getPayoutRequests(userParam: UserIdentifier): Promise<PayoutRequest[]> {
    try {
      const consultant = await getConsultant(userParam);
      if (!consultant) return [];

      const { data, error } = await supabase
        .from("payout_requests")
        .select("*")
        .eq("consultant_id", consultant.id)
        .order("requested_at", { ascending: false });

      if (error) {
        if (error.code === 'PGRST116' || error.message?.includes('relation "payout_requests" does not exist')) {
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
    // Read original values first
    const { data: existing } = await supabase
      .from("bookings")
      .select("date, time")
      .eq("id", bookingId)
      .maybeSingle();

    const { error } = await supabase
      .from("bookings")
      .update({
        reschedule_requested_by: userId,
        reschedule_requested_at: new Date().toISOString(),
        reschedule_reason: reason,
        reschedule_status: "requested",
        original_date: existing?.date || null,
        original_time: existing?.time || null,
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
    const { data: existing } = await supabase
      .from("bookings")
      .select("reschedule_count")
      .eq("id", bookingId)
      .maybeSingle();

    const currentCount = existing?.reschedule_count || 0;

    const { error } = await supabase
      .from("bookings")
      .update({
        date: newDate,
        time: newTime,
        reschedule_status: "approved",
        reschedule_count: currentCount + 1,
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
