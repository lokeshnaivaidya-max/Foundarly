import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import {
  generateUserEmailHTML,
  generateUserEmailText,
  generateConsultantEmailHTML,
  generateConsultantEmailText,
  generateApplicationApprovedEmailHTML,
  generateApplicationApprovedEmailText,
  generateApplicationRejectedEmailHTML,
  generateApplicationRejectedEmailText,
  generateBookingRejectedEmailHTML,
  generateBookingRejectedEmailText,
  EmailBookingData,
  EmailBookingRejectedData,
  EmailApplicationApprovedData,
  EmailApplicationRejectedData,
} from "./src/utils/emailTemplates.js";
import { sendEmail, verifySmtpConnection, getSmtpConfig, getSmtpAuditInfo } from "./src/server/mailer.js";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

function getAdminAllowlist(): string[] {
  const envList =
    process.env.ADMIN_EMAILS ||
    process.env.VITE_ADMIN_EMAILS ||
    process.env.ADMIN_EMAIL ||
    process.env.VITE_ADMIN_EMAIL;

  if (envList && envList.trim()) {
    return envList
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
  }
  return ["admin@foundarly.com"];
}

function isAllowedAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return getAdminAllowlist().includes(email.trim().toLowerCase());
}

const supabaseAdminClient = createClient(
  process.env.VITE_SUPABASE_URL || "https://rfyxnshvtfswvaogjzwq.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_QPkFtczpj8_WzxPf4ZoENw_ZpnfN9vd"
);

// Admin Authorization Middleware for secure server-side admin endpoints
async function requireAdminAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      error: "Unauthorized: Missing or invalid Authorization header.",
    });
  }

  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) {
    return res.status(401).json({
      success: false,
      error: "Unauthorized: Authentication token is missing.",
    });
  }

  try {
    const { data: { user }, error: userError } = await supabaseAdminClient.auth.getUser(token);
    if (userError || !user) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized: Invalid or expired authentication session.",
      });
    }

    const userEmail = (user.email || "").toLowerCase().trim();
    if (!isAllowedAdminEmail(userEmail)) {
      console.warn(`[Security Alert] Non-admin user (${userEmail}) attempted to access protected admin endpoint: ${req.originalUrl}`);
      return res.status(403).json({
        success: false,
        error: "Forbidden: User account does not possess administrator privileges.",
      });
    }

    // Verify role in profiles table
    const { data: profile } = await supabaseAdminClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile || profile.role !== "admin") {
      console.warn(`[Security Alert] User (${userEmail}) lacks database admin role for endpoint: ${req.originalUrl}`);
      return res.status(403).json({
        success: false,
        error: "Forbidden: Administrator role not assigned in database.",
      });
    }

    (req as any).adminUser = user;
    (req as any).adminProfile = profile;
    next();
  } catch (err: any) {
    console.error("[Security] Error during admin authorization:", err);
    return res.status(500).json({
      success: false,
      error: "Internal server error during authorization verification.",
    });
  }
}

