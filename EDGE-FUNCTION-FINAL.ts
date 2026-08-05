// FINAL EDGE FUNCTION CODE - USER EMAIL ONLY
// Copy this ENTIRE code to your Supabase Edge Function editor

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "re_gcnxwuHK_26dbVGZiLWyVoFkKdBeU5W9q";
const SITE_URL = Deno.env.get("SITE_URL") || "http://localhost:5173";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sendEmail(to: string, subject: string, html: string) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: "Foundarly <onboarding@resend.dev>",
      to: [to],
      subject,
      html,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to send email: ${error}`);
  }

  return await response.json();
}

function generateUserEmailHTML(data: any): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Booking Confirmed</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #F5A623 0%, #F7B955 100%); padding: 40px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 700;">✓ Booking Confirmed!</h1>
              <p style="margin: 10px 0 0; color: rgba(255,255,255,0.9); font-size: 16px;">Your consultation is scheduled</p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 24px; color: #333333; font-size: 16px;">Hi <strong>${data.userName}</strong>,</p>
              <p style="margin: 0 0 24px; color: #666666; font-size: 15px;">Great news! Your consultation with <strong style="color: #F5A623;">${data.consultantName}</strong> has been confirmed and paid.</p>

              <!-- Session Details -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8f9fa; border-radius: 12px; border: 1px solid #e9ecef; margin: 24px 0;">
                <tr>
                  <td style="padding: 24px;">
                    <h3 style="margin: 0 0 16px; color: #333333; font-size: 18px; font-weight: 600;">📅 Session Details</h3>
                    <table width="100%" cellpadding="8" cellspacing="0">
                      <tr>
                        <td style="color: #666666; font-size: 14px; padding: 8px 0;"><strong>Consultant:</strong></td>
                        <td style="color: #333333; font-size: 14px; text-align: right; padding: 8px 0;">${data.consultantName}</td>
                      </tr>
                      <tr>
                        <td style="color: #666666; font-size: 14px; padding: 8px 0;"><strong>Date:</strong></td>
                        <td style="color: #333333; font-size: 14px; text-align: right; padding: 8px 0;">${new Date(data.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</td>
                      </tr>
                      <tr>
                        <td style="color: #666666; font-size: 14px; padding: 8px 0;"><strong>Time:</strong></td>
                        <td style="color: #333333; font-size: 14px; text-align: right; padding: 8px 0;">${data.time}</td>
                      </tr>
                      <tr>
                        <td style="color: #666666; font-size: 14px; padding: 8px 0;"><strong>Duration:</strong></td>
                        <td style="color: #333333; font-size: 14px; text-align: right; padding: 8px 0;">${data.duration} minutes</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Join Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 32px 0;">
                <tr>
                  <td align="center">
                    <a href="${data.meetingLink}" style="display: inline-block; background: linear-gradient(135deg, #F5A623 0%, #F7B955 100%); color: #ffffff; text-decoration: none; padding: 16px 48px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 12px rgba(245, 166, 35, 0.3);">
                      🎥 Join Meeting
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 24px 0 0; color: #666666; font-size: 14px; text-align: center;">You can join the meeting 5 minutes before the scheduled time</p>

              <!-- Meeting Link -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8f9fa; border-radius: 8px; margin: 24px 0; padding: 16px;">
                <tr>
                  <td>
                    <p style="margin: 0 0 8px; color: #666666; font-size: 12px; text-transform: uppercase;">Meeting Link</p>
                    <a href="${data.meetingLink}" style="color: #F5A623; font-size: 14px; word-break: break-all; text-decoration: none;">${data.meetingLink}</a>
                  </td>
                </tr>
              </table>

              <p style="margin: 24px 0 0; color: #666666; font-size: 14px;">If you have any questions, feel free to reach out to us.</p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f9fa; padding: 24px 40px; text-align: center; border-top: 1px solid #e9ecef;">
              <p style="margin: 0 0 8px; color: #999999; font-size: 13px;">© ${new Date().getFullYear()} Foundarly. All rights reserved.</p>
              <p style="margin: 0; color: #999999; font-size: 12px;">This is an automated email. Please do not reply.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { bookingId } = await req.json();

    if (!bookingId) {
      throw new Error("Booking ID is required");
    }

    // Use SERVICE_ROLE_KEY for full database access
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Get booking details
    const { data: booking, error: bookingError } = await supabaseClient
      .from("bookings")
      .select(`
        *,
        consultants (
          name
        )
      `)
      .eq("id", bookingId)
      .single();

    if (bookingError || !booking) {
      throw new Error(`Booking not found: ${bookingError?.message}`);
    }

    const meetingLink = `${SITE_URL}/meeting/${booking.meeting_room_id}`;

    const emailData = {
      bookingId: booking.id,
      userName: booking.name,
      userEmail: booking.email,
      consultantName: booking.consultants?.name || "Consultant",
      date: booking.date,
      time: booking.time,
      duration: booking.session_duration || 60,
      meetingLink,
    };

    // Send email to user only
    const userEmailResult = await sendEmail(
      emailData.userEmail,
      "✓ Booking Confirmed - Your Consultation is Scheduled",
      generateUserEmailHTML(emailData)
    );

    console.log("User email sent successfully:", userEmailResult);

    return new Response(
      JSON.stringify({
        success: true,
        userEmail: userEmailResult,
        message: "Confirmation email sent to user"
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error sending email:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
