import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

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
  return cleaned;
}

export interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  fromName: string;
  fromEmail: string;
  defaultFrom: string;
  replyTo: string;
}

/**
 * Resolves SMTP configuration with support for standard environment variable aliases.
 */
export function getSmtpConfig(portOverride?: number): SmtpConfig {
  const host = cleanCredential(process.env.SMTP_HOST || process.env.EMAIL_HOST) || 'smtp.titan.email';
  const configuredPort = parseInt(cleanCredential(process.env.SMTP_PORT || process.env.EMAIL_PORT) || '465', 10) || 465;
  const port = portOverride || configuredPort;
  const user = cleanCredential(process.env.SMTP_USER || process.env.EMAIL_USER || process.env.SMTP_USERNAME) || 'hello@foundarlybusinessworld.in';
  const pass = cleanCredential(process.env.SMTP_PASS || process.env.EMAIL_PASS || process.env.SMTP_PASSWORD || process.env.EMAIL_PASSWORD) || '';

  const fromName = cleanCredential(process.env.FROM_NAME) || 'Foundarly';
  const fromEmail = cleanCredential(process.env.FROM_EMAIL || process.env.SMTP_FROM || process.env.EMAIL_FROM) || user;
  
  // Format as: "Foundarly <hello@foundarlybusinessworld.in>"
  const defaultFrom = fromEmail.includes('<') ? fromEmail : `${fromName} <${fromEmail}>`;
  const replyTo = cleanCredential(process.env.EMAIL_REPLY_TO || process.env.REPLY_TO_EMAIL) || fromEmail.replace(/.*<([^>]+)>.*/, '$1');

  return {
    host,
    port,
    user,
    pass,
    fromName,
    fromEmail: fromEmail.replace(/.*<([^>]+)>.*/, '$1'),
    defaultFrom,
    replyTo,
  };
}

/**
 * Generates an informative, safe diagnostic for SMTP failures without logging credentials.
 */
function buildDiagnostic(error: any, config: SmtpConfig, portsTested: number[]): string {
  const code = error?.code || 'UNKNOWN';
  const response = error?.response || error?.message || 'No server response message';
  const hasPass = Boolean(config.pass);
  const passLength = config.pass ? config.pass.length : 0;

  if (code === 'EAUTH' || response.includes('535') || response.includes('authentication failed')) {
    return `SMTP Authentication Failed (535 5.7.8): Titan SMTP server (${config.host}) rejected credentials for user "${config.user}". ` +
      `Tested port(s): ${portsTested.join(', ')}. Password configured: ${hasPass ? `Yes (${passLength} chars)` : 'No'}. ` +
      `Common Titan Email causes: ` +
      `1) If Two-Factor Authentication (2FA) is enabled on your Titan Email account, you MUST generate and use an "Application Password" in Titan Settings > Preferences > Application Passwords, instead of your primary account password. ` +
      `2) In Titan Webmail settings, verify that access via third-party apps (SMTP) is enabled. ` +
      `3) Ensure SMTP_PASS in Vercel environment variables does not contain accidental extra spaces or typos.`;
  }

  if (code === 'ETIMEDOUT' || code === 'ECONNREFUSED' || code === 'ESOCKET') {
    return `SMTP Connection Failed (${code}): Unable to establish connection to ${config.host} on port(s) ${portsTested.join(', ')}. ` +
      `Check your server outbound firewall rules or network configuration.`;
  }

  return `SMTP Error (${code}): ${response}. Host: ${config.host}, User: ${config.user}, Ports tested: ${portsTested.join(', ')}.`;
}

/**
 * Creates a configured Nodemailer transporter for a given port.
 */
export function createMailTransporter(portOverride?: number): Transporter {
  const config = getSmtpConfig(portOverride);

  if (!config.pass) {
    throw new Error('SMTP_PASS is not configured on the server. Please set the SMTP_PASS environment variable in server/Vercel settings.');
  }

  // Titan Email: Port 465 is implicit SSL (secure: true), Port 587 is explicit STARTTLS (secure: false)
  const isSecure = config.port === 465;

  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: isSecure,
    requireTLS: !isSecure && config.port === 587,
    auth: {
      user: config.user,
      pass: config.pass,
    },
    tls: {
      servername: config.host,
      minVersion: 'TLSv1.2',
      rejectUnauthorized: true,
    },
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
  });
}

