/**
 * Official Foundarly brand asset.
 *
 * Source of truth: "foundarly logo.jpg" added in commit c30ef2d.
 * The public copy is byte-for-byte identical and is content-hash versioned so
 * browsers/CDNs cannot keep serving an older logo after a deployment.
 */
export const OFFICIAL_LOGO_URL = '/brand/foundarly-official-logo-4a1d5c88.jpg';
export const OFFICIAL_LOGO_ALT = 'Foundarly — By the Founders for the Founders';
export const OFFICIAL_LOGO_VERSION = '4a1d5c88';

const LEGACY_LOGO_PATHS = new Set([
  '/logo.svg',
  '/logo-mark.svg',
  '/logo.png',
  '/logo.jpg',
  '/foundarly-logo.jpg',
  '/foundarly-logo.png',
  '/foundarly%20logo.jpg',
  '/foundarly logo.jpg',
  '/og-image.jpg',
  '/og-image.svg',
]);

/**
 * Resolve a configured logo URL to the official asset.
 *
 * Older releases stored `/logo.svg` (the incorrect black rounded-square
 * monogram + separate serif wordmark) in `site_settings`. Those legacy values
 * are replaced with the official uploaded image. A genuinely custom admin
 * upload (for example a Supabase storage URL) is still respected.
 */
export function resolveBrandLogoUrl(value?: string | null): string {
  if (!value || typeof value !== 'string') return OFFICIAL_LOGO_URL;

  const trimmed = value.trim();
  if (!trimmed) return OFFICIAL_LOGO_URL;

  try {
    const pathname = new URL(trimmed, 'https://foundarly.local').pathname;
    if (LEGACY_LOGO_PATHS.has(pathname.toLowerCase())) {
      return OFFICIAL_LOGO_URL;
    }
  } catch {
    // Not a URL/path we can parse — keep the configured value.
  }

  return trimmed;
}

export function isOfficialLogoUrl(value?: string | null): boolean {
  return resolveBrandLogoUrl(value) === OFFICIAL_LOGO_URL;
}