const currentDir = typeof __dirname !== "undefined" ? __dirname : process.cwd();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Health Check
  app.get("/api/health", (req, res) => {
    const config = getSmtpConfig();
    res.json({
      status: "ok",
      service: "Foundarly Server",
      emailService: "Titan SMTP (Nodemailer)",
      emailConfigured: Boolean(config.pass),
      smtpHost: config.host,
      smtpPort: config.port,
      smtpUser: config.user,
      fromEmail: config.fromEmail,
      replyTo: config.replyTo,
      timestamp: new Date().toISOString(),
    });
  });

  // Protected Admin API: Verify admin authorization status
  app.get("/api/admin/verify-access", requireAdminAuth, (req, res) => {
    const adminUser = (req as any).adminUser;
    const adminProfile = (req as any).adminProfile;
    res.json({
      success: true,
      authorized: true,
      user: {
        id: adminUser.id,
        email: adminUser.email,
        role: adminProfile.role,
      },
    });
  });

  // Protected Admin API: Secure password change for authenticated admin
  app.post("/api/admin/change-password", requireAdminAuth, async (req, res) => {
    try {
      const adminUser = (req as any).adminUser;
      const { newPassword } = req.body;

      if (!newPassword || typeof newPassword !== "string" || newPassword.length < 8) {
        return res.status(400).json({
          success: false,
          error: "Password must be at least 8 characters long.",
        });
      }

      // If SUPABASE_SERVICE_ROLE_KEY is configured, update securely via Supabase Admin Auth API
      if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
        const { error: updateError } = await supabaseAdminClient.auth.admin.updateUserById(
          adminUser.id,
          { password: newPassword }
        );

        if (updateError) {
          return res.status(500).json({
            success: false,
            error: updateError.message || "Failed to update password via admin auth service.",
          });
        }

        return res.json({
          success: true,
          message: "Admin password updated successfully via Supabase Admin Auth.",
        });
      }

      // If service role key is not configured, admin session authorization was verified
      return res.json({
        success: true,
        verified: true,
        message: "Admin authorization verified successfully.",
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: "Internal server error occurred while processing password change.",
      });
    }
  });

  // API: Verify SMTP Credentials & Handshake
  app.get("/api/verify-smtp", async (req, res) => {
    const config = getSmtpConfig();
    const audit = getSmtpAuditInfo();
    const passLength = config.pass ? config.pass.length : 0;

    if (!config.pass) {
      return res.status(400).json({
        success: false,
        error: "SMTP_PASS environment variable is not configured. Please set SMTP_PASS in server environment variables.",
        diagnostic: "Missing SMTP_PASS environment variable in server environment.",
        audit,
        config: {
          smtpHost: config.host,
          smtpPort: config.port,
          smtpUser: config.user,
          fromEmail: config.fromEmail,
          encryption: config.secure ? "SSL" : "STARTTLS",
          hasSmtpPass: false,
        },
      });
    }

    try {
      const result = await verifySmtpConnection();
      if (result.success) {
        return res.json({
          success: true,
          message: result.message || "SMTP authentication and connection verified successfully!",
          portVerified: result.portVerified,
          targetVerified: result.targetVerified,
          audit: result.audit || audit,
          config: {
            smtpHost: result.configSummary?.activeHost || config.host,
            smtpPort: result.configSummary?.activePort || config.port,
            smtpUser: config.user,
            fromEmail: config.fromEmail,
            encryption: result.configSummary?.activeEncryption || (config.secure ? "SSL" : "STARTTLS"),
            hasSmtpPass: true,
            passLength,
            runtimeEnvironment: audit.runtimeEnvironment,
          },
          attempts: result.attempts,
        });
      } else {
        return res.status(500).json({
          success: false,
          error: result.error || "Failed to authenticate with SMTP server",
          diagnostic: result.diagnostic,
          audit: result.audit || audit,
          config: {
            smtpHost: config.host,
            smtpPort: config.port,
            smtpUser: config.user,
            fromEmail: config.fromEmail,
            encryption: config.secure ? "SSL" : "STARTTLS",
            hasSmtpPass: true,
            passLength,
            runtimeEnvironment: audit.runtimeEnvironment,
          },
          attempts: result.attempts,
        });
      }
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message || "Unexpected error during SMTP verification",
        audit,
      });
    }
  });

  // API Route: Send Test Booking Confirmation Email
  app.post("/api/send-test-email", async (req, res) => {
    try {
      const { recipient } = req.body || {};
      const targetRecipient = (recipient || "hello@foundarlybusinessworld.in").trim();

      const smtpConfig = getSmtpConfig();
      if (!smtpConfig.pass) {
        return res.status(400).json({
          success: false,
          error: "SMTP_PASS environment variable is not configured.",
          diagnostic: "Missing SMTP_PASS environment variable in server environment.",
        });
      }

      const testData: EmailBookingData = {
        bookingId: "test-" + Date.now(),
        userName: "Test User",
        userEmail: targetRecipient,
        consultantName: "Foundarly Team",
        consultantEmail: smtpConfig.fromEmail,
        date: new Date().toISOString().split("T")[0],
        time: "10:00 AM",
        duration: 45,
        meetingLink: `https://foundarly.com/meeting/test-${Date.now()}`,
        meetingRoomId: `test-${Date.now()}`,
        price: 0,
        message: "This is a verification test of the Foundarly booking confirmation email system.",
      };

      const html = generateUserEmailHTML(testData);
      const text = generateUserEmailText(testData);

      const result = await sendEmail({
        from: smtpConfig.defaultFrom,
        to: targetRecipient,
        replyTo: smtpConfig.replyTo,
        subject: "✓ Test Booking Confirmation | Foundarly SMTP Verification",
        html,
        text,
      });

      if (result.success) {
        return res.json({
          success: true,
          message: `Test booking confirmation email sent successfully to ${targetRecipient}!`,
          messageId: result.messageId,
          details: result.details,
        });
      } else {
        return res.status(500).json({
          success: false,
          error: result.error,
          diagnostic: result.diagnostic,
          details: result.details,
        });
      }
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err?.message || "Internal server error sending test email",
      });
    }
  });

  // API Route: Send Booking Confirmation or Rejection Email (to User & Consultant)
  app.post("/api/send-booking-email", async (req, res) => {
    try {
      const { type, bookingId, emailData, reason } = req.body || {};

      if (!bookingId && !emailData) {
        return res.status(400).json({
          success: false,
          error: "Booking ID or email data is required",
        });
      }

      const smtpConfig = getSmtpConfig();
      const siteUrl = (process.env.APP_URL || process.env.SITE_URL || process.env.VITE_SITE_URL || req.headers.origin || `http://localhost:${PORT}`).trim();

      if (!smtpConfig.pass) {
        console.warn("[Server Email] SMTP_PASS is not configured.");
        return res.status(400).json({
          success: false,
          error: "SMTP_PASS is not configured on the server. Please set the SMTP_PASS environment variable (Titan mailbox password).",
          missingConfig: "SMTP_PASS",
        });
      }

      // ── A. REJECTION FLOW ──
      if (type === "rejected") {
        let rejectData: EmailBookingRejectedData = emailData;

        if (!rejectData || !rejectData.userEmail) {
          const supabaseUrl = process.env.VITE_SUPABASE_URL || "https://rfyxnshvtfswvaogjzwq.supabase.co";
          const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_QPkFtczpj8_WzxPf4ZoENw_ZpnfN9vd";

          const fetchRes = await fetch(`${supabaseUrl}/rest/v1/bookings?id=eq.${bookingId}&select=*,consultants(name,email,title)`, {
            headers: {
              "apikey": supabaseKey,
              "Authorization": `Bearer ${supabaseKey}`,
              "Content-Type": "application/json",
            },
          });

          if (!fetchRes.ok) {
            const errText = await fetchRes.text();
            throw new Error(`Failed to fetch booking for rejection: ${errText}`);
          }

          const records = (await fetchRes.json()) as any[];
          const booking = records?.[0];
          if (!booking) {
            return res.status(404).json({ success: false, error: `Booking record ${bookingId} not found` });
          }

          const consultantObj = Array.isArray(booking.consultants) ? booking.consultants[0] : booking.consultants;
          rejectData = {
            bookingId: booking.id,
            userName: booking.name || "Client",
            userEmail: booking.email,
            consultantName: consultantObj?.name || "Consultant",
            date: booking.date,
            time: booking.time || "Flexible",
            reason: reason || booking.rejection_reason || "Unable to confirm consultation booking at this time.",
          };
        }

        if (!rejectData.userEmail || !rejectData.userEmail.includes("@")) {
          return res.status(400).json({
            success: false,
            error: "Recipient email address is invalid or missing.",
          });
        }

        const rejectHtml = generateBookingRejectedEmailHTML(rejectData);
        const rejectText = generateBookingRejectedEmailText(rejectData);
        const rejectSubject = `Consultation Booking Update: ${rejectData.consultantName} | Foundarly`;

        const mailResult = await sendEmail({
          from: smtpConfig.defaultFrom,
          to: rejectData.userEmail,
          replyTo: smtpConfig.replyTo,
          subject: rejectSubject,
          html: rejectHtml,
          text: rejectText,
        });

        if (!mailResult.success) {
          return res.status(500).json({
            success: false,
            error: mailResult.error || "Failed to send rejection email via Titan SMTP",
            diagnostic: mailResult.diagnostic,
            details: mailResult.details,
          });
        }

        return res.json({
          success: true,
          message: "Rejection email sent successfully",
          userEmailId: mailResult.messageId,
          recipient: rejectData.userEmail,
        });
      }

      // ── B. CONFIRMATION FLOW (CLIENT + CONSULTANT) ──
      let dataToSend: EmailBookingData = emailData;

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
      const userText = generateUserEmailText(dataToSend);
      const clientSubject = `Booking Confirmation: Consultation with ${dataToSend.consultantName} | Foundarly`;

      // Send to user via Titan SMTP
      const mailResult = await sendEmail({
        from: smtpConfig.defaultFrom,
        to: dataToSend.userEmail,
        replyTo: smtpConfig.replyTo,
        subject: clientSubject,
        html: userHtml,
        text: userText,
      });

      if (!mailResult.success) {
        return res.status(500).json({
          success: false,
          error: mailResult.error || "Failed to send booking confirmation email via Titan SMTP",
          diagnostic: mailResult.diagnostic,
          details: mailResult.details,
        });
      }

      console.log(`[Server Email] User email sent successfully! Message ID: ${mailResult.messageId}`);

      // Optionally send to consultant if email is present
      let consultantEmailId = null;
      let consultantError = null;
      if (dataToSend.consultantEmail && dataToSend.consultantEmail.includes("@") && dataToSend.consultantEmail !== dataToSend.userEmail) {
        try {
          const consultantHtml = generateConsultantEmailHTML(dataToSend);
          const consultantText = generateConsultantEmailText(dataToSend);
          const consultantSubject = `New Consultation Booked: ${dataToSend.userName} | Foundarly`;

          const consultantMailRes = await sendEmail({
            from: smtpConfig.defaultFrom,
            to: dataToSend.consultantEmail,
            replyTo: smtpConfig.replyTo,
            subject: consultantSubject,
            html: consultantHtml,
            text: consultantText,
          });
          if (consultantMailRes.success) {
            consultantEmailId = consultantMailRes.messageId;
            console.log(`[Server Email] Consultant email sent successfully! Message ID: ${consultantEmailId}`);
          } else {
            consultantError = consultantMailRes.error;
          }
        } catch (consErr: any) {
          console.warn("[Server Email] Consultant email error (non-fatal):", consErr);
          consultantError = consErr?.message;
        }
      }

      return res.json({
        success: true,
        message: "Booking confirmation email sent successfully",
        userEmailId: mailResult.messageId,
        consultantEmailId: consultantEmailId,
        consultantError: consultantError || undefined,
        portUsed: mailResult.portUsed,
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

  // API Route: Send Consultant Application Status Notification (Approved / Rejected) - Admin Protected
  app.post("/api/send-application-email", requireAdminAuth, async (req, res) => {
    try {
      const { type, applicationData } = req.body || {};

      if (!type || !applicationData) {
        return res.status(400).json({
          success: false,
          error: "Application decision type ('approved' | 'rejected') and applicationData are required.",
        });
      }

      const smtpConfig = getSmtpConfig();
      const fromEmail = smtpConfig.defaultFrom; // hello@foundarlybusinessworld.in
      const replyTo = smtpConfig.replyTo;
      const siteUrl = (process.env.APP_URL || process.env.SITE_URL || process.env.VITE_SITE_URL || req.headers.origin || `http://localhost:${PORT}`).trim();

      if (!smtpConfig.pass) {
        console.warn("[Server Email] SMTP_PASS is not configured.");
        return res.status(400).json({
          success: false,
          error: "SMTP_PASS is not configured on the server. Please set the SMTP_PASS environment variable (Titan mailbox password).",
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
      let emailText = "";
      let emailSubject = "";

      if (type === "approved") {
        emailSubject = "Foundarly Consultant Application Approved";
        emailHtml = generateApplicationApprovedEmailHTML({
          ...applicationData,
          dashboardUrl: applicationData.dashboardUrl || siteUrl,
        });
        emailText = generateApplicationApprovedEmailText({
          ...applicationData,
          dashboardUrl: applicationData.dashboardUrl || siteUrl,
        });
      } else if (type === "rejected") {
        emailSubject = "Update regarding your Foundarly Consultant Application";
        emailHtml = generateApplicationRejectedEmailHTML({
          ...applicationData,
          supportUrl: applicationData.supportUrl || siteUrl,
        });
        emailText = generateApplicationRejectedEmailText({
          ...applicationData,
          supportUrl: applicationData.supportUrl || siteUrl,
        });
      } else {
        return res.status(400).json({
          success: false,
          error: `Invalid application notification type: '${type}'. Expected 'approved' or 'rejected'.`,
        });
      }

      const mailResult = await sendEmail({
        from: fromEmail,
        to: recipientEmail,
        replyTo: replyTo,
        subject: emailSubject,
        html: emailHtml,
        text: emailText,
      });

      if (!mailResult.success) {
        return res.status(500).json({
          success: false,
          error: mailResult.error || `Failed to send ${type} email via Titan SMTP`,
          details: mailResult.details,
        });
      }

      return res.json({
        success: true,
        message: `Application ${type} email sent successfully`,
        emailId: mailResult.messageId,
        recipient: recipientEmail,
      });
    } catch (error: any) {
      console.error("[Server Email] Error sending application email:", error);
      return res.status(500).json({
        success: false,
        error: error?.message || "Internal server error while sending application email",
      });
    }
  });

  // Vite middleware for development vs static build for production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(currentDir, "dist");
    app.use(express.static(distPath));
    app.use((req, res, next) => {
      if (req.method === "GET" && !req.path.startsWith("/api")) {
        return res.sendFile(path.join(distPath, "index.html"));
      }
      next();
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Foundarly Server] Running on http://localhost:${PORT}`);
  });
}

startServer();
