import {
  generateApplicationApprovedEmailHTML,
  generateApplicationRejectedEmailHTML,
  EmailApplicationApprovedData,
  EmailApplicationRejectedData,
} from '../src/utils/emailTemplates';

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

    const resendApiKey = (process.env.RESEND_API_KEY || process.env.RESEND_KEY || process.env.VITE_RESEND_API_KEY || '').trim();
    const fromEmail = (process.env.EMAIL_FROM || process.env.VITE_EMAIL_FROM || 'Foundarly <officialfoundarly@gmail.com>').trim();
    const siteUrl = (process.env.APP_URL || process.env.SITE_URL || process.env.VITE_SITE_URL || 'https://foundarly.com').trim();

    if (!resendApiKey) {
      return res.status(400).json({
        success: false,
        error: 'RESEND_API_KEY is not configured on the server.',
        missingConfig: 'RESEND_API_KEY',
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
    let emailSubject = '';

    if (type === 'approved') {
      emailSubject = '🎉 Your Foundarly Consultant Application has been APPROVED!';
      emailHtml = generateApplicationApprovedEmailHTML({
        ...applicationData,
        dashboardUrl: applicationData.dashboardUrl || siteUrl,
      });
    } else if (type === 'rejected') {
      emailSubject = 'Update regarding your Foundarly Consultant Application';
      emailHtml = generateApplicationRejectedEmailHTML({
        ...applicationData,
        supportUrl: applicationData.supportUrl || siteUrl,
      });
    } else {
      return res.status(400).json({
        success: false,
        error: `Invalid application notification type: '${type}'. Expected 'approved' or 'rejected'.`,
      });
    }

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [recipientEmail],
        subject: emailSubject,
        html: emailHtml,
      }),
    });

    const resendResult = (await resendResponse.json()) as any;

    if (!resendResponse.ok) {
      const errMsg = resendResult?.message || resendResult?.error || JSON.stringify(resendResult);
      return res.status(resendResponse.status).json({
        success: false,
        error: `Resend API Error: ${errMsg}`,
        details: resendResult,
      });
    }

    return res.status(200).json({
      success: true,
      message: `Application ${type} email sent successfully`,
      emailId: resendResult.id,
      recipient: recipientEmail,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error?.message || 'Internal server error while sending email',
    });
  }
}
