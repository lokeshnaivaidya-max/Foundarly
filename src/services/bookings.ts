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
  async getAll() {
    console.log('[BookingsService.getAll] Fetching all bookings from Supabase...');
    const response = await supabase
      .from('bookings')
      .select(`
        *,
        consultants (
          name,
          title
        )
      `, { count: 'exact' })
      .order('created_at', { ascending: false });
    
    console.log('[BookingsService.getAll] Supabase response:', {
      data: response.data,
      error: response.error,
      count: response.count,
      status: response.status,
    });
    
    if (response.error) {
      console.error('[BookingsService.getAll] COMPLETE SUPABASE ERROR OBJECT:', JSON.stringify(response.error, null, 2), response.error);
      throw response.error;
    }

    return response.data || [];
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
