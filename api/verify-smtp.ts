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

  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const user = process.env.SMTP_USER || 'officialfoundarly@gmail.com';
  const hasPass = Boolean(process.env.SMTP_PASS);
  const passLength = process.env.SMTP_PASS ? process.env.SMTP_PASS.trim().replace(/\s+/g, '').length : 0;

  if (!hasPass) {
    return res.status(400).json({
      success: false,
      error: 'SMTP_PASS environment variable is not configured in Vercel. Please set SMTP_PASS in Vercel Project Settings > Environment Variables.',
      config: {
        smtpHost: host,
        smtpUser: user,
        hasSmtpPass: false,
      },
    });
  }

  try {
    const result = await verifySmtpConnection();
    if (result.success) {
      return res.status(200).json({
        success: true,
        message: 'Gmail SMTP authentication and connection verified successfully!',
        config: {
          smtpHost: host,
          smtpUser: user,
          hasSmtpPass: true,
          passLength,
        },
      });
    } else {
      return res.status(500).json({
        success: false,
        error: result.error || 'Failed to authenticate with Gmail SMTP server',
        config: {
          smtpHost: host,
          smtpUser: user,
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
