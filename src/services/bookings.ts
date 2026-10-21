import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/database.types';
import {
  validateUUID,
  validateDate,
  validateTime,
  validateBookingStatus,
  validatePaymentStatus,
  sanitizeString,
  validateEmail,
} from '@/utils/security';

type Booking = Database['public']['Tables']['bookings']['Row'];
type BookingInsert = Database['public']['Tables']['bookings']['Insert'];
type BookingUpdate = Database['public']['Tables']['bookings']['Update'];

export const bookingsService = {
  async getAll(statusFilter?: 'all' | 'pending' | 'confirmed' | 'rejected' | string) {
    console.log(`[BookingsService.getAll] Fetching bookings from Supabase with filter: ${statusFilter || 'all'}...`);
    let rawBookings: any[] = [];
    
    let query = supabase
      .from('bookings')
      .select(`
        *,
        consultants (
          name,
          title,
          email
        )
      `, { count: 'exact' });

    if (statusFilter === 'pending') {
      query = query.eq('status', 'pending').neq('payment_status', 'rejected');
    } else if (statusFilter === 'confirmed') {
      query = query.in('status', ['confirmed', 'completed']).neq('payment_status', 'rejected');
    } else if (statusFilter === 'rejected') {
      query = query.or('status.in.(rejected,cancelled),payment_status.eq.rejected');
    }
    
    const response = await query.order('created_at', { ascending: false });
    
    if (response.error) {
      console.warn('[BookingsService.getAll] Joined query failed, attempting flat select fallback:', response.error);
      let fallbackQuery = supabase
        .from('bookings')
        .select('*');

      if (statusFilter === 'pending') {
        fallbackQuery = fallbackQuery.eq('status', 'pending').neq('payment_status', 'rejected');
      } else if (statusFilter === 'confirmed') {
        fallbackQuery = fallbackQuery.in('status', ['confirmed', 'completed']).neq('payment_status', 'rejected');
      } else if (statusFilter === 'rejected') {
        fallbackQuery = fallbackQuery.or('status.in.(rejected,cancelled),payment_status.eq.rejected');
      }

      const fallbackResponse = await fallbackQuery.order('created_at', { ascending: false });

      if (fallbackResponse.error) {
        console.error('[BookingsService.getAll] Flat select fallback also failed:', fallbackResponse.error);
        throw fallbackResponse.error;
      }
      rawBookings = fallbackResponse.data || [];
    } else {
      rawBookings = response.data || [];
    }

    console.log('[BookingsService.getAll] Fetched bookings count:', rawBookings.length);

    // Normalize consultant objects (handling both single object and array return formats from PostgREST)
    return rawBookings.map((b: any) => {
      let consultantObj = b.consultants;
      if (Array.isArray(consultantObj)) {
        consultantObj = consultantObj[0] || null;
      }
      return {
        ...b,
        status: (b.status || 'pending').toLowerCase().trim(),
        payment_status: (b.payment_status || 'pending').toLowerCase().trim(),
        consultants: consultantObj,
      };
    });
  },

  async getById(id: string) {
    if (!validateUUID(id)) {
      throw new Error('Invalid booking ID');
    }

    console.log('[BookingsService.getById] Fetching booking by ID:', id);

    const { data, error } = await supabase
      .from('bookings')
      .select(`
        *,
        consultants (
          name,
          title
        )
      `)
      .eq('id', id)
      .maybeSingle();

    console.log('[BookingsService.getById] Supabase response:', { data, error });

    if (error) {
      console.error('[BookingsService.getById] COMPLETE SUPABASE ERROR OBJECT:', JSON.stringify(error, null, 2), error);
      throw error;
    }

    return data;
  },

  async getByUserId(userId: string, email?: string) {
    if (!validateUUID(userId)) {
      throw new Error('Invalid user ID');
    }

    console.log('[BookingsService.getByUserId] Fetching bookings for user ID:', userId, 'email:', email);

    const { data: byUserId, error: err1 } = await supabase
      .from('bookings')
      .select(`
        *,
        consultants (
          name,
          title
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    let byEmail: any[] = [];
    if (email) {
      const { data: emailData } = await supabase
        .from('bookings')
        .select(`
          *,
          consultants (
            name,
            title
          )
        `)
        .eq('email', email.toLowerCase().trim())
        .order('created_at', { ascending: false });
      byEmail = emailData || [];
    }

    if (err1 && !byEmail.length) {
      console.error('[BookingsService.getByUserId] COMPLETE SUPABASE ERROR OBJECT:', JSON.stringify(err1, null, 2), err1);
    }

    const map = new Map<string, any>();
    (byUserId || []).forEach(b => map.set(b.id, b));
    byEmail.forEach(b => map.set(b.id, b));

    return Array.from(map.values()).sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  },

  async create(booking: BookingInsert) {
    console.log('[BookingsService.create] --- START BOOKING CREATION ---');
    console.log('[BookingsService.create] Raw input:', booking);

    if (!validateEmail(booking.email)) {
      throw new Error('Invalid email address');
    }

    const validConsultantId = validateUUID(booking.consultant_id) ? booking.consultant_id : null;
    if (!validConsultantId) {
      throw new Error('Invalid consultant ID');
    }

    const newBookingId = booking.id || crypto.randomUUID();

    // Prepare payload
    const sanitizedBooking = {
      id: newBookingId,
      user_id: validateUUID(booking.user_id || '') ? booking.user_id : null,
      consultant_id: validConsultantId,
      name: sanitizeString(booking.name),
      email: booking.email.toLowerCase().trim(),
      date: booking.date,
      time: booking.time || 'Flexible',
      message: booking.message ? sanitizeString(booking.message) : null,
      session_duration: booking.session_duration || 60,
      session_price: booking.session_price ?? 699,
      status: booking.status || 'pending',
      payment_status: booking.payment_status || 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    console.log('[BookingsService.create] Executing supabase.from("bookings").insert with explicit ID:', newBookingId, sanitizedBooking);

    // Perform INSERT without .select() so RLS SELECT policy won't block unauthenticated creators
    let { error } = await supabase
      .from('bookings')
      .insert(sanitizedBooking);

    console.log('[BookingsService.create] First insert result error:', error);

    // If failed due to ANY constraint/policy error with user_id, retry with user_id = null
    if (error && sanitizedBooking.user_id) {
      console.warn('[BookingsService.create] Insert failed with user_id:', sanitizedBooking.user_id, 'Error:', error, '. Retrying insert with user_id = null...');
      sanitizedBooking.user_id = null;
      const retryResult = await supabase
        .from('bookings')
        .insert(sanitizedBooking);
      error = retryResult.error;
      console.log('[BookingsService.create] Retry insert result error:', error);
    }

    if (error) {
      console.error('[BookingsService.create] COMPLETE SUPABASE ERROR OBJECT:', JSON.stringify(error, null, 2), error);
      throw new Error(error.message || `Failed to insert booking into database (Code: ${error.code})`);
    }

    console.log('[BookingsService.create] Booking successfully inserted into Supabase with ID:', newBookingId);
    return sanitizedBooking as Booking;
  },

  async update(id: string, updates: BookingUpdate) {
    if (!validateUUID(id)) {
      throw new Error('Invalid booking ID');
    }

    console.log('[BookingsService.update] Updating booking ID:', id, 'with updates:', updates);

    const { data, error } = await supabase
      .from('bookings')
      .update(updates)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) {
      console.error('[BookingsService.update] COMPLETE SUPABASE ERROR OBJECT:', JSON.stringify(error, null, 2), error);
      throw error;
    }

    return data as Booking;
  },

  async delete(id: string) {
    if (!validateUUID(id)) {
      throw new Error('Invalid booking ID');
    }

    console.log('[BookingsService.delete] Deleting booking ID:', id);

    const { error } = await supabase
      .from('bookings')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[BookingsService.delete] COMPLETE SUPABASE ERROR OBJECT:', JSON.stringify(error, null, 2), error);
      throw error;
    }
  },

  async updateStatus(id: string, status: Booking['status']) {
    if (!validateBookingStatus(status)) {
      throw new Error('Invalid booking status');
    }
    return this.update(id, { status });
  },

  async updatePaymentStatus(id: string, paymentStatus: Booking['payment_status']) {
    if (!validatePaymentStatus(paymentStatus)) {
      throw new Error('Invalid payment status');
    }
    return this.update(id, { payment_status: paymentStatus });
  },

  /**
   * Request a reschedule for a booking.
   * Preserves existing consultant approval workflow: does NOT directly change confirmed booking date/time.
   * Tries server proxy /api/bookings/reschedule-request first, with fallback to Supabase RLS.
   */
  async requestReschedule(params: {
    bookingId: string;
    newDate: string;
    newTime: string;
    reason: string;
  }): Promise<{ success: boolean; booking?: any; error?: string; code?: string; message?: string }> {
    const { bookingId, newDate, newTime, reason } = params;

    if (!validateUUID(bookingId)) {
      return { success: false, error: 'Invalid booking ID', code: 'INVALID_ID' };
    }
    if (!validateDate(newDate)) {
      return { success: false, error: 'Invalid date format (must be YYYY-MM-DD)', code: 'INVALID_DATE' };
    }
    if (!newTime || typeof newTime !== 'string') {
      return { success: false, error: 'Invalid time format', code: 'INVALID_TIME' };
    }
    if (!reason || !reason.trim()) {
      return { success: false, error: 'A reason for rescheduling is required', code: 'MISSING_REASON' };
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    const user = sessionData?.session?.user;

    // Attempt 1: Server proxy route /api/bookings/reschedule-request
    if (token) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000);

        const response = await fetch('/api/bookings/reschedule-request', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            bookingId,
            newDate,
            newTime,
            reason: reason.trim(),
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        const resData = await response.json().catch(() => null);
        if (response.ok && resData?.success) {
          return resData;
        }
        if (resData && !resData.success) {
          return { success: false, error: resData.error, code: resData.code };
        }
      } catch {
        // Fall through to direct Supabase client call
      }
    }

    // Attempt 2: Direct Supabase client update using RLS
    try {
      const { data: booking, error: bErr } = await supabase
        .from('bookings')
        .select('*')
        .eq('id', bookingId)
        .maybeSingle();

      if (bErr || !booking) {
        return { success: false, error: 'Original booking record not found.', code: 'BOOKING_NOT_FOUND' };
      }

      if (booking.reschedule_status === 'requested' || booking.reschedule_status === 'pending') {
        return {
          success: false,
          error: 'A reschedule request is already pending consultant approval.',
          code: 'DUPLICATE_REQUEST',
        };
      }

      const formattedReason = `Proposed: ${newDate} at ${newTime} | Reason: ${reason.trim()}`;
      const payload: any = {
        reschedule_requested_by: user?.id || null,
        reschedule_requested_at: new Date().toISOString(),
        reschedule_reason: formattedReason,
        reschedule_status: 'requested',
        original_date: booking.date,
        original_time: booking.time,
        updated_at: new Date().toISOString(),
      };

      const { data: updated, error: updErr } = await (supabase as any)
        .from('bookings')
        .update(payload)
        .eq('id', bookingId)
        .select()
        .single();

      if (updErr) {
        // Retry with minimal payload if table lacks some newer columns
        console.warn('[BookingsService.requestReschedule] Primary update failed, trying minimal payload:', updErr);
        const minimalPayload: any = {
          reschedule_reason: formattedReason,
          reschedule_status: 'requested',
          updated_at: new Date().toISOString(),
        };
        const { data: minUpdated, error: minErr } = await (supabase as any)
          .from('bookings')
          .update(minimalPayload)
          .eq('id', bookingId)
          .select()
          .single();

        if (minErr) {
          return { success: false, error: updErr.message || minErr.message, code: updErr.code };
        }
        return { success: true, booking: minUpdated, message: 'Reschedule request sent to consultant!' };
      }

      return { success: true, booking: updated, message: 'Reschedule request sent to consultant!' };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to submit reschedule request.', code: 'UNKNOWN_ERROR' };
    }
  },

  async reschedule(id: string, newDate: string, newTime: string) {
    if (!validateDate(newDate) || !validateTime(newTime)) {
      throw new Error('Invalid date or time format');
    }
    return this.update(id, { 
      date: newDate, 
      time: newTime,
      status: 'confirmed'
    });
  },
};
