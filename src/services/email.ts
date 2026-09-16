import { supabase } from '@/lib/supabase';
import { secureLog, validateEmail, validateUUID } from '@/utils/security';
import {
  EmailBookingData,
  EmailApplicationApprovedData,
  EmailApplicationRejectedData,
} from '@/utils/emailTemplates';

export interface EmailSendResult {
  success: boolean;
  error?: string;
  message?: string;
  userEmailId?: string;
  recipient?: string;
}

export const emailService = {
  /**
   * Send booking confirmation emails to user (and consultant)
   * Dispatches via server-side Titan SMTP endpoint (/api/send-booking-email)
   *
   * @param bookingId - The booking ID to send emails for
   * @returns Promise with success status and informative error/message
   */
  async sendBookingConfirmation(bookingId: string): Promise<EmailSendResult> {
    try {
      console.log(`[EmailService] Preparing confirmation email for booking: ${bookingId}`);

      if (!validateUUID(bookingId)) {
        console.warn(`[EmailService] Non-UUID or custom booking ID format: ${bookingId}`);
      }

      // Step 1: Fetch booking & consultant details from Supabase to construct complete email payload
      const { data: booking, error: fetchError } = await supabase
        .from('bookings')
        .select(`
          *,
          consultants (
            name,
            email,
            title
          )
        `)
        .eq('id', bookingId)
        .maybeSingle();

      if (fetchError || !booking) {
        const errorMsg = fetchError?.message || `Booking record ${bookingId} not found in database.`;
        console.error('[EmailService] Failed to load booking for email:', errorMsg);
        return { success: false, error: errorMsg };
      }

      if (!booking.email || !validateEmail(booking.email)) {
        const errorMsg = `Recipient email address "${booking.email || ''}" is invalid in booking record.`;
        console.error('[EmailService]', errorMsg);
        return { success: false, error: errorMsg };
      }

      const consultantObj = Array.isArray(booking.consultants) ? (booking.consultants[0] as any) : booking.consultants;
      const siteUrl = typeof window !== 'undefined' ? window.location.origin : (import.meta.env.VITE_SITE_URL || '');
      const meetingRoomId = booking.meeting_room_id || `foundarly-${booking.id}`;
      const meetingLink = `${siteUrl}/meeting/${meetingRoomId}`;

      const emailData: EmailBookingData = {
        bookingId: booking.id,
        userName: booking.name || 'Client',
        userEmail: booking.email.toLowerCase().trim(),
        consultantName: consultantObj?.name || 'Consultant',
        consultantEmail: consultantObj?.email || null,
        date: booking.date,
        time: booking.time || 'Flexible',
        duration: booking.session_duration || 60,
        meetingLink,
        meetingRoomId,
        price: booking.session_price ?? undefined,
        message: booking.message,
      };

      let lastServerError: string | undefined;

      // ── Primary Delivery via Server-side Titan SMTP (/api/send-booking-email) ──
      try {
        console.log('[EmailService] Dispatching confirmation email via /api/send-booking-email...');
        const apiResponse = await fetch('/api/send-booking-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            bookingId: booking.id,
            emailData,
          }),
        });

        if (apiResponse.ok) {
          const apiResult = await apiResponse.json();
          if (apiResult?.success) {
            console.log('[EmailService] Confirmation email sent successfully via server Titan SMTP:', apiResult);
            secureLog.info('Booking confirmation email sent successfully via server Titan SMTP');
            return {
              success: true,
              message: 'Confirmation email sent successfully',
              userEmailId: apiResult.userEmailId,
              recipient: emailData.userEmail,
            };
          } else {
            lastServerError = apiResult?.error;
            console.warn('[EmailService] Server SMTP returned error:', apiResult?.error);
          }
        } else {
          try {
            const errJson = await apiResponse.json();
            lastServerError = errJson?.error || errJson?.message;
          } catch {
            const errorText = await apiResponse.text();
            if (errorText && errorText.length < 200 && !errorText.includes('<!doctype')) {
              lastServerError = errorText;
            }
          }
          console.warn(`[EmailService] Server SMTP API status ${apiResponse.status}:`, lastServerError);
        }
      } catch (serverErr: any) {
        lastServerError = serverErr?.message || 'Server SMTP API unreachable';
        console.warn('[EmailService] Server SMTP API unreachable:', serverErr);
      }

      const configHelp = lastServerError || 'Email service is not configured. Please ensure SMTP_PASS is set in server environment variables.';
      console.warn(`[EmailService] ${configHelp}`);
      return {
        success: false,
        error: configHelp,
        recipient: emailData.userEmail,
      };

    } catch (error: any) {
      console.error('[EmailService] Fatal error in sendBookingConfirmation:', error);
      return {
        success: false,
        error: error?.message || 'Unexpected error sending confirmation email',
      };
    }
  },

  /**
   * Send application approval notification email to consultant applicant
   */
  async sendApplicationApproval(data: EmailApplicationApprovedData): Promise<EmailSendResult> {
    try {
      console.log(`[EmailService] Dispatching application APPROVAL email to: ${data.applicantEmail}`);

      if (!data.applicantEmail || !validateEmail(data.applicantEmail)) {
        return { success: false, error: `Invalid applicant email address: ${data.applicantEmail}` };
      }

      const siteUrl = typeof window !== 'undefined' ? window.location.origin : (import.meta.env.VITE_SITE_URL || 'https://foundarly.com');
      const payload: EmailApplicationApprovedData = {
        ...data,
        dashboardUrl: data.dashboardUrl || siteUrl,
      };

      let lastServerError: string | undefined;

      try {
        const { data: { session } } = await supabase.auth.getSession();
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (session?.access_token) {
          headers['Authorization'] = `Bearer ${session.access_token}`;
        }

        const apiResponse = await fetch('/api/send-application-email', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            type: 'approved',
            applicationData: payload,
          }),
        });

        if (apiResponse.ok) {
          const apiResult = await apiResponse.json();
          if (apiResult?.success) {
            console.log('[EmailService] Application approval email sent via Server Titan SMTP:', apiResult);
            return {
              success: true,
              message: 'Application approval email sent successfully',
              userEmailId: apiResult.emailId,
              recipient: payload.applicantEmail,
            };
          } else {
            lastServerError = apiResult?.error;
          }
        } else {
          try {
            const errJson = await apiResponse.json();
            lastServerError = errJson?.error || errJson?.message;
          } catch {
            const errorText = await apiResponse.text();
            if (errorText && errorText.length < 200 && !errorText.includes('<!doctype')) {
              lastServerError = errorText;
            }
          }
        }
      } catch (serverErr) {
        console.warn('[EmailService] Server API call for application approval failed:', serverErr);
      }

      return {
        success: false,
        error: lastServerError || 'Email service could not dispatch approval notification. Please verify SMTP_PASS configuration.',
        recipient: payload.applicantEmail,
      };
    } catch (error: any) {
      console.error('[EmailService] Fatal error sending approval email:', error);
      return { success: false, error: error?.message || 'Error sending approval email' };
    }
  },

  /**
   * Send application rejection notification email to consultant applicant
   */
  async sendApplicationRejection(data: EmailApplicationRejectedData): Promise<EmailSendResult> {
    try {
      console.log(`[EmailService] Dispatching application REJECTION email to: ${data.applicantEmail}`);

      if (!data.applicantEmail || !validateEmail(data.applicantEmail)) {
        return { success: false, error: `Invalid applicant email address: ${data.applicantEmail}` };
      }

      const siteUrl = typeof window !== 'undefined' ? window.location.origin : (import.meta.env.VITE_SITE_URL || 'https://foundarly.com');
      const payload: EmailApplicationRejectedData = {
        ...data,
        supportUrl: data.supportUrl || siteUrl,
      };

      let lastServerError: string | undefined;

      try {
        const { data: { session } } = await supabase.auth.getSession();
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (session?.access_token) {
          headers['Authorization'] = `Bearer ${session.access_token}`;
        }

        const apiResponse = await fetch('/api/send-application-email', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            type: 'rejected',
            applicationData: payload,
          }),
        });

        if (apiResponse.ok) {
          const apiResult = await apiResponse.json();
          if (apiResult?.success) {
            console.log('[EmailService] Application rejection email sent via Server Titan SMTP:', apiResult);
            return {
              success: true,
              message: 'Application rejection email sent successfully',
              userEmailId: apiResult.emailId,
              recipient: payload.applicantEmail,
            };
          } else {
            lastServerError = apiResult?.error;
          }
        } else {
          try {
            const errJson = await apiResponse.json();
            lastServerError = errJson?.error || errJson?.message;
          } catch {
            const errorText = await apiResponse.text();
            if (errorText && errorText.length < 200 && !errorText.includes('<!doctype')) {
              lastServerError = errorText;
            }
          }
        }
      } catch (serverErr) {
        console.warn('[EmailService] Server API call for application rejection failed:', serverErr);
      }

      return {
        success: false,
        error: lastServerError || 'Email service could not dispatch rejection notification. Please verify SMTP_PASS configuration.',
        recipient: payload.applicantEmail,
      };
    } catch (error: any) {
      console.error('[EmailService] Fatal error sending rejection email:', error);
      return { success: false, error: error?.message || 'Error sending rejection email' };
    }
  },

  /**
   * Send booking rejection/cancellation notification email to attendee
   */
  async sendBookingRejection(bookingId: string, reason?: string): Promise<EmailSendResult> {
    try {
      console.log(`[EmailService] Preparing booking rejection email for booking: ${bookingId}`);

      const { data: booking, error: fetchError } = await supabase
        .from('bookings')
        .select(`
          *,
          consultants (
            name,
            email,
            title
          )
        `)
        .eq('id', bookingId)
        .maybeSingle();

      if (fetchError || !booking) {
        const errorMsg = fetchError?.message || `Booking record ${bookingId} not found in database.`;
        return { success: false, error: errorMsg };
      }

      if (!booking.email || !validateEmail(booking.email)) {
        return { success: false, error: 'Recipient email address is invalid in booking record.' };
      }

      const consultantObj = Array.isArray(booking.consultants) ? booking.consultants[0] : booking.consultants;

      const rejectionData = {
        bookingId: booking.id,
        userName: booking.name || 'Client',
        userEmail: booking.email.toLowerCase().trim(),
        consultantName: consultantObj?.name || 'Consultant',
        date: booking.date,
        time: booking.time || 'Flexible',
        reason: reason || booking.rejection_reason || 'Unable to confirm consultation booking at this time.',
      };

      try {
        const apiResponse = await fetch('/api/send-booking-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'rejected',
            bookingId: booking.id,
            emailData: rejectionData,
            reason: rejectionData.reason,
          }),
        });

        if (apiResponse.ok) {
          const apiResult = await apiResponse.json();
          if (apiResult?.success) {
            return {
              success: true,
              message: 'Booking rejection email sent successfully',
              userEmailId: apiResult.userEmailId,
              recipient: rejectionData.userEmail,
            };
          } else {
            return { success: false, error: apiResult?.error || 'Failed to send rejection email' };
          }
        } else {
          let errMessage: string | undefined;
          try {
            const errJson = await apiResponse.json();
            errMessage = errJson?.error || errJson?.message;
          } catch {
            const errText = await apiResponse.text();
            if (errText && errText.length < 200 && !errText.includes('<!doctype')) {
              errMessage = errText;
            }
          }
          return { success: false, error: errMessage || `Server returned ${apiResponse.status}` };
        }
      } catch (networkErr: any) {
        return { success: false, error: networkErr?.message || 'Network error reaching email server' };
      }
    } catch (error: any) {
      console.error('[EmailService] Fatal error in sendBookingRejection:', error);
      return { success: false, error: error?.message || 'Unexpected error sending rejection email' };
    }
  },
};
