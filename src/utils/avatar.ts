/**
 * Helper utility to provide robust fallback avatars for consultants.
 * Ensures images never break or display missing icons in any view.
 */

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
  const fallback = gender && gender.toLowerCase().trim() === 'female'
    ? '/female-default.jpg'
    : '/male-default.png';

  if (!img.src.endsWith(fallback)) {
    img.src = fallback;
  }
}
