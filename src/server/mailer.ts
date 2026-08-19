import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export interface SendMailOptions {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
}

export interface MailSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  details?: any;
}

/**
 * Creates and configures a Nodemailer transporter for Gmail SMTP with TLS.
 * Safely validates required environment variables without exposing credentials.
 */
export function createMailTransporter(): Transporter {
  const host = (process.env.SMTP_HOST || 'smtp.gmail.com').trim();
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = (process.env.SMTP_USER || 'officialfoundarly@gmail.com').trim();
  const pass = (process.env.SMTP_PASS || '').trim();

  if (!pass) {
    throw new Error('SMTP_PASS is not configured on the server. Please set the SMTP_PASS environment variable (Google App Password).');
  }

  const isPort465 = port === 465;

  return nodemailer.createTransport({
    host,
    port,
    secure: isPort465, // false for port 587 (STARTTLS), true for port 465 (SMTPS)
    requireTLS: port === 587, // Enforce TLS negotiation for port 587
    auth: {
      user,
      pass,
    },
    tls: {
      minVersion: 'TLSv1.2',
      rejectUnauthorized: true,
    },
  });
}

/**
 * Sends a transactional email using Gmail SMTP via Nodemailer.
 * Performs safe logging without exposing passwords or tokens.
 */
export async function sendEmail(options: SendMailOptions): Promise<MailSendResult> {
  const host = (process.env.SMTP_HOST || 'smtp.gmail.com').trim();
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = (process.env.SMTP_USER || 'officialfoundarly@gmail.com').trim();
  const pass = (process.env.SMTP_PASS || '').trim();
  const defaultFrom = (process.env.EMAIL_FROM || `Foundarly <${user}>`).trim();

  if (!pass) {
    console.warn('[SMTP Mailer] SMTP_PASS is missing in environment variables.');
    return {
      success: false,
      error: 'SMTP_PASS is not configured on the server. Please set the SMTP_PASS environment variable (Google App Password).',
    };
  }

  const recipients = Array.isArray(options.to) ? options.to.join(', ') : options.to;
  console.log(`[SMTP Mailer] Dispatching email via ${host}:${port} (${port === 587 ? 'STARTTLS' : 'SSL'}) from "${options.from || defaultFrom}" to "${recipients}" | Subject: "${options.subject}"`);

  try {
    const transporter = createMailTransporter();
    const info = await transporter.sendMail({
      from: options.from || defaultFrom,
      to: options.to,
      subject: options.subject,
      html: options.html,
    });

    console.log(`[SMTP Mailer] Email delivered successfully! Message ID: ${info.messageId} | Response: ${info.response || 'OK'}`);
    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (error: any) {
    // Sanitize and extract safe error details
    const errCode = error?.code || 'UNKNOWN';
    const errResponse = error?.response || error?.message || 'Unknown SMTP error';
    console.error(`[SMTP Mailer Error] Failed to send email to "${recipients}". Code: ${errCode} | Response: ${errResponse}`);

    return {
      success: false,
      error: `SMTP Error (${errCode}): ${errResponse}`,
      details: {
        code: errCode,
        command: error?.command || undefined,
      },
    };
  }
}

/**
 * Checks if the SMTP transporter can connect and verify credentials.
 */
export async function verifySmtpConnection(): Promise<{ success: boolean; error?: string }> {
  try {
    const transporter = createMailTransporter();
    await transporter.verify();
    console.log('[SMTP Mailer] SMTP connection verified successfully with Gmail.');
    return { success: true };
  } catch (error: any) {
    const errCode = error?.code || 'UNKNOWN';
    const errMsg = error?.message || 'Unknown verification error';
    console.warn(`[SMTP Mailer] SMTP verification check failed. Code: ${errCode} | Message: ${errMsg}`);
    return { success: false, error: `${errCode}: ${errMsg}` };
  }
}
