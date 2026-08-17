import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { generateUserEmailHTML, generateConsultantEmailHTML, EmailBookingData } from "./src/utils/emailTemplates.ts";

const currentDir = typeof __dirname !== "undefined" ? __dirname : process.cwd();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Health Check
  app.get("/api/health", (req, res) => {
    const hasResend = Boolean(process.env.RESEND_API_KEY || process.env.RESEND_KEY || process.env.VITE_RESEND_API_KEY);
    res.json({
      status: "ok",
      service: "Foundarly Server",
      emailConfigured: hasResend,
      timestamp: new Date().toISOString(),
    });
  });

  // API Route: Send Booking Confirmation Email
  app.post("/api/send-booking-email", async (req, res) => {
    try {
      const { bookingId, emailData } = req.body;

      if (!bookingId && !emailData) {
        return res.status(400).json({
          success: false,
          error: "Booking ID or email data is required",
        });
      }

      const resendApiKey = process.env.RESEND_API_KEY || process.env.RESEND_KEY || process.env.VITE_RESEND_API_KEY;
      const fromEmail = process.env.EMAIL_FROM || process.env.VITE_EMAIL_FROM || "Foundarly <onboarding@resend.dev>";
      const siteUrl = process.env.APP_URL || process.env.SITE_URL || process.env.VITE_SITE_URL || req.headers.origin || `http://localhost:${PORT}`;

      if (!resendApiKey) {
        console.warn("[Server Email] RESEND_API_KEY is not configured.");
        return res.status(400).json({
          success: false,
          error: "RESEND_API_KEY is not configured on the server. Please add your Resend API Key in Settings.",
          missingConfig: "RESEND_API_KEY",
        });
      }

      let dataToSend: EmailBookingData = emailData;

      // If data was not directly passed, or missing recipient info, fetch from Supabase
      if (!dataToSend || !dataToSend.userEmail) {
        const supabaseUrl = process.env.VITE_SUPABASE_URL || "https://rfyxnshvtfswvaogjzwq.supabase.co";
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_QPkFtczpj8_WzxPf4ZoENw_ZpnfN9vd";
        
        try {
          const fetchRes = await fetch(`${supabaseUrl}/rest/v1/bookings?id=eq.${bookingId}&select=*,consultants(name,email,title)`, {
            headers: {
              "apikey": supabaseKey,
              "Authorization": `Bearer ${supabaseKey}`,
              "Content-Type": "application/json",
            },
          });

          if (!fetchRes.ok) {
            const errText = await fetchRes.text();
            throw new Error(`Failed to fetch booking: ${errText}`);
          }

          const records = await fetchRes.json();
          const booking = records?.[0];

          if (!booking) {
            return res.status(404).json({
              success: false,
              error: `Booking record ${bookingId} not found`,
            });
          }

          const meetingRoomId = booking.meeting_room_id || `foundarly-${booking.id}`;
          const consultantObj = Array.isArray(booking.consultants) ? booking.consultants[0] : booking.consultants;

          dataToSend = {
            bookingId: booking.id,
            userName: booking.name || "Client",
            userEmail: booking.email,
            consultantName: consultantObj?.name || "Consultant",
            consultantEmail: consultantObj?.email || null,
            date: booking.date,
            time: booking.time || "Flexible",
            duration: booking.session_duration || 60,
            meetingLink: `${siteUrl}/meeting/${meetingRoomId}`,
            meetingRoomId,
            price: booking.session_price,
            message: booking.message,
          };
        } catch (fetchError: any) {
          console.error("[Server Email] Supabase fetch error:", fetchError);
          return res.status(500).json({
            success: false,
            error: `Failed to retrieve booking data: ${fetchError.message}`,
          });
        }
      }

      if (!dataToSend.userEmail || !dataToSend.userEmail.includes("@")) {
        return res.status(400).json({
          success: false,
          error: "Recipient email address is invalid or missing from booking record.",
        });
      }

      console.log(`[Server Email] Sending confirmation email for booking ${dataToSend.bookingId} to ${dataToSend.userEmail}...`);

      const userHtml = generateUserEmailHTML(dataToSend);

      // Send to user via Resend API
      const resendResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [dataToSend.userEmail],
          subject: "✓ Booking Confirmed - Your Consultation is Scheduled | Foundarly",
          html: userHtml,
        }),
      });

      const resendResult = await resendResponse.json();

      if (!resendResponse.ok) {
        console.error("[Server Email] Resend API Error:", resendResult);
        const errMsg = resendResult?.message || resendResult?.error || JSON.stringify(resendResult);
        return res.status(resendResponse.status).json({
          success: false,
          error: `Resend API Error: ${errMsg}`,
          details: resendResult,
        });
      }

      console.log(`[Server Email] User email sent successfully! Resend ID: ${resendResult.id}`);

      // Optionally send to consultant if email is present
      let consultantResendId = null;
      if (dataToSend.consultantEmail && dataToSend.consultantEmail.includes("@") && dataToSend.consultantEmail !== dataToSend.userEmail) {
        try {
          const consultantHtml = generateConsultantEmailHTML(dataToSend);
          const consultantRes = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${resendApiKey}`,
            },
            body: JSON.stringify({
              from: fromEmail,
              to: [dataToSend.consultantEmail],
              subject: `🎉 New Booking Scheduled with ${dataToSend.userName} | Foundarly`,
              html: consultantHtml,
            }),
          });
          if (consultantRes.ok) {
            const consJson = await consultantRes.json();
            consultantResendId = consJson?.id;
            console.log(`[Server Email] Consultant email sent successfully! Resend ID: ${consultantResendId}`);
          }
        } catch (consErr) {
          console.warn("[Server Email] Consultant email error (non-fatal):", consErr);
        }
      }

      return res.json({
        success: true,
        message: "Booking confirmation email sent successfully",
        userEmailId: resendResult.id,
        consultantEmailId: consultantResendId,
        recipient: dataToSend.userEmail,
      });
    } catch (error: any) {
      console.error("[Server Email] Unexpected error sending email:", error);
      return res.status(500).json({
        success: false,
        error: error?.message || "Internal server error while sending email",
      });
    }
  });

  // Vite middleware for development vs static files for production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Foundarly server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
