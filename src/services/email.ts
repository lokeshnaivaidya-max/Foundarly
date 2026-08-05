import { supabase } from '@/lib/supabase';
import { secureLog } from '@/utils/security';

export const emailService = {
  /**
   * Send booking confirmation emails to both user and consultant
   * @param bookingId - The booking ID to send emails for
   * @returns Promise with success status
   */
  async sendBookingConfirmation(bookingId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Get current session for authentication
      const { data: { session } } = await supabase.auth.getSession();
      
      // Check if edge function is deployed
      const { data, error } = await supabase.functions.invoke('send-booking-email', {
        body: { bookingId },
        headers: session ? {
          Authorization: `Bearer ${session.access_token}`,
        } : undefined,
      });

      if (error) {
        console.error('Error invoking email function:', error);
        return { success: false, error: error.message };
      }

      if (!data?.success) {
        console.error('Email function returned error:', data?.error);
        // Show the actual error from the edge function
        return { success: false, error: data?.error || 'Failed to send emails' };
      }

      secureLog.info('Booking confirmation emails sent successfully');
      return { success: true };
    } catch (error: any) {
      console.error('Failed to send booking emails:', error);
      return { success: false, error: error.message };
    }
  },
};
