// Supabase Edge Function: send-booking-email
// Serves booking confirmation emails using Resend API

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FROM_EMAIL = Deno.env.get("EMAIL_FROM") || "Foundarly <onboarding@resend.dev>";
const SITE_URL = Deno.env.get("SITE_URL") || "https://foundarly.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function escapeHTML(str: string | null | undefined): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatSessionDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function generateUserEmailHTML(data: {
  userName: string;
  consultantName: string;
  date: string;
  time: string;
  duration: number;
  bookingId: string;
  meetingLink: string;
}): string {
  const formattedDate = formatSessionDate(data.date);
  const timing = data.time && data.time !== "Flexible" ? data.time : "Flexible Time";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Booking Confirmed - Foundarly</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; color: #1e293b;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);">
          <tr>
            <td style="background: linear-gradient(135deg, #F5A623 0%, #D48806 100%); padding: 36px 32px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 26px; font-weight: 700;">✓ Booking Confirmed!</h1>
              <p style="margin: 8px 0 0; color: rgba(255, 255, 255, 0.92); font-size: 15px;">Your consultation session is scheduled</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 36px 32px;">
              <p style="font-size: 16px; margin: 0 0 16px;">Hi <strong>${escapeHTML(data.userName)}</strong>,</p>
              <p style="font-size: 15px; color: #475569; margin: 0 0 24px;">Your consultation with <strong style="color: #D48806;">${escapeHTML(data.consultantName)}</strong> has been confirmed.</p>
              <table width="100%" style="background-color: #fdfbf7; border-radius: 12px; border: 1px solid #fef3c7; margin: 24px 0; padding: 20px;">
                <tr>
                  <td>
                    <h3 style="margin: 0 0 12px; color: #92400e; font-size: 16px;">Session Details</h3>
                    <p style="margin: 6px 0; font-size: 14px;"><strong>Consultant:</strong> ${escapeHTML(data.consultantName)}</p>
                    <p style="margin: 6px 0; font-size: 14px;"><strong>Date:</strong> ${escapeHTML(formattedDate)}</p>
                    <p style="margin: 6px 0; font-size: 14px;"><strong>Time:</strong> ${escapeHTML(timing)}</p>
                    <p style="margin: 6px 0; font-size: 14px;"><strong>Duration:</strong> ${data.duration} Minutes</p>
                    <p style="margin: 6px 0; font-size: 12px; color: #64748b; font-family: monospace;"><strong>Booking ID:</strong> ${data.bookingId}</p>
                  </td>
                </tr>
              </table>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${data.meetingLink}" style="background: linear-gradient(135deg, #F5A623 0%, #D48806 100%); color: #ffffff; text-decoration: none; padding: 14px 36px; border-radius: 8px; font-weight: 600; font-size: 15px; display: inline-block;">
                  Join Video Meeting
                </a>
              </div>
              <p style="font-size: 12px; color: #64748b; text-align: center; margin-top: 10px;">Direct Link: <a href="${data.meetingLink}" style="color: #D48806;">${data.meetingLink}</a></p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; color: #94a3b8; font-size: 12px;">© ${new Date().getFullYear()} Foundarly. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { bookingId, emailData } = await req.json();

    if (!bookingId && !emailData) {
      return new Response(
        JSON.stringify({ success: false, error: "bookingId or emailData is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!RESEND_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: "RESEND_API_KEY environment variable is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let payload = emailData;

    if (!payload || !payload.userEmail) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const { data: booking, error: bookingErr } = await supabase
        .from("bookings")
        .select("*, consultants(name, email, title)")
        .eq("id", bookingId)
        .maybeSingle();

      if (bookingErr || !booking) {
        return new Response(
          JSON.stringify({ success: false, error: bookingErr?.message || "Booking not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const consultantObj = Array.isArray(booking.consultants) ? booking.consultants[0] : booking.consultants;
      const meetingRoomId = booking.meeting_room_id || `foundarly-${booking.id}`;

      payload = {
        bookingId: booking.id,
        userName: booking.name || "Client",
        userEmail: booking.email,
        consultantName: consultantObj?.name || "Consultant",
        consultantEmail: consultantObj?.email || null,
        date: booking.date,
        time: booking.time || "Flexible",
        duration: booking.session_duration || 60,
        meetingLink: `${SITE_URL}/meeting/${meetingRoomId}`,
      };
    }

    if (!payload.userEmail) {
      return new Response(
        JSON.stringify({ success: false, error: "Recipient email is missing" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const html = generateUserEmailHTML(payload);

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [payload.userEmail],
        subject: "✓ Booking Confirmed - Your Consultation is Scheduled | Foundarly",
        html,
      }),
    });

    const resendJson = await resendRes.json();

    if (!resendRes.ok) {
      return new Response(
        JSON.stringify({ success: false, error: resendJson.message || "Failed to send email via Resend" }),
        { status: resendRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: "Email sent successfully", data: resendJson }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
