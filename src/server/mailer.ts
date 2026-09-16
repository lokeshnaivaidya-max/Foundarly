import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

export interface SendMailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
}

export interface MailSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  details?: any;
  diagnostic?: string;
  portUsed?: number;
}

/**
 * Strips HTML tags to generate a clean plain-text fallback when not explicitly provided.
 */
function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Strips leading/trailing whitespace, newlines, and surrounding wrapping quotes
 * without altering characters inside the credential.
 */
function cleanCredential(val?: string): string {
  if (!val) return '';
  let cleaned = val.trim();
  // Strip outer quotes if the entire string is wrapped in quotes
  if (
    (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
    (cleaned.startsWith("'") && cleaned.endsWith("'"))
  ) {
    cleaned = cleaned.slice(1, -1).trim();
  }
  if (
    (cleaned.startsWith('\\"') && cleaned.endsWith('\\"')) ||
    (cleaned.startsWith("\\'") && cleaned.endsWith("\\'"))
  ) {
    cleaned = cleaned.slice(2, -2).trim();
  }
  return cleaned;
}

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromName: string;
  fromEmail: string;
  defaultFrom: string;
  replyTo: string;
}

export interface SmtpAuditInfo {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  fromEmail: string;
  hasPassword: boolean;
  passwordMeta: {
    length: number;
    hasSurroundingQuotes: boolean;
    hasWhitespace: boolean;
    hasNewlines: boolean;
    detectedEnvVar: string;
  };
}

export interface SmtpServerTarget {
  name: string;
  host: string;
  port: number;
  secure: boolean;
  requireTLS?: boolean;
}

export interface CandidateAttempt {
  name: string;
  host: string;
  port: number;
  secure: boolean;
  requireTLS: boolean;
  code?: string;
  response?: string;
  success: boolean;
}

/**
 * Returns safe environment audit metadata without exposing the password.
 */
export function getSmtpAuditInfo(): SmtpAuditInfo {
  const config = getSmtpConfig();
  
  const passEnvKeys = [
    'SMTP_PASS',
    'EMAIL_PASS',
    'SMTP_PASSWORD',
    'EMAIL_PASSWORD',
    'MAIL_PASSWORD',
    'TITAN_PASS',
    'TITAN_PASSWORD',
  ];

  let detectedEnvVar = 'none';
  let rawVal = '';

  for (const key of passEnvKeys) {
    if (process.env[key]) {
      detectedEnvVar = key;
      rawVal = process.env[key] || '';
      break;
    }
  }

  const hasSurroundingQuotes =
    (rawVal.startsWith('"') && rawVal.endsWith('"')) ||
    (rawVal.startsWith("'") && rawVal.endsWith("'")) ||
    (rawVal.startsWith('\\"') && rawVal.endsWith('\\"'));

  const hasWhitespace = rawVal.length > 0 && (rawVal !== rawVal.trim());
  const hasNewlines = rawVal.includes('\n') || rawVal.includes('\r');

  return {
    host: config.host,
    port: config.port,
    secure: config.secure,
    username: config.user,
    fromEmail: config.fromEmail,
    hasPassword: Boolean(config.pass),
    passwordMeta: {
      length: config.pass ? config.pass.length : 0,
      hasSurroundingQuotes,
      hasWhitespace,
      hasNewlines,
      detectedEnvVar,
    },
  };
}

/**
 * Resolves SMTP configuration with default Titan Port 587 (STARTTLS).
 */
