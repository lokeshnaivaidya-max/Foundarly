/**
 * Privacy-Safe Structured Error Tracking Service for Foundarly
 *
 * Guiding Principles:
 * 1. Sanitizes all error messages and contextual telemetry before recording.
 * 2. Redacts all bearer tokens, passwords, database credentials, and personal data.
 * 3. Generates unique reference IDs (e.g. ERR_ABCD1234) for user-facing assistance.
 * 4. Persists incident records to local & session audit storage so crashes survive reloads.
 * 5. Logs to browser console with stack trace and safely forwards structured errors
 *    to the server diagnostic endpoint (/api/diagnostics/client-error).
 * 6. Provides lookup by reference code (e.g. ERR_C27J8S5M) for support and diagnostics.
 */

export interface TrackedErrorRecord {
  id: string;
  message: string;
  component?: string;
  timestamp: string;
  sanitizedStack?: string;
  componentStack?: string;
}

const errorBuffer: TrackedErrorRecord[] = [];
const MAX_ERROR_BUFFER = 50;
const STORAGE_AUDIT_KEY = "foundarly_error_audit_trail";

/**
 * Sanitizes an error message or stack trace string to strip sensitive information.
 */
export function sanitizeErrorMessage(rawMessage: string): string {
  if (!rawMessage || typeof rawMessage !== "string") {
    return "Unknown application error";
  }

  const sanitized = rawMessage
    // Strip JWT tokens
    .replace(/eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]*/g, "[REDACTED_JWT]")
    // Strip Bearer headers
    .replace(/Bearer\s+[^\s"']+/gi, "Bearer [REDACTED_TOKEN]")
    // Strip Supabase keys (anon key, service role key)
    .replace(/\b(?:sb_publishable_|sb_secret_|sbp_)[a-zA-Z0-9_]{10,}\b/gi, "[REDACTED_SUPABASE_KEY]")
    // Strip Razorpay keys, payments, orders, and refund identifiers
    .replace(/\b(?:rzp_(?:test|live)_[a-zA-Z0-9]{10,}|pay_[a-zA-Z0-9]{10,}|order_[a-zA-Z0-9]{10,}|inv_[a-zA-Z0-9]{10,}|rfnd_[a-zA-Z0-9]{10,})\b/gi, "[REDACTED_PAYMENT_ID]")
    // Strip passwords, secrets, access tokens, refresh tokens & keys
    .replace(/(password|secret|key|token|apiKey|access_token|refresh_token)\s*[:=]\s*["']?[^"'\s,&#]+/gi, "$1=[REDACTED]")
    // Strip sensitive URL query parameters
    .replace(/([?&](?:token|code|key|signature|password|secret|auth|apiKey)=)[^&\s]+/gi, "$1[REDACTED]")
    // Strip payment card numbers (13-19 digits, possibly space/hyphen delimited)
    .replace(/\b(?:\d[ -]*?){13,19}\b/g, "[REDACTED_CARD]")
    // Strip CVV / CVC numbers
    .replace(/(?:cvv|cvc)\s*[:=]\s*["']?\d{3,4}["']?/gi, "cvv=[REDACTED]")
    // Strip 12-digit UTR payment transaction references
    .replace(/\b\d{12}\b/g, "[REDACTED_UTR]")
    // Strip UPI VPAs / handles (e.g. user@okhdfcbank, user@upi, user@paytm, user@ybl) BEFORE generic email
    .replace(/\b[a-zA-Z0-9._-]{2,}@(okhdfcbank|okaxis|oksbi|okicici|paytm|upi|apl|ybl|axl|ibl|barodampay|postbank|idfcbank|federal|icici|sbi|hdfcbank|axisbank|kotak|indus|yesbank)\b/gi, "[REDACTED_UPI]")
    // Strip generic email addresses
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[REDACTED_EMAIL]")
    // Strip 10-digit mobile phone numbers with optional +91 prefix
    .replace(/(?:\+?91[- ]?)?[6-9]\d{9}\b/g, "[REDACTED_PHONE]")
    .trim();

  // Limit length to prevent massive payload spam
  return sanitized.slice(0, 1500);
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
 * Load persisted errors from browser storage so crashes survive reloads
 */
function loadPersistedErrors(): TrackedErrorRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage?.getItem(STORAGE_AUDIT_KEY) ||
                window.localStorage?.getItem(STORAGE_AUDIT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    // ignore parse errors
  }
  return [];
}

/**
 * Save errors to persistent browser storage
 */
function persistErrors(records: TrackedErrorRecord[]): void {
  if (typeof window === "undefined") return;
  try {
    const payload = JSON.stringify(records.slice(-MAX_ERROR_BUFFER));
    window.sessionStorage?.setItem(STORAGE_AUDIT_KEY, payload);
    window.localStorage?.setItem(STORAGE_AUDIT_KEY, payload);
  } catch {
    // ignore storage quota errors
  }
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
      ? sanitizeErrorMessage(error.stack.split("\n").slice(0, 15).join("\n"))
      : undefined;

  const componentStack = context?.info
    ? sanitizeErrorMessage(context.info)
    : undefined;

  const record: TrackedErrorRecord = {
    id: errId,
    message: sanitizedMessage,
    component: context?.component ? sanitizeErrorMessage(context.component) : undefined,
    timestamp: new Date().toISOString(),
    sanitizedStack,
    componentStack,
  };

  // Add to in-memory error audit buffer
  errorBuffer.push(record);
  if (errorBuffer.length > MAX_ERROR_BUFFER) {
    errorBuffer.shift();
  }

  // Persist to storage so crashes survive reloads
  const currentPersisted = loadPersistedErrors();
  currentPersisted.push(record);
  persistErrors(currentPersisted);

  // Structured console log
  console.group(`🚨 [Foundarly ErrorTracker] Crash Caught: ${record.id}`);
  console.error(`Component: ${record.component || "Unknown"}`);
  console.error(`Message: ${record.message}`);
  if (record.sanitizedStack) {
    console.error(`Stack:\n${record.sanitizedStack}`);
  }
  if (record.componentStack) {
    console.error(`Component Stack:\n${record.componentStack}`);
  }
  console.groupEnd();

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
          stack: record.sanitizedStack,
        }),
      }).catch(() => {
        // Silently fail if offline or running in environment without backend
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
  const mergedMap = new Map<string, TrackedErrorRecord>();
  loadPersistedErrors().forEach((r) => mergedMap.set(r.id, r));
  errorBuffer.forEach((r) => mergedMap.set(r.id, r));
  return Array.from(mergedMap.values());
}

/**
 * Lookup error by reference ID (e.g. ERR_C27J8S5M)
 */
export function getTrackedErrorById(refId: string): TrackedErrorRecord | undefined {
  if (!refId) return undefined;
  const cleanId = refId.trim().toUpperCase();
  const all = getRecordedErrors();
  return all.find((r) => r.id.toUpperCase() === cleanId);
}

/**
 * Clears error buffer and storage.
 */
export function clearRecordedErrors(): void {
  errorBuffer.length = 0;
  if (typeof window !== "undefined") {
    try {
      window.sessionStorage?.removeItem(STORAGE_AUDIT_KEY);
      window.localStorage?.removeItem(STORAGE_AUDIT_KEY);
    } catch {
      // ignore
    }
  }
}

// Expose diagnostic lookup on window for DevTools debugging
if (typeof window !== "undefined") {
  (window as any).foundarlyGetError = getTrackedErrorById;
  (window as any).foundarlyGetErrors = getRecordedErrors;
}
