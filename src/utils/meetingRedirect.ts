/**
 * Utility for persisting and restoring meeting room destinations across
 * unauthenticated navigation, browser refreshes, OAuth redirects, and login flows.
 */

export const MEETING_REDIRECT_KEY = 'foundarly_meeting_redirect';
export const LEGACY_REDIRECT_KEY = 'foundarly_redirect_url';

/**
 * Checks whether a given string is a meeting room path or URL
 */
export function isMeetingUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const clean = url.trim();
  if (clean.startsWith('/meeting/')) return true;
  try {
    if (clean.startsWith('http://') || clean.startsWith('https://')) {
      const parsed = new URL(clean);
      return parsed.pathname.startsWith('/meeting/');
    }
  } catch {
    // Ignore URL parse failures
  }
  return clean.includes('/meeting/');
}

/**
 * Extracts the relative meeting path (pathname + search + hash) from any valid string or object
 */
export function normalizeMeetingPath(target?: string | null | { pathname?: string; search?: string; hash?: string }): string | null {
  if (!target) return null;

  if (typeof target === 'object') {
    if (!target.pathname || !isMeetingUrl(target.pathname)) return null;
    return `${target.pathname}${target.search || ''}${target.hash || ''}`;
  }

  if (typeof target !== 'string') return null;

  const clean = target.trim();
  if (!isMeetingUrl(clean)) return null;

  try {
    if (clean.startsWith('http://') || clean.startsWith('https://')) {
      const parsed = new URL(clean);
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
  } catch {
    // fall through
  }

  // Ensure relative path starting with /
  if (clean.startsWith('/')) {
    return clean;
  }

  const meetingIndex = clean.indexOf('/meeting/');
  if (meetingIndex !== -1) {
    return clean.substring(meetingIndex);
  }

  return `/${clean}`;
}

/**
 * Persists the target meeting room in both sessionStorage and localStorage
 * to ensure survival across OAuth redirects, tab restorations, and browser restarts.
 */
export function saveMeetingRedirect(url: string): void {
  const normalized = normalizeMeetingPath(url);
  if (!normalized) return;

  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.setItem(MEETING_REDIRECT_KEY, normalized);
    }
  } catch (e) {
    console.warn('[MeetingRedirect] Failed to write to sessionStorage:', e);
  }

  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(MEETING_REDIRECT_KEY, normalized);
    }
  } catch (e) {
    console.warn('[MeetingRedirect] Failed to write to localStorage:', e);
  }
}

/**
 * Retrieves the pending meeting room destination from router state, query params, or browser storage.
 */
export function getMeetingRedirect(
  locationState?: unknown,
  locationSearch?: string
): string | null {
  // 1. Check router state (location.state.from)
  if (locationState && typeof locationState === 'object') {
    const from = (locationState as Record<string, unknown>).from;
    const normalizedFrom = normalizeMeetingPath(from);
    if (normalizedFrom) return normalizedFrom;
  }

  // 2. Check query string (?redirect=... or ?from=... or ?returnUrl=...)
  if (locationSearch && typeof locationSearch === 'string') {
    try {
      const searchParams = new URLSearchParams(locationSearch);
      const candidates = [
        searchParams.get('redirect'),
        searchParams.get('from'),
        searchParams.get('returnUrl'),
        searchParams.get('target'),
      ];

      for (const raw of candidates) {
        if (!raw) continue;
        let decoded = raw;
        try {
          decoded = decodeURIComponent(raw);
        } catch {
          // ignore decode errors
        }
        const normalized = normalizeMeetingPath(decoded);
        if (normalized) return normalized;
      }
    } catch {
      // ignore
    }
  }

  // 3. Check sessionStorage
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const fromSession = window.sessionStorage.getItem(MEETING_REDIRECT_KEY) ||
                          window.sessionStorage.getItem(LEGACY_REDIRECT_KEY);
      const normalized = normalizeMeetingPath(fromSession);
      if (normalized) return normalized;
    }
  } catch {
    // ignore
  }

  // 4. Check localStorage
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const fromLocal = window.localStorage.getItem(MEETING_REDIRECT_KEY) ||
                        window.localStorage.getItem(LEGACY_REDIRECT_KEY);
      const normalized = normalizeMeetingPath(fromLocal);
      if (normalized) return normalized;
    }
  } catch {
    // ignore
  }

  return null;
}

/**
 * Clears the stored meeting redirect keys once user has successfully navigated to the meeting
 */
export function clearMeetingRedirect(): void {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.removeItem(MEETING_REDIRECT_KEY);
      window.sessionStorage.removeItem(LEGACY_REDIRECT_KEY);
    }
  } catch {
    // ignore
  }

  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(MEETING_REDIRECT_KEY);
      window.localStorage.removeItem(LEGACY_REDIRECT_KEY);
    }
  } catch {
    // ignore
  }
}

/**
 * Builds the login URL preserving the meeting target as both a query parameter and router state payload
 */
export function buildMeetingLoginUrl(targetUrl: string): string {
  const normalized = normalizeMeetingPath(targetUrl) || targetUrl;
  return `/login?redirect=${encodeURIComponent(normalized)}&from=${encodeURIComponent(normalized)}`;
}