export function getSmtpConfig(portOverride?: number): SmtpConfig {
  const host = cleanCredential(process.env.SMTP_HOST || process.env.EMAIL_HOST) || 'smtp.titan.email';
  const configuredPort = parseInt(cleanCredential(process.env.SMTP_PORT || process.env.EMAIL_PORT) || '587', 10) || 587;
  const port = portOverride || configuredPort;

  const secureEnv = process.env.SMTP_SECURE?.trim().toLowerCase();
  const secure = secureEnv === 'true' 
    ? true 
    : (secureEnv === 'false' ? false : port === 465);

  let rawUser = cleanCredential(
    process.env.SMTP_USER || 
    process.env.EMAIL_USER || 
    process.env.SMTP_USERNAME || 
    process.env.MAIL_USERNAME || 
    process.env.TITAN_USER
  ) || 'hello@foundarlybusinessworld.in';
  
  // Extract clean email if username was provided as "Name <email@domain>"
  if (rawUser.includes('<') && rawUser.includes('>')) {
    const match = rawUser.match(/<([^>]+)>/);
    if (match) rawUser = match[1].trim();
  }
  const user = rawUser;

  const pass = cleanCredential(
    process.env.SMTP_PASS || 
    process.env.EMAIL_PASS || 
    process.env.SMTP_PASSWORD || 
    process.env.EMAIL_PASSWORD || 
    process.env.MAIL_PASSWORD || 
    process.env.TITAN_PASS || 
    process.env.TITAN_PASSWORD
  ) || '';

  const fromName = cleanCredential(process.env.FROM_NAME) || 'Foundarly';
  const fromEmail = cleanCredential(process.env.FROM_EMAIL || process.env.SMTP_FROM || process.env.EMAIL_FROM) || user;
  
  // Format as: "Foundarly <hello@foundarlybusinessworld.in>"
  const defaultFrom = fromEmail.includes('<') ? fromEmail : `${fromName} <${fromEmail}>`;
  const replyTo = cleanCredential(process.env.EMAIL_REPLY_TO || process.env.REPLY_TO_EMAIL) || fromEmail.replace(/.*<([^>]+)>.*/, '$1');

  return {
    host,
    port,
    secure,
    user,
    pass,
    fromName,
    fromEmail: fromEmail.replace(/.*<([^>]+)>.*/, '$1'),
    defaultFrom,
    replyTo,
  };
}

/**
 * Returns prioritized SMTP targets to test per specifications:
 * 1. Titan Port 587 (STARTTLS, secure: false, requireTLS: true)
 * 2. Titan Port 465 (SSL, secure: true, requireTLS: false)
 * 3. GoDaddy Port 465 (smtpout.secureserver.net, secure: true)
 * 4. GoDaddy Port 587 (smtpout.secureserver.net, secure: false, requireTLS: true)
 */
export function getSmtpCandidates(): SmtpServerTarget[] {
  return [
    {
      name: 'Titan Port 587 (STARTTLS)',
      host: 'smtp.titan.email',
      port: 587,
      secure: false,
      requireTLS: true,
    },
    {
      name: 'Titan Port 465 (SSL)',
      host: 'smtp.titan.email',
      port: 465,
      secure: true,
      requireTLS: false,
    },
    {
      name: 'GoDaddy Port 465 (SSL)',
      host: 'smtpout.secureserver.net',
      port: 465,
      secure: true,
      requireTLS: false,
    },
    {
      name: 'GoDaddy Port 587 (STARTTLS)',
      host: 'smtpout.secureserver.net',
      port: 587,
      secure: false,
      requireTLS: true,
    },
  ];
}

/**
 * Generates an informative, safe diagnostic for SMTP failures without logging credentials.
 */
function buildDiagnostic(error: any, config: SmtpConfig, attempts: Array<{ name: string; error: string }>): string {
  const code = error?.code || 'UNKNOWN';
  const response = error?.response || error?.message || 'No server response message';
  const hasPass = Boolean(config.pass);
  const passLength = config.pass ? config.pass.length : 0;

  let attemptSummary = attempts.length > 0
    ? `\nCandidate attempts:\n` + attempts.map(a => `• ${a.name}: ${a.error}`).join('\n')
    : '';

  if (code === 'EAUTH' || response.includes('535') || response.includes('authentication failed')) {
    return `SMTP Authentication Failed (535 5.7.8): Mail server rejected credentials for user "${config.user}". ` +
      `Password configured: ${hasPass ? `Yes (${passLength} chars)` : 'No'}. ` +
      `Common causes: ` +
      `1) If Two-Factor Authentication (2FA) is active on the mailbox, you MUST generate and use an "Application Password" in webmail preferences instead of your primary account password. ` +
      `2) In webmail settings, verify third-party SMTP access is enabled. ` +
      `3) Ensure SMTP_PASS in Vercel environment variables does not contain accidental leading/trailing spaces or quotes.${attemptSummary}`;
  }

  if (code === 'ETIMEDOUT' || code === 'ECONNREFUSED' || code === 'ESOCKET') {
    return `SMTP Connection Failed (${code}): Unable to establish socket connection to host. ` +
      `Check outbound firewall or host availability.${attemptSummary}`;
  }

  return `SMTP Error (${code}): ${response}.${attemptSummary}`;
}

