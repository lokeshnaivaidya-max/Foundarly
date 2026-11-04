/**
 * Helper utility to provide robust fallback avatars for consultants.
 * Ensures images never break or display missing icons in any view.
 */

// Resilient inline SVG data URIs that never fail network requests
const inlineMaleAvatar = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="48" fill="%231e293b" stroke="%23f59e0b" stroke-width="3"/><circle cx="50" cy="38" r="18" fill="%23e2e8f0"/><path d="M22 84 C22 66 35 58 50 58 C65 58 78 66 78 84 Z" fill="%23475569"/><polygon points="46,58 50,68 54,58" fill="%23f59e0b"/></svg>`;
const inlineFemaleAvatar = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="48" fill="%231e293b" stroke="%23f59e0b" stroke-width="3"/><circle cx="50" cy="38" r="18" fill="%23f1f5f9"/><path d="M22 84 C22 66 35 58 50 58 C65 58 78 66 78 84 Z" fill="%23ec4899"/><polygon points="46,58 50,68 54,58" fill="%23fde68a"/></svg>`;

export function getConsultantAvatar(imageUrl?: string | null, gender?: string | null): string {
  if (imageUrl && typeof imageUrl === 'string' && imageUrl.trim().length > 0) {
    return imageUrl.trim();
  }
  const isFemale = gender && gender.toLowerCase().trim() === 'female';
  return isFemale ? '/female-default.jpg' : '/male-default.png';
}

export function handleImageFallback(
  event: React.SyntheticEvent<HTMLImageElement, Event>,
  gender?: string | null
) {
  const img = event.currentTarget;
  const isFemale = gender && gender.toLowerCase().trim() === 'female';
  const defaultAsset = isFemale ? '/female-default.jpg' : '/male-default.png';
  const svgFallback = isFemale ? '/female-default.svg' : '/male-default.svg';
  const inlineFallback = isFemale ? inlineFemaleAvatar : inlineMaleAvatar;

  // Multi-tier fallback hierarchy:
  // 1. If currently on remote URL or failed custom URL, try clean static default asset
  // 2. If default asset fails, try vector SVG
  // 3. If SVG fails, switch to guaranteed inline SVG data URI
  if (!img.src.includes('default.jpg') && !img.src.includes('default.png') && !img.src.includes('default.svg')) {
    img.src = defaultAsset;
  } else if (!img.src.includes('default.svg')) {
    img.src = svgFallback;
  } else if (img.src !== inlineFallback) {
    img.src = inlineFallback;
  }
}
