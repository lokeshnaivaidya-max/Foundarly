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
  generateFollowUpRequestedEmailHTML,
  generateFollowUpRequestedEmailText,
  generateFollowUpAlternativeEmailHTML,
  generateFollowUpAlternativeEmailText,
  generateFollowUpConfirmedEmailHTML,
  generateFollowUpConfirmedEmailText,
  generateFollowUpDeclinedEmailHTML,
  generateFollowUpDeclinedEmailText,
  generateParticipantWaitingEmailHTML,
  generateParticipantWaitingEmailText,
  generateSessionCompletedEmailHTML,
  generateSessionCompletedEmailText,
  EmailBookingData,
  EmailBookingRejectedData,
  EmailApplicationApprovedData,
  EmailApplicationRejectedData,
  EmailParticipantWaitingData,
  EmailSessionCompletedData,
} from "./src/utils/emailTemplates.js";
import { sendEmail, verifySmtpConnection, getSmtpConfig, getSmtpAuditInfo } from "./src/server/mailer.js";
import { createClient } from "@supabase/supabase-js";
import {
  calculateRejoinEligibility,
  validateParticipantAccess,
  parseSessionTimes,
  validateFollowUpTiming,
  checkBookingFollowUpEligibility,
  formatRejoinExpiryDateTime,
  FollowUpRequest,
} from "./src/utils/meetingRejoin.js";
import { followUpStorage } from "./src/server/followUpStorage.js";
import { completionEmailStorage } from "./src/server/completionEmailStorage.js";
import { meetingParticipantStorage } from "./src/server/meetingParticipantStorage.js";

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

  app.set("trust proxy", 1);
  app.use(express.json({ limit: "1mb" }));

  // Global Security & Defense Headers Middleware
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(self), microphone=(self), display-capture=(self), geolocation=(self)");
    if (process.env.NODE_ENV === "production") {
      res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
    }
    next();
  });

  // Global Multi-Bucket Rate Limiter
  const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
  function checkRateLimit(key: string, limit: number, windowMs: number): { allowed: boolean; retryAfter: number } {
    const now = Date.now();
    const record = rateLimitStore.get(key);
    if (!record || now > record.resetAt) {
      rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
      return { allowed: true, retryAfter: 0 };
    }
    if (record.count >= limit) {
      const retryAfter = Math.ceil((record.resetAt - now) / 1000);
      return { allowed: false, retryAfter };
    }
    record.count += 1;
    return { allowed: true, retryAfter: 0 };
  }

  // Periodic cleanup of stale rate-limit keys
  setInterval(() => {
    const now = Date.now();
    for (const [key, val] of rateLimitStore.entries()) {
      if (now > val.resetAt) {
        rateLimitStore.delete(key);
      }
    }
  }, 120000);

  // Rate Limiting Middleware Factory
  function createRateLimiter(actionName: string, limit: number, windowMs: number) {
    return (req: express.Request, res: express.Response, next: express.NextFunction) => {
      const clientIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || req.socket.remoteAddress || "unknown_ip";
      const key = `${actionName}:${clientIp}`;
      const { allowed, retryAfter } = checkRateLimit(key, limit, windowMs);
      if (!allowed) {
        res.setHeader("Retry-After", String(retryAfter));
        return res.status(429).json({
          success: false,
          error: "Too many requests. Please slow down and try again.",
          code: "RATE_LIMITED",
          retryAfter,
        });
      }
      next();
    };
  }

  // Apply rate limiter to sensitive email and booking endpoints
  app.use("/api/send-booking-email", createRateLimiter("send_booking_email", 30, 60000));
  app.use("/api/send-test-email", createRateLimiter("send_test_email", 10, 60000));
  app.use("/api/verify-smtp", createRateLimiter("verify_smtp", 20, 60000));
  app.use("/api/follow-ups/request", createRateLimiter("followup_request", 20, 60000));

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

  // Rate Limiting helper for meeting access validation to prevent room ID guessing
  const meetingRateLimits = new Map<string, { count: number; resetAt: number }>();
  function checkMeetingRateLimit(key: string, limit: number = 60, windowMs: number = 60000): boolean {
    const now = Date.now();
    const record = meetingRateLimits.get(key);
    if (!record || now > record.resetAt) {
      meetingRateLimits.set(key, { count: 1, resetAt: now + windowMs });
      return true;
    }
    if (record.count >= limit) {
      return false;
    }
    record.count += 1;
    return true;
  }

  // Authentication helper for authenticated users (clients, consultants, admins)
  async function authenticateSessionUser(req: express.Request): Promise<{ user: any; error?: string; status?: number }> {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return { error: "Unauthorized: Missing or invalid Authorization header.", status: 401, user: null };
    }
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) {
      return { error: "Unauthorized: Missing authentication token.", status: 401, user: null };
    }
    try {
      const { data: { user }, error: userError } = await supabaseAdminClient.auth.getUser(token);
      if (userError || !user) {
        return { error: "Unauthorized: Invalid or expired authentication session.", status: 401, user: null };
      }
      return { user };
    } catch (err: any) {
      return { error: "Internal authentication verification error.", status: 500, user: null };
    }
  }

  // Core handler: Authoritative Server-Side Meeting Access & 7-Day Rejoin Validator
  async function handleMeetingAccessValidation(roomId: string | undefined, req: express.Request, res: express.Response) {
    const ip = req.ip || req.socket.remoteAddress || "client_unknown";
    if (!checkMeetingRateLimit(`meeting_rate_${ip}`, 60, 60000)) {
      return res.status(429).json({
        success: false,
        error: "Too many requests. Please slow down and try again.",
        code: "RATE_LIMITED",
      });
    }

    const auth = await authenticateSessionUser(req);
    if (auth.error || !auth.user) {
      return res.status(auth.status || 401).json({
        success: false,
        error: auth.error || "Authentication required to access meeting room.",
        code: "UNAUTHENTICATED",
      });
    }

    const user = auth.user;
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '').trim();

    // Clean and normalize roomId: extract room ID if full URL, strip query params and trailing slashes
    let cleanRoomId = (roomId || "").trim();
    if (cleanRoomId.includes('/meeting/')) {
      cleanRoomId = cleanRoomId.split('/meeting/').pop() || cleanRoomId;
    }
    cleanRoomId = cleanRoomId.split('?')[0].split('#')[0].replace(/\/+$/, '').trim();

    if (!cleanRoomId || cleanRoomId.length > 255) {
      return res.status(400).json({
        success: false,
        error: "Valid meeting room ID is required.",
        code: "INVALID_ROOM_ID",
      });
    }

    try {
      const rawBookingId = cleanRoomId.startsWith("foundarly-") ? cleanRoomId.replace("foundarly-", "") : cleanRoomId;
      const prefixedRoomId = cleanRoomId.startsWith("foundarly-") ? cleanRoomId : `foundarly-${cleanRoomId}`;
      const isRawUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawBookingId);
      const isCleanUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanRoomId);

      // If SUPABASE_SERVICE_ROLE_KEY is available, use supabaseAdminClient (bypasses RLS).
      // Otherwise, create a client scoped with the authenticated user's bearer token so RLS allows reading their booking.
      const clientToUse = (process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY.trim())
        ? supabaseAdminClient
        : createClient(
            process.env.VITE_SUPABASE_URL || "https://rfyxnshvtfswvaogjzwq.supabase.co",
            process.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_QPkFtczpj8_WzxPf4ZoENw_ZpnfN9vd",
            {
              global: {
                headers: token ? { Authorization: `Bearer ${token}` } : {},
              },
              auth: {
                persistSession: false,
                autoRefreshToken: false,
              },
            }
          );

      // Build flexible OR filter matching room ID variants and booking UUID
      const orFilters: string[] = [
        `meeting_room_id.eq.${cleanRoomId}`,
        `meeting_room_id.eq.${prefixedRoomId}`,
        `meeting_room_id.eq.${rawBookingId}`,
      ];
      if (isRawUuid) {
        orFilters.push(`id.eq.${rawBookingId}`);
      }
      if (isCleanUuid && cleanRoomId !== rawBookingId) {
        orFilters.push(`id.eq.${cleanRoomId}`);
      }

      let bookings: any[] | null = null;
      let bookingError: any = null;

      // 1. Prioritize SECURITY DEFINER RPC lookup
      try {
        const { data: rpcData, error: rpcError } = await clientToUse
          .rpc('lookup_meeting_room', { p_room_id: cleanRoomId });
        if (!rpcError && Array.isArray(rpcData) && rpcData.length > 0) {
          const row = rpcData[0];
          bookings = [{
            ...row,
            consultants: (row.consultant_name || row.consultant_email || row.consultant_user_id) ? {
              id: row.consultant_id,
              name: row.consultant_name,
              email: row.consultant_email,
              title: row.consultant_title,
              user_id: row.consultant_user_id,
            } : undefined,
          }];
        }
      } catch {
        // Non-blocking
      }

      if (!bookings || bookings.length === 0) {
        // Query booking and linked consultant details
        const baseQuery = clientToUse
          .from("bookings")
          .select("*, consultants(id, name, title, email, user_id)");

        const baseRes = await baseQuery.or(orFilters.join(",")).limit(1);
        bookings = baseRes.data;
        bookingError = baseRes.error;

        // Fallback: If joined query errored or returned empty, try flat bookings select
        if (bookingError || !bookings || bookings.length === 0) {
          const flatQuery = clientToUse.from("bookings").select("*");
          const flatResult = await flatQuery.or(orFilters.join(",")).limit(1);
          if (flatResult.data && flatResult.data.length > 0) {
            bookings = flatResult.data;
            bookingError = null;
          }
        }

        if ((bookingError || !bookings || bookings.length === 0) && user?.email) {
          const userEmailClean = user.email.toLowerCase().trim();
          // Check if client email matches
          const emailQuery = supabaseAdminClient
            .from("bookings")
            .select("*, consultants(id, name, title, email, user_id)")
            .eq("email", userEmailClean);
          const emailResult = await emailQuery.or(orFilters.join(",")).limit(1);
          if (emailResult.data && emailResult.data.length > 0) {
            bookings = emailResult.data;
            bookingError = null;
          } else {
            // Check if consultant email or user_id matches
            const { data: matchedCons } = await supabaseAdminClient
              .from("consultants")
              .select("id, name, title, email, user_id")
              .or(`user_id.eq.${user.id},email.ilike.${userEmailClean}`)
              .limit(1);

            if (matchedCons && matchedCons.length > 0) {
              const consId = matchedCons[0].id;
              const consQuery = supabaseAdminClient
                .from("bookings")
                .select("*, consultants(id, name, title, email, user_id)")
                .eq("consultant_id", consId);
              const consResult = await consQuery.or(orFilters.join(",")).limit(1);
              if (consResult.data && consResult.data.length > 0) {
                bookings = consResult.data;
                bookingError = null;
                // Self-heal consultant user_id if needed
                if (matchedCons[0].user_id !== user.id) {
                  supabaseAdminClient
                    .from("consultants")
                    .update({ user_id: user.id })
                    .eq("id", consId)
                    .then();
                }
              }
            }
          }
        }
      }

      if (bookingError) {
        console.error("[Meeting Server] Database fetch error:", bookingError);
        return res.status(500).json({
          success: false,
          error: "Failed to verify meeting session due to a database error.",
          code: "DATABASE_ERROR",
        });
      }

      const booking = bookings?.[0];
      if (!booking) {
        return res.status(404).json({
          success: false,
          error: "Meeting session not found or invalid meeting link.",
          code: "ROOM_NOT_FOUND",
        });
      }

      let consultantObj = Array.isArray(booking.consultants)
        ? booking.consultants[0]
        : booking.consultants;

      // Fallback: direct consultant lookup if relationship was not auto-joined
      if (!consultantObj && booking.consultant_id) {
        const { data: directConsultant } = await supabaseAdminClient
          .from("consultants")
          .select("id, name, title, email, user_id")
          .eq("id", booking.consultant_id)
          .maybeSingle();
        if (directConsultant) {
          consultantObj = directConsultant;
        }
      }

      const isAdmin = isAllowedAdminEmail(user.email);
      const authResult = validateParticipantAccess(user, booking, consultantObj, isAdmin);

      if (!authResult.authorized) {
        return res.status(403).json({
          success: false,
          error: authResult.reason || "You are not authorized to access this meeting room.",
          code: authResult.code || "UNAUTHORIZED_PARTICIPANT",
        });
      }

      // Authoritative server-side 7-day eligibility calculation
      const serverNow = new Date();
      const eligibility = calculateRejoinEligibility(booking, serverNow);
      const timing = parseSessionTimes(booking);

      if (eligibility.sessionStatus === "expired") {
        return res.status(403).json({
          success: false,
          error: "The 7-day follow-up rejoin window for this consultation has expired.",
          code: "REJOIN_EXPIRED",
          sessionStatus: "expired",
          canJoin: false,
          isRejoin: false,
          timing: {
            scheduledStart: timing.scheduledStart.toISOString(),
            scheduledEnd: timing.scheduledEnd.toISOString(),
            rejoinDeadline: eligibility.rejoinDeadline.toISOString(),
            rejoinTimeRemainingMs: 0,
            rejoinDaysRemaining: 0,
            serverTime: serverNow.toISOString(),
          },
        });
      }

      const followUp = await followUpStorage.getLatestByBookingId(booking.id);

      const participantIdentifier = (user.id || user.email || 'unknown').trim().toLowerCase();
      const hasJoined = meetingParticipantStorage.hasJoined(booking.id, participantIdentifier, authResult.role);
      const participantHistory = meetingParticipantStorage.getParticipantHistory(booking.id, participantIdentifier, authResult.role);

      return res.json({
        success: true,
        authorized: true,
        canJoin: eligibility.canJoin,
        hasJoined: Boolean(hasJoined),
        isRejoin: Boolean(hasJoined),
        isRejoinWindow: eligibility.isRejoin,
        sessionStatus: eligibility.sessionStatus,
        participantHistory,
        role: authResult.role,
        booking: {
          id: booking.id,
          meeting_room_id: booking.meeting_room_id || cleanRoomId,
          user_id: booking.user_id,
          consultant_id: booking.consultant_id,
          date: booking.date,
          time: booking.time,
          session_duration: booking.session_duration || 60,
          status: booking.status,
          name: booking.name,
          email: booking.email,
          consultants: consultantObj ? {
            name: consultantObj.name,
            title: consultantObj.title,
            user_id: consultantObj.user_id,
          } : undefined,
        },
        followUp: followUp || null,
        timing: {
          scheduledStart: timing.scheduledStart.toISOString(),
          scheduledEnd: timing.scheduledEnd.toISOString(),
          rejoinDeadline: eligibility.rejoinDeadline.toISOString(),
          rejoinTimeRemainingMs: eligibility.rejoinTimeRemainingMs,
          rejoinDaysRemaining: eligibility.rejoinDaysRemaining,
          timeUntilStartMs: eligibility.timeUntilStartMs,
          serverTime: serverNow.toISOString(),
        },
      });
    } catch (err: any) {
      console.error("[Meeting Server] Unexpected validation error:", err);
      return res.status(500).json({
        success: false,
        error: "Internal server error occurred while verifying meeting session.",
        code: "INTERNAL_ERROR",
      });
    }
  }

  // API Endpoints: Meeting Access & Rejoin Validation
  app.post("/api/meeting/validate-access", (req, res) => {
    handleMeetingAccessValidation(req.body?.roomId, req, res);
  });

  app.get("/api/meeting/:roomId/access", (req, res) => {
    handleMeetingAccessValidation(req.params.roomId, req, res);
  });

  // API Endpoint: Record participant join event
  app.post("/api/meeting/record-join", async (req, res) => {
    const auth = await authenticateSessionUser(req);
    if (!auth.user) {
      return res.status(auth.status || 401).json({
        success: false,
        error: auth.error || "Authentication required.",
        code: "UNAUTHENTICATED",
      });
    }

    const { roomId, bookingId, role } = req.body || {};
    const targetRoomOrId = (bookingId || roomId || '').trim();
    if (!targetRoomOrId) {
      return res.status(400).json({
        success: false,
        error: "Room ID or Booking ID is required.",
        code: "MISSING_ID",
      });
    }

    try {
      const cleanBookingId = targetRoomOrId.replace(/^foundarly-/, '');
      const participantIdentifier = (auth.user.id || auth.user.email || 'unknown').trim().toLowerCase();

      // Record join in server storage
      const userEmail = auth.user.email ? auth.user.email.trim().toLowerCase() : undefined;
      const result = meetingParticipantStorage.recordJoin(cleanBookingId, participantIdentifier, role, userEmail);

      // Also update Supabase bookings table: set meeting_started_at if not set and increment participants_count
      try {
        const { data: bData } = await supabaseAdminClient
          .from("bookings")
          .select("id, meeting_started_at, participants_count")
          .or(`id.eq.${cleanBookingId},meeting_room_id.eq.${targetRoomOrId},meeting_room_id.eq.foundarly-${cleanBookingId}`)
          .maybeSingle();

        if (bData) {
          const updates: any = {
            participants_count: (bData.participants_count || 0) + (result.isFirstJoin ? 1 : 0),
          };
          if (!bData.meeting_started_at) {
            updates.meeting_started_at = new Date().toISOString();
          }
          await supabaseAdminClient
            .from("bookings")
            .update(updates)
            .eq("id", bData.id);
        }
      } catch (dbErr) {
        console.warn("[Server] Non-critical warning updating booking join in Supabase:", dbErr);
      }

      return res.json({
        success: true,
        hasJoined: true,
        isFirstJoin: result.isFirstJoin,
        joinCount: result.joinCount,
        bookingId: cleanBookingId,
      });
    } catch (err: any) {
      console.error("[Server] Error recording participant join:", err);
      return res.status(500).json({
        success: false,
        error: "Failed to record participant join.",
        code: "INTERNAL_ERROR",
      });
    }
  });

  // Cooldown tracker for waiting participant email notifications
  // Key: `${bookingId}_${role}`, Value: timestamp (ms)
  const waitingNotificationCooldowns = new Map<string, number>();

  async function handleMeetingNotifyWaiting(
    roomIdInput: string | undefined,
    req: express.Request,
    res: express.Response
  ) {
    const auth = await authenticateSessionUser(req);
    if (!auth.user) {
      return res.status(auth.status || 401).json({
        success: false,
        error: auth.error || "Authentication required.",
        code: "UNAUTHENTICATED",
      });
    }

    let cleanRoomId = (roomIdInput || "").trim();
    if (cleanRoomId.includes("/meeting/")) {
      cleanRoomId = cleanRoomId.split("/meeting/").pop() || cleanRoomId;
    }
    cleanRoomId = cleanRoomId.split("?")[0].split("#")[0].replace(/\/+$/, "").trim();

    if (!cleanRoomId || cleanRoomId.length > 255) {
      return res.status(400).json({
        success: false,
        error: "Valid meeting room ID is required.",
        code: "INVALID_ROOM_ID",
      });
    }

    try {
      const rawBookingId = cleanRoomId.startsWith("foundarly-")
        ? cleanRoomId.replace("foundarly-", "")
        : cleanRoomId;
      const prefixedRoomId = cleanRoomId.startsWith("foundarly-")
        ? cleanRoomId
        : `foundarly-${cleanRoomId}`;
      const isRawUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawBookingId);
      const isCleanUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanRoomId);

      const orFilters: string[] = [
        `meeting_room_id.eq.${cleanRoomId}`,
        `meeting_room_id.eq.${prefixedRoomId}`,
        `meeting_room_id.eq.${rawBookingId}`,
      ];
      if (isRawUuid) {
        orFilters.push(`id.eq.${rawBookingId}`);
      }
      if (isCleanUuid && cleanRoomId !== rawBookingId) {
        orFilters.push(`id.eq.${cleanRoomId}`);
      }

      const clientToUse = supabaseAdminClient || supabaseUserClient(auth.token);

      let bookings: any[] | null = null;
      let bookingError: any = null;

      // 1. Prioritize SECURITY DEFINER RPC lookup
      try {
        const { data: rpcData, error: rpcError } = await clientToUse
          .rpc('lookup_meeting_room', { p_room_id: cleanRoomId });
        if (!rpcError && Array.isArray(rpcData) && rpcData.length > 0) {
          const row = rpcData[0];
          bookings = [{
            ...row,
            consultants: (row.consultant_name || row.consultant_email || row.consultant_user_id) ? {
              id: row.consultant_id,
              name: row.consultant_name,
              email: row.consultant_email,
              title: row.consultant_title,
              user_id: row.consultant_user_id,
            } : undefined,
          }];
        }
      } catch {
        // Non-blocking
      }

      if (!bookings || bookings.length === 0) {
        const baseQuery = clientToUse
          .from("bookings")
          .select("*, consultants(id, name, title, email, user_id)");

        const baseRes = await baseQuery.or(orFilters.join(",")).limit(1);
        bookings = baseRes.data;
        bookingError = baseRes.error;

        if (bookingError || !bookings || bookings.length === 0) {
          const flatQuery = clientToUse.from("bookings").select("*");
          const flatResult = await flatQuery.or(orFilters.join(",")).limit(1);
          if (flatResult.data && flatResult.data.length > 0) {
            bookings = flatResult.data;
            bookingError = null;
          }
        }

        if ((bookingError || !bookings || bookings.length === 0) && auth.user?.email) {
          const emailQuery = clientToUse
            .from("bookings")
            .select("*, consultants(id, name, title, email, user_id)")
            .eq("email", auth.user.email.toLowerCase().trim());
          const emailResult = await emailQuery.or(orFilters.join(",")).limit(1);
          if (emailResult.data && emailResult.data.length > 0) {
            bookings = emailResult.data;
            bookingError = null;
          }
        }
      }

      if (bookingError || !bookings || bookings.length === 0) {
        return res.status(404).json({
          success: false,
          error: "Meeting session not found or invalid meeting link.",
          code: "ROOM_NOT_FOUND",
        });
      }

      const booking = bookings[0];

      let consultantObj = Array.isArray(booking.consultants)
        ? booking.consultants[0]
        : booking.consultants;

      if (!consultantObj && booking.consultant_id) {
        const { data: directConsultant } = await clientToUse
          .from("consultants")
          .select("id, name, title, email, user_id")
          .eq("id", booking.consultant_id)
          .maybeSingle();
        if (directConsultant) {
          consultantObj = directConsultant;
        }
      }

      const authCheck = validateParticipantAccess(
        auth.user,
        booking,
        consultantObj,
        auth.isAdmin
      );

      if (!authCheck.authorized) {
        return res.status(403).json({
          success: false,
          error: authCheck.reason || "You are not authorized to access this meeting session.",
          code: authCheck.code || "UNAUTHORIZED_PARTICIPANT",
        });
      }

      const eligibility = calculateRejoinEligibility(booking, new Date());
      if (eligibility.sessionStatus === "expired") {
        return res.status(410).json({
          success: false,
          error: "The 7-day follow-up window for this consultation has concluded.",
          code: "REJOIN_EXPIRED",
        });
      }

      const senderRole = authCheck.role;
      if (senderRole !== "client" && senderRole !== "consultant") {
        return res.json({
          success: true,
          message: "Admin presence does not trigger participant notification.",
        });
      }

      // 3-minute cooldown per booking per sender role to avoid duplicate spam
      const cooldownKey = `${booking.id}_${senderRole}`;
      const now = Date.now();
      const lastSent = waitingNotificationCooldowns.get(cooldownKey) || 0;
      if (now - lastSent < 3 * 60 * 1000) {
        return res.json({
          success: true,
          throttled: true,
          message: "Waiting notification was recently sent. Please wait before notifying again.",
        });
      }

      const siteUrl = (
        process.env.APP_URL ||
        process.env.SITE_URL ||
        process.env.VITE_SITE_URL ||
        req.headers.origin ||
        `http://localhost:${PORT}`
      ).trim();
      const effectiveRoomId = booking.meeting_room_id || `foundarly-${booking.id}`;
      const meetingLink = `${siteUrl}/meeting/${effectiveRoomId}`;
      const isFollowUp = eligibility.isRejoin || booking.status === "completed";

      let recipientEmail = "";
      let recipientName = "";
      let waitingUserName = "";

      if (senderRole === "client") {
        recipientEmail = consultantObj?.email || "";
        recipientName = consultantObj?.name || "Consultant";
        waitingUserName = booking.name || auth.user.email?.split("@")[0] || "Client";
      } else {
        recipientEmail = booking.email || "";
        recipientName = booking.name || "Client";
        waitingUserName = consultantObj?.name || auth.user.email?.split("@")[0] || "Consultant";
      }

      if (!recipientEmail || !recipientEmail.includes("@")) {
        console.warn(`[Meeting Notification] Recipient email missing for booking ${booking.id}`);
        return res.json({
          success: false,
          error: "Recipient email is not available for this booking.",
        });
      }

      const waitingData: EmailParticipantWaitingData = {
        bookingId: booking.id,
        recipientName,
        recipientEmail,
        waitingUserName,
        waitingUserRole: senderRole,
        meetingLink,
        meetingRoomId: effectiveRoomId,
        date: booking.date,
        time: booking.time,
        isFollowUp,
      };

      const emailHtml = generateParticipantWaitingEmailHTML(waitingData);
      const emailText = generateParticipantWaitingEmailText(waitingData);
      const emailSubject = senderRole === "client"
        ? `${waitingUserName} is waiting in your Foundarly meeting room`
        : `Your consultant, ${waitingUserName}, is waiting in your Foundarly meeting room`;

      const smtpConfig = getSmtpConfig();
      if (!smtpConfig.pass) {
        console.warn("[Meeting Notification] SMTP_PASS not set. Notification recorded in dev log.");
        waitingNotificationCooldowns.set(cooldownKey, now);
        return res.json({
          success: true,
          simulated: true,
          message: `Notification simulated (SMTP_PASS not configured). Target: ${recipientEmail}`,
          recipient: recipientEmail,
        });
      }

      const mailResult = await sendEmail({
        from: smtpConfig.defaultFrom,
        to: recipientEmail,
        replyTo: smtpConfig.replyTo,
        subject: emailSubject,
        html: emailHtml,
        text: emailText,
      });

      waitingNotificationCooldowns.set(cooldownKey, now);

      if (!mailResult.success) {
        console.error("[Meeting Notification] Email send failed:", mailResult.error);
        return res.status(500).json({
          success: false,
          error: mailResult.error || "Failed to send waiting notification email.",
        });
      }

      console.log(`[Meeting Notification] Waiting alert sent to ${recipientEmail} for booking ${booking.id}`);
      return res.json({
        success: true,
        message: `Notification sent to ${recipientEmail}`,
        recipient: recipientEmail,
      });
    } catch (err: any) {
      console.error("[Meeting Notification] Internal error:", err);
      return res.status(500).json({
        success: false,
        error: "Internal error processing waiting notification.",
      });
    }
  }

  // API Endpoint: Send email notification when a participant is waiting in room
  app.post("/api/meeting/notify-waiting", (req, res) => {
    handleMeetingNotifyWaiting(req.body?.roomId, req, res);
  });

  // =========================================================================
  // FOLLOW-UP SCHEDULING WORKFLOW ENDPOINTS (NO ADMIN APPROVAL REQUIRED)
  // =========================================================================

  // Helper to resolve site URL
  const getSiteUrl = (req: express.Request): string => {
    return (
      process.env.APP_URL ||
      process.env.SITE_URL ||
      process.env.VITE_SITE_URL ||
      req.headers.origin ||
      `http://localhost:${PORT}`
    ).trim();
  };

  // 1. Client Submits Follow-up Request
  app.post("/api/follow-ups/request", async (req, res) => {
    const auth = await authenticateSessionUser(req);
    if (!auth.user) {
      return res.status(auth.status || 401).json({
        success: false,
        error: auth.error || "Authentication required.",
        code: "UNAUTHENTICATED",
      });
    }

    const { bookingId, reason, preferredDate, preferredTime } = req.body || {};

    if (!bookingId || !reason || !preferredDate || !preferredTime) {
      return res.status(400).json({
        success: false,
        error: "Booking ID, reason, preferred date, and preferred time are all required.",
        code: "MISSING_FIELDS",
      });
    }

    if (reason.trim().length < 3) {
      return res.status(400).json({
        success: false,
        error: "Please provide a brief reason or clarification for the follow-up.",
        code: "INVALID_REASON",
      });
    }

    try {
      // Fetch booking from Supabase
      const { data: booking, error: bookingErr } = await supabaseAdminClient
        .from("bookings")
        .select("*, consultants(id, name, title, email, user_id)")
        .eq("id", bookingId)
        .maybeSingle();

      if (bookingErr || !booking) {
        return res.status(404).json({
          success: false,
          error: "Original booking not found.",
          code: "BOOKING_NOT_FOUND",
        });
      }

      const user = auth.user;
      const userEmail = (user.email || "").toLowerCase().trim();
      const bookingEmail = (booking.email || "").toLowerCase().trim();
      const isClient = (booking.user_id && booking.user_id === user.id) || (bookingEmail && userEmail === bookingEmail);

      if (!isClient && !isAllowedAdminEmail(userEmail)) {
        return res.status(403).json({
          success: false,
          error: "You are not authorized to request a follow-up for this booking.",
          code: "UNAUTHORIZED_CLIENT",
        });
      }

      // Check lifecycle eligibility
      const serverNow = new Date();
      const eligibility = checkBookingFollowUpEligibility(booking, serverNow);
      if (!eligibility.eligible) {
        return res.status(400).json({
          success: false,
          error: eligibility.reason || "This booking is not currently eligible for follow-up.",
          code: "INELIGIBLE_BOOKING",
          rejoinDeadline: eligibility.rejoinDeadline.toISOString(),
        });
      }

      // Validate preferred date & time strictly within 7-day window
      const timingValidation = validateFollowUpTiming(preferredDate, preferredTime, eligibility.rejoinDeadline, serverNow);
      if (!timingValidation.valid) {
        return res.status(400).json({
          success: false,
          error: timingValidation.error || "Proposed follow-up timing is invalid.",
          code: timingValidation.code || "TIMING_INVALID",
          rejoinDeadline: eligibility.rejoinDeadline.toISOString(),
        });
      }

      // Prevent duplicate pending or active requests
      const activeExisting = await followUpStorage.findActiveByBookingId(booking.id);
      if (activeExisting) {
        return res.status(409).json({
          success: false,
          error: "A follow-up request is already pending or confirmed for this consultation.",
          code: "DUPLICATE_REQUEST",
          followUp: activeExisting,
        });
      }

      // Resolve consultant details
      let consultantObj = Array.isArray(booking.consultants) ? booking.consultants[0] : booking.consultants;
      if (!consultantObj && booking.consultant_id) {
        const { data: directC } = await supabaseAdminClient
          .from("consultants")
          .select("id, name, title, email, user_id")
          .eq("id", booking.consultant_id)
          .maybeSingle();
        if (directC) consultantObj = directC;
      }

      const meetingRoomId = booking.meeting_room_id || `foundarly-${booking.id}`;

      // Create new follow-up record
      const followUp = await followUpStorage.create({
        booking_id: booking.id,
        client_id: user.id,
        client_name: booking.name || user.email?.split("@")[0] || "Client",
        client_email: booking.email || user.email,
        consultant_id: booking.consultant_id,
        consultant_name: consultantObj?.name || "Consultant",
        consultant_email: consultantObj?.email || null,
        meeting_room_id: meetingRoomId,
        reason: reason.trim(),
        preferred_date: preferredDate.trim(),
        preferred_time: preferredTime.trim(),
        status: "pending_consultant",
        rejoin_deadline: eligibility.rejoinDeadline.toISOString(),
      });

      // Send email notification to consultant (reusing working email infrastructure)
      const siteUrl = getSiteUrl(req);
      const smtpConfig = getSmtpConfig();
      if (smtpConfig.pass && consultantObj?.email) {
        try {
          const emailHtml = generateFollowUpRequestedEmailHTML({
            bookingId: booking.id,
            clientName: followUp.client_name || "Client",
            clientEmail: followUp.client_email || "",
            consultantName: followUp.consultant_name || "Consultant",
            consultantEmail: consultantObj.email,
            reason: followUp.reason,
            preferredDate: followUp.preferred_date,
            preferredTime: followUp.preferred_time,
            originalDate: booking.date,
            originalTime: booking.time || "10:00 AM",
            rejoinDeadline: eligibility.rejoinDeadline.toISOString(),
            dashboardUrl: `${siteUrl}/consultant-dashboard`,
          });
          const emailText = generateFollowUpRequestedEmailText({
            bookingId: booking.id,
            clientName: followUp.client_name || "Client",
            clientEmail: followUp.client_email || "",
            consultantName: followUp.consultant_name || "Consultant",
            consultantEmail: consultantObj.email,
            reason: followUp.reason,
            preferredDate: followUp.preferred_date,
            preferredTime: followUp.preferred_time,
            originalDate: booking.date,
            originalTime: booking.time || "10:00 AM",
            rejoinDeadline: eligibility.rejoinDeadline.toISOString(),
            dashboardUrl: `${siteUrl}/consultant-dashboard`,
          });

          const mailRes = await sendEmail({
            from: smtpConfig.defaultFrom,
            to: consultantObj.email,
            replyTo: followUp.client_email || smtpConfig.replyTo,
            subject: `Follow-up Request: ${followUp.client_name} - Consultation #${booking.id.slice(0, 8)} | Foundarly`,
            html: emailHtml,
            text: emailText,
          });

          if (mailRes.success) {
            await followUpStorage.update(followUp.id, {
              consultant_notified_at: new Date().toISOString(),
            });
          }
        } catch (emailErr) {
          console.warn("[FollowUp Email] Failed to notify consultant:", emailErr);
        }
      }

      return res.json({
        success: true,
        message: "Follow-up request submitted successfully. The assigned consultant has been notified.",
        followUp,
      });
    } catch (err: any) {
      console.error("[FollowUp Server] Unexpected error creating request:", err);
      return res.status(500).json({
        success: false,
        error: "Internal server error occurred while creating follow-up request.",
        code: "INTERNAL_ERROR",
      });
    }
  });

  // =========================================================================
  // CONSULTANT DASHBOARD & ROLE ENDPOINTS
  // =========================================================================

  // 1. Get current consultant profile & auto-link user account
  app.get("/api/consultant/me", async (req, res) => {
    const auth = await authenticateSessionUser(req);
    if (!auth.user) {
      return res.status(auth.status || 401).json({ success: false, error: "Authentication required." });
    }

    const user = auth.user;
    const userEmail = (user.email || "").toLowerCase().trim();

    try {
      let query = supabaseAdminClient
        .from("consultants")
        .select("*")
        .eq("is_active", true);

      if (userEmail) {
        query = query.or(`user_id.eq.${user.id},email.ilike.${userEmail}`);
      } else {
        query = query.eq("user_id", user.id);
      }

      const { data: consultants, error } = await query.limit(1);
      const consultant = consultants?.[0];

      if (!consultant) {
        return res.json({ success: true, isConsultant: false, consultant: null });
      }

      // Self-heal linking user_id if null or mismatched
      if (consultant.user_id !== user.id) {
        await supabaseAdminClient
          .from("consultants")
          .update({ user_id: user.id })
          .eq("id", consultant.id);
        consultant.user_id = user.id;
      }

      // Self-heal profile role
      await supabaseAdminClient
        .from("profiles")
        .upsert({
          id: user.id,
          role: "consultant",
          full_name: consultant.name,
        });

      return res.json({
        success: true,
        isConsultant: true,
        consultant,
      });
    } catch (err: any) {
      console.error("[Consultant API] Error fetching consultant profile:", err);
      return res.status(500).json({ success: false, error: "Failed to resolve consultant profile." });
    }
  });

  // 2. Explicitly link consultant record
  app.post("/api/consultant/sync", async (req, res) => {
    const auth = await authenticateSessionUser(req);
    if (!auth.user) {
      return res.status(auth.status || 401).json({ success: false, error: "Authentication required." });
    }

    const user = auth.user;
    const userEmail = (user.email || "").toLowerCase().trim();
    const consultantId = req.body?.consultantId;

    try {
      let query = supabaseAdminClient
        .from("consultants")
        .select("id, name, email, user_id")
        .eq("is_active", true);

      if (consultantId) {
        query = query.eq("id", consultantId);
      } else if (userEmail) {
        query = query.or(`user_id.eq.${user.id},email.ilike.${userEmail}`);
      } else {
        query = query.eq("user_id", user.id);
      }

      const { data: consultants } = await query.limit(1);
      const consultant = consultants?.[0];

      if (!consultant) {
        return res.status(404).json({ success: false, error: "Consultant record not found." });
      }

      if (consultant.user_id !== user.id) {
        await supabaseAdminClient
          .from("consultants")
          .update({ user_id: user.id })
          .eq("id", consultant.id);
      }

      await supabaseAdminClient
        .from("profiles")
        .upsert({
          id: user.id,
          role: "consultant",
          full_name: consultant.name,
        });

      return res.json({ success: true, linked: true, consultantId: consultant.id });
    } catch (err: any) {
      console.error("[Consultant Sync] Error syncing consultant:", err);
      return res.status(500).json({ success: false, error: "Sync failed." });
    }
  });

  // 3. Get Bookings strictly for the Authenticated Consultant
  app.get("/api/consultant/bookings", async (req, res) => {
    const auth = await authenticateSessionUser(req);
    if (!auth.user) {
      return res.status(auth.status || 401).json({ success: false, error: "Authentication required." });
    }

    const user = auth.user;
    const userEmail = (user.email || "").toLowerCase().trim();

    try {
      let query = supabaseAdminClient
        .from("consultants")
        .select("id, name, email, user_id")
        .eq("is_active", true);

      if (userEmail) {
        query = query.or(`user_id.eq.${user.id},email.ilike.${userEmail}`);
      } else {
        query = query.eq("user_id", user.id);
      }

      const { data: consultants } = await query.limit(1);
      const consultant = consultants?.[0];

      if (!consultant) {
        return res.status(403).json({ success: false, error: "Forbidden: Not registered as a consultant." });
      }

      // Self-heal link if needed
      if (consultant.user_id !== user.id) {
        await supabaseAdminClient
          .from("consultants")
          .update({ user_id: user.id })
          .eq("id", consultant.id);
      }

      // Query bookings strictly for this consultant
      const { data: bookings, error: bErr } = await supabaseAdminClient
        .from("bookings")
        .select("*")
        .eq("consultant_id", consultant.id)
        .order("date", { ascending: false })
        .order("time", { ascending: false });

      if (bErr) {
        console.error("[Consultant API] Error fetching consultant bookings:", bErr);
        return res.status(500).json({ success: false, error: "Failed to fetch bookings." });
      }

      // Format bookings: ensure valid meeting_room_id, earnings, and client information
      const formatted = (bookings || []).map((b: any) => {
        const effectiveRoomId = b.meeting_room_id || (b.id ? (b.id.startsWith("foundarly-") ? b.id : `foundarly-${b.id}`) : "");
        return {
          ...b,
          meeting_room_id: effectiveRoomId,
          consultant_name: consultant.name,
          consultant_earnings: b.consultant_earnings ?? (b.session_price ? Math.round(b.session_price * 0.8) : 0),
          payout_status: b.payout_status || "pending",
          reschedule_status: b.reschedule_status || "none",
        };
      });

      return res.json({
        success: true,
        consultantId: consultant.id,
        bookings: formatted,
      });
    } catch (err: any) {
      console.error("[Consultant API] Unexpected bookings error:", err);
      return res.status(500).json({ success: false, error: "Internal server error." });
    }
  });

  // 4. Get Dynamic Stats for Authenticated Consultant
  app.get("/api/consultant/stats", async (req, res) => {
    const auth = await authenticateSessionUser(req);
    if (!auth.user) {
      return res.status(auth.status || 401).json({ success: false, error: "Authentication required." });
    }

    const user = auth.user;
    const userEmail = (user.email || "").toLowerCase().trim();

    try {
      let query = supabaseAdminClient
        .from("consultants")
        .select("id, name, email, user_id")
        .eq("is_active", true);

      if (userEmail) {
        query = query.or(`user_id.eq.${user.id},email.ilike.${userEmail}`);
      } else {
        query = query.eq("user_id", user.id);
      }

      const { data: consultants } = await query.limit(1);
      const consultant = consultants?.[0];

      if (!consultant) {
        return res.status(403).json({ success: false, error: "Forbidden: Not registered as a consultant." });
      }

      const { data: bookings } = await supabaseAdminClient
        .from("bookings")
        .select("id, status, session_price, consultant_earnings, payout_status, date, time")
        .eq("consultant_id", consultant.id);

      const allBookings = bookings || [];
      const totalBookings = allBookings.length;
      const completedSessions = allBookings.filter(b => b.status === "completed").length;
      const upcomingSessions = allBookings.filter(b => b.status === "confirmed").length;

      let totalEarnings = 0;
      let pendingEarnings = 0;
      let paidEarnings = 0;

      for (const b of allBookings) {
        if (b.status === "completed") {
          const earnings = b.consultant_earnings ?? (b.session_price ? Math.round(b.session_price * 0.8) : 0);
          totalEarnings += earnings;
          if (b.payout_status === "paid") {
            paidEarnings += earnings;
          } else {
            pendingEarnings += earnings;
          }
        }
      }

      const { data: reviews } = await supabaseAdminClient
        .from("testimonials")
        .select("rating")
        .eq("consultant_id", consultant.id);

      let avgRating: number | null = null;
      const totalReviews = reviews?.length || 0;
      if (totalReviews > 0) {
        const sum = reviews!.reduce((acc, r) => acc + (r.rating || 5), 0);
        avgRating = Number((sum / totalReviews).toFixed(1));
      }

      return res.json({
        success: true,
        stats: {
          total_bookings: totalBookings,
          completed_sessions: completedSessions,
          upcoming_sessions: upcomingSessions,
          total_earnings: totalEarnings,
          pending_earnings: pendingEarnings,
          paid_earnings: paidEarnings,
          average_rating: avgRating,
          total_reviews: totalReviews,
        },
      });
    } catch (err: any) {
      console.error("[Consultant API] Unexpected stats error:", err);
      return res.status(500).json({ success: false, error: "Failed to compute stats." });
    }
  });

  // 2. Get Follow-up for a specific booking
  app.get("/api/follow-ups/booking/:bookingId", async (req, res) => {
    const auth = await authenticateSessionUser(req);
    if (!auth.user) {
      return res.status(auth.status || 401).json({ success: false, error: "Authentication required." });
    }

    const { bookingId } = req.params;
    const followUp = await followUpStorage.getLatestByBookingId(bookingId);
    return res.json({
      success: true,
      followUp: followUp || null,
    });
  });

  // 3. List Follow-ups for Current Client
  app.get("/api/follow-ups/client", async (req, res) => {
    const auth = await authenticateSessionUser(req);
    if (!auth.user) {
      return res.status(auth.status || 401).json({ success: false, error: "Authentication required." });
    }

    const list = await followUpStorage.listForClient(auth.user.id, auth.user.email);
    return res.json({
      success: true,
      followUps: list,
    });
  });

  // 4. List Follow-ups for Current Consultant
  app.get("/api/follow-ups/consultant", async (req, res) => {
    const auth = await authenticateSessionUser(req);
    if (!auth.user) {
      return res.status(auth.status || 401).json({ success: false, error: "Authentication required." });
    }

    const user = auth.user;
    const userEmail = (user.email || "").toLowerCase().trim();

    // Look up consultant profile
    const { data: consultants } = await supabaseAdminClient
      .from("consultants")
      .select("id, email, user_id")
      .or(`user_id.eq.${user.id},email.eq.${userEmail}`)
      .limit(1);

    const consultant = consultants?.[0];
    const consultantId = consultant?.id;

    const list = await followUpStorage.listForConsultant(consultantId, user.id, userEmail);
    return res.json({
      success: true,
      followUps: list,
    });
  });

  // 5. Consultant Responds (Accept, Propose Alternative, Decline) - NO ADMIN APPROVAL
  app.post("/api/follow-ups/:id/respond", async (req, res) => {
    const auth = await authenticateSessionUser(req);
    if (!auth.user) {
      return res.status(auth.status || 401).json({
        success: false,
        error: "Authentication required.",
        code: "UNAUTHENTICATED",
      });
    }

    const { id } = req.params;
    const { action, alternativeDate, alternativeTime, consultantNote, reason } = req.body || {};

    if (!["accept", "propose_alternative", "decline"].includes(action)) {
      return res.status(400).json({
        success: false,
        error: "Invalid action. Must be 'accept', 'propose_alternative', or 'decline'.",
        code: "INVALID_ACTION",
      });
    }

    const followUp = await followUpStorage.getById(id);
    if (!followUp) {
      return res.status(404).json({
        success: false,
        error: "Follow-up request not found.",
        code: "REQUEST_NOT_FOUND",
      });
    }

    if (followUp.status !== "pending_consultant") {
      return res.status(400).json({
        success: false,
        error: `Cannot respond to a request with status '${followUp.status}'.`,
        code: "INVALID_STATE",
      });
    }

    // Verify authorized consultant
    const user = auth.user;
    const userEmail = (user.email || "").toLowerCase().trim();
    const isConsultantEmail = followUp.consultant_email && followUp.consultant_email.toLowerCase().trim() === userEmail;

    // Check consultant database link
    let isConsultantById = false;
    if (followUp.consultant_id) {
      const { data: cRecord } = await supabaseAdminClient
        .from("consultants")
        .select("id, user_id, email")
        .eq("id", followUp.consultant_id)
        .maybeSingle();

      if (cRecord) {
        if (cRecord.user_id === user.id || (cRecord.email && cRecord.email.toLowerCase().trim() === userEmail)) {
          isConsultantById = true;
        }
      }
    }

    if (!isConsultantEmail && !isConsultantById && !isAllowedAdminEmail(userEmail)) {
      return res.status(403).json({
        success: false,
        error: "Forbidden: Only the assigned consultant can respond to this request.",
        code: "FORBIDDEN",
      });
    }

    const serverNow = new Date();
    const rejoinDeadline = new Date(followUp.rejoin_deadline);

    // Enforce 7-day expiry
    if (serverNow.getTime() > rejoinDeadline.getTime()) {
      await followUpStorage.update(id, { status: "expired" });
      return res.status(400).json({
        success: false,
        error: "The 7-day follow-up window for this consultation has expired.",
        code: "EXPIRED",
      });
    }

    const siteUrl = getSiteUrl(req);
    const smtpConfig = getSmtpConfig();

    if (action === "accept") {
      // 1. Consultant accepts proposed date and time -> Confirmed immediately!
      const confirmedDate = followUp.preferred_date;
      const confirmedTime = followUp.preferred_time;

      const updated = await followUpStorage.update(id, {
        status: "confirmed",
        confirmed_date: confirmedDate,
        confirmed_time: confirmedTime,
      });

      // Send email notifications to BOTH client and consultant
      if (smtpConfig.pass && followUp.client_email) {
        try {
          const emailData = {
            bookingId: followUp.booking_id,
            clientName: followUp.client_name || "Client",
            clientEmail: followUp.client_email,
            consultantName: followUp.consultant_name || "Consultant",
            consultantEmail: followUp.consultant_email,
            confirmedDate,
            confirmedTime,
            reason: followUp.reason,
            meetingLink: `${siteUrl}/meeting/${followUp.meeting_room_id}`,
            meetingRoomId: followUp.meeting_room_id,
            rejoinDeadline: followUp.rejoin_deadline,
          };

          const html = generateFollowUpConfirmedEmailHTML(emailData);
          const text = generateFollowUpConfirmedEmailText(emailData);

          // Client email
          await sendEmail({
            from: smtpConfig.defaultFrom,
            to: followUp.client_email,
            replyTo: smtpConfig.replyTo,
            subject: `Follow-up Consultation Confirmed: ${emailData.consultantName} & ${emailData.clientName} | Foundarly`,
            html,
            text,
          });

          // Consultant email
          if (followUp.consultant_email) {
            await sendEmail({
              from: smtpConfig.defaultFrom,
              to: followUp.consultant_email,
              replyTo: followUp.client_email || smtpConfig.replyTo,
              subject: `Follow-up Consultation Confirmed: ${emailData.consultantName} & ${emailData.clientName} | Foundarly`,
              html,
              text,
            });
          }

          await followUpStorage.update(id, {
            client_notified_at: new Date().toISOString(),
            consultant_notified_at: new Date().toISOString(),
          });
        } catch (emailErr) {
          console.warn("[FollowUp Email] Error sending confirmation emails:", emailErr);
        }
      }

      return res.json({
        success: true,
        message: "Follow-up consultation confirmed. Both participants have been notified.",
        followUp: updated,
      });
    }

    if (action === "propose_alternative") {
      // 2. Consultant proposes alternative date and time within the 7-day window
      if (!alternativeDate || !alternativeTime) {
        return res.status(400).json({
          success: false,
          error: "Alternative date and time are required.",
          code: "MISSING_ALTERNATIVE_TIMING",
        });
      }

      const timingCheck = validateFollowUpTiming(alternativeDate, alternativeTime, rejoinDeadline, serverNow);
      if (!timingCheck.valid) {
        return res.status(400).json({
          success: false,
          error: timingCheck.error || "Proposed alternative time is invalid.",
          code: timingCheck.code || "TIMING_INVALID",
        });
      }

      const updated = await followUpStorage.update(id, {
        status: "alternative_proposed",
        alternative_date: alternativeDate.trim(),
        alternative_time: alternativeTime.trim(),
        consultant_note: consultantNote ? consultantNote.trim() : null,
      });

      // Send email to client notifying of alternative proposal
      if (smtpConfig.pass && followUp.client_email) {
        try {
          const html = generateFollowUpAlternativeEmailHTML({
            bookingId: followUp.booking_id,
            clientName: followUp.client_name || "Client",
            clientEmail: followUp.client_email,
            consultantName: followUp.consultant_name || "Consultant",
            alternativeDate: alternativeDate.trim(),
            alternativeTime: alternativeTime.trim(),
            consultantNote: consultantNote ? consultantNote.trim() : null,
            reason: followUp.reason,
            rejoinDeadline: followUp.rejoin_deadline,
            dashboardUrl: `${siteUrl}/my-bookings`,
          });
          const text = generateFollowUpAlternativeEmailText({
            bookingId: followUp.booking_id,
            clientName: followUp.client_name || "Client",
            clientEmail: followUp.client_email,
            consultantName: followUp.consultant_name || "Consultant",
            alternativeDate: alternativeDate.trim(),
            alternativeTime: alternativeTime.trim(),
            consultantNote: consultantNote ? consultantNote.trim() : null,
            reason: followUp.reason,
            rejoinDeadline: followUp.rejoin_deadline,
            dashboardUrl: `${siteUrl}/my-bookings`,
          });

          await sendEmail({
            from: smtpConfig.defaultFrom,
            to: followUp.client_email,
            replyTo: followUp.consultant_email || smtpConfig.replyTo,
            subject: `Alternative Follow-up Time Proposed: ${followUp.consultant_name} | Foundarly`,
            html,
            text,
          });

          await followUpStorage.update(id, {
            client_notified_at: new Date().toISOString(),
          });
        } catch (emailErr) {
          console.warn("[FollowUp Email] Error sending alternative proposal email:", emailErr);
        }
      }

      return res.json({
        success: true,
        message: "Alternative time proposed to client. Awaiting client acceptance.",
        followUp: updated,
      });
    }

    if (action === "decline") {
      // 3. Consultant declines
      const updated = await followUpStorage.update(id, {
        status: "declined",
        declined_reason: reason ? reason.trim() : "Consultant cannot accommodate follow-up at this time.",
      });

      // Send decline email to client
      if (smtpConfig.pass && followUp.client_email) {
        try {
          const html = generateFollowUpDeclinedEmailHTML({
            bookingId: followUp.booking_id,
            clientName: followUp.client_name || "Client",
            clientEmail: followUp.client_email,
            consultantName: followUp.consultant_name || "Consultant",
            declinedReason: updated?.declined_reason,
            rejoinDeadline: followUp.rejoin_deadline,
            supportUrl: `${siteUrl}/#contact`,
          });
          const text = generateFollowUpDeclinedEmailText({
            bookingId: followUp.booking_id,
            clientName: followUp.client_name || "Client",
            clientEmail: followUp.client_email,
            consultantName: followUp.consultant_name || "Consultant",
            declinedReason: updated?.declined_reason,
            rejoinDeadline: followUp.rejoin_deadline,
          });

          await sendEmail({
            from: smtpConfig.defaultFrom,
            to: followUp.client_email,
            replyTo: smtpConfig.replyTo,
            subject: `Follow-up Request Update: ${followUp.consultant_name} | Foundarly`,
            html,
            text,
          });

          await followUpStorage.update(id, {
            client_notified_at: new Date().toISOString(),
          });
        } catch (emailErr) {
          console.warn("[FollowUp Email] Error sending decline email:", emailErr);
        }
      }

      return res.json({
        success: true,
        message: "Follow-up request declined.",
        followUp: updated,
      });
    }
  });

  // 6. Client Responds to Consultant's Proposed Alternative Time
  app.post("/api/follow-ups/:id/client-respond", async (req, res) => {
    const auth = await authenticateSessionUser(req);
    if (!auth.user) {
      return res.status(auth.status || 401).json({
        success: false,
        error: "Authentication required.",
        code: "UNAUTHENTICATED",
      });
    }

    const { id } = req.params;
    const { action } = req.body || {};

    if (!["accept", "decline"].includes(action)) {
      return res.status(400).json({
        success: false,
        error: "Action must be 'accept' or 'decline'.",
        code: "INVALID_ACTION",
      });
    }

    const followUp = await followUpStorage.getById(id);
    if (!followUp) {
      return res.status(404).json({
        success: false,
        error: "Follow-up request not found.",
        code: "REQUEST_NOT_FOUND",
      });
    }

    if (followUp.status !== "alternative_proposed") {
      return res.status(400).json({
        success: false,
        error: `Cannot respond to follow-up in state '${followUp.status}'.`,
        code: "INVALID_STATE",
      });
    }

    // Verify authorized client
    const user = auth.user;
    const userEmail = (user.email || "").toLowerCase().trim();
    const isClient = (followUp.client_id && followUp.client_id === user.id) ||
      (followUp.client_email && followUp.client_email.toLowerCase().trim() === userEmail);

    if (!isClient && !isAllowedAdminEmail(userEmail)) {
      return res.status(403).json({
        success: false,
        error: "Only the requesting client can respond to this proposed time.",
        code: "FORBIDDEN",
      });
    }

    const serverNow = new Date();
    const rejoinDeadline = new Date(followUp.rejoin_deadline);
    if (serverNow.getTime() > rejoinDeadline.getTime()) {
      await followUpStorage.update(id, { status: "expired" });
      return res.status(400).json({
        success: false,
        error: "The 7-day follow-up window for this consultation has expired.",
        code: "EXPIRED",
      });
    }

    const siteUrl = getSiteUrl(req);
    const smtpConfig = getSmtpConfig();

    if (action === "accept") {
      const confirmedDate = followUp.alternative_date || followUp.preferred_date;
      const confirmedTime = followUp.alternative_time || followUp.preferred_time;

      const updated = await followUpStorage.update(id, {
        status: "confirmed",
        confirmed_date: confirmedDate,
        confirmed_time: confirmedTime,
      });

      // Notify both participants of confirmation
      if (smtpConfig.pass && followUp.client_email) {
        try {
          const emailData = {
            bookingId: followUp.booking_id,
            clientName: followUp.client_name || "Client",
            clientEmail: followUp.client_email,
            consultantName: followUp.consultant_name || "Consultant",
            consultantEmail: followUp.consultant_email,
            confirmedDate,
            confirmedTime,
            reason: followUp.reason,
            meetingLink: `${siteUrl}/meeting/${followUp.meeting_room_id}`,
            meetingRoomId: followUp.meeting_room_id,
            rejoinDeadline: followUp.rejoin_deadline,
          };

          const html = generateFollowUpConfirmedEmailHTML(emailData);
          const text = generateFollowUpConfirmedEmailText(emailData);

          await sendEmail({
            from: smtpConfig.defaultFrom,
            to: followUp.client_email,
            replyTo: smtpConfig.replyTo,
            subject: `Follow-up Consultation Confirmed: ${emailData.consultantName} & ${emailData.clientName} | Foundarly`,
            html,
            text,
          });

          if (followUp.consultant_email) {
            await sendEmail({
              from: smtpConfig.defaultFrom,
              to: followUp.consultant_email,
              replyTo: followUp.client_email || smtpConfig.replyTo,
              subject: `Follow-up Consultation Confirmed: ${emailData.consultantName} & ${emailData.clientName} | Foundarly`,
              html,
              text,
            });
          }

          await followUpStorage.update(id, {
            client_notified_at: new Date().toISOString(),
            consultant_notified_at: new Date().toISOString(),
          });
        } catch (emailErr) {
          console.warn("[FollowUp Email] Error sending confirmation emails:", emailErr);
        }
      }

      return res.json({
        success: true,
        message: "Alternative time accepted. Follow-up is now confirmed!",
        followUp: updated,
      });
    }

    if (action === "decline") {
      const updated = await followUpStorage.update(id, {
        status: "declined",
        declined_reason: "Client declined the proposed alternative time.",
      });

      return res.json({
        success: true,
        message: "Proposed alternative time declined.",
        followUp: updated,
      });
    }
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
        meetingLink: `https://www.foundarlybusinessworld.in/meeting/test-${Date.now()}`,
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

      // ── B. POST-SESSION COMPLETION EMAIL FLOW (WITH 7-DAY REJOIN & DEDUPLICATION) ──
      if (type === "completed") {
        const targetBookingId = bookingId || emailData?.bookingId;
        if (!targetBookingId) {
          return res.status(400).json({
            success: false,
            error: "Booking ID is required to send completion email",
          });
        }

        // Idempotency check: avoid duplicate completion emails when triggered multiple times
        if (completionEmailStorage.isSent(targetBookingId)) {
          console.log(`[Server Email] Post-session completion email already sent for booking: ${targetBookingId}. Skipping duplicate.`);
          return res.json({
            success: true,
            message: "Post-session completion email already sent (idempotent)",
            alreadySent: true,
            bookingId: targetBookingId,
          });
        }

        let bookingRecord: any = null;
        let consultantRecord: any = null;

        try {
          const { data: bData } = await supabaseAdminClient
            .from("bookings")
            .select("*, consultants(name, email, title)")
            .eq("id", targetBookingId)
            .maybeSingle();

          if (bData) {
            bookingRecord = bData;
            consultantRecord = Array.isArray(bData.consultants) ? bData.consultants[0] : bData.consultants;
          }
        } catch (fetchErr) {
          console.warn("[Server Email] Warning fetching booking from database, using payload if present:", fetchErr);
        }

        const clientEmail = (bookingRecord?.email || emailData?.userEmail || "").toLowerCase().trim();
        const clientName = bookingRecord?.name || emailData?.userName || "Client";
        const consultantName = consultantRecord?.name || emailData?.consultantName || "Consultant";
        const consultantEmail = (consultantRecord?.email || emailData?.consultantEmail || "").toLowerCase().trim();
        const date = bookingRecord?.date || emailData?.date || new Date().toISOString().split("T")[0];
        const time = bookingRecord?.time || emailData?.time || "Flexible";
        const sessionDuration = bookingRecord?.session_duration || emailData?.duration || 60;
        const meetingRoomId = bookingRecord?.meeting_room_id || emailData?.meetingRoomId || `foundarly-${targetBookingId}`;
        const meetingLink = `${siteUrl}/meeting/${meetingRoomId}`;

        const timing = parseSessionTimes({
          date,
          time,
          session_duration: sessionDuration,
          meeting_started_at: bookingRecord?.meeting_started_at,
          meeting_ended_at: bookingRecord?.meeting_ended_at,
        });
        const rejoinDeadlineIso = timing.rejoinDeadline.toISOString();
        const rejoinExpiryFormatted = formatRejoinExpiryDateTime(timing.rejoinDeadline);

        if (!clientEmail || !clientEmail.includes("@")) {
          return res.status(400).json({
            success: false,
            error: "Recipient client email address is missing or invalid.",
          });
        }

        // 1. Send Completion & 7-Day Rejoin Email to Client
        const clientPayload: EmailSessionCompletedData = {
          bookingId: targetBookingId,
          userName: clientName,
          userEmail: clientEmail,
          consultantName,
          consultantEmail: consultantEmail || null,
          recipientRole: "client",
          recipientName: clientName,
          recipientEmail: clientEmail,
          date,
          time,
          sessionDuration,
          meetingRoomId,
          meetingLink,
          rejoinDeadline: rejoinDeadlineIso,
          rejoinExpiryFormatted,
          rejoinDaysRemaining: 7,
        };

        const clientHtml = generateSessionCompletedEmailHTML(clientPayload);
        const clientText = generateSessionCompletedEmailText(clientPayload);
        const clientSubject = `Thank You for Attending Your Consultation with ${consultantName} | 7-Day Follow-Up Access Active`;

        const clientMailRes = await sendEmail({
          from: smtpConfig.defaultFrom,
          to: clientEmail,
          replyTo: smtpConfig.replyTo,
          subject: clientSubject,
          html: clientHtml,
          text: clientText,
        });

        if (!clientMailRes.success) {
          return res.status(500).json({
            success: false,
            error: clientMailRes.error || "Failed to send post-session completion email to client",
            diagnostic: clientMailRes.diagnostic,
            details: clientMailRes.details,
          });
        }

        // 2. Also send Completion Email to Consultant if consultant email is available
        let consultantEmailId = null;
        if (consultantEmail && consultantEmail.includes("@") && consultantEmail !== clientEmail) {
          try {
            const consultantPayload: EmailSessionCompletedData = {
              ...clientPayload,
              recipientRole: "consultant",
              recipientName: consultantName,
              recipientEmail: consultantEmail,
            };
            const consHtml = generateSessionCompletedEmailHTML(consultantPayload);
            const consText = generateSessionCompletedEmailText(consultantPayload);
            const consSubject = `Session Completed: Consultation with ${clientName} | 7-Day Follow-Up Active`;

            const consMailRes = await sendEmail({
              from: smtpConfig.defaultFrom,
              to: consultantEmail,
              replyTo: smtpConfig.replyTo,
              subject: consSubject,
              html: consHtml,
              text: consText,
            });
            if (consMailRes.success) {
              consultantEmailId = consMailRes.messageId;
            }
          } catch (consErr) {
            console.warn("[Server Email] Consultant completion email warning:", consErr);
          }
        }

        // Mark as sent in persistent storage to prevent duplicates
        completionEmailStorage.markSent(targetBookingId);

        return res.json({
          success: true,
          message: "Post-session completion email sent successfully",
          clientEmailId: clientMailRes.messageId,
          consultantEmailId,
          recipient: clientEmail,
          rejoinDeadline: rejoinDeadlineIso,
          rejoinExpiryFormatted,
        });
      }

      // ── C. CONFIRMATION FLOW (CLIENT + CONSULTANT) ──
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

  // Explicit JSON 404 response for unmatched API routes
  app.use("/api", (req, res) => {
    return res.status(404).json({
      success: false,
      error: `API endpoint '${req.method} ${req.originalUrl || req.url}' not found`,
      code: "API_ENDPOINT_NOT_FOUND",
    });
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

    const recognizedSpaRoutes = [
      /^\/$/,
      /^\/home\/?$/,
      /^\/consultants(\/.*)?$/,
      /^\/consultant(\/.*)?$/,
      /^\/booking\/?$/,
      /^\/my-bookings\/?$/,
      /^\/network(\/.*)?$/,
      /^\/pricing\/?$/,
      /^\/about\/?$/,
      /^\/blog(\/.*)?$/,
      /^\/faqs\/?$/,
      /^\/apply-consultant\/?$/,
      /^\/terms\/?$/,
      /^\/privacy\/?$/,
      /^\/networking-terms\/?$/,
      /^\/camera-test\/?$/,
      /^\/meeting(\/.*)?$/,
      /^\/review(\/.*)?$/,
      /^\/upi-payment\/?$/,
      /^\/login\/?$/,
      /^\/admin(\/.*)?$/,
    ];

    app.use((req, res, next) => {
      if (req.method === "GET" && !req.path.startsWith("/api")) {
        const isRecognized = recognizedSpaRoutes.some((route) => route.test(req.path));
        if (isRecognized) {
          return res.sendFile(path.join(distPath, "index.html"));
        }
        const notFoundFile = path.join(distPath, "404.html");
        if (fs.existsSync(notFoundFile)) {
          return res.status(404).sendFile(notFoundFile);
        }
        return res.status(404).sendFile(path.join(distPath, "index.html"));
      }
      next();
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Foundarly Server] Running on http://localhost:${PORT}`);
  });
}

startServer();
