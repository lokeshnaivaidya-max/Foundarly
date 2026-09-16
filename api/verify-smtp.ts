import { verifySmtpConnection } from '../src/server/mailer.js';

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

  const host = process.env.SMTP_HOST || 'smtp.titan.email';
  const port = parseInt(process.env.SMTP_PORT || '465', 10);
  const user = process.env.SMTP_USER || 'hello@foundarlybusinessworld.in';
  const hasPass = Boolean(process.env.SMTP_PASS);
  const passLength = process.env.SMTP_PASS ? process.env.SMTP_PASS.trim().replace(/\s+/g, '').length : 0;

  if (!hasPass) {
    return res.status(400).json({
      success: false,
      error: 'SMTP_PASS environment variable is not configured. Please set SMTP_PASS in environment variables (Titan mailbox password).',
      config: {
        smtpHost: host,
        smtpPort: port,
        smtpUser: user,
        encryption: 'SSL',
        hasSmtpPass: false,
      },
    });
  }

  try {
    const result = await verifySmtpConnection();
    if (result.success) {
      return res.status(200).json({
        success: true,
        message: 'Titan SMTP authentication and connection verified successfully!',
        config: {
          smtpHost: host,
          smtpPort: port,
          smtpUser: user,
          encryption: 'SSL',
          hasSmtpPass: true,
          passLength,
        },
      });
    } else {
      return res.status(500).json({
        success: false,
        error: result.error || 'Failed to authenticate with Titan SMTP server',
        config: {
          smtpHost: host,
          smtpPort: port,
          smtpUser: user,
          encryption: 'SSL',
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
