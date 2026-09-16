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
 * Creates and configures a Nodemailer transporter for Titan SMTP.
 * Configured for SSL encryption on port 465 with high delivery reliability.
 */
export function createMailTransporter(): Transporter {
  const host = (process.env.SMTP_HOST || 'smtp.titan.email').trim();
  const rawPort = (process.env.SMTP_PORT || '465').trim();
  const port = parseInt(rawPort, 10) || 465;
  const user = (process.env.SMTP_USER || 'hello@foundarlybusinessworld.in').trim();
  
  // Clean mailbox or application password
  const pass = (process.env.SMTP_PASS || '').trim().replace(/["']/g, '');

  if (!pass) {
    throw new Error('SMTP_PASS is not configured on the server. Please set the SMTP_PASS environment variable (Titan mailbox password).');
  }

  // Titan Email uses port 465 with SSL (secure: true)
  const isSecure = port === 465;

  return nodemailer.createTransport({
    host,
    port,
    secure: isSecure,
    requireTLS: !isSecure && port === 587,
    auth: {
      user,
      pass,
    },
    tls: {
      minVersion: 'TLSv1.2',
      rejectUnauthorized: true,
    },
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
  });
}

/**
 * Sends a transactional email using Titan SMTP via Nodemailer.
 * Configured specifically for optimal Inbox placement and RFC compliance.
 * Sender address, SMTP username, and envelope sender are aligned with hello@foundarlybusinessworld.in.
 */
export async function sendEmail(options: SendMailOptions): Promise<MailSendResult> {
  const user = (process.env.SMTP_USER || 'hello@foundarlybusinessworld.in').trim();
  const pass = (process.env.SMTP_PASS || '').trim().replace(/["']/g, '');
  
  // Default From and Reply-To configured for Foundarly via Titan SMTP
  const fromName = (process.env.FROM_NAME || 'Foundarly').trim();
  const fromEmail = (process.env.FROM_EMAIL || user).trim();
  const defaultFrom = (process.env.EMAIL_FROM || `${fromName} <${fromEmail}>`).trim();
  const defaultReplyTo = (process.env.EMAIL_REPLY_TO || fromEmail).trim();
  const replyTo = (options.replyTo || defaultReplyTo).trim();

  if (!pass) {
    console.warn('[SMTP Mailer] SMTP_PASS is missing in server environment variables.');
    return {
      success: false,
      error: 'SMTP_PASS is not configured on the server. Please set the SMTP_PASS environment variable (Titan mailbox password).',
    };
  }

  const recipients = Array.isArray(options.to) ? options.to.join(', ') : options.to;
  console.log(`[SMTP Mailer] Dispatching email via Titan SMTP from "${options.from || defaultFrom}" to "${recipients}" | Subject: "${options.subject}"`);

  try {
    const transporter = createMailTransporter();
    
    // Clean multi-part plain-text alternative is mandatory for inbox deliverability
    const textContent = (options.text && options.text.trim().length > 0) 
      ? options.text 
      : stripHtml(options.html);

    const info = await transporter.sendMail({
      from: options.from || defaultFrom,
      to: options.to,
      replyTo: replyTo,
      subject: options.subject,
      text: textContent,
      html: options.html,
      envelope: {
        from: fromEmail,
        to: Array.isArray(options.to) ? options.to : [options.to],
      },
      // Standard transactional headers without spam-triggering priority flags
      headers: {
        'Auto-Submitted': 'auto-generated',
        'X-Auto-Response-Suppress': 'All',
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
 * Checks if the SMTP transporter can connect and verify credentials with Titan SMTP.
 */
export async function verifySmtpConnection(): Promise<{ success: boolean; error?: string; message?: string }> {
  try {
    const transporter = createMailTransporter();
    await transporter.verify();
    console.log('[SMTP Mailer] SMTP connection verified successfully with Titan Email.');
    return { success: true, message: 'SMTP connection verified successfully with Titan Email.' };
  } catch (error: any) {
    const errCode = error?.code || 'UNKNOWN';
    const errMsg = error?.message || 'Unknown verification error';
    console.warn(`[SMTP Mailer] Titan SMTP verification check failed. Code: ${errCode} | Message: ${errMsg}`);
    return { success: false, error: `${errCode}: ${errMsg}` };
  }
}
