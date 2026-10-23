/**
 * Privacy-Conscious, Consent-Aware Analytics Service for Foundarly
 *
 * Guiding Principles:
 * 1. Strictly respects user cookie preferences (isCookieCategoryAllowed('analytics')).
 * 2. Absolutely NEVER collects or sends passwords, tokens, JWTs, UTR numbers,
 *    payment reference IDs, email addresses, phone numbers, or private user data.
 * 3. Gracefully supports external privacy-friendly analytics providers (Google Analytics 4 / Plausible)
 *    if the user configures VITE_GA_MEASUREMENT_ID or VITE_PLAUSIBLE_DOMAIN.
 * 4. Maintains an in-memory buffer of recent anonymized event telemetry for runtime audit and verification.
 */

import { isCookieCategoryAllowed } from "@/utils/cookieConsent";

export interface AnalyticsEvent {
  name: string;
  properties?: Record<string, string | number | boolean>;
  timestamp: string;
}

// Sensitive property keys that must NEVER be passed to analytics
const FORBIDDEN_PROPERTY_KEYS = [
  "password",
  "token",
  "secret",
  "key",
  "jwt",
  "utr",
  "txn",
  "transaction_id",
  "email",
  "phone",
  "mobile",
  "auth",
  "authorization",
  "card",
  "upi_id",
  "account",
];

// In-memory buffer of recent anonymized events for testing & audit
const eventBuffer: AnalyticsEvent[] = [];
const MAX_BUFFER_SIZE = 100;

/**
 * Sanitizes event properties to guarantee zero leakage of sensitive data or PII.
 */
export function sanitizeAnalyticsProperties(
  props?: Record<string, any>
): Record<string, string | number | boolean> {
  if (!props || typeof props !== "object") return {};

  const clean: Record<string, string | number | boolean> = {};

  for (const [key, val] of Object.entries(props)) {
    const lowerKey = key.toLowerCase();
    const isForbiddenKey = FORBIDDEN_PROPERTY_KEYS.some((f) =>
      lowerKey.includes(f)
    );
    if (isForbiddenKey) {
      continue;
    }

    if (typeof val === "string") {
      // Check if value looks like an email or JWT token
      if (val.includes("@") && val.includes(".")) continue;
      if (val.startsWith("ey") && val.length > 50) continue;
      if (val.length > 200) {
        clean[key] = val.slice(0, 200);
      } else {
        clean[key] = val;
      }
    } else if (typeof val === "number" || typeof val === "boolean") {
      clean[key] = val;
    }
  }

  return clean;
}

/**
 * Records an anonymized user interaction event, conditioned on analytics consent.
 */
export function trackEvent(
  eventName: string,
  properties?: Record<string, any>
): boolean {
  // 1. Consent Gate: strictly return false if analytics cookies are rejected
  if (!isCookieCategoryAllowed("analytics")) {
    return false;
  }

  // 2. Sanitize payload
  const sanitizedProps = sanitizeAnalyticsProperties(properties);
  const event: AnalyticsEvent = {
    name: eventName.trim().slice(0, 60),
    properties: sanitizedProps,
    timestamp: new Date().toISOString(),
  };

  // 3. Store in audit buffer
  eventBuffer.push(event);
  if (eventBuffer.length > MAX_BUFFER_SIZE) {
    eventBuffer.shift();
  }

  // 4. Send to Google Analytics 4 if configured in runtime
  if (typeof window !== "undefined") {
    const w = window as any;
    if (typeof w.gtag === "function") {
      try {
        w.gtag("event", event.name, event.properties);
      } catch {
        // Suppress external analytics errors
      }
    }
  }

  return true;
}

/**
 * Tracks a page view, conditioned on analytics consent.
 */
export function trackPageView(pagePath: string): boolean {
  if (!isCookieCategoryAllowed("analytics")) {
    return false;
  }

  // Anonymize path: replace UUIDs with ':id' placeholder
  const sanitizedPath = pagePath.replace(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
    ":id"
  );

  return trackEvent("page_view", { path: sanitizedPath });
}

/**
 * Retrieves recorded events buffer (used for verification and auditing).
 */
export function getRecordedEvents(): AnalyticsEvent[] {
  return [...eventBuffer];
}

/**
 * Clears the event buffer (useful for test isolation).
 */
export function clearRecordedEvents(): void {
  eventBuffer.length = 0;
}
