import { verifySmtpConnection, getSmtpConfig } from '../src/server/mailer.js';

interface RequestLike {
  method?: string;
}

interface ResponseLike {
  status: (code: number) => ResponseLike;
  json: (data: any) => ResponseLike;
  end: () => void;
  setHeader: (name: string, value: string) => void;
}

export default async function handler(req: RequestLike, res: ResponseLike) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const config = getSmtpConfig();
  const passLength = config.pass ? config.pass.length : 0;

  if (!config.pass) {
    return res.status(400).json({
      success: false,
      error: 'SMTP_PASS environment variable is not configured. Please set SMTP_PASS in your Vercel project settings (Titan mailbox password).',
      diagnostic: 'Missing SMTP_PASS environment variable in server environment.',
      config: {
        smtpHost: config.host,
        smtpPort: config.port,
        smtpUser: config.user,
        fromEmail: config.fromEmail,
        encryption: config.port === 465 ? 'SSL' : 'STARTTLS',
        hasSmtpPass: false,
      },
    });
  }

  try {
    const result = await verifySmtpConnection();
    if (result.success) {
      return res.status(200).json({
        success: true,
        message: result.message || 'Titan SMTP authentication and connection verified successfully!',
        portVerified: result.portVerified,
        config: {
          smtpHost: config.host,
          smtpPort: config.port,
          smtpUser: config.user,
          fromEmail: config.fromEmail,
          encryption: (result.portVerified === 465 || config.port === 465) ? 'SSL' : 'STARTTLS',
          hasSmtpPass: true,
          passLength,
        },
      });
    } else {
      return res.status(500).json({
        success: false,
        error: result.error || 'Failed to authenticate with Titan SMTP server',
        diagnostic: result.diagnostic,
        config: {
          smtpHost: config.host,
          smtpPort: config.port,
          smtpUser: config.user,
          fromEmail: config.fromEmail,
          encryption: config.port === 465 ? 'SSL' : 'STARTTLS',
          hasSmtpPass: true,
          passLength,
        },
      });
    }
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error?.message || 'Unexpected error during SMTP verification',
    });
  }
}
