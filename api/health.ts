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

  const hasSmtp = Boolean(process.env.SMTP_PASS);

  return res.status(200).json({
    status: 'ok',
    service: 'Foundarly Serverless API',
    emailService: 'Titan SMTP (Nodemailer)',
    emailConfigured: hasSmtp,
    smtpHost: process.env.SMTP_HOST || 'smtp.titan.email',
    smtpPort: parseInt(process.env.SMTP_PORT || '465', 10),
    smtpUser: process.env.SMTP_USER || 'hello@foundarlybusinessworld.in',
    fromEmail: process.env.FROM_EMAIL || 'hello@foundarlybusinessworld.in',
    replyTo: process.env.EMAIL_REPLY_TO || 'hello@foundarlybusinessworld.in',
    timestamp: new Date().toISOString(),
  });
}
