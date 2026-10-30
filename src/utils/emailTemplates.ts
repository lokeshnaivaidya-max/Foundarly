/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Foundarly Official Email Templates
 * Unified, responsive, production-ready transactional email templates
 * matching Foundarly's official brand palette, typography, and visual identity.
 */

export const FOUNDARLY_BRAND = {
  name: 'Foundarly',
  tagline: 'Expert Business Consultation & Professional Consulting Services',
  domain: 'https://www.foundarlybusinessworld.in',
  logoUrl: 'https://www.foundarlybusinessworld.in/logo.png',
  supportEmail: 'hello@foundarlybusinessworld.in',
  colors: {
    primaryGold: '#d97706',
    primaryGoldHover: '#b45309',
    amberLight: '#f59e0b',
    goldBg: '#fef3c7',
    goldBorder: '#fde68a',
    darkNavy: '#0f172a',
    navySecondary: '#1e293b',
    bodyText: '#334155',
    mutedText: '#64748b',
    subtleText: '#94a3b8',
    cardBg: '#ffffff',
    canvasBg: '#f8fafc',
    border: '#e2e8f0',
    emerald: '#10b981',
    emeraldBg: '#ecfdf5',
    emeraldBorder: '#a7f3d0',
    rose: '#ef4444',
    roseBg: '#fef2f2',
    roseBorder: '#fecaca',
    indigo: '#3b82f6',
    indigoBg: '#eff6ff',
    indigoBorder: '#bfdbfe',
  },
};

export interface EmailBookingData {
  bookingId: string;
  userName: string;
  userEmail: string;
  consultantName: string;
  consultantEmail?: string | null;
  date: string;
  time: string;
  duration: number;
  meetingLink: string;
  meetingRoomId?: string;
  price?: number;
  message?: string | null;
}

export interface EmailApplicationApprovedData {
  applicantName: string;
  applicantEmail: string;
  qualification?: string | null;
  currentJob?: string | null;
  preferredTiming?: string | null;
  adminNotes?: string | null;
  dashboardUrl?: string;
}

export interface EmailApplicationRejectedData {
  applicantName: string;
  applicantEmail: string;
  reason?: string | null;
  supportUrl?: string;
}

export interface EmailBookingRejectedData {
  bookingId: string;
  userName: string;
  userEmail: string;
  consultantName: string;
  date: string;
  time: string;
  reason?: string | null;
  supportUrl?: string;
}

export interface EmailFollowUpRequestedData {
  bookingId: string;
  clientName: string;
  clientEmail: string;
  consultantName: string;
  consultantEmail: string;
  reason: string;
  preferredDate: string;
  preferredTime: string;
  originalDate: string;
  originalTime: string;
  rejoinDeadline: string;
  dashboardUrl: string;
}

export interface EmailFollowUpAlternativeData {
  bookingId: string;
  clientName: string;
  clientEmail: string;
  consultantName: string;
  alternativeDate: string;
  alternativeTime: string;
  consultantNote?: string | null;
  reason: string;
  rejoinDeadline: string;
  dashboardUrl: string;
}

export interface EmailFollowUpConfirmedData {
  bookingId: string;
  clientName: string;
  clientEmail: string;
  consultantName: string;
  consultantEmail?: string | null;
  confirmedDate: string;
  confirmedTime: string;
  reason: string;
  meetingLink: string;
  meetingRoomId: string;
  rejoinDeadline: string;
}

export interface EmailFollowUpDeclinedData {
  bookingId: string;
  clientName: string;
  clientEmail: string;
  consultantName: string;
  reason?: string | null;
  declinedReason?: string | null;
  rejoinDeadline: string;
  supportUrl?: string;
}

export interface EmailParticipantWaitingData {
  bookingId: string;
  recipientName: string;
  recipientEmail: string;
  waitingUserName: string;
  waitingUserRole: 'client' | 'consultant';
  meetingLink: string;
  meetingRoomId: string;
  date?: string;
  time?: string;
  isFollowUp?: boolean;
}

export interface EmailSessionCompletedData {
  bookingId: string;
  userName: string;
  userEmail: string;
  consultantName: string;
  consultantEmail?: string | null;
  recipientRole: 'client' | 'consultant';
  recipientName: string;
  recipientEmail: string;
  date: string;
  time: string;
  sessionDuration: number;
  meetingRoomId: string;
  meetingLink: string;
  rejoinDeadline: string; // ISO date string
  rejoinExpiryFormatted: string; // Human-readable date & time (e.g. October 27, 2026 at 3:00 PM UTC)
  rejoinDaysRemaining?: number;
}

export interface EmailMeetingReminderData {
  bookingId: string;
  recipientName: string;
  recipientEmail: string;
  recipientRole: 'client' | 'consultant';
  partnerName: string;
  date: string;
  time: string;
  duration: number;
  meetingLink: string;
  meetingRoomId: string;
  timeframeLabel?: string; // e.g. "Starting in 1 hour" or "Tomorrow"
}

export interface EmailMeetingRoomInviteData {
  bookingId: string;
  recipientName: string;
  recipientEmail: string;
  inviterName: string;
  consultantName: string;
  clientName: string;
  date: string;
  time: string;
  duration: number;
  meetingLink: string;
  meetingRoomId: string;
  customMessage?: string;
}

export interface EmailRescheduleData {
  bookingId: string;
  clientName: string;
  clientEmail: string;
  consultantName: string;
  consultantEmail?: string | null;
  originalDate: string;
  originalTime: string;
  newDate: string;
  newTime: string;
  reason?: string | null;
  meetingLink?: string;
  dashboardUrl?: string;
}

export interface EmailPaymentConfirmationData {
  bookingId: string;
  userName: string;
  userEmail: string;
  consultantName: string;
  amount: number;
  currency?: string;
  paymentMethod?: string;
  transactionId?: string;
  date: string;
  time: string;
  duration: number;
  meetingLink: string;
  meetingRoomId: string;
}

export interface EmailVerificationData {
  userName: string;
  userEmail: string;
  verificationUrl: string;
}

export interface EmailPasswordResetData {
  userName: string;
  userEmail: string;
  resetUrl: string;
}

// ── UTILITIES ──

export function formatSessionDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export function escapeHTML(str: string | null | undefined): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function resolveSiteUrl(link?: string): string {
  if (link && link.startsWith('http')) {
    try {
      const u = new URL(link);
      if (
        u.hostname === 'localhost' ||
        u.hostname === '127.0.0.1' ||
        u.hostname.endsWith('.internal') ||
        u.hostname.includes('vercel.app') ||
        u.hostname.includes('run.app')
      ) {
        return FOUNDARLY_BRAND.domain;
      }
      return `${u.protocol === 'http:' ? 'https:' : u.protocol}//${u.host}`;
    } catch {
      // fallback
    }
  }
  return FOUNDARLY_BRAND.domain;
}

