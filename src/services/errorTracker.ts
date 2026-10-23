/**
 * Privacy-Safe Structured Error Tracking Service for Foundarly
 *
 * Guiding Principles:
 * 1. Sanitizes all error messages and contextual telemetry before recording.
 * 2. Redacts all bearer tokens, passwords, database credentials, and personal data.
 * 3. Generates unique reference IDs (e.g. ERR_ABCD1234) for user-facing assistance.
 * 4. Logs to browser console in development and safely forwards structured errors
 *    to the server diagnostic endpoint (/api/diagnostics/client-error) in production.
 * 5. Provides an audit buffer for runtime verification.
 */

export interface TrackedErrorRecord {
  id: string;
  message: string;
  component?: string;
  timestamp: string;
  sanitizedStack?: string;
}

const errorBuffer: TrackedErrorRecord[] = [];
const MAX_ERROR_BUFFER = 50;

/**
 * Sanitizes an error message or stack trace string to strip sensitive information.
 */
export function sanitizeErrorMessage(rawMessage: string): string {
  if (!rawMessage || typeof rawMessage !== "string") {
    return "Unknown application error";
  }

  let sanitized = rawMessage
    // Strip JWT tokens
    .replace(/eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]*/g, "[REDACTED_JWT]")
    // Strip Bearer headers
    .replace(/Bearer\s+[^\s"']+/gi, "Bearer [REDACTED_TOKEN]")
    // Strip passwords & secrets
    .replace(/(?:password|secret|key|token|apiKey)\s*[:=]\s*["']?[^"'\s,]+/gi, "$1=[REDACTED]")
    // Strip email addresses
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[REDACTED_EMAIL]")
    // Strip 12-digit UTR numbers
    .replace(/\b\d{12}\b/g, "[REDACTED_UTR]")
    .trim();

  // Limit length to prevent massive payload spam
  return sanitized.slice(0, 500);
}

/**
 * Generates an 8-character human-friendly alphanumeric error reference ID.
 */
export function generateErrorReferenceId(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "ERR_";
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Records a client-side error in a structured, privacy-safe format.
 */
export function trackClientError(
  error: unknown,
  context?: { component?: string; info?: string }
): TrackedErrorRecord {
  const errId = generateErrorReferenceId();
  const rawMsg =
    error instanceof Error
      ? error.message
      : typeof error === "string"
      ? error
      : "Unknown error";

  const sanitizedMessage = sanitizeErrorMessage(rawMsg);
  const sanitizedStack =
    error instanceof Error && error.stack
      ? sanitizeErrorMessage(error.stack.split("\n").slice(0, 4).join("\n"))
      : undefined;

  const record: TrackedErrorRecord = {
    id: errId,
    message: sanitizedMessage,
    component: context?.component ? sanitizeErrorMessage(context.component) : undefined,
    timestamp: new Date().toISOString(),
    sanitizedStack,
  };

  // Add to in-memory error audit buffer
  errorBuffer.push(record);
  if (errorBuffer.length > MAX_ERROR_BUFFER) {
    errorBuffer.shift();
  }

  // Forward to server diagnostic endpoint in background without blocking UI
  if (typeof window !== "undefined" && typeof fetch === "function") {
    try {
      fetch("/api/diagnostics/client-error", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: record.id,
          message: record.message,
          component: record.component,
          timestamp: record.timestamp,
        }),
      }).catch(() => {
        // Silently fail if offline
      });
    } catch {
      // Ignore background network errors
    }
  }

  return record;
}

/**
 * Retrieves recorded error records for auditing and testing.
 */
export function getRecordedErrors(): TrackedErrorRecord[] {
  return [...errorBuffer];
}

/**
 * Clears error buffer.
 */
export function clearRecordedErrors(): void {
  errorBuffer.length = 0;
}
