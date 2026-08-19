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
}

/**
 * Strips HTML tags to generate a clean plain-text fallback.
 * Essential for spam filters and anti-phishing scoring.
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
 * Creates and configures a Nodemailer transporter for Gmail SMTP.
 * Sanitizes App Passwords and configures reliable SSL/TLS settings for serverless runtimes.
 */
export function createMailTransporter(): Transporter {
  const host = (process.env.SMTP_HOST || 'smtp.gmail.com').trim();
  const rawPort = (process.env.SMTP_PORT || '587').trim();
  const port = parseInt(rawPort, 10) || 587;
  const user = (process.env.SMTP_USER || 'officialfoundarly@gmail.com').trim();
  
  // Google App Passwords are 16 characters often copied with spaces (e.g., "abcd efgh ijkl mnop")
  // We sanitize spaces and quotes so authentication doesn't fail silently.
  const pass = (process.env.SMTP_PASS || '').trim().replace(/\s+/g, '').replace(/["']/g, '');

  if (!pass) {
    throw new Error('SMTP_PASS is not configured on the server. Please set the SMTP_PASS environment variable (Google App Password).');
  }

  const isPort465 = port === 465;

  // Use service 'gmail' or direct SMTP config with high compatibility
  if (host === 'smtp.gmail.com') {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user,
        pass,
      },
      connectionTimeout: 10000,
      greetingTimeout: 5000,
      socketTimeout: 15000,
    });
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: isPort465,
    requireTLS: port === 587,
    auth: {
      user,
      pass,
    },
    tls: {
      minVersion: 'TLSv1.2',
      rejectUnauthorized: true,
    },
    connectionTimeout: 10000,
    greetingTimeout: 5000,
    socketTimeout: 15000,
  });
}

/**
 * Sends a transactional email using Gmail SMTP via Nodemailer.
 * Performs safe logging without exposing passwords or tokens.
 */
export async function sendEmail(options: SendMailOptions): Promise<MailSendResult> {
  const user = (process.env.SMTP_USER || 'officialfoundarly@gmail.com').trim();
  const pass = (process.env.SMTP_PASS || '').trim().replace(/\s+/g, '').replace(/["']/g, '');
  const defaultFrom = (process.env.EMAIL_FROM || `Foundarly <${user}>`).trim();

  if (!pass) {
    console.warn('[SMTP Mailer] SMTP_PASS is missing in server environment variables.');
    return {
      success: false,
      error: 'SMTP_PASS is not configured on the server. Please set the SMTP_PASS environment variable (Google App Password).',
    };
  }

  const recipients = Array.isArray(options.to) ? options.to.join(', ') : options.to;
  console.log(`[SMTP Mailer] Dispatching email via Gmail SMTP from "${options.from || defaultFrom}" to "${recipients}" | Subject: "${options.subject}"`);

  try {
    const transporter = createMailTransporter();
    
    // Plain text alternative helps bypass spam filters
    const textContent = options.text || stripHtml(options.html);

    const info = await transporter.sendMail({
      from: options.from || defaultFrom,
      to: options.to,
      replyTo: options.replyTo || user,
      subject: options.subject,
      html: options.html,
      text: textContent,
      envelope: {
        from: user,
        to: Array.isArray(options.to) ? options.to : [options.to],
      },
      headers: {
        'X-Mailer': 'Foundarly Mail Engine',
        'X-Priority': '1',
      },
    });

    console.log(`[SMTP Mailer] Email delivered successfully! Message ID: ${info.messageId} | Response: ${info.response || 'OK'}`);
    return {
      success: true,
      messageId: info.messageId,
      details: {
        response: info.response,
        accepted: info.accepted,
        rejected: info.rejected,
      },
    };
  } catch (error: any) {
    const errCode = error?.code || 'UNKNOWN';
    const errResponse = error?.response || error?.message || 'Unknown SMTP error';
    console.error(`[SMTP Mailer Error] Failed to send email to "${recipients}". Code: ${errCode} | Response: ${errResponse}`);

    return {
      success: false,
      error: `SMTP Error (${errCode}): ${errResponse}`,
      details: {
        code: errCode,
        command: error?.command || undefined,
        response: error?.response || undefined,
      },
    };
  }
}

/**
 * Checks if the SMTP transporter can connect and verify credentials.
 */
export async function verifySmtpConnection(): Promise<{ success: boolean; error?: string; message?: string }> {
  try {
    const transporter = createMailTransporter();
    await transporter.verify();
    console.log('[SMTP Mailer] SMTP connection verified successfully with Gmail.');
    return { success: true, message: 'SMTP connection verified successfully with Gmail.' };
  } catch (error: any) {
    const errCode = error?.code || 'UNKNOWN';
    const errMsg = error?.message || 'Unknown verification error';
    console.warn(`[SMTP Mailer] SMTP verification check failed. Code: ${errCode} | Message: ${errMsg}`);
    return { success: false, error: `${errCode}: ${errMsg}` };
  }
}
