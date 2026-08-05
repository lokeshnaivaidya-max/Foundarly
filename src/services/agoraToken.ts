// Agora Token Generation Service - Browser Compatible
// Note: In production, tokens should be generated on your backend server for security

// Simple browser-compatible token generation
// This is a simplified approach that works without Node.js dependencies

const APP_ID = import.meta.env.VITE_AGORA_APP_ID;
const APP_CERTIFICATE = import.meta.env.VITE_AGORA_APP_CERTIFICATE;

export interface TokenConfig {
  channelName: string;
  uid: string | number;
  role?: 'publisher' | 'subscriber';
  expirationTimeInSeconds?: number;
}

/**
 * Generate a temporary token for development
 * WARNING: This is a simplified approach for development only!
 * In production, use proper server-side token generation.
 */
export function generateAgoraToken(config: TokenConfig): string {
  if (!APP_ID || !APP_CERTIFICATE) {
    throw new Error('Agora App ID and Certificate must be configured');
  }

  // For development: Create a simple token-like string
  // This won't work with Agora's token validation, but shows the structure
  const {
    channelName,
    uid,
    role = 'publisher',
    expirationTimeInSeconds = 3600
  } = config;

  const currentTimestamp = Math.floor(Date.now() / 1000);
  const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;
  
  // Simple token format for development
  const tokenData = {
    appId: APP_ID,
    channel: channelName,
    uid: typeof uid === 'string' ? parseInt(uid) || 0 : uid,
    role,
    exp: privilegeExpiredTs
  };

  console.log('Token generation attempted for:', tokenData);
  
  // Since we can't generate real tokens in browser, return null
  // This will force the system to use App ID only mode
  throw new Error('Browser token generation not supported. Please enable "App ID only" mode in Agora Console or implement server-side token generation.');
}

/**
 * Generate token for a meeting room
 */
export function generateMeetingToken(roomId: string, userId: string | number): string {
  return generateAgoraToken({
    channelName: roomId,
    uid: userId,
    role: 'publisher',
    expirationTimeInSeconds: 7200 // 2 hours for meetings
  });
}

/**
 * Validate if token generation is possible
 */
export function canGenerateTokens(): boolean {
  // Return false since browser token generation is not secure/supported
  return false;
}

/**
 * Get token info without generating
 */
export function getTokenInfo() {
  return {
    appId: APP_ID,
    hasCertificate: !!APP_CERTIFICATE,
    canGenerate: false, // Browser generation not supported
    recommendation: 'Enable "App ID only" mode in Agora Console for development'
  };
}