/**
 * Creates a configured Nodemailer transporter for a given target.
 */
export function createMailTransporter(target?: Partial<SmtpServerTarget>): Transporter {
  const config = getSmtpConfig();
  const host = target?.host || config.host;
  const port = target?.port || config.port;
  const secure = target?.secure !== undefined ? target.secure : config.secure;
  const requireTLS = target?.requireTLS !== undefined ? target.requireTLS : !secure;

  if (!config.pass) {
    throw new Error('SMTP_PASS is not configured on the server. Please set the SMTP_PASS environment variable in server/Vercel settings.');
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    requireTLS,
    auth: {
      user: config.user,
      pass: config.pass,
    },
    tls: {
      servername: host,
      minVersion: 'TLSv1.2',
      rejectUnauthorized: true,
    },
    connectionTimeout: 12000,
    greetingTimeout: 8000,
    socketTimeout: 15000,
  });
}

/**
 * Sends an email with automatic failover across candidate configurations
 * (Titan 587 -> Titan 465 -> GoDaddy 465 -> GoDaddy 587)
 */
export async function sendEmail(options: SendMailOptions): Promise<MailSendResult> {
  const config = getSmtpConfig();

  if (!config.pass) {
    console.warn('[SMTP Mailer] SMTP_PASS is missing in server environment variables.');
    return {
      success: false,
      error: 'SMTP_PASS is not configured on the server. Please set the SMTP_PASS environment variable in server/Vercel settings.',
      diagnostic: 'Missing SMTP_PASS environment variable. Add SMTP_PASS to your Vercel/server environment configuration.',
    };
  }

  const recipients = Array.isArray(options.to) ? options.to.join(', ') : options.to;
  const fromAddress = options.from || config.defaultFrom;
  const replyToAddress = options.replyTo || config.replyTo;

  console.log(`[SMTP Mailer] Preparing email from "${fromAddress}" to "${recipients}" | Subject: "${options.subject}"`);

  const candidates = getSmtpCandidates();
  const textContent = (options.text && options.text.trim().length > 0)
    ? options.text
    : stripHtml(options.html);

  let lastError: any = null;
  const attempts: Array<{ name: string; error: string }> = [];

  for (const candidate of candidates) {
    console.log(`[SMTP Mailer] Attempting delivery via ${candidate.name}...`);

    try {
      const transporter = createMailTransporter(candidate);
      const info = await transporter.sendMail({
        from: fromAddress,
        to: options.to,
        replyTo: replyToAddress,
        subject: options.subject,
        text: textContent,
        html: options.html,
        envelope: {
          from: config.fromEmail,
          to: Array.isArray(options.to) ? options.to : [options.to],
        },
        headers: {
          'Auto-Submitted': 'auto-generated',
          'X-Auto-Response-Suppress': 'All',
        },
      });

      console.log(`[SMTP Mailer] Email delivered successfully via ${candidate.name}! Message ID: ${info.messageId}`);
      return {
        success: true,
        messageId: info.messageId,
        portUsed: candidate.port,
        details: {
          targetUsed: candidate.name,
          host: candidate.host,
          port: candidate.port,
          secure: candidate.secure,
          response: info.response,
          accepted: info.accepted,
          rejected: info.rejected,
        },
      };
    } catch (err: any) {
      lastError = err;
      const errCode = err?.code || 'UNKNOWN';
      const errResponse = err?.response || err?.message || 'Failure';
      attempts.push({ name: candidate.name, error: `${errCode}: ${errResponse}` });
      console.warn(`[SMTP Mailer] ${candidate.name} failed: ${errCode} - ${errResponse}`);
    }
  }

  const errCode = lastError?.code || 'UNKNOWN';
  const errResponse = lastError?.response || lastError?.message || 'Unknown SMTP failure';
  const diagnostic = buildDiagnostic(lastError, config, attempts);

  console.error(`[SMTP Mailer Error] Delivery failed on all candidate targets: ${diagnostic}`);

  return {
    success: false,
    error: `SMTP Error (${errCode}): ${errResponse}`,
    diagnostic,
    details: {
      code: errCode,
      command: lastError?.command || undefined,
      response: lastError?.response || undefined,
      attempts,
    },
  };
}

