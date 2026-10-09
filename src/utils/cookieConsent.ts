export const COOKIE_CONSENT_KEY = 'foundarly_cookie_consent_v1';

export interface CookiePreferences {
  essential: boolean;
  functional: boolean;
  analytics: boolean;
  timestamp: string;
}

export function getCookiePreferences(): CookiePreferences | null {
  try {
    const raw = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Authoritatively check if a cookie or tracking category is allowed by user consent.
 */
export function isCookieCategoryAllowed(category: 'essential' | 'functional' | 'analytics'): boolean {
  if (category === 'essential') return true;
  const prefs = getCookiePreferences();
  // Default before explicit user selection: essential=true, functional=true, analytics=false
  if (!prefs) {
    return category === 'functional';
  }
  return Boolean(prefs[category]);
}

/**
 * Enforces active cookie policy by cleaning up non-consented data and notifying listeners
 */
export function enforceConsentPolicies(prefs: CookiePreferences) {
  try {
    // If functional cookies/storage rejected, clear discretionary cached settings
    if (!prefs.functional) {
      try {
        sessionStorage.removeItem('foundarly_draft_search');
        sessionStorage.removeItem('foundarly_draft_filters');
      } catch {
        // Ignore session storage errors
      }
    }

    // If analytics cookies rejected, signal global telemetry suppressors
    const customWindow = window as Window & { __foundarly_analytics_disabled?: boolean };
    if (!prefs.analytics) {
      customWindow.__foundarly_analytics_disabled = true;
    } else {
      customWindow.__foundarly_analytics_disabled = false;
    }
  } catch (e) {
    console.warn('[CookieConsent] Enforcement warning:', e);
  }
}

export function saveCookiePreferences(prefs: Omit<CookiePreferences, 'timestamp'>) {
  try {
    const full: CookiePreferences = {
      ...prefs,
      essential: true, // Always required for platform operation
      timestamp: new Date().toISOString(),
    };
    localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(full));
    enforceConsentPolicies(full);
    window.dispatchEvent(new CustomEvent('foundarly_cookie_consent_updated', { detail: full }));
  } catch (err) {
    console.error('Failed to save cookie preferences:', err);
  }
}
