import { supabase } from '@/lib/supabase';
import { secureLog, validateEmail, validateUUID } from '@/utils/security';
import { generateUserEmailHTML, generateConsultantEmailHTML, EmailBookingData } from '@/utils/emailTemplates';

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
   * Resilient, multi-layer delivery:
   * 1. Express backend API route (/api/send-booking-email)
   * 2. Supabase Edge Function (send-booking-email)
   * 3. Direct client-side Resend API (if VITE_RESEND_API_KEY configured)
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

      // ── Method 1: Try Server-side API endpoint (/api/send-booking-email) ──
      try {
        console.log('[EmailService] Attempting delivery via server API /api/send-booking-email...');
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
            console.log('[EmailService] Confirmation email sent successfully via server API:', apiResult);
            secureLog.info('Booking confirmation emails sent successfully via Server API');
            return {
              success: true,
              message: 'Confirmation email sent successfully',
              userEmailId: apiResult.userEmailId,
              recipient: emailData.userEmail,
            };
          } else if (apiResult?.missingConfig === 'RESEND_API_KEY') {
            console.warn('[EmailService] Server reported missing RESEND_API_KEY, attempting edge/client fallbacks...');
          } else {
            console.warn('[EmailService] Server API returned error:', apiResult?.error);
          }
        } else if (apiResponse.status !== 404) {
          const errorText = await apiResponse.text();
          console.warn(`[EmailService] Server API responded with status ${apiResponse.status}:`, errorText);
        }
      } catch (serverErr) {
        console.warn('[EmailService] Server API unreachable or threw error:', serverErr);
      }

      // ── Method 2: Try Supabase Edge Function (send-booking-email) ──
      try {
        console.log('[EmailService] Attempting delivery via Supabase Edge Function "send-booking-email"...');
        const { data: { session } } = await supabase.auth.getSession();
        
        const { data: edgeData, error: edgeError } = await supabase.functions.invoke('send-booking-email', {
          body: {
            bookingId: booking.id,
            emailData,
          },
          headers: session ? {
            Authorization: `Bearer ${session.access_token}`,
          } : undefined,
        });

        if (!edgeError && edgeData?.success) {
          console.log('[EmailService] Confirmation email sent successfully via Supabase Edge Function:', edgeData);
          secureLog.info('Booking confirmation emails sent successfully via Edge Function');
          return {
            success: true,
            message: 'Confirmation email sent successfully',
            recipient: emailData.userEmail,
          };
        } else if (edgeError) {
          console.warn('[EmailService] Supabase Edge Function returned error or not found:', edgeError.message);
        }
      } catch (edgeErr) {
        console.warn('[EmailService] Supabase Edge Function invocation failed:', edgeErr);
      }

      // ── Method 3: Direct Client-Side Resend API (if VITE_RESEND_API_KEY available) ──
      const clientResendKey = import.meta.env.VITE_RESEND_API_KEY;
      if (clientResendKey) {
        try {
          console.log('[EmailService] Attempting delivery via client Resend key...');
          const fromEmail = import.meta.env.VITE_EMAIL_FROM || 'Foundarly <onboarding@resend.dev>';
          const userHtml = generateUserEmailHTML(emailData);

          const clientRes = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${clientResendKey}`,
            },
            body: JSON.stringify({
              from: fromEmail,
              to: [emailData.userEmail],
              subject: '✓ Booking Confirmed - Your Consultation is Scheduled | Foundarly',
              html: userHtml,
            }),
          });

          if (clientRes.ok) {
            const clientResult = await clientRes.json();
            console.log('[EmailService] Confirmation email sent successfully via client Resend API:', clientResult);
            return {
              success: true,
              message: 'Confirmation email sent successfully',
              userEmailId: clientResult?.id,
              recipient: emailData.userEmail,
            };
          } else {
            const clientErr = await clientRes.text();
            console.error('[EmailService] Client Resend API error:', clientErr);
          }
        } catch (clientDirectErr: any) {
          console.error('[EmailService] Client direct email dispatch error:', clientDirectErr);
        }
      }

      // If all methods failed:
      const configHelp = 'Email service is not configured. Please set the RESEND_API_KEY environment variable in settings or deploy the Supabase edge function.';
      console.warn(`[EmailService] ${configHelp}`);
      return {
        success: false,
        error: configHelp,
        recipient: emailData.userEmail,
      };

    } catch (error: any) {
      console.error('[EmailService] Unexpected fatal error in sendBookingConfirmation:', error);
      return {
        success: false,
        error: error?.message || 'Unexpected error sending confirmation email',
      };
    }
  },
};
