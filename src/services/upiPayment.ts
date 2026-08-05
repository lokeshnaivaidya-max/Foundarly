import { supabase } from '@/lib/supabase';
import { validateEmail, validateUUID, sanitizeString } from '@/utils/security';

export interface UPIPaymentData {
  booking_id: string;
  user_id: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  transaction_id: string;
  payment_amount: number;
  payment_method?: string;
  consultant_id: string;
  session_duration: number;
  booking_date: string;
  booking_time: string;
  booking_message?: string;
}

export interface UPIPayment {
  id: string;
  booking_id: string;
  user_id: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  transaction_id: string;
  payment_amount: number;
  payment_method: string;
  consultant_id: string;
  session_duration: number;
  booking_date: string;
  booking_time: string;
  booking_message: string | null;
  status: 'pending' | 'verified' | 'rejected';
  admin_notes: string | null;
  verified_by: string | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export const upiPaymentService = {
  /**
   * Create a new UPI payment request
   */
  async createPayment(data: UPIPaymentData): Promise<UPIPayment> {
    // Validate inputs
    if (!validateUUID(data.booking_id)) {
      throw new Error('Invalid booking ID');
    }
    if (!validateUUID(data.user_id)) {
      throw new Error('Invalid user ID');
    }
    if (!validateEmail(data.customer_email)) {
      throw new Error('Invalid email address');
    }
    if (!data.transaction_id || data.transaction_id.trim().length < 5) {
      throw new Error('Invalid transaction ID');
    }
    if (!data.customer_phone || data.customer_phone.trim().length < 10) {
      throw new Error('Invalid phone number');
    }

    const paymentId = crypto.randomUUID();

    // Sanitize inputs
    const sanitizedData = {
      id: paymentId,
      booking_id: data.booking_id,
      user_id: validateUUID(data.user_id) ? data.user_id : null,
      customer_name: sanitizeString(data.customer_name),
      customer_phone: data.customer_phone.trim(),
      customer_email: data.customer_email.toLowerCase().trim(),
      transaction_id: data.transaction_id.trim().toUpperCase(),
      payment_amount: data.payment_amount,
      payment_method: data.payment_method || 'UPI',
      consultant_id: data.consultant_id,
      session_duration: data.session_duration,
      booking_date: data.booking_date,
      booking_time: data.booking_time,
      booking_message: data.booking_message ? sanitizeString(data.booking_message) : null,
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    console.log('[upiPaymentService.createPayment] Inserting payment with explicit ID:', paymentId, sanitizedData);

    let { error } = await supabase
      .from('upi_payments')
      .insert(sanitizedData as any);

    if (error && error.code === '23503' && sanitizedData.user_id) {
      console.warn('[upiPaymentService.createPayment] Foreign key violation on user_id, retrying with user_id = null');
      sanitizedData.user_id = null;
      const retryRes = await supabase.from('upi_payments').insert(sanitizedData as any);
      error = retryRes.error;
    }

    if (error) {
      console.error('[upiPaymentService.createPayment] COMPLETE SUPABASE ERROR OBJECT:', JSON.stringify(error, null, 2), error);
      throw error;
    }

    console.log('[upiPaymentService.createPayment] Payment successfully inserted into Supabase:', paymentId);
    return sanitizedData as unknown as UPIPayment;
  },

  /**
   * Get payment by booking ID
   */
  async getPaymentByBookingId(bookingId: string): Promise<UPIPayment | null> {
    if (!validateUUID(bookingId)) {
      throw new Error('Invalid booking ID');
    }

    const { data, error } = await supabase
      .from('upi_payments')
      .select('*')
      .eq('booking_id', bookingId)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  /**
   * Get all payments for a user
   */
  async getUserPayments(userId: string): Promise<UPIPayment[]> {
    if (!validateUUID(userId)) {
      throw new Error('Invalid user ID');
    }

    const { data, error } = await supabase
      .from('upi_payments')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  /**
   * Get all pending payments (Admin only)
   */
  async getPendingPayments(): Promise<UPIPayment[]> {
    const { data, error } = await supabase
      .from('upi_payments')
      .select(`
        *,
        consultants (
          name,
          title
        )
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  /**
   * Get all payments (Admin only)
   */
  async getAllPayments(): Promise<UPIPayment[]> {
    const { data, error } = await supabase
      .from('upi_payments')
      .select(`
        *,
        consultants (
          name,
          title
        )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  /**
   * Verify payment (Admin only)
   */
  async verifyPayment(
    paymentId: string,
    adminId: string,
    adminNotes?: string
  ): Promise<UPIPayment> {
    if (!validateUUID(paymentId)) {
      throw new Error('Invalid payment ID');
    }
    if (!validateUUID(adminId)) {
      throw new Error('Invalid admin ID');
    }

    const { data, error } = await (supabase
      .from('upi_payments')
      .update({
        status: 'verified',
        verified_by: adminId,
        verified_at: new Date().toISOString(),
        admin_notes: adminNotes ? sanitizeString(adminNotes) : null,
      } as any) as any)
      .eq('id', paymentId)
      .select()
      .maybeSingle();

    if (error) throw error;
    return data as UPIPayment;
  },

  /**
   * Reject payment (Admin only)
   */
  async rejectPayment(
    paymentId: string,
    adminId: string,
    reason: string
  ): Promise<UPIPayment> {
    if (!validateUUID(paymentId)) {
      throw new Error('Invalid payment ID');
    }
    if (!validateUUID(adminId)) {
      throw new Error('Invalid admin ID');
    }
    if (!reason || reason.trim().length < 5) {
      throw new Error('Rejection reason is required');
    }

    const { data, error } = await (supabase
      .from('upi_payments')
      .update({
        status: 'rejected',
        verified_by: adminId,
        verified_at: new Date().toISOString(),
        admin_notes: sanitizeString(reason),
      } as any) as any)
      .eq('id', paymentId)
      .select()
      .maybeSingle();

    if (error) throw error;
    return data as UPIPayment;
  },

  /**
   * Get payment statistics (Admin only)
   */
  async getPaymentStats() {
    const { data, error } = await supabase
      .from('upi_payments')
      .select('status, payment_amount');

    if (error) throw error;

    const payments = data as any[];

    const stats = {
      total: payments.length,
      pending: payments.filter(p => p.status === 'pending').length,
      verified: payments.filter(p => p.status === 'verified').length,
      rejected: payments.filter(p => p.status === 'rejected').length,
      totalAmount: payments
        .filter(p => p.status === 'verified')
        .reduce((sum, p) => sum + Number(p.payment_amount), 0),
    };

    return stats;
  },
};
