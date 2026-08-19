import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import {
  generateUserEmailHTML,
  generateConsultantEmailHTML,
  generateApplicationApprovedEmailHTML,
  generateApplicationRejectedEmailHTML,
  EmailBookingData,
  EmailApplicationApprovedData,
  EmailApplicationRejectedData,
} from "./src/utils/emailTemplates.ts";
import { sendEmail, verifySmtpConnection } from "./src/server/mailer.ts";

dotenv.config();

const currentDir = typeof __dirname !== "undefined" ? __dirname : process.cwd();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Health Check
  app.get("/api/health", (req, res) => {
    const hasSmtp = Boolean(process.env.SMTP_PASS);
    res.json({
      status: "ok",
      service: "Foundarly Server",
      emailService: "Gmail SMTP (Nodemailer)",
      emailConfigured: hasSmtp,
      smtpHost: process.env.SMTP_HOST || "smtp.gmail.com",
      smtpPort: parseInt(process.env.SMTP_PORT || "587", 10),
      smtpUser: process.env.SMTP_USER || "officialfoundarly@gmail.com",
      timestamp: new Date().toISOString(),
    });
  });

  // API Route: Verify SMTP Connection
  app.get("/api/verify-smtp", async (req, res) => {
    try {
      const result = await verifySmtpConnection();
      if (result.success) {
        return res.json({
          success: true,
          message: "Gmail SMTP connection verified successfully over TLS.",
        });
      } else {
        return res.status(500).json({
          success: false,
          error: result.error || "SMTP verification failed",
        });
      }
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err?.message || "Internal error verifying SMTP",
      });
    }
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

      const fromEmail = (process.env.EMAIL_FROM || "Foundarly <officialfoundarly@gmail.com>").trim();
      const siteUrl = (process.env.APP_URL || process.env.SITE_URL || process.env.VITE_SITE_URL || req.headers.origin || `http://localhost:${PORT}`).trim();

      if (!process.env.SMTP_PASS) {
        console.warn("[Server Email] SMTP_PASS is not configured.");
        return res.status(400).json({
          success: false,
          error: "SMTP_PASS is not configured on the server. Please set the SMTP_PASS environment variable (Google App Password).",
          missingConfig: "SMTP_PASS",
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

      // Send to user via Gmail SMTP
      const mailResult = await sendEmail({
        from: fromEmail,
        to: dataToSend.userEmail,
        subject: "✓ Booking Confirmed - Your Consultation is Scheduled | Foundarly",
        html: userHtml,
      });

      if (!mailResult.success) {
        return res.status(500).json({
          success: false,
          error: mailResult.error || "Failed to send booking confirmation email via Gmail SMTP",
          details: mailResult.details,
        });
      }

      console.log(`[Server Email] User email sent successfully! Message ID: ${mailResult.messageId}`);

      // Optionally send to consultant if email is present
      let consultantEmailId = null;
      if (dataToSend.consultantEmail && dataToSend.consultantEmail.includes("@") && dataToSend.consultantEmail !== dataToSend.userEmail) {
        try {
          const consultantHtml = generateConsultantEmailHTML(dataToSend);
          const consultantMailRes = await sendEmail({
            from: fromEmail,
            to: dataToSend.consultantEmail,
            subject: `🎉 New Booking Scheduled with ${dataToSend.userName} | Foundarly`,
            html: consultantHtml,
          });
          if (consultantMailRes.success) {
            consultantEmailId = consultantMailRes.messageId;
            console.log(`[Server Email] Consultant email sent successfully! Message ID: ${consultantEmailId}`);
          }
        } catch (consErr) {
          console.warn("[Server Email] Consultant email error (non-fatal):", consErr);
        }
      }

      return res.json({
        success: true,
        message: "Booking confirmation email sent successfully",
        userEmailId: mailResult.messageId,
        consultantEmailId: consultantEmailId,
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

  // API Route: Send Consultant Application Status Notification (Approved / Rejected)
  app.post("/api/send-application-email", async (req, res) => {
    try {
      const { type, applicationData } = req.body || {};

      if (!type || !applicationData) {
        return res.status(400).json({
          success: false,
          error: "Application decision type ('approved' | 'rejected') and applicationData are required.",
        });
      }

      const fromEmail = (process.env.EMAIL_FROM || "Foundarly <officialfoundarly@gmail.com>").trim();
      const siteUrl = (process.env.APP_URL || process.env.SITE_URL || process.env.VITE_SITE_URL || req.headers.origin || `http://localhost:${PORT}`).trim();

      if (!process.env.SMTP_PASS) {
        console.warn("[Server Email] SMTP_PASS is not configured.");
        return res.status(400).json({
          success: false,
          error: "SMTP_PASS is not configured on the server. Please set the SMTP_PASS environment variable (Google App Password).",
          missingConfig: "SMTP_PASS",
        });
      }

      const recipientEmail = applicationData.applicantEmail?.toLowerCase().trim();
      if (!recipientEmail || !recipientEmail.includes("@")) {
        return res.status(400).json({
          success: false,
          error: "Valid applicant email address is required.",
        });
      }

      let emailHtml = "";
      let emailSubject = "";

      if (type === "approved") {
        emailSubject = "🎉 Your Foundarly Consultant Application has been APPROVED!";
        emailHtml = generateApplicationApprovedEmailHTML({
          ...applicationData,
          dashboardUrl: applicationData.dashboardUrl || siteUrl,
        });
      } else if (type === "rejected") {
        emailSubject = "Update regarding your Foundarly Consultant Application";
        emailHtml = generateApplicationRejectedEmailHTML({
          ...applicationData,
          supportUrl: applicationData.supportUrl || siteUrl,
        });
      } else {
        return res.status(400).json({
          success: false,
          error: `Invalid application notification type: '${type}'. Expected 'approved' or 'rejected'.`,
        });
      }

      console.log(`[Server Email] Dispatching ${type} notification to applicant ${recipientEmail}...`);

      const mailResult = await sendEmail({
        from: fromEmail,
        to: recipientEmail,
        subject: emailSubject,
        html: emailHtml,
      });

      if (!mailResult.success) {
        return res.status(500).json({
          success: false,
          error: mailResult.error || `Failed to send ${type} email via Gmail SMTP`,
          details: mailResult.details,
        });
      }

      console.log(`[Server Email] Application ${type} email sent successfully! Message ID: ${mailResult.messageId}`);

      return res.json({
        success: true,
        message: `Application ${type} email sent successfully`,
        emailId: mailResult.messageId,
        recipient: recipientEmail,
      });
    } catch (error: any) {
      console.error("[Server Email] Unexpected error sending application notification email:", error);
      return res.status(500).json({
        success: false,
        error: error?.message || "Internal server error while sending application email",
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