/**
 * Sends an email with automatic dual-port fallback (465 SSL <-> 587 STARTTLS)
 * and rich, safe diagnostics if authentication or delivery fails.
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

  const primaryPort = config.port;
  const alternatePort = primaryPort === 465 ? 587 : 465;
  const portsToAttempt = [primaryPort, alternatePort];

  const textContent = (options.text && options.text.trim().length > 0)
    ? options.text
    : stripHtml(options.html);

  let lastError: any = null;
  const portsTested: number[] = [];

  for (const currentPort of portsToAttempt) {
    portsTested.push(currentPort);
    const isSsl = currentPort === 465;
    console.log(`[SMTP Mailer] Attempting delivery via ${config.host}:${currentPort} (${isSsl ? 'SSL' : 'STARTTLS'})...`);

    try {
      const transporter = createMailTransporter(currentPort);
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

      console.log(`[SMTP Mailer] Email delivered successfully via ${config.host}:${currentPort}! Message ID: ${info.messageId}`);
      return {
        success: true,
        messageId: info.messageId,
        portUsed: currentPort,
        details: {
          response: info.response,
          accepted: info.accepted,
          rejected: info.rejected,
        },
      };
    } catch (err: any) {
      lastError = err;
      const errCode = err?.code || 'UNKNOWN';
      const errResponse = err?.response || err?.message || '';
      console.warn(`[SMTP Mailer] Port ${currentPort} failed: ${errCode} - ${errResponse}`);

      // If this was an auth error (535) on the primary port, try the alternate port once
      // If it fails on both, break and return the diagnostic
    }
  }

  const errCode = lastError?.code || 'UNKNOWN';
  const errResponse = lastError?.response || lastError?.message || 'Unknown SMTP failure';
  const diagnostic = buildDiagnostic(lastError, config, portsTested);

  console.error(`[SMTP Mailer Error] Delivery failed on ports ${portsTested.join(', ')}: ${diagnostic}`);

  return {
    success: false,
    error: `SMTP Error (${errCode}): ${errResponse}`,
    diagnostic,
    details: {
      code: errCode,
      command: lastError?.command || undefined,
      response: lastError?.response || undefined,
      portsTested,
    },
  };
}

/**
 * Checks if the SMTP transporter can connect and verify credentials with Titan SMTP.
 * Tests both primary and alternate ports.
 */
export async function verifySmtpConnection(): Promise<{
  success: boolean;
  error?: string;
  message?: string;
  diagnostic?: string;
  portVerified?: number;
  configSummary?: any;
}> {
  const config = getSmtpConfig();

  const configSummary = {
    smtpHost: config.host,
    smtpPort: config.port,
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
      configSummary,
    };
  }

  const primaryPort = config.port;
  const alternatePort = primaryPort === 465 ? 587 : 465;
  const portsToTest = [primaryPort, alternatePort];

  let lastError: any = null;
  const portsTested: number[] = [];

  for (const port of portsToTest) {
    portsTested.push(port);
    try {
      console.log(`[SMTP Mailer] Testing SMTP handshake on ${config.host}:${port}...`);
      const transporter = createMailTransporter(port);
      await transporter.verify();
      console.log(`[SMTP Mailer] Titan SMTP credentials verified successfully on port ${port}!`);
      return {
        success: true,
        message: `Titan SMTP authentication verified successfully on port ${port} (${port === 465 ? 'SSL' : 'STARTTLS'})!`,
        portVerified: port,
        configSummary,
      };
    } catch (err: any) {
      lastError = err;
      console.warn(`[SMTP Mailer] Verification on port ${port} failed:`, err?.message || err);
    }
  }

  const diagnostic = buildDiagnostic(lastError, config, portsTested);
  return {
    success: false,
    error: `SMTP Error (${lastError?.code || 'UNKNOWN'}): ${lastError?.response || lastError?.message || 'Verification failed'}`,
    diagnostic,
    configSummary,
  };
}
