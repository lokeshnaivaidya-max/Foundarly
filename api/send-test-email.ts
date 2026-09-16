import dotenv from 'dotenv';
import {
  generateUserEmailHTML,
  generateUserEmailText,
  EmailBookingData,
} from '../src/utils/emailTemplates.js';
import { sendEmail, getSmtpConfig } from '../src/server/mailer.js';

dotenv.config();

interface RequestLike {
  method?: string;
  body?: any;
}

interface ResponseLike {
  status: (code: number) => ResponseLike;
  json: (data: any) => ResponseLike;
  end: () => void;
  setHeader: (name: string, value: string) => void;
}

export default async function handler(req: RequestLike, res: ResponseLike) {
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
    const { recipient } = parsedBody || {};
    const targetRecipient = (recipient || 'hello@foundarlybusinessworld.in').trim();

    const smtpConfig = getSmtpConfig();
    if (!smtpConfig.pass) {
      return res.status(400).json({
        success: false,
        error: 'SMTP_PASS environment variable is not configured.',
        diagnostic: 'Missing SMTP_PASS environment variable in server/Vercel settings.',
      });
    }

    const testData: EmailBookingData = {
      bookingId: 'test-' + Date.now(),
      userName: 'Test User',
      userEmail: targetRecipient,
      consultantName: 'Foundarly Team',
      consultantEmail: smtpConfig.fromEmail,
      date: new Date().toISOString().split('T')[0],
      time: '10:00 AM',
      duration: 45,
      meetingLink: `https://foundarly.com/meeting/test-${Date.now()}`,
      meetingRoomId: `test-${Date.now()}`,
      price: 0,
      message: 'This is a verification test of the Foundarly booking confirmation email system.',
    };

    const html = generateUserEmailHTML(testData);
    const text = generateUserEmailText(testData);

    const result = await sendEmail({
      from: smtpConfig.defaultFrom,
      to: targetRecipient,
      replyTo: smtpConfig.replyTo,
      subject: '✓ Test Booking Confirmation | Foundarly SMTP Verification',
      html,
      text,
    });

    if (result.success) {
      return res.status(200).json({
        success: true,
        message: `Test booking confirmation email sent successfully to ${targetRecipient}!`,
        messageId: result.messageId,
        details: result.details,
      });
    } else {
      return res.status(500).json({
        success: false,
        error: result.error,
        diagnostic: result.diagnostic,
        details: result.details,
      });
    }
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err?.message || 'Internal server error sending test email',
    });
  }
}
