// Agora Token Generation Service - Server-backed & Browser-Safe

const APP_ID = import.meta.env.VITE_AGORA_APP_ID || "";

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
  const numericUid = typeof uid === 'string' ? parseInt(uid, 10) || 0 : uid;

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