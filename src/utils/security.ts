// Production Security Utilities

/**
 * Input validation and sanitization
 */

// Email validation (RFC 5322 compliant)
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
}

// Sanitize string input (prevent XSS)
export function sanitizeString(input: string): string {
  return input
    .replace(/[<>]/g, '') // Remove < and >
    .trim()
    .slice(0, 1000); // Max length
}

// Validate UUID
export function validateUUID(uuid: string): boolean {
  if (!uuid || typeof uuid !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

// Validate date (YYYY-MM-DD)
export function validateDate(date: string): boolean {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date)) return false;
  
  const parsedDate = new Date(date);
  return parsedDate instanceof Date && !isNaN(parsedDate.getTime());
}

// Validate time (HH:MM)
export function validateTime(time: string): boolean {
  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
  return timeRegex.test(time);
}

// Validate phone number (international format)
export function validatePhone(phone: string): boolean {
  const phoneRegex = /^\+?[1-9]\d{1,14}$/;
  return phoneRegex.test(phone.replace(/[\s()-]/g, ''));
}

// Validate amount (positive number, max 2 decimals)
export function validateAmount(amount: number): boolean {
  return (
    typeof amount === 'number' &&
    amount > 0 &&
    amount < 1000000 &&
    Number.isFinite(amount) &&
    /^\d+(\.\d{1,2})?$/.test(amount.toString())
  );
}

// Validate session duration
export function validateSessionDuration(duration: number): boolean {
  return [30, 60].includes(duration);
}

// Validate booking status
export function validateBookingStatus(status: string): boolean {
  const validStatuses = ['pending', 'confirmed', 'completed', 'cancelled', 'missed'];
  return validStatuses.includes(status);
}

// Validate payment status
export function validatePaymentStatus(status: string): boolean {
  const validStatuses = ['pending', 'paid', 'failed', 'refunded'];
  return validStatuses.includes(status);
}

/**
 * Rate limiting utilities
 */
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

export function checkRateLimit(
  key: string,
  maxRequests: number = 10,
  windowMs: number = 60000
): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(key);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
    return true;
  }

  if (record.count >= maxRequests) {
    return false;
  }

  record.count++;
  return true;
}

/**
 * Secure logging (production-safe)
 */
export const secureLog = {
  error: (message: string, error?: unknown) => {
    console.error(`[SECURE_LOG_ERROR] ${message}`, error);
  },
  
  warn: (message: string, data?: unknown) => {
    console.warn(`[SECURE_LOG_WARN] ${message}`, data);
  },
  
  info: (message: string, data?: unknown) => {
    console.log(`[SECURE_LOG_INFO] ${message}`, data);
  },
};

/**
 * Content Security Policy headers
 */
export const CSP_DIRECTIVES = {
  'default-src': ["'self'"],
  'script-src': ["'self'", "'unsafe-inline'", 'https://checkout.razorpay.com', 'https://vercel.live'],
  'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
  'img-src': ["'self'", 'data:', 'https:', 'blob:'],
  'font-src': ["'self'", 'data:', 'https://fonts.gstatic.com'],
  'connect-src': [
    "'self'",
    'https://rfyxnshvtfswvaogjzwq.supabase.co',
    'wss://rfyxnshvtfswvaogjzwq.supabase.co',
    'https://api.razorpay.com',
    'https://generativelanguage.googleapis.com',
  ],
  'frame-src': ["'self'", 'https://api.razorpay.com'],
  'object-src': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
  'frame-ancestors': ["'none'"],
  'upgrade-insecure-requests': [],
};

/**
 * Prevent timing attacks
 */
export function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Generate secure random string
 */
export function generateSecureToken(length: number = 32): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Validate environment variables
 */
export function validateEnvVars(): void {
  const required = [
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY',
    'VITE_RAZORPAY_KEY_ID',
  ];

  const missing = required.filter(key => !import.meta.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}