/**
 * Checks if the SMTP transporter can authenticate across candidate configurations
 * (Titan 587 -> Titan 465 -> GoDaddy 465 -> GoDaddy 587)
 */
export async function verifySmtpConnection(): Promise<{
  success: boolean;
  error?: string;
  message?: string;
  diagnostic?: string;
  portVerified?: number;
  targetVerified?: SmtpServerTarget;
  audit?: SmtpAuditInfo;
  configSummary?: any;
  attempts?: Array<{
    name: string;
    host: string;
    port: number;
    secure: boolean;
    requireTLS: boolean;
    code: string;
    response: string;
    success: boolean;
  }>;
}> {
  const config = getSmtpConfig();
  const audit = getSmtpAuditInfo();

  const configSummary = {
    smtpHost: config.host,
    smtpPort: config.port,
    smtpSecure: config.secure,
    encryption: config.secure ? 'SSL' : 'STARTTLS',
    smtpUser: config.user,
    fromEmail: config.fromEmail,
    hasSmtpPass: Boolean(config.pass),
    passLength: config.pass ? config.pass.length : 0,
  };

  if (!config.pass) {
    return {
      success: false,
      error: 'SMTP_PASS environment variable is not configured. Please set SMTP_PASS in environment variables.',
      diagnostic: 'Missing SMTP_PASS environment variable. Add SMTP_PASS to your Vercel or server environment configuration.',
      audit,
      configSummary,
    };
  }

  const candidates = getSmtpCandidates();
  let lastError: any = null;
  const attempts: Array<{
    name: string;
    host: string;
    port: number;
    secure: boolean;
    requireTLS: boolean;
    code: string;
    response: string;
    success: boolean;
  }> = [];

  for (const candidate of candidates) {
    try {
      console.log(`[SMTP Mailer] Testing SMTP handshake on ${candidate.name}...`);
      const transporter = createMailTransporter(candidate);
      await transporter.verify();
      console.log(`[SMTP Mailer] SMTP credentials verified successfully on ${candidate.name}!`);

      attempts.push({
        name: candidate.name,
        host: candidate.host,
        port: candidate.port,
        secure: candidate.secure,
        requireTLS: Boolean(candidate.requireTLS),
        code: '250',
        response: '250 Authentication Successful',
        success: true,
      });

      return {
        success: true,
        message: `SMTP authentication verified successfully on ${candidate.name}!`,
        portVerified: candidate.port,
        targetVerified: candidate,
        audit,
        configSummary: {
          ...configSummary,
          activeHost: candidate.host,
          activePort: candidate.port,
          activeEncryption: candidate.secure ? 'SSL' : 'STARTTLS',
        },
        attempts,
      };
    } catch (err: any) {
      lastError = err;
      const errCode = err?.code || 'UNKNOWN';
      const errMsg = err?.response || err?.message || 'Verification failed';
      attempts.push({
        name: candidate.name,
        host: candidate.host,
        port: candidate.port,
        secure: candidate.secure,
        requireTLS: Boolean(candidate.requireTLS),
        code: errCode,
        response: errMsg,
        success: false,
      });
      console.warn(`[SMTP Mailer] Verification on ${candidate.name} failed:`, errMsg);
    }
  }

  const allAuthFailed = attempts.every(a => a.code === 'EAUTH' || a.response.includes('535'));
  let diagnostic = buildDiagnostic(lastError, config, attempts.map(a => ({ name: a.name, error: `${a.code}: ${a.response}` })));
  
  if (allAuthFailed) {
    diagnostic += '\n\nIMPORTANT CONCLUSION: All four candidate SMTP configurations (Titan 587 STARTTLS, Titan 465 SSL, GoDaddy 465 SSL, GoDaddy 587 STARTTLS) were reached successfully over the network, but the remote mail servers rejected the credentials with 535 Authentication Failed. This indicates network routing, TLS handshakes, and port connectivity are fully functional, but the mailbox password/credentials configured in the environment are not accepted by the mail server, or third-party SMTP/App Passwords must be configured on the mailbox.';
  }

  return {
    success: false,
    error: `SMTP Error (${lastError?.code || 'UNKNOWN'}): ${lastError?.response || lastError?.message || 'Verification failed'}`,
    diagnostic,
    audit,
    configSummary,
    attempts,
  };
}
