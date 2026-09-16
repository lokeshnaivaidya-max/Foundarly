import dotenv from 'dotenv';
import { verifySmtpConnection, getSmtpConfig, getSmtpAuditInfo } from '../src/server/mailer.js';

dotenv.config();

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
  const audit = getSmtpAuditInfo();
  const passLength = config.pass ? config.pass.length : 0;

  if (!config.pass) {
    return res.status(400).json({
      success: false,
      error: 'SMTP_PASS environment variable is not configured. Please set SMTP_PASS in your Vercel project settings (mailbox password).',
      diagnostic: 'Missing SMTP_PASS environment variable in server environment.',
      audit,
      config: {
        smtpHost: config.host,
        smtpPort: config.port,
        smtpUser: config.user,
        fromEmail: config.fromEmail,
        encryption: config.secure ? 'SSL' : 'STARTTLS',
        hasSmtpPass: false,
      },
    });
  }

  try {
    const result = await verifySmtpConnection();
    if (result.success) {
      return res.status(200).json({
        success: true,
        message: result.message || 'SMTP authentication and connection verified successfully!',
        portVerified: result.portVerified,
        targetVerified: result.targetVerified,
        audit: result.audit || audit,
        config: {
          smtpHost: result.configSummary?.activeHost || config.host,
          smtpPort: result.configSummary?.activePort || config.port,
          smtpUser: config.user,
          fromEmail: config.fromEmail,
          encryption: result.configSummary?.activeEncryption || (config.secure ? 'SSL' : 'STARTTLS'),
          hasSmtpPass: true,
          passLength,
        },
        attempts: result.attempts,
      });
    } else {
      return res.status(500).json({
        success: false,
        error: result.error || 'Failed to authenticate with SMTP server',
        diagnostic: result.diagnostic,
        audit: result.audit || audit,
        config: {
          smtpHost: config.host,
          smtpPort: config.port,
          smtpUser: config.user,
          fromEmail: config.fromEmail,
          encryption: config.secure ? 'SSL' : 'STARTTLS',
          hasSmtpPass: true,
          passLength,
        },
        attempts: result.attempts,
      });
    }
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error?.message || 'Unexpected error during SMTP verification',
      audit,
    });
  }
}
