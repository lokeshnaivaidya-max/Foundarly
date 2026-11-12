// Agora Token Generation Service - Server-backed & Browser-Safe

const APP_ID = (typeof import.meta !== "undefined" && import.meta.env?.VITE_AGORA_APP_ID) || process.env?.VITE_AGORA_APP_ID || "";

export function toNumericUid(uid?: string | number | null): number {
  if (typeof uid === 'number' && !isNaN(uid) && uid > 0) return uid;
  if (!uid) return Math.floor(Math.random() * 900000) + 100000;
  if (typeof uid === 'string' && /^\d+$/.test(uid)) {
    const parsed = parseInt(uid, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  let hash = 0;
  const str = String(uid);
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return (Math.abs(hash) % 9000000) + 100000;
}

export interface TokenConfig {
  channelName: string;
  uid: string | number;
  role?: 'publisher' | 'subscriber';
  expirationTimeInSeconds?: number;
}

/**
 * Fetch a valid Agora RTC Token from the server endpoint
 */
export async function generateAgoraToken(config: TokenConfig): Promise<string | null> {
  const { channelName, uid } = config;
  const numericUid = toNumericUid(uid);

  try {
    const res = await fetch('/api/agora/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channelName,
        uid: numericUid,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data?.success && data?.token) {
        console.log('[Agora Token] Successfully obtained RTC token from server');
        return data.token;
      }
    }

    console.warn('[Agora Token] Server token endpoint did not return token, falling back to App ID mode');
    return null;
  } catch (err) {
    console.warn('[Agora Token] Error requesting token from server:', err);
    return null;
  }
}

/**
 * Generate token for a meeting room
 */
export async function generateMeetingToken(roomId: string, userId: string | number): Promise<string | null> {
  return generateAgoraToken({
    channelName: roomId,
    uid: userId,
    role: 'publisher',
    expirationTimeInSeconds: 7200, // 2 hours
  });
}

/**
 * Validate if token generation is supported
 */
export function canGenerateTokens(): boolean {
  return true;
}

/**
 * Get token configuration info
 */
export function getTokenInfo() {
  return {
    appId: APP_ID,
    hasCertificate: true,
    canGenerate: true,
    recommendation: 'Using secure server-side Agora token generation via /api/agora/token',
  };
}