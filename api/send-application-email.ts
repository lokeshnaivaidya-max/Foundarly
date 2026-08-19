import {
  generateApplicationApprovedEmailHTML,
  generateApplicationApprovedEmailText,
  generateApplicationRejectedEmailHTML,
  generateApplicationRejectedEmailText,
  EmailApplicationApprovedData,
  EmailApplicationRejectedData,
} from '../src/utils/emailTemplates.js';
import { sendEmail } from '../src/server/mailer.js';

interface RequestLike {
  method?: string;
  body?: any;
  headers?: Record<string, string | string[] | undefined>;
}

interface ResponseLike {
  status: (code: number) => ResponseLike;
  json: (data: any) => ResponseLike;
  end: () => void;
  setHeader: (name: string, value: string) => void;
}

export default async function handler(req: RequestLike, res: ResponseLike) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const rawBody = req.body;
    let parsedBody = rawBody;
    if (typeof rawBody === 'string') {
      try {
        parsedBody = JSON.parse(rawBody);
      } catch {
        parsedBody = {};
      }
    }
    const { type, applicationData } = parsedBody || {};

    if (!type || !applicationData) {
      return res.status(400).json({
        success: false,
        error: "Application decision type ('approved' | 'rejected') and applicationData are required.",
      });
    }

    const fromEmail = (process.env.EMAIL_FROM || 'Foundarly <officialfoundarly@gmail.com>').trim();
    const siteUrl = (process.env.APP_URL || process.env.SITE_URL || process.env.VITE_SITE_URL || 'https://foundarly.com').trim();

    if (!process.env.SMTP_PASS) {
      return res.status(400).json({
        success: false,
        error: 'SMTP_PASS is not configured on the server. Please set the SMTP_PASS environment variable (Google App Password).',
        missingConfig: 'SMTP_PASS',
      });
    }

    const recipientEmail = applicationData.applicantEmail?.toLowerCase().trim();
    if (!recipientEmail || !recipientEmail.includes('@')) {
      return res.status(400).json({
        success: false,
        error: 'Valid applicant email address is required.',
      });
    }

    let emailHtml = '';
    let emailText = '';
    let emailSubject = '';

    if (type === 'approved') {
      emailSubject = 'Foundarly Consultant Application Approved';
      emailHtml = generateApplicationApprovedEmailHTML({
        ...applicationData,
        dashboardUrl: applicationData.dashboardUrl || siteUrl,
      });
      emailText = generateApplicationApprovedEmailText({
        ...applicationData,
        dashboardUrl: applicationData.dashboardUrl || siteUrl,
      });
    } else if (type === 'rejected') {
      emailSubject = 'Update regarding your Foundarly Consultant Application';
      emailHtml = generateApplicationRejectedEmailHTML({
        ...applicationData,
        supportUrl: applicationData.supportUrl || siteUrl,
      });
      emailText = generateApplicationRejectedEmailText({
        ...applicationData,
        supportUrl: applicationData.supportUrl || siteUrl,
      });
    } else {
      return res.status(400).json({
        success: false,
        error: `Invalid application notification type: '${type}'. Expected 'approved' or 'rejected'.`,
      });
    }

    const mailResult = await sendEmail({
      from: fromEmail,
      to: recipientEmail,
      subject: emailSubject,
      html: emailHtml,
      text: emailText,
    });

    if (!mailResult.success) {
      return res.status(500).json({
        success: false,
        error: mailResult.error || `Failed to send ${type} email via Gmail SMTP`,
        details: mailResult.details,
      });
    }

    return res.status(200).json({
      success: true,
      message: `Application ${type} email sent successfully`,
      emailId: mailResult.messageId,
      recipient: recipientEmail,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error?.message || 'Internal server error while sending application email',
    });
  }
}