export function canonicalizeUrl(url?: string): string {
  if (!url || typeof url !== 'string' || !url.trim()) {
    return FOUNDARLY_BRAND.domain;
  }
  const clean = url.trim();
  if (clean.startsWith('mailto:')) {
    return clean;
  }
  if (clean.startsWith('/')) {
    return `${FOUNDARLY_BRAND.domain}${clean}`;
  }
  try {
    const parsed = new URL(clean);
    const isOutdatedOrLocal =
      parsed.hostname === 'localhost' ||
      parsed.hostname === '127.0.0.1' ||
      parsed.hostname.endsWith('.internal') ||
      parsed.hostname.includes('vercel.app') ||
      parsed.hostname.includes('run.app');

    if (isOutdatedOrLocal) {
      return `${FOUNDARLY_BRAND.domain}${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
    if (parsed.protocol === 'http:') {
      parsed.protocol = 'https:';
    }
    return parsed.toString();
  } catch {
    return `${FOUNDARLY_BRAND.domain}/${clean.replace(/^\/+/, '')}`;
  }
}

export function resolveMeetingLink(meetingLink?: string, meetingRoomId?: string, bookingId?: string): string {
  if (meetingLink && typeof meetingLink === 'string' && meetingLink.trim()) {
    return canonicalizeUrl(meetingLink);
  }
  const effectiveRoom = meetingRoomId || (bookingId ? (bookingId.startsWith('foundarly-') ? bookingId : `foundarly-${bookingId}`) : 'default-room');
  return `${FOUNDARLY_BRAND.domain}/meeting/${effectiveRoom}`;
}

// ── BRANDED HEADER & FOOTER BUILDERS ──

interface HeaderOptions {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  theme?: 'gold' | 'navy' | 'emerald' | 'rose' | 'indigo' | 'slate';
}

function renderHeader(opts: HeaderOptions): string {
  let gradientBg = 'background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);';
  let accentBorder = 'border-bottom: 3px solid #d97706;';
  let eyebrowColor = '#f59e0b';
  let subtitleColor = '#94a3b8';

  if (opts.theme === 'gold') {
    gradientBg = 'background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);';
    accentBorder = 'border-bottom: 3px solid #b45309;';
    eyebrowColor = '#ffffff';
    subtitleColor = '#fef3c7';
  } else if (opts.theme === 'emerald') {
    gradientBg = 'background: linear-gradient(135deg, #10b981 0%, #059669 100%);';
    accentBorder = 'border-bottom: 3px solid #047857;';
    eyebrowColor = '#ffffff';
    subtitleColor = '#d1fae5';
  } else if (opts.theme === 'rose') {
    gradientBg = 'background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);';
    accentBorder = 'border-bottom: 3px solid #991b1b;';
    eyebrowColor = '#ffffff';
    subtitleColor = '#fee2e2';
  } else if (opts.theme === 'indigo') {
    gradientBg = 'background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);';
    accentBorder = 'border-bottom: 3px solid #1e40af;';
    eyebrowColor = '#ffffff';
    subtitleColor = '#dbeafe';
  } else if (opts.theme === 'slate') {
    gradientBg = 'background: linear-gradient(135deg, #475569 0%, #334155 100%);';
    accentBorder = 'border-bottom: 3px solid #1e293b;';
    eyebrowColor = '#cbd5e1';
    subtitleColor = '#e2e8f0';
  }

  const eyebrow = opts.eyebrow || 'FOUNDARLY • BUSINESS WORLD';

  return `
    <!-- Branded Header -->
    <tr>
      <td style="${gradientBg} ${accentBorder} padding: 36px 28px; text-align: center;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td align="center">
              <a href="${FOUNDARLY_BRAND.domain}" target="_blank" rel="noopener noreferrer" style="text-decoration: none; display: inline-block;">
                <img src="${FOUNDARLY_BRAND.logoUrl}" alt="Foundarly" width="140" height="auto" style="display: block; border: 0; outline: none; margin: 0 auto 12px auto; max-width: 150px;" onerror="this.style.display='none'" />
              </a>
              <p style="margin: 0 0 8px 0; font-size: 11px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: ${eyebrowColor};">
                ${escapeHTML(eyebrow)}
              </p>
              <h1 style="margin: 0 0 6px 0; color: #ffffff; font-size: 24px; font-weight: 700; line-height: 1.3; letter-spacing: -0.02em;">
                ${escapeHTML(opts.title)}
              </h1>
              ${opts.subtitle ? `<p style="margin: 0; color: ${subtitleColor}; font-size: 14px; line-height: 1.5;">${escapeHTML(opts.subtitle)}</p>` : ''}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
}

function renderFooter(options?: { recipientEmail?: string; customNote?: string }): string {
  const currentYear = new Date().getFullYear();
  return `
    <!-- Branded Footer -->
    <tr>
      <td style="background-color: #f8fafc; padding: 24px 28px; text-align: center; border-top: 1px solid #e2e8f0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td align="center">
              <p style="margin: 0 0 8px 0; color: #0f172a; font-size: 13px; font-weight: 700; letter-spacing: 0.5px;">
                Foundarly Consultation Platform
              </p>
              <p style="margin: 0 0 12px 0; color: #64748b; font-size: 12px; line-height: 1.5;">
                1-on-1 Expert Business Mentorship &amp; Verified Professional Consulting
              </p>
              <p style="margin: 0 0 14px 0; font-size: 12px; color: #64748b;">
                <a href="${FOUNDARLY_BRAND.domain}" style="color: #d97706; text-decoration: none; font-weight: 600;">Visit Website</a>
                &nbsp;•&nbsp;
                <a href="${FOUNDARLY_BRAND.domain}/my-bookings" style="color: #d97706; text-decoration: none; font-weight: 600;">My Bookings</a>
                &nbsp;•&nbsp;
                <a href="mailto:${FOUNDARLY_BRAND.supportEmail}" style="color: #d97706; text-decoration: none; font-weight: 600;">Support Helpdesk</a>
              </p>
              ${options?.customNote ? `<p style="margin: 0 0 8px 0; color: #94a3b8; font-size: 11px;">${escapeHTML(options.customNote)}</p>` : ''}
              <p style="margin: 0 0 4px 0; color: #94a3b8; font-size: 11px;">
                You received this transactional email because you have an account or consultation on <a href="${FOUNDARLY_BRAND.domain}" style="color: #94a3b8; text-decoration: underline;">${FOUNDARLY_BRAND.domain}</a>.
              </p>
              <p style="margin: 0; color: #94a3b8; font-size: 11px;">
                © ${currentYear} Foundarly. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
}

function renderCtaButton(url: string, label: string, color: 'gold' | 'emerald' | 'navy' | 'rose' = 'gold'): string {
  const safeUrl = canonicalizeUrl(url);
  let bg = 'background-color: #d97706; background: linear-gradient(135deg, #d97706 0%, #b45309 100%);';
  let shadow = 'box-shadow: 0 4px 12px rgba(217, 119, 6, 0.3);';

  if (color === 'emerald') {
    bg = 'background-color: #10b981; background: linear-gradient(135deg, #10b981 0%, #059669 100%);';
    shadow = 'box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);';
  } else if (color === 'navy') {
    bg = 'background-color: #0f172a; background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);';
    shadow = 'box-shadow: 0 4px 12px rgba(15, 23, 42, 0.3);';
  } else if (color === 'rose') {
    bg = 'background-color: #ef4444; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);';
    shadow = 'box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);';
  }

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 28px 0;">
      <tr>
        <td align="center">
          <!--[if mso]>
          <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${safeUrl}" style="height:48px;v-text-anchor:middle;width:280px;" arcsize="15%" stroke="f" fillcolor="#d97706">
          <w:anchorlock/>
          <center style="color:#ffffff;font-family:sans-serif;font-size:15px;font-weight:bold;">${escapeHTML(label)}</center>
          </v:roundrect>
          <![endif]-->
          <!--[if !mso]><!-- -->
          <a href="${safeUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; ${bg} ${shadow} color: #ffffff; text-decoration: none; padding: 15px 36px; border-radius: 8px; font-size: 15px; font-weight: 600; letter-spacing: 0.2px; text-align: center;">
            ${escapeHTML(label)} &rarr;
          </a>
          <!--<![endif]-->
        </td>
      </tr>
    </table>
  `;
}

function renderDirectLinkBox(url: string, label: string = 'Direct Link to Join:'): string {
  const safeUrl = canonicalizeUrl(url);
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; margin: 16px 0; padding: 14px;">
      <tr>
        <td>
          <p style="margin: 0 0 6px; color: #64748b; font-size: 11px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">${escapeHTML(label)}</p>
          <a href="${safeUrl}" target="_blank" rel="noopener noreferrer" style="color: #b45309; font-size: 13px; font-family: monospace; word-break: break-all; text-decoration: underline;">${escapeHTML(safeUrl)}</a>
        </td>
      </tr>
    </table>
  `;
}

function wrapEmailDocument(title: string, headerHtml: string, contentHtml: string, footerHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
  <title>${escapeHTML(title)} - Foundarly</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    @media only screen and (max-width: 620px) {
      .email-container { width: 100% !important; max-width: 100% !important; border-radius: 0 !important; }
      .mobile-padding { padding: 24px 18px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8fafc; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table class="email-container" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0;">
          ${headerHtml}
          <tr>
            <td class="mobile-padding" style="padding: 36px 30px;">
              ${contentHtml}
            </td>
          </tr>
          ${footerHtml}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/* ==========================================================================
   1. CLIENT BOOKING CONFIRMATION EMAIL
   ========================================================================== */

export function generateUserEmailHTML(data: EmailBookingData): string {
  const formattedDate = formatSessionDate(data.date);
  const timing = data.time && data.time !== 'Flexible' ? data.time : 'Flexible Time';
  const siteUrl = resolveSiteUrl(data.meetingLink);
  const dashboardLink = `${siteUrl}/my-bookings`;
  const roomName = data.meetingRoomId || `foundarly-${data.bookingId}`;

  const header = renderHeader({
    title: 'Booking Confirmation',
    subtitle: 'Your 1-on-1 consultation session is scheduled & confirmed',
    theme: 'gold',
  });

  const content = `
    <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: #0f172a;">
      Hi <strong>${escapeHTML(data.userName)}</strong>,
    </p>
    <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.6; color: #334155;">
      Your 1-on-1 consultation session with <strong>${escapeHTML(data.consultantName)}</strong> is confirmed. Below are your meeting credentials and appointment details:
    </p>

    <!-- Session Details Card -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #fefce8; border-radius: 10px; border: 1px solid #fde68a; margin: 20px 0;">
      <tr>
        <td style="padding: 22px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size: 14px;">
            <tr>
              <td style="color: #64748b; width: 35%; padding: 7px 0;">Consultant:</td>
              <td style="color: #0f172a; font-weight: 700; text-align: right; padding: 7px 0;">${escapeHTML(data.consultantName)}</td>
            </tr>
            <tr>
              <td style="color: #64748b; padding: 7px 0;">Date:</td>
              <td style="color: #0f172a; font-weight: 600; text-align: right; padding: 7px 0;">${escapeHTML(formattedDate)}</td>
            </tr>
            <tr>
              <td style="color: #64748b; padding: 7px 0;">Time:</td>
              <td style="color: #0f172a; font-weight: 600; text-align: right; padding: 7px 0;">${escapeHTML(timing)}</td>
            </tr>
            <tr>
              <td style="color: #64748b; padding: 7px 0;">Duration:</td>
              <td style="color: #0f172a; font-weight: 600; text-align: right; padding: 7px 0;">${data.duration} Minutes</td>
            </tr>
            <tr>
              <td style="color: #64748b; padding: 7px 0;">Meeting Room ID:</td>
              <td style="color: #0f172a; font-family: monospace; font-size: 13px; text-align: right; padding: 7px 0;">${escapeHTML(roomName)}</td>
            </tr>
            <tr>
              <td style="color: #64748b; padding: 7px 0;">Booking ID:</td>
              <td style="color: #0f172a; font-family: monospace; font-size: 13px; text-align: right; padding: 7px 0;">${escapeHTML(data.bookingId)}</td>
            </tr>
            ${data.price !== undefined ? `
            <tr>
              <td style="color: #64748b; padding: 7px 0; border-top: 1px dashed #fde68a;">Session Fee:</td>
              <td style="color: #d97706; font-weight: 700; text-align: right; padding: 7px 0; border-top: 1px dashed #fde68a;">₹${data.price}</td>
            </tr>` : ''}
          </table>
        </td>
      </tr>
    </table>

    <!-- Join Video Meeting Room Button -->
    ${renderCtaButton(data.meetingLink, 'Join Video Meeting Room', 'gold')}

    <p style="margin: 0 0 16px; color: #64748b; font-size: 13px; text-align: center;">
      Please join 5 minutes before your scheduled start time. Both participants will enter the same secure meeting room.
    </p>

    ${renderDirectLinkBox(data.meetingLink, 'Direct Link to Join:')}

    <!-- 7-Day Follow-Up Policy Assurance -->
    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 24px 0;">
      <p style="margin: 0 0 6px; color: #0f172a; font-size: 13px; font-weight: 700;">✨ Foundarly 7-Day Post-Meeting Rejoin Guarantee</p>
      <p style="margin: 0; color: #475569; font-size: 12px; line-height: 1.5;">
        After your session completes, you can rejoin this exact meeting room for up to 7 days for quick follow-up questions and clarifications directly with your consultant.
      </p>
    </div>

    <p style="margin: 24px 0 0; color: #64748b; font-size: 14px; line-height: 1.5;">
      Need to reschedule or view your appointments? You can manage your bookings anytime on your <a href="${dashboardLink}" style="color: #d97706; text-decoration: underline; font-weight: 600;">Foundarly Dashboard</a>.
    </p>
  `;

  return wrapEmailDocument('Booking Confirmation', header, content, renderFooter({ recipientEmail: data.userEmail }));
}

export function generateUserEmailText(data: EmailBookingData): string {
  const formattedDate = formatSessionDate(data.date);
  const timing = data.time && data.time !== 'Flexible' ? data.time : 'Flexible Time';
  const siteUrl = resolveSiteUrl(data.meetingLink);
  const dashboardLink = `${siteUrl}/my-bookings`;

  return `Booking Confirmation – Your Foundarly Consultation Is Scheduled

Hi ${data.userName},

Your 1-on-1 consultation session with ${data.consultantName} is confirmed.

SESSION DETAILS:
- Consultant: ${data.consultantName}
- Date: ${formattedDate}
- Time: ${timing}
- Duration: ${data.duration} Minutes
- Room ID: ${data.meetingRoomId || `foundarly-${data.bookingId}`}
- Booking ID: ${data.bookingId}
${data.price !== undefined ? `- Session Fee: ₹${data.price}\n` : ''}
JOIN VIDEO MEETING ROOM:
${data.meetingLink}
(Please join 5 minutes before your scheduled start time)

7-DAY FOLLOW-UP GUARANTEE:
You can rejoin this exact meeting room for up to 7 days after the session completes for follow-up clarifications.

Manage your bookings: ${dashboardLink}

---
Foundarly Consultation Platform
Contact: ${FOUNDARLY_BRAND.supportEmail}
Website: ${FOUNDARLY_BRAND.domain}`;
}

/* ==========================================================================
   2. CONSULTANT BOOKING NOTIFICATION EMAIL
   ========================================================================== */

export function generateConsultantEmailHTML(data: EmailBookingData): string {
  const formattedDate = formatSessionDate(data.date);
  const timing = data.time && data.time !== 'Flexible' ? data.time : 'Flexible Time';
  const siteUrl = resolveSiteUrl(data.meetingLink);
  const consultantDashboard = `${siteUrl}/consultant/dashboard`;
  const roomName = data.meetingRoomId || `foundarly-${data.bookingId}`;

  const header = renderHeader({
    title: 'New Consultation Booked',
    subtitle: 'A client has scheduled a 1-on-1 consultation session with you',
    theme: 'navy',
  });

  const content = `
    <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: #0f172a;">
      Hi <strong>${escapeHTML(data.consultantName)}</strong>,
    </p>
    <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.6; color: #334155;">
      You have a new consultation session scheduled with <strong>${escapeHTML(data.userName)}</strong> on Foundarly.
    </p>

    <!-- Details Card -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #fefce8; border-radius: 10px; border: 1px solid #fde68a; margin: 20px 0;">
      <tr>
        <td style="padding: 22px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size: 14px;">
            <tr>
              <td style="color: #64748b; width: 35%; padding: 7px 0;">Client Name:</td>
              <td style="color: #0f172a; font-weight: 700; text-align: right; padding: 7px 0;">${escapeHTML(data.userName)}</td>
            </tr>
            <tr>
              <td style="color: #64748b; padding: 7px 0;">Client Email:</td>
              <td style="color: #0f172a; font-weight: 600; text-align: right; padding: 7px 0;">${escapeHTML(data.userEmail)}</td>
            </tr>
            <tr>
              <td style="color: #64748b; padding: 7px 0;">Date:</td>
              <td style="color: #0f172a; font-weight: 600; text-align: right; padding: 7px 0;">${escapeHTML(formattedDate)}</td>
            </tr>
            <tr>
              <td style="color: #64748b; padding: 7px 0;">Time:</td>
              <td style="color: #0f172a; font-weight: 600; text-align: right; padding: 7px 0;">${escapeHTML(timing)}</td>
            </tr>
            <tr>
              <td style="color: #64748b; padding: 7px 0;">Duration:</td>
              <td style="color: #0f172a; font-weight: 600; text-align: right; padding: 7px 0;">${data.duration} Minutes</td>
            </tr>
            <tr>
              <td style="color: #64748b; padding: 7px 0;">Meeting Room ID:</td>
              <td style="color: #0f172a; font-family: monospace; font-size: 13px; text-align: right; padding: 7px 0;">${escapeHTML(roomName)}</td>
            </tr>
            <tr>
              <td style="color: #64748b; padding: 7px 0;">Booking ID:</td>
              <td style="color: #0f172a; font-family: monospace; font-size: 13px; text-align: right; padding: 7px 0;">${escapeHTML(data.bookingId)}</td>
            </tr>
            ${data.message ? `
            <tr>
              <td style="color: #64748b; padding: 7px 0; vertical-align: top; border-top: 1px dashed #fde68a;">Client Topic / Note:</td>
              <td style="color: #0f172a; text-align: right; padding: 7px 0; border-top: 1px dashed #fde68a;">${escapeHTML(data.message)}</td>
            </tr>` : ''}
          </table>
        </td>
      </tr>
    </table>

    <!-- CTA Button -->
    ${renderCtaButton(data.meetingLink, 'Open Video Meeting Room', 'gold')}

    ${renderDirectLinkBox(data.meetingLink, 'Direct Link to Join Room:')}

    <p style="margin: 20px 0 0; color: #64748b; font-size: 14px; line-height: 1.5; text-align: center;">
      View and manage all your scheduled sessions on your <a href="${consultantDashboard}" style="color: #d97706; text-decoration: underline; font-weight: 600;">Consultant Dashboard</a>.
    </p>
  `;

  return wrapEmailDocument('New Booking Scheduled', header, content, renderFooter({ recipientEmail: data.consultantEmail || undefined }));
}

export function generateConsultantEmailText(data: EmailBookingData): string {
  const formattedDate = formatSessionDate(data.date);
  const timing = data.time && data.time !== 'Flexible' ? data.time : 'Flexible Time';
  const siteUrl = resolveSiteUrl(data.meetingLink);

  return `New Consultation Booking – Foundarly

Hi ${data.consultantName},

You have a new consultation session scheduled with ${data.userName}.

SESSION DETAILS:
- Client: ${data.userName} (${data.userEmail})
- Date: ${formattedDate}
- Time: ${timing}
- Duration: ${data.duration} Minutes
- Room ID: ${data.meetingRoomId || `foundarly-${data.bookingId}`}
- Booking ID: ${data.bookingId}
${data.message ? `- Topic / Notes: ${data.message}\n` : ''}
OPEN VIDEO MEETING ROOM:
${data.meetingLink}

Consultant Dashboard: ${siteUrl}/consultant/dashboard

---
Foundarly Consultation Platform
Contact: ${FOUNDARLY_BRAND.supportEmail}`;
}

/* ==========================================================================
   3. MEETING REMINDER EMAIL
   ========================================================================== */

export function generateMeetingReminderEmailHTML(data: EmailMeetingReminderData): string {
  const formattedDate = formatSessionDate(data.date);
  const siteUrl = resolveSiteUrl(data.meetingLink);
  const dashboardUrl = data.recipientRole === 'consultant' ? `${siteUrl}/consultant/dashboard` : `${siteUrl}/my-bookings`;
  const timeframe = data.timeframeLabel || 'Starting Soon';

  const header = renderHeader({
    title: 'Your Foundarly Meeting Reminder',
    subtitle: `${timeframe} – 1-on-1 Consultation Session`,
    theme: 'navy',
  });

  const content = `
    <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: #0f172a;">
      Hello <strong>${escapeHTML(data.recipientName)}</strong>,
    </p>
    <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.6; color: #334155;">
      This is a friendly reminder that your Foundarly consultation session with <strong>${escapeHTML(data.partnerName)}</strong> is <strong>${escapeHTML(timeframe.toLowerCase())}</strong>.
    </p>

    <!-- Meeting Card -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #fefce8; border-radius: 10px; border: 1px solid #fde68a; margin: 20px 0;">
      <tr>
        <td style="padding: 22px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size: 14px;">
            <tr>
              <td style="color: #64748b; width: 35%; padding: 7px 0;">Participant:</td>
              <td style="color: #0f172a; font-weight: 700; text-align: right; padding: 7px 0;">${escapeHTML(data.partnerName)}</td>
            </tr>
            <tr>
              <td style="color: #64748b; padding: 7px 0;">Scheduled Date:</td>
              <td style="color: #0f172a; font-weight: 600; text-align: right; padding: 7px 0;">${escapeHTML(formattedDate)}</td>
            </tr>
            <tr>
              <td style="color: #64748b; padding: 7px 0;">Start Time:</td>
              <td style="color: #d97706; font-weight: 700; text-align: right; padding: 7px 0;">${escapeHTML(data.time)}</td>
            </tr>
            <tr>
              <td style="color: #64748b; padding: 7px 0;">Duration:</td>
              <td style="color: #0f172a; font-weight: 600; text-align: right; padding: 7px 0;">${data.duration} Minutes</td>
            </tr>
            <tr>
              <td style="color: #64748b; padding: 7px 0;">Room ID:</td>
              <td style="color: #0f172a; font-family: monospace; font-size: 13px; text-align: right; padding: 7px 0;">${escapeHTML(data.meetingRoomId)}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    ${renderCtaButton(data.meetingLink, 'Open Video Meeting Room', 'gold')}

    ${renderDirectLinkBox(data.meetingLink, 'Direct Meeting URL:')}

    <p style="margin: 20px 0 0; color: #64748b; font-size: 13px; line-height: 1.5; text-align: center;">
      Please check that your camera and microphone are connected and test your audio before entering.
    </p>
    <p style="margin: 12px 0 0; color: #64748b; font-size: 13px; text-align: center;">
      View details in your <a href="${dashboardUrl}" style="color: #d97706; text-decoration: underline; font-weight: 600;">Foundarly Dashboard</a>.
    </p>
  `;

  return wrapEmailDocument('Your Foundarly Meeting Reminder', header, content, renderFooter({ recipientEmail: data.recipientEmail }));
}

export function generateMeetingReminderEmailText(data: EmailMeetingReminderData): string {
  return `Your Foundarly Meeting Reminder – ${data.timeframeLabel || 'Starting Soon'}

Hello ${data.recipientName},

Your consultation session with ${data.partnerName} is starting soon.

SESSION DETAILS:
- Participant: ${data.partnerName}
- Date: ${formatSessionDate(data.date)}
- Time: ${data.time}
- Duration: ${data.duration} Minutes
- Meeting Room ID: ${data.meetingRoomId}

JOIN VIDEO MEETING ROOM:
${data.meetingLink}

---
Foundarly Consultation Platform
Contact: ${FOUNDARLY_BRAND.supportEmail}`;
}

/* ==========================================================================
   4. MEETING ROOM INVITATION EMAIL
   ========================================================================== */

export function generateMeetingRoomInviteEmailHTML(data: EmailMeetingRoomInviteData): string {
  const formattedDate = formatSessionDate(data.date);

  const header = renderHeader({
    title: 'Meeting Room Invitation',
    subtitle: `1-on-1 Video Consultation Room`,
    theme: 'navy',
  });

  const content = `
    <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: #0f172a;">
      Hello <strong>${escapeHTML(data.recipientName)}</strong>,
    </p>
    <p style="margin: 0 0 20px; font-size: 15px; line-height: 1.6; color: #334155;">
      You have been invited by <strong>${escapeHTML(data.inviterName)}</strong> to join your private video consultation room on Foundarly.
    </p>

    ${data.customMessage ? `
      <div style="background-color: #f8fafc; border-left: 4px solid #d97706; padding: 14px 18px; margin: 16px 0; border-radius: 4px;">
        <p style="margin: 0; font-size: 14px; color: #1e293b; font-style: italic;">"${escapeHTML(data.customMessage)}"</p>
      </div>
    ` : ''}

    <!-- Details Card -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #fefce8; border-radius: 10px; border: 1px solid #fde68a; margin: 20px 0;">
      <tr>
        <td style="padding: 22px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size: 14px;">
            <tr>
              <td style="color: #64748b; width: 35%; padding: 7px 0;">Consultant:</td>
              <td style="color: #0f172a; font-weight: 700; text-align: right; padding: 7px 0;">${escapeHTML(data.consultantName)}</td>
            </tr>
            <tr>
              <td style="color: #64748b; padding: 7px 0;">Client:</td>
              <td style="color: #0f172a; font-weight: 700; text-align: right; padding: 7px 0;">${escapeHTML(data.clientName)}</td>
            </tr>
            <tr>
              <td style="color: #64748b; padding: 7px 0;">Date:</td>
              <td style="color: #0f172a; font-weight: 600; text-align: right; padding: 7px 0;">${escapeHTML(formattedDate)}</td>
            </tr>
            <tr>
              <td style="color: #64748b; padding: 7px 0;">Time:</td>
              <td style="color: #0f172a; font-weight: 600; text-align: right; padding: 7px 0;">${escapeHTML(data.time)}</td>
            </tr>
            <tr>
              <td style="color: #64748b; padding: 7px 0;">Room ID:</td>
              <td style="color: #0f172a; font-family: monospace; font-size: 13px; text-align: right; padding: 7px 0;">${escapeHTML(data.meetingRoomId)}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    ${renderCtaButton(data.meetingLink, 'Join Video Meeting Room', 'gold')}

    ${renderDirectLinkBox(data.meetingLink, 'Direct Link to Join Room:')}
  `;

  return wrapEmailDocument('Meeting Room Invitation', header, content, renderFooter({ recipientEmail: data.recipientEmail }));
}

export function generateMeetingRoomInviteEmailText(data: EmailMeetingRoomInviteData): string {
  return `Join Video Meeting Room – Foundarly Consultation

Hello ${data.recipientName},

You have been invited by ${data.inviterName} to enter your consultation meeting room.

Consultant: ${data.consultantName}
Client: ${data.clientName}
Date: ${formatSessionDate(data.date)}
Time: ${data.time}
Room ID: ${data.meetingRoomId}

JOIN VIDEO MEETING ROOM:
${data.meetingLink}

---
Foundarly Consultation Platform`;
}

/* ==========================================================================
   5. BOOKING RESCHEDULING & CANCELLATION EMAILS
   ========================================================================== */

export function generateRescheduleRequestedEmailHTML(data: EmailRescheduleData): string {
  const formattedOrigDate = formatSessionDate(data.originalDate);
  const formattedNewDate = formatSessionDate(data.newDate);
  const siteUrl = resolveSiteUrl(data.meetingLink);
  const dashboardUrl = data.dashboardUrl || `${siteUrl}/consultant/dashboard`;

  const header = renderHeader({
    title: 'Reschedule Request',
    subtitle: 'A client has requested a new consultation time',
    theme: 'gold',
  });

  const content = `
    <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: #0f172a;">
      Hello <strong>${escapeHTML(data.consultantName)}</strong>,
    </p>
    <p style="margin: 0 0 20px; font-size: 15px; line-height: 1.6; color: #334155;">
      Your client <strong>${escapeHTML(data.clientName)}</strong> has requested to reschedule their consultation session. Please review their proposed time and respond directly in your dashboard.
    </p>

    <!-- Comparison Card -->
    <div style="background-color: #fefce8; border: 1px solid #fde68a; border-radius: 10px; padding: 20px; margin: 20px 0;">
      <p style="margin: 0 0 10px; font-size: 14px; color: #64748b;">
        <strong>Original Schedule:</strong> <span style="color: #0f172a;">${escapeHTML(formattedOrigDate)} at ${escapeHTML(data.originalTime)}</span>
      </p>
      <p style="margin: 0 0 10px; font-size: 14px; color: #b45309;">
        <strong>Proposed New Schedule:</strong> <span style="font-weight: 700; color: #d97706;">${escapeHTML(formattedNewDate)} at ${escapeHTML(data.newTime)}</span>
      </p>
      <p style="margin: 0 0 10px; font-size: 13px; color: #64748b;">
        <strong>Booking ID:</strong> <code style="color: #0f172a;">${escapeHTML(data.bookingId)}</code>
      </p>
      ${data.reason ? `
        <div style="margin-top: 12px; padding: 12px 14px; background-color: #ffffff; border-left: 3px solid #d97706; border-radius: 4px;">
          <p style="margin: 0 0 4px; font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b;">Reason for Rescheduling:</p>
          <p style="margin: 0; font-size: 13px; color: #1e293b;">${escapeHTML(data.reason)}</p>
        </div>
      ` : ''}
    </div>

    ${renderCtaButton(dashboardUrl, 'Review on Consultant Dashboard', 'gold')}

    <p style="margin: 20px 0 0; color: #64748b; font-size: 13px; line-height: 1.5; text-align: center;">
      You can accept this proposed time or offer an alternative slot directly from your dashboard.
    </p>
  `;

  return wrapEmailDocument('Consultation Reschedule Request', header, content, renderFooter({ recipientEmail: data.consultantEmail || undefined }));
}

export function generateRescheduleRequestedEmailText(data: EmailRescheduleData): string {
  return `Consultation Reschedule Request – Foundarly

Hello ${data.consultantName},

Your client ${data.clientName} has requested to reschedule their consultation session.

Original Session: ${formatSessionDate(data.originalDate)} at ${data.originalTime}
Proposed New Schedule: ${formatSessionDate(data.newDate)} at ${data.newTime}
Booking ID: ${data.bookingId}
${data.reason ? `Reason: ${data.reason}\n` : ''}
Please review and accept or suggest an alternative on your Consultant Dashboard:
${data.dashboardUrl || `${FOUNDARLY_BRAND.domain}/consultant/dashboard`}

---
Foundarly Consultation Platform`;
}

export function generateRescheduleConfirmedEmailHTML(data: EmailRescheduleData): string {
  const formattedNewDate = formatSessionDate(data.newDate);
  const siteUrl = resolveSiteUrl(data.meetingLink);
  const meetingUrl = data.meetingLink || `${siteUrl}/meeting/foundarly-${data.bookingId}`;

  const header = renderHeader({
    title: 'Consultation Rescheduled',
    subtitle: 'Your session has been updated to the confirmed new time',
    theme: 'emerald',
  });

  const content = `
    <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: #0f172a;">
      Hello <strong>${escapeHTML(data.clientName)}</strong> &amp; <strong>${escapeHTML(data.consultantName)}</strong>,
    </p>
    <p style="margin: 0 0 20px; font-size: 15px; line-height: 1.6; color: #334155;">
      Your consultation reschedule has been confirmed! Both participants will connect in the exact same meeting room at the new time.
    </p>

    <!-- New Schedule Box -->
    <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 10px; padding: 22px; margin: 20px 0;">
      <p style="margin: 0 0 8px; font-size: 16px; color: #065f46; font-weight: 700;">
        📅 New Confirmed Time: ${escapeHTML(formattedNewDate)} at ${escapeHTML(data.newTime)}
      </p>
      <p style="margin: 0 0 8px; font-size: 13px; color: #047857;">
        <strong>Booking ID:</strong> <code>${escapeHTML(data.bookingId)}</code>
      </p>
      <p style="margin: 0; font-size: 13px; color: #047857;">
        <strong>Previous Time:</strong> ${escapeHTML(formatSessionDate(data.originalDate))} at ${escapeHTML(data.originalTime)}
      </p>
    </div>

    ${renderCtaButton(meetingUrl, 'Open Video Meeting Room', 'emerald')}

    ${renderDirectLinkBox(meetingUrl, 'Meeting Room URL:')}
  `;

  return wrapEmailDocument('Your Consultation Has Been Rescheduled', header, content, renderFooter({ recipientEmail: data.clientEmail }));
}

export function generateRescheduleConfirmedEmailText(data: EmailRescheduleData): string {
  const siteUrl = resolveSiteUrl(data.meetingLink);
  const meetingUrl = data.meetingLink || `${siteUrl}/meeting/foundarly-${data.bookingId}`;

  return `Your Consultation Has Been Rescheduled – Foundarly

Dear ${data.clientName} & ${data.consultantName},

Your consultation reschedule is confirmed!

NEW SCHEDULE:
- Date: ${formatSessionDate(data.newDate)}
- Time: ${data.newTime}
- Booking ID: ${data.bookingId}

JOIN VIDEO MEETING ROOM:
${meetingUrl}

---
Foundarly Consultation Platform`;
}

export function generateBookingRejectedEmailHTML(data: EmailBookingRejectedData): string {
  const formattedDate = formatSessionDate(data.date);
  const siteUrl = data.supportUrl || FOUNDARLY_BRAND.domain;

  const header = renderHeader({
    title: 'Consultation Booking Update',
    subtitle: 'Booking Status Update',
    theme: 'rose',
  });

  const content = `
    <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: #0f172a;">
      Dear <strong>${escapeHTML(data.userName)}</strong>,
    </p>
    <p style="margin: 0 0 20px; font-size: 15px; line-height: 1.6; color: #334155;">
      We are writing to notify you that your consultation booking with <strong>${escapeHTML(data.consultantName)}</strong> could not be confirmed and has been cancelled.
    </p>

    <!-- Details Card -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; margin: 20px 0; padding: 18px;">
      <tr>
        <td style="padding: 6px 0; font-size: 13px; color: #64748b; width: 140px;">Booking ID:</td>
        <td style="padding: 6px 0; font-size: 13px; font-weight: 600; font-family: monospace; color: #0f172a;">${escapeHTML(data.bookingId)}</td>
      </tr>
      <tr>
        <td style="padding: 6px 0; font-size: 13px; color: #64748b;">Scheduled Date:</td>
        <td style="padding: 6px 0; font-size: 13px; font-weight: 600; color: #0f172a;">${escapeHTML(formattedDate)}</td>
      </tr>
      <tr>
        <td style="padding: 6px 0; font-size: 13px; color: #64748b;">Scheduled Time:</td>
        <td style="padding: 6px 0; font-size: 13px; font-weight: 600; color: #0f172a;">${escapeHTML(data.time)}</td>
      </tr>
    </table>

    ${data.reason ? `
      <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 14px 18px; margin: 18px 0;">
        <p style="margin: 0 0 4px; color: #991b1b; font-size: 11px; font-weight: 700; text-transform: uppercase;">Cancellation / Rejection Reason:</p>
        <p style="margin: 0; color: #b91c1c; font-size: 13px; line-height: 1.5;">${escapeHTML(data.reason)}</p>
      </div>
    ` : ''}

    <p style="margin: 20px 0 16px; color: #475569; font-size: 14px; line-height: 1.6;">
      If you completed a payment, any applicable refund or credit will be processed promptly according to our policies. You can schedule another consultation anytime with our verified experts.
    </p>

    ${renderCtaButton(`${siteUrl}/consultants`, 'Explore Other Consultants', 'navy')}

    <p style="margin: 24px 0 0; color: #64748b; font-size: 13px; line-height: 1.5; text-align: center;">
      Need assistance? Reply directly to this email or contact us at <a href="mailto:${FOUNDARLY_BRAND.supportEmail}" style="color: #d97706; text-decoration: underline;">${FOUNDARLY_BRAND.supportEmail}</a>.
    </p>
  `;

  return wrapEmailDocument('Consultation Booking Update', header, content, renderFooter({ recipientEmail: data.userEmail }));
}

export function generateBookingRejectedEmailText(data: EmailBookingRejectedData): string {
  return `Consultation Booking Update - Foundarly

Dear ${data.userName},

We are writing to notify you that your consultation booking with ${data.consultantName} could not be confirmed and has been cancelled.

Booking ID: ${data.bookingId}
Date: ${formatSessionDate(data.date)}
Time: ${data.time}

${data.reason ? `Reason: ${data.reason}\n\n` : ''}If you made a payment or need to reschedule, please contact us.

---
Foundarly Consultation Platform
Support: ${FOUNDARLY_BRAND.supportEmail}`;
}

/* ==========================================================================
   6. PAYMENT CONFIRMATION EMAIL
   ========================================================================== */

export function generatePaymentConfirmationEmailHTML(data: EmailPaymentConfirmationData): string {
  const formattedDate = formatSessionDate(data.date);
  const siteUrl = resolveSiteUrl(data.meetingLink);

  const header = renderHeader({
    title: 'Payment Confirmation',
    subtitle: 'Payment received & consultation scheduled',
    theme: 'gold',
  });

  const content = `
    <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: #0f172a;">
      Hi <strong>${escapeHTML(data.userName)}</strong>,
    </p>
    <p style="margin: 0 0 20px; font-size: 15px; line-height: 1.6; color: #334155;">
      Thank you for your payment! Your transaction has been verified and your consultation with <strong>${escapeHTML(data.consultantName)}</strong> is fully confirmed.
    </p>

    <!-- Payment Receipt Card -->
    <div style="background-color: #fefce8; border: 1px solid #fde68a; border-radius: 10px; padding: 22px; margin: 20px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size: 14px;">
        <tr>
          <td style="color: #64748b; width: 40%; padding: 6px 0;">Amount Paid:</td>
          <td style="color: #d97706; font-size: 18px; font-weight: 700; text-align: right; padding: 6px 0;">₹${data.amount}</td>
        </tr>
        ${data.transactionId ? `
        <tr>
          <td style="color: #64748b; padding: 6px 0;">Transaction / UTR:</td>
          <td style="color: #0f172a; font-family: monospace; font-size: 13px; text-align: right; padding: 6px 0;">${escapeHTML(data.transactionId)}</td>
        </tr>` : ''}
        <tr>
          <td style="color: #64748b; padding: 6px 0;">Booking ID:</td>
          <td style="color: #0f172a; font-family: monospace; font-size: 13px; text-align: right; padding: 6px 0;">${escapeHTML(data.bookingId)}</td>
        </tr>
        <tr>
          <td style="color: #64748b; padding: 6px 0;">Consultant:</td>
          <td style="color: #0f172a; font-weight: 600; text-align: right; padding: 6px 0;">${escapeHTML(data.consultantName)}</td>
        </tr>
        <tr>
          <td style="color: #64748b; padding: 6px 0;">Scheduled Session:</td>
          <td style="color: #0f172a; font-weight: 600; text-align: right; padding: 6px 0;">${escapeHTML(formattedDate)} at ${escapeHTML(data.time)}</td>
        </tr>
      </table>
    </div>

    ${renderCtaButton(data.meetingLink, 'Open Video Meeting Room', 'gold')}

    ${renderDirectLinkBox(data.meetingLink, 'Direct Meeting URL:')}

    <p style="margin: 20px 0 0; color: #64748b; font-size: 14px; text-align: center;">
      View your payment receipt &amp; booking details anytime on your <a href="${siteUrl}/my-bookings" style="color: #d97706; text-decoration: underline; font-weight: 600;">Foundarly Dashboard</a>.
    </p>
  `;

  return wrapEmailDocument('Payment Confirmation', header, content, renderFooter({ recipientEmail: data.userEmail }));
}

export function generatePaymentConfirmationEmailText(data: EmailPaymentConfirmationData): string {
  return `Payment Confirmation – Foundarly

Hi ${data.userName},

Your payment of ₹${data.amount} for your consultation with ${data.consultantName} has been verified and confirmed.

RECEIPT DETAILS:
- Amount Paid: ₹${data.amount}
${data.transactionId ? `- Transaction ID: ${data.transactionId}\n` : ''}- Booking ID: ${data.bookingId}
- Consultant: ${data.consultantName}
- Session: ${formatSessionDate(data.date)} at ${data.time}

JOIN VIDEO MEETING ROOM:
${data.meetingLink}

---
Foundarly Consultation Platform`;
}

/* ==========================================================================
   7. EMAIL VERIFICATION & PASSWORD RESET EMAILS
   ========================================================================== */

export function generateEmailVerificationEmailHTML(data: EmailVerificationData): string {
  const header = renderHeader({
    title: 'Verify Your Email',
    subtitle: 'Welcome to Foundarly Business World',
    theme: 'navy',
  });

  const content = `
    <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: #0f172a;">
      Hello <strong>${escapeHTML(data.userName)}</strong>,
    </p>
    <p style="margin: 0 0 20px; font-size: 15px; line-height: 1.6; color: #334155;">
      Thank you for creating an account on <strong>Foundarly</strong>. To complete your registration and activate 1-on-1 consultation bookings, please verify your email address below:
    </p>

    ${renderCtaButton(data.verificationUrl, 'Verify Email Address', 'gold')}

    ${renderDirectLinkBox(data.verificationUrl, 'Verification Link:')}

    <p style="margin: 20px 0 0; color: #64748b; font-size: 13px; line-height: 1.5; text-align: center;">
      This verification link is secure and will expire in 24 hours. If you did not create a Foundarly account, please disregard this message.
    </p>
  `;

  return wrapEmailDocument('Verify Your Email', header, content, renderFooter({ recipientEmail: data.userEmail }));
}

export function generateEmailVerificationEmailText(data: EmailVerificationData): string {
  return `Verify Your Email – Foundarly

Hello ${data.userName},

Thank you for registering on Foundarly. Please verify your email address using this secure link:

${data.verificationUrl}

This link is valid for 24 hours.

---
Foundarly Consultation Platform`;
}

export function generatePasswordResetEmailHTML(data: EmailPasswordResetData): string {
  const header = renderHeader({
    title: 'Reset Your Password',
    subtitle: 'Foundarly Account Security',
    theme: 'navy',
  });

  const content = `
    <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: #0f172a;">
      Hello <strong>${escapeHTML(data.userName)}</strong>,
    </p>
    <p style="margin: 0 0 20px; font-size: 15px; line-height: 1.6; color: #334155;">
      We received a request to reset the password for your Foundarly account (<strong>${escapeHTML(data.userEmail)}</strong>). Click the button below to set a new password:
    </p>

    ${renderCtaButton(data.resetUrl, 'Reset Password', 'gold')}

    ${renderDirectLinkBox(data.resetUrl, 'Password Reset URL:')}

    <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 14px 18px; margin: 24px 0;">
      <p style="margin: 0; color: #991b1b; font-size: 12px; line-height: 1.5;">
        🔒 <strong>Security Notice:</strong> If you did not request a password reset, you can safely ignore this email. Your current password remains secure.
      </p>
    </div>
  `;

  return wrapEmailDocument('Reset Your Password', header, content, renderFooter({ recipientEmail: data.userEmail }));
}

export function generatePasswordResetEmailText(data: EmailPasswordResetData): string {
  return `Reset Your Password – Foundarly

Hello ${data.userName},

We received a request to reset your password. Use the following link to set a new password:

${data.resetUrl}

If you did not request this, please disregard this email.

---
Foundarly Consultation Platform`;
}

/* ==========================================================================
   8. CONSULTANT APPLICATION APPROVAL & REJECTION EMAILS
   ========================================================================== */

export function generateApplicationApprovedEmailHTML(data: EmailApplicationApprovedData): string {
  const dashboardUrl = canonicalizeUrl(data.dashboardUrl || '/consultant/dashboard');
  const loginUrl = `${FOUNDARLY_BRAND.domain}/login?from=/consultant/dashboard`;

  const header = renderHeader({
    title: 'Application Approved',
    subtitle: 'Welcome to the Foundarly Consultant Community',
    theme: 'emerald',
  });

  const content = `
    <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: #0f172a;">
      Dear <strong>${escapeHTML(data.applicantName)}</strong>,
    </p>
    <p style="margin: 0 0 20px; font-size: 15px; line-height: 1.6; color: #334155;">
      We are pleased to inform you that your application to join <strong>Foundarly</strong> as an expert consultant has been approved.
    </p>

    <!-- Profile Summary Box -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f0fdf4; border-radius: 10px; border: 1px solid #bbf7d0; margin: 20px 0;">
      <tr>
        <td style="padding: 22px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size: 14px;">
            <tr>
              <td style="color: #64748b; width: 40%; padding: 6px 0;">Consultant Name:</td>
              <td style="color: #0f172a; font-weight: 700; text-align: right; padding: 6px 0;">${escapeHTML(data.applicantName)}</td>
            </tr>
            ${data.currentJob ? `
            <tr>
              <td style="color: #64748b; padding: 6px 0;">Domain / Role:</td>
              <td style="color: #0f172a; font-weight: 600; text-align: right; padding: 6px 0;">${escapeHTML(data.currentJob)}</td>
            </tr>` : ''}
            ${data.qualification ? `
            <tr>
              <td style="color: #64748b; padding: 6px 0;">Qualification:</td>
              <td style="color: #0f172a; font-weight: 600; text-align: right; padding: 6px 0;">${escapeHTML(data.qualification)}</td>
            </tr>` : ''}
            <tr>
              <td style="color: #64748b; padding: 6px 0;">Account Status:</td>
              <td style="color: #15803d; font-weight: 700; text-align: right; padding: 6px 0;">Active Consultant</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    ${data.adminNotes ? `
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 18px; margin: 18px 0;">
        <p style="margin: 0 0 4px; color: #475569; font-size: 11px; font-weight: 700; text-transform: uppercase;">Note from Review Team:</p>
        <p style="margin: 0; color: #334155; font-size: 13px; line-height: 1.5;">${escapeHTML(data.adminNotes)}</p>
      </div>
    ` : ''}

    <h3 style="margin: 24px 0 12px; color: #0f172a; font-size: 15px; font-weight: 700;">Next Steps to Launch Your Profile:</h3>
    <ol style="margin: 0 0 24px; padding-left: 20px; color: #475569; font-size: 14px; line-height: 1.6;">
      <li>Log in to your account with <strong>${escapeHTML(data.applicantEmail)}</strong>.</li>
      <li>Visit your Consultant Dashboard to configure your hourly pricing and availability calendar.</li>
      <li>Your profile is live for clients to schedule 1-on-1 video consultations.</li>
    </ol>

    ${renderCtaButton(loginUrl, 'Access Consultant Portal', 'emerald')}
  `;

  return wrapEmailDocument('Application Approved', header, content, renderFooter({ recipientEmail: data.applicantEmail }));
}

export function generateApplicationApprovedEmailText(data: EmailApplicationApprovedData): string {
  const loginUrl = `${FOUNDARLY_BRAND.domain}/login?from=/consultant/dashboard`;

  return `Application Approved - Foundarly

Dear ${data.applicantName},

We are pleased to inform you that your application to join Foundarly as an expert consultant has been approved.

PROFILE SUMMARY:
- Name: ${data.applicantName}
- Status: Active Consultant
${data.currentJob ? `- Domain: ${data.currentJob}\n` : ''}
NEXT STEPS:
1. Log in to your account with ${data.applicantEmail} at: ${loginUrl}
2. Configure your profile, session fee, and availability.
3. Your profile is live for clients to book consultations.

Access Consultant Portal: ${loginUrl}

---
Foundarly Consultation Platform
Contact: ${FOUNDARLY_BRAND.supportEmail}`;
}

export function generateApplicationRejectedEmailHTML(data: EmailApplicationRejectedData): string {
  const header = renderHeader({
    title: 'Consultant Application Update',
    subtitle: 'Foundarly Consultant Program',
    theme: 'slate',
  });

  const content = `
    <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: #0f172a;">
      Dear <strong>${escapeHTML(data.applicantName)}</strong>,
    </p>
    <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.6; color: #334155;">
      Thank you for your interest in joining <strong>Foundarly</strong> as an expert consultant and taking the time to share your credentials with us.
    </p>
    <p style="margin: 0 0 20px; font-size: 15px; line-height: 1.6; color: #334155;">
      After reviewing our current opening requirements and domain capacity, we are unable to approve your application at this time.
    </p>

    ${data.reason ? `
      <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 14px 18px; margin: 18px 0;">
        <p style="margin: 0 0 4px; color: #991b1b; font-size: 11px; font-weight: 700; text-transform: uppercase;">Review Notes:</p>
        <p style="margin: 0; color: #b91c1c; font-size: 13px; line-height: 1.5;">${escapeHTML(data.reason)}</p>
      </div>
    ` : ''}

    <p style="margin: 20px 0 16px; color: #475569; font-size: 14px; line-height: 1.6;">
      We encourage you to re-apply in the future as new consulting categories open up on Foundarly.
    </p>

    <p style="margin: 24px 0 0; color: #64748b; font-size: 14px; line-height: 1.5; text-align: center;">
      If you have questions, please reach out to us at <a href="mailto:${FOUNDARLY_BRAND.supportEmail}" style="color: #d97706; text-decoration: underline;">${FOUNDARLY_BRAND.supportEmail}</a>.
    </p>
  `;

  return wrapEmailDocument('Consultant Application Update', header, content, renderFooter({ recipientEmail: data.applicantEmail }));
}

export function generateApplicationRejectedEmailText(data: EmailApplicationRejectedData): string {
  return `Consultant Application Update - Foundarly

Dear ${data.applicantName},

Thank you for your interest in joining Foundarly as a consultant.

After reviewing our current category openings, we are unable to approve your consultant application at this time.

${data.reason ? `Feedback from review team: ${data.reason}\n\n` : ''}We encourage you to re-apply in the future as new categories open.

---
Foundarly Consultation Platform
Contact: ${FOUNDARLY_BRAND.supportEmail}`;
}

/* ==========================================================================
   9. FOLLOW-UP CONSULTATION WORKFLOW EMAILS (7-DAY WINDOW)
   ========================================================================== */

export function generateFollowUpRequestedEmailHTML(data: EmailFollowUpRequestedData): string {
  const formattedReqDate = formatSessionDate(data.preferredDate);
  const formattedOrigDate = formatSessionDate(data.originalDate);

  const header = renderHeader({
    title: 'Follow-up Consultation Request',
    subtitle: '7-Day Follow-Up Window Active',
    theme: 'gold',
  });

  const content = `
    <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: #0f172a;">
      Hello <strong>${escapeHTML(data.consultantName)}</strong>,
    </p>
    <p style="margin: 0 0 20px; font-size: 15px; line-height: 1.6; color: #334155;">
      Your client <strong>${escapeHTML(data.clientName)}</strong> has requested a follow-up consultation within the 7-day post-meeting eligibility period. Please review the proposed time below and confirm or suggest an alternative in your dashboard.
    </p>

    <!-- Request Details -->
    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 20px; margin: 20px 0;">
      <p style="margin: 0 0 10px; font-size: 14px;"><strong>Client:</strong> ${escapeHTML(data.clientName)} (${escapeHTML(data.clientEmail)})</p>
      <p style="margin: 0 0 10px; font-size: 14px;"><strong>Original Session:</strong> ${escapeHTML(formattedOrigDate)} at ${escapeHTML(data.originalTime)}</p>
      <p style="margin: 0 0 10px; font-size: 14px; color: #b45309;"><strong>Proposed Follow-up:</strong> ${escapeHTML(formattedReqDate)} at ${escapeHTML(data.preferredTime)}</p>
      <p style="margin: 0 0 10px; font-size: 14px;"><strong>Original Booking Ref:</strong> <code>${escapeHTML(data.bookingId)}</code></p>
      <p style="margin: 0; font-size: 14px;"><strong>Clarification / Reason:</strong></p>
      <blockquote style="margin: 8px 0 0 0; padding: 10px 14px; background: #ffffff; border-left: 3px solid #f59e0b; border-radius: 4px; font-size: 13px; color: #334155;">
        ${escapeHTML(data.reason)}
      </blockquote>
    </div>

    ${renderCtaButton(data.dashboardUrl, 'Respond on Consultant Dashboard', 'gold')}

    <p style="margin: 20px 0 0; font-size: 12px; color: #94a3b8; line-height: 1.5; text-align: center;">
      No administrative approval is required. You can accept, propose an alternative time, or decline directly.
    </p>
  `;

  return wrapEmailDocument('Follow-up Request', header, content, renderFooter({ recipientEmail: data.consultantEmail }));
}

export function generateFollowUpRequestedEmailText(data: EmailFollowUpRequestedData): string {
  return `Follow-up Consultation Request - Foundarly

Hello ${data.consultantName},

Your client ${data.clientName} (${data.clientEmail}) has requested a follow-up consultation.

Original Consultation: ${formatSessionDate(data.originalDate)} at ${data.originalTime}
Proposed Follow-up Time: ${formatSessionDate(data.preferredDate)} at ${data.preferredTime}
Original Booking ID: ${data.bookingId}

Reason / Question:
"${data.reason}"

Please open your consultant dashboard to accept the request, propose an alternative time, or decline:
${data.dashboardUrl}

Note: No administrative approval is required. You control your schedule directly.

---
Foundarly Consultation Platform`;
}

export function generateFollowUpAlternativeEmailHTML(data: EmailFollowUpAlternativeData): string {
  const formattedAltDate = formatSessionDate(data.alternativeDate);

  const header = renderHeader({
    title: 'Alternative Follow-up Time Proposed',
    subtitle: 'Consultant Response',
    theme: 'indigo',
  });

  const content = `
    <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: #0f172a;">
      Hello <strong>${escapeHTML(data.clientName)}</strong>,
    </p>
    <p style="margin: 0 0 20px; font-size: 15px; line-height: 1.6; color: #334155;">
      Your consultant <strong>${escapeHTML(data.consultantName)}</strong> is unavailable at your requested time, but has proposed an alternative time within your 7-day follow-up window.
    </p>

    <!-- Alternative Box -->
    <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 20px; margin: 20px 0;">
      <p style="margin: 0 0 8px; font-size: 15px; color: #1e40af; font-weight: 700;">
        📅 Proposed Time: ${escapeHTML(formattedAltDate)} at ${escapeHTML(data.alternativeTime)}
      </p>
      ${data.consultantNote ? `
        <p style="margin: 8px 0 0; font-size: 13px; color: #1e3a8a;">
          <strong>Consultant Note:</strong> "${escapeHTML(data.consultantNote)}"
        </p>
      ` : ''}
    </div>

    ${renderCtaButton(data.dashboardUrl, 'Respond on Foundarly Dashboard', 'gold')}
  `;

  return wrapEmailDocument('Alternative Follow-up Time Proposed', header, content, renderFooter({ recipientEmail: data.clientEmail }));
}

export function generateFollowUpAlternativeEmailText(data: EmailFollowUpAlternativeData): string {
  return `Alternative Follow-up Time Proposed - Foundarly

Hello ${data.clientName},

Your consultant ${data.consultantName} has proposed an alternative time for your follow-up consultation:

Proposed Time: ${formatSessionDate(data.alternativeDate)} at ${data.alternativeTime}
${data.consultantNote ? `Note: "${data.consultantNote}"\n` : ''}
Please visit your bookings dashboard to accept or decline this proposed time:
${data.dashboardUrl}

---
Foundarly Consultation Platform`;
}

export function generateFollowUpConfirmedEmailHTML(data: EmailFollowUpConfirmedData): string {
  const formattedDate = formatSessionDate(data.confirmedDate);

  const header = renderHeader({
    title: 'Follow-up Consultation Confirmed!',
    subtitle: 'Rejoining Original Meeting Room',
    theme: 'emerald',
  });

  const content = `
    <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: #0f172a;">
      Hello <strong>${escapeHTML(data.clientName)}</strong> &amp; <strong>${escapeHTML(data.consultantName)}</strong>,
    </p>
    <p style="margin: 0 0 20px; font-size: 15px; line-height: 1.6; color: #334155;">
      Your follow-up video consultation has been confirmed. You will rejoin using the original meeting room at the agreed time.
    </p>

    <!-- Details Box -->
    <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 10px; padding: 22px; margin: 20px 0;">
      <p style="margin: 0 0 8px; font-size: 15px; color: #065f46; font-weight: 700;">
        📅 Date &amp; Time: ${escapeHTML(formattedDate)} at ${escapeHTML(data.confirmedTime)}
      </p>
      <p style="margin: 0 0 8px; font-size: 13px; color: #047857;">
        <strong>Meeting Room ID:</strong> <code>${escapeHTML(data.meetingRoomId)}</code>
      </p>
      <p style="margin: 0 0 8px; font-size: 13px; color: #047857;">
        <strong>Original Booking Ref:</strong> <code>${escapeHTML(data.bookingId)}</code>
      </p>
      <p style="margin: 0; font-size: 13px; color: #065f46;">
        <strong>Topic:</strong> ${escapeHTML(data.reason)}
      </p>
    </div>

    ${renderCtaButton(data.meetingLink, 'Open Meeting Room', 'emerald')}

    ${renderDirectLinkBox(data.meetingLink, 'Meeting Room Link:')}

    <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0; line-height: 1.5;">
      Only the scheduled client and assigned consultant have access to this room.
    </p>
  `;

  return wrapEmailDocument('Follow-up Confirmed', header, content, renderFooter({ recipientEmail: data.clientEmail }));
}

export function generateFollowUpConfirmedEmailText(data: EmailFollowUpConfirmedData): string {
  return `Follow-up Consultation Confirmed - Foundarly

Dear ${data.clientName} & ${data.consultantName},

Your follow-up consultation is confirmed!

Date: ${formatSessionDate(data.confirmedDate)}
Time: ${data.confirmedTime}
Topic: ${data.reason}
Original Booking Reference: ${data.bookingId}

Access your meeting room here:
${data.meetingLink}

Note: Rejoin access uses your existing secure meeting room and is authorized only for you two.

---
Foundarly Consultation Platform`;
}

export function generateFollowUpDeclinedEmailHTML(data: EmailFollowUpDeclinedData): string {
  const header = renderHeader({
    title: 'Follow-up Request Update',
    subtitle: 'Consultation Follow-up',
    theme: 'slate',
  });

  const content = `
    <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: #0f172a;">
      Hello <strong>${escapeHTML(data.clientName)}</strong>,
    </p>
    <p style="margin: 0 0 20px; font-size: 15px; line-height: 1.6; color: #334155;">
      Your consultant <strong>${escapeHTML(data.consultantName)}</strong> is unfortunately unable to accommodate this follow-up request at this time.
    </p>

    ${data.declinedReason ? `
      <div style="background-color: #f1f5f9; border-left: 3px solid #64748b; padding: 14px 18px; border-radius: 4px; margin-bottom: 24px;">
        <p style="margin: 0; font-size: 13px; color: #334155;"><strong>Reason provided:</strong> ${escapeHTML(data.declinedReason)}</p>
      </div>
    ` : ''}

    <p style="font-size: 13px; color: #64748b; line-height: 1.6; text-align: center;">
      You may reach out to our support team at <a href="mailto:${FOUNDARLY_BRAND.supportEmail}" style="color: #d97706; text-decoration: underline;">${FOUNDARLY_BRAND.supportEmail}</a> if you need further assistance.
    </p>
  `;

  return wrapEmailDocument('Follow-up Request Update', header, content, renderFooter({ recipientEmail: data.clientEmail }));
}

export function generateFollowUpDeclinedEmailText(data: EmailFollowUpDeclinedData): string {
  return `Follow-up Request Update - Foundarly

Dear ${data.clientName},

Your consultant ${data.consultantName} was unable to accommodate your follow-up request.
${data.declinedReason ? `Reason: "${data.declinedReason}"\n` : ''}
Booking Reference: ${data.bookingId}

If you have questions or require further assistance, please contact us at ${FOUNDARLY_BRAND.supportEmail}.

---
Foundarly Consultation Platform`;
}

/* ==========================================================================
   10. PARTICIPANT WAITING IN MEETING ROOM EMAIL
   ========================================================================== */

export function generateParticipantWaitingEmailHTML(data: EmailParticipantWaitingData): string {
  const isClientWaiting = data.waitingUserRole === 'client';
  const roleTitle = isClientWaiting ? 'Client' : 'Consultant';
  const headerTitle = isClientWaiting
    ? `${escapeHTML(data.waitingUserName)} is waiting in the meeting room`
    : `Your consultant is waiting in the meeting room`;
  const subTitle = data.isFollowUp ? '7-Day Follow-Up Consultation' : 'Scheduled Consultation Session';

  const header = renderHeader({
    eyebrow: 'FOUNDARLY • LIVE SESSION ALERT',
    title: headerTitle,
    subtitle: subTitle,
    theme: 'navy',
  });

  const content = `
    <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: #0f172a;">
      Hello <strong>${escapeHTML(data.recipientName)}</strong>,
    </p>
    <p style="margin: 0 0 20px; font-size: 15px; line-height: 1.6; color: #334155;">
      <strong>${escapeHTML(data.waitingUserName)}</strong> (${escapeHTML(roleTitle)}) has joined your consultation meeting room and is waiting for you to connect.
    </p>

    <!-- Details Box -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #fefce8; border-radius: 10px; border: 1px solid #fde68a; margin: 20px 0; padding: 18px;">
      <tr>
        <td style="padding-bottom: 10px; font-size: 13px; color: #64748b; width: 140px;">Session Type:</td>
        <td style="padding-bottom: 10px; font-size: 13px; font-weight: 600; color: #0f172a;">
          ${data.isFollowUp ? '7-Day Follow-Up Clarification' : 'Consultation Meeting'}
        </td>
      </tr>
      ${data.date ? `
      <tr>
        <td style="padding-bottom: 10px; font-size: 13px; color: #64748b;">Scheduled Date:</td>
        <td style="padding-bottom: 10px; font-size: 13px; font-weight: 600; color: #0f172a;">${escapeHTML(data.date)} ${data.time ? `at ${escapeHTML(data.time)}` : ''}</td>
      </tr>
      ` : ''}
      <tr>
        <td style="padding-bottom: 10px; font-size: 13px; color: #64748b;">Waiting Participant:</td>
        <td style="padding-bottom: 10px; font-size: 13px; font-weight: 700; color: #d97706;">
          ${escapeHTML(data.waitingUserName)} (${escapeHTML(roleTitle)})
        </td>
      </tr>
      <tr>
        <td style="font-size: 13px; color: #64748b;">Room ID:</td>
        <td style="font-size: 13px; font-family: monospace; color: #0f172a;">${escapeHTML(data.meetingRoomId)}</td>
      </tr>
    </table>

    ${renderCtaButton(data.meetingLink, 'Join Meeting Now', 'gold')}

    ${renderDirectLinkBox(data.meetingLink, 'Meeting Link:')}

    <p style="font-size: 12px; color: #94a3b8; line-height: 1.5; margin: 20px 0 0; text-align: center;">
      Both participants can access this secure meeting room directly without generating a new link.
    </p>
  `;

  return wrapEmailDocument(`${headerTitle} - Foundarly`, header, content, renderFooter({ recipientEmail: data.recipientEmail }));
}

export function generateParticipantWaitingEmailText(data: EmailParticipantWaitingData): string {
  const isClientWaiting = data.waitingUserRole === 'client';
  const roleTitle = isClientWaiting ? 'Client' : 'Consultant';

  return `Meeting Alert: ${data.waitingUserName} is waiting in the room - Foundarly

Hello ${data.recipientName},

${data.waitingUserName} (${roleTitle}) has joined your consultation room and is waiting for you to connect.

Session Details:
- Type: ${data.isFollowUp ? '7-Day Follow-Up Clarification' : 'Consultation Meeting'}
${data.date ? `- Scheduled Date: ${data.date} ${data.time ? `at ${data.time}` : ''}\n` : ''}- Waiting Participant: ${data.waitingUserName} (${roleTitle})
- Room ID: ${data.meetingRoomId}

Join the meeting directly using this link:
${data.meetingLink}

---
Foundarly Consultation Platform`;
}

/* ==========================================================================
   11. POST-SESSION COMPLETED NOTIFICATION EMAIL (WITH 7-DAY REJOIN)
   ========================================================================== */

export function generateSessionCompletedEmailHTML(data: EmailSessionCompletedData): string {
  const isClient = data.recipientRole === 'client';
  const partnerName = isClient ? data.consultantName : data.userName;
  const partnerRole = isClient ? 'Consultant' : 'Client';
  const dashboardName = isClient ? 'My Bookings' : 'Consultant Dashboard';
  const siteUrl = resolveSiteUrl(data.meetingLink);
  const dashboardPath = isClient ? '/my-bookings' : '/consultant/dashboard';
  const dashboardFullUrl = `${siteUrl}${dashboardPath}`;

  const header = renderHeader({
    eyebrow: 'FOUNDARLY • SESSION SUMMARY',
    title: 'Thank You for Attending Your Consultation',
    subtitle: `Your session with ${escapeHTML(partnerName)} has successfully completed`,
    theme: 'navy',
  });

  const content = `
    <p style="font-size: 16px; line-height: 1.6; margin: 0 0 16px 0; color: #0f172a;">
      Hello <strong>${escapeHTML(data.recipientName)}</strong>,
    </p>
    <p style="font-size: 15px; line-height: 1.6; color: #334155; margin: 0 0 24px 0;">
      Thank you for participating in your professional consultation with <strong>${escapeHTML(partnerName)}</strong> (${escapeHTML(partnerRole)}) today. We trust the session was productive and provided actionable guidance.
    </p>

    <!-- 7-Day Follow-Up Policy Box -->
    <div style="background-color: #fef3c7; border: 1px solid #fcd34d; border-radius: 12px; padding: 22px; margin-bottom: 28px;">
      <div style="display: flex; align-items: center; margin-bottom: 8px;">
        <span style="font-size: 20px; margin-right: 8px;">✨</span>
        <h3 style="margin: 0; font-size: 16px; font-weight: 700; color: #92400e;">7-Day Follow-Up Clarification Policy</h3>
      </div>
      <p style="margin: 0 0 14px 0; font-size: 14px; line-height: 22px; color: #78350f;">
        At Foundarly, your engagement doesn't end when the call disconnects. You can <strong>rejoin the exact same meeting room</strong> at any time over the next <strong>7 days</strong> for follow-up questions, additional clarifications, or quick check-ins.
      </p>
      <div style="background-color: #ffffff; border-radius: 8px; padding: 12px 16px; border: 1px dashed #f59e0b;">
        <p style="margin: 0; font-size: 13px; color: #78350f;">
          <strong>Rejoin Window Expiry:</strong> <span style="font-weight: 700; color: #b45309;">${escapeHTML(data.rejoinExpiryFormatted)}</span>
        </p>
      </div>
    </div>

    <!-- Completed Session Details -->
    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 22px; margin-bottom: 28px;">
      <h4 style="margin: 0 0 14px 0; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #475569;">Session Details</h4>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding-bottom: 10px; font-size: 14px; color: #64748b; width: 160px;">Consultation Date:</td>
          <td style="padding-bottom: 10px; font-size: 14px; font-weight: 600; color: #0f172a;">${escapeHTML(data.date)} at ${escapeHTML(data.time)}</td>
        </tr>
        <tr>
          <td style="padding-bottom: 10px; font-size: 14px; color: #64748b;">Scheduled Duration:</td>
          <td style="padding-bottom: 10px; font-size: 14px; font-weight: 600; color: #0f172a;">${data.sessionDuration} minutes</td>
        </tr>
        <tr>
          <td style="padding-bottom: 10px; font-size: 14px; color: #64748b;">Consultant:</td>
          <td style="padding-bottom: 10px; font-size: 14px; font-weight: 600; color: #0f172a;">${escapeHTML(data.consultantName)}</td>
        </tr>
        <tr>
          <td style="padding-bottom: 10px; font-size: 14px; color: #64748b;">Client:</td>
          <td style="padding-bottom: 10px; font-size: 14px; font-weight: 600; color: #0f172a;">${escapeHTML(data.userName)}</td>
        </tr>
        <tr>
          <td style="padding-bottom: 10px; font-size: 14px; color: #64748b;">Meeting Room ID:</td>
          <td style="padding-bottom: 10px; font-size: 14px; font-family: monospace; color: #0f172a; font-weight: 600;">${escapeHTML(data.meetingRoomId)}</td>
        </tr>
        <tr>
          <td style="font-size: 14px; color: #64748b;">Booking Reference:</td>
          <td style="font-size: 14px; font-family: monospace; color: #64748b;">${escapeHTML(data.bookingId)}</td>
        </tr>
      </table>
    </div>

    <!-- How to Rejoin Instructions -->
    <div style="background-color: #f1f5f9; border-radius: 12px; padding: 22px; margin-bottom: 28px;">
      <h4 style="margin: 0 0 12px 0; font-size: 15px; font-weight: 700; color: #0f172a;">How to Rejoin for Follow-up Clarifications</h4>
      <ol style="margin: 0; padding-left: 20px; font-size: 14px; line-height: 24px; color: #334155;">
        <li>Log in to your <strong>Foundarly</strong> account at <a href="${siteUrl}/login" style="color: #d97706; text-decoration: underline;">${siteUrl}/login</a>.</li>
        <li>Open your <strong>${escapeHTML(dashboardName)}</strong> from the navigation menu or visit <a href="${dashboardFullUrl}" style="color: #d97706; text-decoration: underline;">${dashboardFullUrl}</a>.</li>
        <li>Find this booking (Ref: <code>${escapeHTML(data.bookingId.slice(0, 8))}...</code>) with <strong>${escapeHTML(partnerName)}</strong>.</li>
        <li>Click <strong>"Rejoin Meeting"</strong> to immediately re-enter your private video room.</li>
      </ol>
    </div>

    <!-- Rejoin Button -->
    ${renderCtaButton(data.meetingLink, 'Rejoin Consultation Room', 'gold')}

    ${renderDirectLinkBox(data.meetingLink, 'Direct Rejoin Link:')}

    <p style="font-size: 12px; color: #94a3b8; line-height: 1.5; margin: 20px 0 0; text-align: center;">
      Security Note: Rejoin access uses your original authenticated room. Only the verified client (${escapeHTML(data.userEmail)}) and assigned consultant can access this session.
    </p>
  `;

  return wrapEmailDocument('Consultation Completed & 7-Day Follow-Up Access', header, content, renderFooter({ recipientEmail: data.recipientEmail }));
}

export function generateSessionCompletedEmailText(data: EmailSessionCompletedData): string {
  const isClient = data.recipientRole === 'client';
  const partnerName = isClient ? data.consultantName : data.userName;
  const partnerRole = isClient ? 'Consultant' : 'Client';
  const dashboardName = isClient ? 'My Bookings' : 'Consultant Dashboard';
  const siteUrl = resolveSiteUrl(data.meetingLink);
  const dashboardPath = isClient ? '/my-bookings' : '/consultant/dashboard';

  return `Consultation Completed & 7-Day Follow-Up Access - Foundarly

Dear ${data.recipientName},

Thank you for attending your consultation session with ${partnerName} (${partnerRole}) today.

7-DAY FOLLOW-UP CLARIFICATION POLICY:
At Foundarly, your engagement does not end when the call disconnects. You can rejoin the exact same meeting room at any time over the next 7 days for follow-up questions, additional clarifications, or quick check-ins.

REJOIN EXPIRY DATE & TIME:
${data.rejoinExpiryFormatted} (7 days after session completion)

SESSION DETAILS:
- Consultation Date: ${data.date} at ${data.time}
- Scheduled Duration: ${data.sessionDuration} minutes
- Consultant: ${data.consultantName}
- Client: ${data.userName}
- Meeting Room ID: ${data.meetingRoomId}
- Booking Reference: ${data.bookingId}

HOW TO REJOIN FOR FOLLOW-UP CLARIFICATIONS:
1. Log in to your Foundarly account at ${siteUrl}/login
2. Open your ${dashboardName} (${siteUrl}${dashboardPath})
3. Select your booking with ${partnerName}
4. Click "Rejoin Meeting" to re-enter your meeting room.

Or access the meeting directly using this link:
${data.meetingLink}

Note: Rejoin access uses your existing secure meeting room and is authorized only for you and your consultant.

---
Foundarly Consultation Platform
${FOUNDARLY_BRAND.domain}`;
}
