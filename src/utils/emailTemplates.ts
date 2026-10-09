/**
 * Email templates for Foundarly booking confirmations and notifications.
 * Crafted with White & Gold brand aesthetic and optimized for high inbox deliverability.
 */

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
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/* ==========================================================================
   1. CLIENT BOOKING CONFIRMATION EMAIL
   ========================================================================== */

export function generateUserEmailHTML(data: EmailBookingData): string {
  const formattedDate = formatSessionDate(data.date);
  const timing = data.time && data.time !== 'Flexible' ? data.time : 'Flexible Time';
  const dashboardLink = data.meetingLink.split('/meeting/')[0] + '/my-bookings';

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
  <title>Booking Confirmation - Foundarly</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8fafc; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 580px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0;">
          
          <!-- Header Banner -->
          <tr>
            <td style="background-color: #f59e0b; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 32px 28px; text-align: center;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center">
                    <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: -0.01em;">Booking Confirmation</h1>
                    <p style="margin: 6px 0 0; color: #fef3c7; font-size: 15px;">Your consultation has been confirmed</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 32px 28px;">
              <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: #1e293b;">
                Hi <strong>${escapeHTML(data.userName)}</strong>,
              </p>
              <p style="margin: 0 0 20px; font-size: 15px; line-height: 1.6; color: #334155;">
                Your 1-on-1 consultation session with <strong>${escapeHTML(data.consultantName)}</strong> is confirmed. Below are your meeting details:
              </p>

              <!-- Session Details Box -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #fefce8; border-radius: 8px; border: 1px solid #fef08a; margin: 20px 0;">
                <tr>
                  <td style="padding: 20px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size: 14px;">
                      <tr>
                        <td style="color: #64748b; width: 35%; padding: 6px 0;">Consultant:</td>
                        <td style="color: #0f172a; font-weight: 600; text-align: right; padding: 6px 0;">${escapeHTML(data.consultantName)}</td>
                      </tr>
                      <tr>
                        <td style="color: #64748b; padding: 6px 0;">Date:</td>
                        <td style="color: #0f172a; font-weight: 600; text-align: right; padding: 6px 0;">${escapeHTML(formattedDate)}</td>
                      </tr>
                      <tr>
                        <td style="color: #64748b; padding: 6px 0;">Time:</td>
                        <td style="color: #0f172a; font-weight: 600; text-align: right; padding: 6px 0;">${escapeHTML(timing)}</td>
                      </tr>
                      <tr>
                        <td style="color: #64748b; padding: 6px 0;">Duration:</td>
                        <td style="color: #0f172a; font-weight: 600; text-align: right; padding: 6px 0;">${data.duration} Minutes</td>
                      </tr>
                      <tr>
                        <td style="color: #64748b; padding: 6px 0;">Booking ID:</td>
                        <td style="color: #0f172a; font-family: monospace; font-size: 13px; text-align: right; padding: 6px 0;">${data.bookingId}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Join Video Meeting Button -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 24px 0;">
                <tr>
                  <td align="center">
                    <a href="${data.meetingLink}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background-color: #d97706; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-size: 15px; font-weight: 600;">
                      Join Video Meeting Room
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 16px; color: #64748b; font-size: 13px; text-align: center;">
                Please join 5 minutes before your scheduled start time.
              </p>

              <!-- Direct Link -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8fafc; border-radius: 6px; border: 1px solid #e2e8f0; margin: 16px 0; padding: 12px;">
                <tr>
                  <td>
                    <p style="margin: 0 0 4px; color: #64748b; font-size: 11px; text-transform: uppercase; font-weight: 600; letter-spacing: 0.05em;">Direct Link to Join:</p>
                    <a href="${data.meetingLink}" style="color: #b45309; font-size: 13px; word-break: break-all; text-decoration: underline;">${data.meetingLink}</a>
                  </td>
                </tr>
              </table>

              <p style="margin: 24px 0 0; color: #64748b; font-size: 14px; line-height: 1.5;">
                Need to reschedule or view your upcoming appointments? You can manage your bookings anytime on your <a href="${dashboardLink}" style="color: #b45309; text-decoration: underline; font-weight: 500;">Foundarly Dashboard</a>.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 20px 28px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0 0 4px; color: #475569; font-size: 12px; font-weight: 600;">Foundarly Consultation Platform</p>
              <p style="margin: 0 0 4px; color: #94a3b8; font-size: 11px;">You received this transactional email because you booked a consultation on foundarly.com.</p>
              <p style="margin: 0; color: #94a3b8; font-size: 11px;">© ${new Date().getFullYear()} Foundarly. All rights reserved.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function generateUserEmailText(data: EmailBookingData): string {
  const formattedDate = formatSessionDate(data.date);
  const timing = data.time && data.time !== 'Flexible' ? data.time : 'Flexible Time';
  const dashboardLink = data.meetingLink.split('/meeting/')[0] + '/my-bookings';

  return `Booking Confirmation - Foundarly

Hi ${data.userName},

Your 1-on-1 consultation session with ${data.consultantName} is confirmed.

SESSION DETAILS:
- Consultant: ${data.consultantName}
- Date: ${formattedDate}
- Time: ${timing}
- Duration: ${data.duration} Minutes
- Booking ID: ${data.bookingId}

JOIN VIDEO MEETING:
${data.meetingLink}
(Please join 5 minutes before your scheduled start time)

Manage your bookings: ${dashboardLink}

---
Foundarly Consultation Platform
Contact: hello@foundarlybusinessworld.in
This is a transactional confirmation regarding your booking on foundarly.com.`;
}

/* ==========================================================================
   2. CONSULTANT BOOKING NOTIFICATION EMAIL
   ========================================================================== */

export function generateConsultantEmailHTML(data: EmailBookingData): string {
  const formattedDate = formatSessionDate(data.date);
  const timing = data.time && data.time !== 'Flexible' ? data.time : 'Flexible Time';

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
  <title>New Booking Scheduled - Foundarly</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8fafc; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 580px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0;">
          
          <!-- Header Banner -->
          <tr>
            <td style="background-color: #f59e0b; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 32px 28px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: -0.01em;">New Booking Scheduled</h1>
              <p style="margin: 6px 0 0; color: #fef3c7; font-size: 15px;">A client has booked a consultation session with you</p>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 32px 28px;">
              <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: #1e293b;">
                Hi <strong>${escapeHTML(data.consultantName)}</strong>,
              </p>
              <p style="margin: 0 0 20px; font-size: 15px; line-height: 1.6; color: #334155;">
                You have a new consultation session scheduled with <strong>${escapeHTML(data.userName)}</strong>.
              </p>

              <!-- Details Box -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #fefce8; border-radius: 8px; border: 1px solid #fef08a; margin: 20px 0;">
                <tr>
                  <td style="padding: 20px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size: 14px;">
                      <tr>
                        <td style="color: #64748b; width: 35%; padding: 6px 0;">Client Name:</td>
                        <td style="color: #0f172a; font-weight: 600; text-align: right; padding: 6px 0;">${escapeHTML(data.userName)}</td>
                      </tr>
                      <tr>
                        <td style="color: #64748b; padding: 6px 0;">Client Email:</td>
                        <td style="color: #0f172a; font-weight: 600; text-align: right; padding: 6px 0;">${escapeHTML(data.userEmail)}</td>
                      </tr>
                      <tr>
                        <td style="color: #64748b; padding: 6px 0;">Date:</td>
                        <td style="color: #0f172a; font-weight: 600; text-align: right; padding: 6px 0;">${escapeHTML(formattedDate)}</td>
                      </tr>
                      <tr>
                        <td style="color: #64748b; padding: 6px 0;">Time:</td>
                        <td style="color: #0f172a; font-weight: 600; text-align: right; padding: 6px 0;">${escapeHTML(timing)}</td>
                      </tr>
                      <tr>
                        <td style="color: #64748b; padding: 6px 0;">Duration:</td>
                        <td style="color: #0f172a; font-weight: 600; text-align: right; padding: 6px 0;">${data.duration} Minutes</td>
                      </tr>
                      ${data.message ? `
                      <tr>
                        <td style="color: #64748b; padding: 6px 0; vertical-align: top;">Topic / Message:</td>
                        <td style="color: #0f172a; text-align: right; padding: 6px 0;">${escapeHTML(data.message)}</td>
                      </tr>` : ''}
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Button -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 24px 0;">
                <tr>
                  <td align="center">
                    <a href="${data.meetingLink}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background-color: #d97706; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-size: 15px; font-weight: 600;">
                      Open Video Meeting Room
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Link Box -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8fafc; border-radius: 6px; border: 1px solid #e2e8f0; margin: 16px 0; padding: 12px;">
                <tr>
                  <td>
                    <p style="margin: 0 0 4px; color: #64748b; font-size: 11px; text-transform: uppercase; font-weight: 600; letter-spacing: 0.05em;">Direct Link to Join:</p>
                    <a href="${data.meetingLink}" style="color: #b45309; font-size: 13px; word-break: break-all; text-decoration: underline;">${data.meetingLink}</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 20px 28px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0 0 4px; color: #475569; font-size: 12px; font-weight: 600;">Foundarly Consultation Platform</p>
              <p style="margin: 0 0 4px; color: #94a3b8; font-size: 11px;">You received this notification because a client booked a session with you on foundarly.com.</p>
              <p style="margin: 0; color: #94a3b8; font-size: 11px;">© ${new Date().getFullYear()} Foundarly. All rights reserved.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function generateConsultantEmailText(data: EmailBookingData): string {
  const formattedDate = formatSessionDate(data.date);
  const timing = data.time && data.time !== 'Flexible' ? data.time : 'Flexible Time';

  return `New Booking Scheduled - Foundarly

Hi ${data.consultantName},

You have a new consultation session scheduled with ${data.userName}.

SESSION DETAILS:
- Client: ${data.userName} (${data.userEmail})
- Date: ${formattedDate}
- Time: ${timing}
- Duration: ${data.duration} Minutes
- Booking ID: ${data.bookingId}
${data.message ? `- Topic / Notes: ${data.message}\n` : ''}
OPEN MEETING ROOM:
${data.meetingLink}

---
Foundarly Consultation Platform
Contact: hello@foundarlybusinessworld.in`;
}

/* ==========================================================================
   3. CONSULTANT APPLICATION APPROVED EMAIL
   ========================================================================== */

export function generateApplicationApprovedEmailHTML(data: EmailApplicationApprovedData): string {
  const siteUrl = data.dashboardUrl || 'https://foundarly.com';
  const loginUrl = `${siteUrl}/login`;

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
  <title>Application Approved - Foundarly</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8fafc; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 580px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0;">
          
          <!-- Header Banner -->
          <tr>
            <td style="background-color: #15803d; background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); padding: 32px 28px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: -0.01em;">Application Approved</h1>
              <p style="margin: 6px 0 0; color: #dcfce7; font-size: 15px;">Welcome to the Foundarly Consultant Community</p>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 32px 28px;">
              <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: #1e293b;">
                Dear <strong>${escapeHTML(data.applicantName)}</strong>,
              </p>
              <p style="margin: 0 0 20px; font-size: 15px; line-height: 1.6; color: #334155;">
                We are pleased to inform you that your application to join <strong>Foundarly</strong> as an expert consultant has been approved.
              </p>

              <!-- Profile Details Box -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f0fdf4; border-radius: 8px; border: 1px solid #bbf7d0; margin: 20px 0;">
                <tr>
                  <td style="padding: 20px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size: 14px;">
                      <tr>
                        <td style="color: #64748b; width: 40%; padding: 6px 0;">Consultant Name:</td>
                        <td style="color: #0f172a; font-weight: 600; text-align: right; padding: 6px 0;">${escapeHTML(data.applicantName)}</td>
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
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8fafc; border-radius: 6px; border: 1px solid #e2e8f0; margin: 16px 0; padding: 12px;">
                <tr>
                  <td>
                    <p style="margin: 0 0 4px; color: #475569; font-size: 11px; font-weight: 600; text-transform: uppercase;">Note from Review Team:</p>
                    <p style="margin: 0; color: #334155; font-size: 13px; line-height: 1.5;">${escapeHTML(data.adminNotes)}</p>
                  </td>
                </tr>
              </table>` : ''}

              <!-- Next Steps -->
              <h3 style="margin: 24px 0 12px; color: #0f172a; font-size: 15px; font-weight: 600;">Next Steps:</h3>
              <ol style="margin: 0 0 24px; padding-left: 20px; color: #475569; font-size: 14px; line-height: 1.6;">
                <li>Log in to your account with <strong>${escapeHTML(data.applicantEmail)}</strong>.</li>
                <li>Visit your Consultant Dashboard to set your session fee and availability.</li>
                <li>Your profile is live for clients to schedule 1-on-1 consultations.</li>
              </ol>

              <!-- CTA Button -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 24px 0;">
                <tr>
                  <td align="center">
                    <a href="${loginUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background-color: #15803d; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-size: 15px; font-weight: 600;">
                      Access Consultant Portal
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 24px 0 0; color: #64748b; font-size: 14px; line-height: 1.5;">
                If you have any questions or need assistance, reply directly to this email.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 20px 28px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0 0 4px; color: #475569; font-size: 12px; font-weight: 600;">Foundarly Consultation Platform</p>
              <p style="margin: 0 0 4px; color: #94a3b8; font-size: 11px;">You received this notification regarding your consultant application on foundarly.com.</p>
              <p style="margin: 0; color: #94a3b8; font-size: 11px;">© ${new Date().getFullYear()} Foundarly. All rights reserved.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function generateApplicationApprovedEmailText(data: EmailApplicationApprovedData): string {
  const siteUrl = data.dashboardUrl || 'https://foundarly.com';
  const loginUrl = `${siteUrl}/login`;

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

---
Foundarly Consultation Platform
Contact: hello@foundarlybusinessworld.in`;
}

/* ==========================================================================
   4. CONSULTANT APPLICATION REJECTED EMAIL
   ========================================================================== */

export function generateApplicationRejectedEmailHTML(data: EmailApplicationRejectedData): string {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
  <title>Application Update - Foundarly</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8fafc; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 580px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0;">
          
          <!-- Header Banner -->
          <tr>
            <td style="background-color: #475569; padding: 28px 28px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 700;">Consultant Application Update</h1>
              <p style="margin: 6px 0 0; color: #cbd5e1; font-size: 14px;">Foundarly Consultant Program</p>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 32px 28px;">
              <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: #1e293b;">
                Dear <strong>${escapeHTML(data.applicantName)}</strong>,
              </p>
              <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.6; color: #334155;">
                Thank you for your interest in joining <strong>Foundarly</strong> as a consultant and taking the time to apply.
              </p>
              <p style="margin: 0 0 20px; font-size: 15px; line-height: 1.6; color: #334155;">
                After reviewing our current opening requirements and category capacity, we are unable to approve your application at this time.
              </p>

              ${data.reason ? `
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #fef2f2; border-radius: 6px; border: 1px solid #fecaca; margin: 16px 0; padding: 12px;">
                <tr>
                  <td>
                    <p style="margin: 0 0 4px; color: #991b1b; font-size: 11px; font-weight: 600; text-transform: uppercase;">Review Notes:</p>
                    <p style="margin: 0; color: #b91c1c; font-size: 13px; line-height: 1.5;">${escapeHTML(data.reason)}</p>
                  </td>
                </tr>
              </table>` : ''}

              <p style="margin: 20px 0 16px; color: #475569; font-size: 14px; line-height: 1.6;">
                We invite you to re-apply in the future as new consulting domains open up on Foundarly.
              </p>

              <p style="margin: 24px 0 0; color: #64748b; font-size: 14px; line-height: 1.5;">
                If you have questions, please reach out to us at <a href="mailto:hello@foundarlybusinessworld.in" style="color: #b45309; text-decoration: underline;">hello@foundarlybusinessworld.in</a>.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 20px 28px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0 0 4px; color: #475569; font-size: 12px; font-weight: 600;">Foundarly Consultation Platform</p>
              <p style="margin: 0 0 4px; color: #94a3b8; font-size: 11px;">You received this update regarding your application on foundarly.com.</p>
              <p style="margin: 0; color: #94a3b8; font-size: 11px;">© ${new Date().getFullYear()} Foundarly. All rights reserved.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function generateApplicationRejectedEmailText(data: EmailApplicationRejectedData): string {
  return `Consultant Application Update - Foundarly

Dear ${data.applicantName},

Thank you for your interest in joining Foundarly as a consultant.

After reviewing our current category openings, we are unable to approve your consultant application at this time.

${data.reason ? `Feedback from review team: ${data.reason}\n\n` : ''}We encourage you to re-apply in the future as new categories open.

---
Foundarly Consultation Platform
Contact: hello@foundarlybusinessworld.in`;
}

/* ==========================================================================
   5. BOOKING REJECTED / CANCELLED EMAIL
   ========================================================================== */

export function generateBookingRejectedEmailHTML(data: EmailBookingRejectedData): string {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
  <title>Booking Update - Foundarly</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8fafc; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 580px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0;">
          
          <!-- Header Banner -->
          <tr>
            <td style="background-color: #0f172a; padding: 28px 28px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 700;">Consultation Booking Update</h1>
              <p style="margin: 6px 0 0; color: #94a3b8; font-size: 14px;">Foundarly Consultation Platform</p>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 32px 28px;">
              <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: #1e293b;">
                Dear <strong>${escapeHTML(data.userName)}</strong>,
              </p>
              <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.6; color: #334155;">
                We are writing to notify you that your consultation booking with <strong>${escapeHTML(data.consultantName)}</strong> could not be confirmed and has been cancelled.
              </p>

              <!-- Session Details Card -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; margin: 20px 0; padding: 16px;">
                <tr>
                  <td style="padding: 6px 0; font-size: 13px; color: #64748b; width: 120px;">Booking ID:</td>
                  <td style="padding: 6px 0; font-size: 13px; font-weight: 600; font-family: monospace; color: #334155;">${escapeHTML(data.bookingId)}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-size: 13px; color: #64748b;">Scheduled Date:</td>
                  <td style="padding: 6px 0; font-size: 13px; font-weight: 600; color: #334155;">${escapeHTML(formatSessionDate(data.date))}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-size: 13px; color: #64748b;">Time:</td>
                  <td style="padding: 6px 0; font-size: 13px; font-weight: 600; color: #334155;">${escapeHTML(data.time)}</td>
                </tr>
              </table>

              ${data.reason ? `
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #fef2f2; border-radius: 6px; border: 1px solid #fecaca; margin: 16px 0; padding: 12px;">
                <tr>
                  <td>
                    <p style="margin: 0 0 4px; color: #991b1b; font-size: 11px; font-weight: 600; text-transform: uppercase;">Cancellation / Rejection Reason:</p>
                    <p style="margin: 0; color: #b91c1c; font-size: 13px; line-height: 1.5;">${escapeHTML(data.reason)}</p>
                  </td>
                </tr>
              </table>` : ''}

              <p style="margin: 20px 0 16px; color: #475569; font-size: 14px; line-height: 1.6;">
                If you made a payment that requires a refund or if you would like to reschedule with an alternative date, please reach out to our team.
              </p>

              <p style="margin: 24px 0 0; color: #64748b; font-size: 14px; line-height: 1.5;">
                For assistance, reply directly to this email or reach us at <a href="mailto:hello@foundarlybusinessworld.in" style="color: #b45309; text-decoration: underline;">hello@foundarlybusinessworld.in</a>.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 20px 28px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0 0 4px; color: #475569; font-size: 12px; font-weight: 600;">Foundarly Consultation Platform</p>
              <p style="margin: 0 0 4px; color: #94a3b8; font-size: 11px;">You received this notification regarding your booking on foundarly.com.</p>
              <p style="margin: 0; color: #94a3b8; font-size: 11px;">© ${new Date().getFullYear()} Foundarly. All rights reserved.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
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
Support: hello@foundarlybusinessworld.in`;
}

/* ==========================================================================
   FOLLOW-UP WORKFLOW EMAIL TEMPLATES
   ========================================================================== */

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

/**
 * 1. Consultant Notification: Client requested a follow-up session
 */
export function generateFollowUpRequestedEmailHTML(data: EmailFollowUpRequestedData): string {
  const formattedReqDate = formatSessionDate(data.preferredDate);
  const formattedOrigDate = formatSessionDate(data.originalDate);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Follow-up Request - Foundarly</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 580px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0;">
          <tr>
            <td style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 32px 28px; text-align: center;">
              <h1 style="margin: 0 0 6px 0; color: #ffffff; font-size: 22px; font-weight: 700; letter-spacing: -0.5px;">Follow-up Consultation Request</h1>
              <p style="margin: 0; color: #fef3c7; font-size: 14px;">7-Day Meeting Window Active</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 28px;">
              <p style="font-size: 15px; line-height: 24px; margin: 0 0 16px 0;">Hello <strong>${escapeHTML(data.consultantName)}</strong>,</p>
              <p style="font-size: 14px; line-height: 22px; color: #475569; margin: 0 0 24px 0;">
                Your client <strong>${escapeHTML(data.clientName)}</strong> has requested a follow-up consultation within the 7-day post-meeting eligibility period. Please review the proposed time below and confirm or suggest an alternative in your dashboard.
              </p>

              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
                <p style="margin: 0 0 10px 0; font-size: 14px;"><strong>Client:</strong> ${escapeHTML(data.clientName)} (${escapeHTML(data.clientEmail)})</p>
                <p style="margin: 0 0 10px 0; font-size: 14px;"><strong>Original Session:</strong> ${formattedOrigDate} at ${escapeHTML(data.originalTime)}</p>
                <p style="margin: 0 0 10px 0; font-size: 14px; color: #b45309;"><strong>Proposed Follow-up:</strong> ${formattedReqDate} at ${escapeHTML(data.preferredTime)}</p>
                <p style="margin: 0 0 10px 0; font-size: 14px;"><strong>Original Booking Ref:</strong> <code>${escapeHTML(data.bookingId)}</code></p>
                <p style="margin: 0; font-size: 14px;"><strong>Clarification / Reason:</strong></p>
                <blockquote style="margin: 8px 0 0 0; padding: 10px 14px; background: #fff; border-left: 3px solid #f59e0b; border-radius: 4px; font-size: 13px; color: #334155;">
                  ${escapeHTML(data.reason)}
                </blockquote>
              </div>

              <div style="text-align: center; margin-bottom: 28px;">
                <a href="${data.dashboardUrl}" style="display: inline-block; background-color: #f59e0b; color: #ffffff; font-size: 14px; font-weight: 600; text-decoration: none; padding: 12px 28px; border-radius: 8px; box-shadow: 0 2px 4px rgba(245, 158, 11, 0.2);">
                  Respond on Consultant Dashboard
                </a>
              </div>

              <p style="font-size: 12px; color: #94a3b8; line-height: 18px; margin: 0; text-align: center;">
                No administrative approval is required. You can accept, propose an alternative time, or decline directly.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
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

/**
 * 2. Client Notification: Consultant proposed alternative time
 */
export function generateFollowUpAlternativeEmailHTML(data: EmailFollowUpAlternativeData): string {
  const formattedAltDate = formatSessionDate(data.alternativeDate);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Alternative Follow-up Time Proposed - Foundarly</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 580px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0;">
          <tr>
            <td style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 32px 28px; text-align: center;">
              <h1 style="margin: 0 0 6px 0; color: #ffffff; font-size: 22px; font-weight: 700;">Alternative Follow-up Time Proposed</h1>
              <p style="margin: 0; color: #dbeafe; font-size: 14px;">Consultant Response</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 28px;">
              <p style="font-size: 15px; line-height: 24px; margin: 0 0 16px 0;">Hello <strong>${escapeHTML(data.clientName)}</strong>,</p>
              <p style="font-size: 14px; line-height: 22px; color: #475569; margin: 0 0 24px 0;">
                Your consultant <strong>${escapeHTML(data.consultantName)}</strong> is unavailable at your requested time, but has proposed an alternative time within your 7-day follow-up window.
              </p>

              <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
                <p style="margin: 0 0 10px 0; font-size: 15px; color: #1e40af; font-weight: 600;">
                  Proposed Alternative Time: ${formattedAltDate} at ${escapeHTML(data.alternativeTime)}
                </p>
                ${data.consultantNote ? `
                  <p style="margin: 0 0 8px 0; font-size: 13px; color: #1e3a8a;"><strong>Consultant Note:</strong></p>
                  <blockquote style="margin: 0; padding: 8px 12px; background: #fff; border-left: 3px solid #3b82f6; border-radius: 4px; font-size: 13px; color: #334155;">
                    ${escapeHTML(data.consultantNote)}
                  </blockquote>
                ` : ''}
              </div>

              <div style="text-align: center; margin-bottom: 28px;">
                <a href="${data.dashboardUrl}" style="display: inline-block; background-color: #2563eb; color: #ffffff; font-size: 14px; font-weight: 600; text-decoration: none; padding: 12px 28px; border-radius: 8px;">
                  View & Accept Proposed Time
                </a>
              </div>

              <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0;">
                Once you accept, the follow-up meeting will be confirmed immediately.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
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

/**
 * 3. Both Participants: Follow-up session confirmed
 */
export function generateFollowUpConfirmedEmailHTML(data: EmailFollowUpConfirmedData): string {
  const formattedDate = formatSessionDate(data.confirmedDate);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Follow-up Confirmed - Foundarly</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 580px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0;">
          <tr>
            <td style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 32px 28px; text-align: center;">
              <h1 style="margin: 0 0 6px 0; color: #ffffff; font-size: 22px; font-weight: 700;">Follow-up Consultation Confirmed!</h1>
              <p style="margin: 0; color: #d1fae5; font-size: 14px;">Rejoining Original Meeting Room</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 28px;">
              <p style="font-size: 15px; line-height: 24px; margin: 0 0 16px 0;">Hello <strong>${escapeHTML(data.clientName)}</strong> & <strong>${escapeHTML(data.consultantName)}</strong>,</p>
              <p style="font-size: 14px; line-height: 22px; color: #475569; margin: 0 0 24px 0;">
                Your follow-up video consultation has been confirmed. You will rejoin using the original meeting room at the agreed time.
              </p>

              <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
                <p style="margin: 0 0 8px 0; font-size: 15px; color: #065f46; font-weight: 700;">
                  📅 Date & Time: ${formattedDate} at ${escapeHTML(data.confirmedTime)}
                </p>
                <p style="margin: 0 0 8px 0; font-size: 13px; color: #047857;">
                  <strong>Meeting Room ID:</strong> <code>${escapeHTML(data.meetingRoomId)}</code>
                </p>
                <p style="margin: 0 0 8px 0; font-size: 13px; color: #047857;">
                  <strong>Original Booking Ref:</strong> <code>${escapeHTML(data.bookingId)}</code>
                </p>
                <p style="margin: 0; font-size: 13px; color: #065f46;">
                  <strong>Topic:</strong> ${escapeHTML(data.reason)}
                </p>
              </div>

              <div style="text-align: center; margin-bottom: 28px;">
                <a href="${data.meetingLink}" style="display: inline-block; background-color: #10b981; color: #ffffff; font-size: 14px; font-weight: 600; text-decoration: none; padding: 14px 32px; border-radius: 8px; box-shadow: 0 2px 4px rgba(16, 185, 129, 0.2);">
                  Open Meeting Room
                </a>
              </div>

              <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0; line-height: 18px;">
                Only the scheduled client and assigned consultant have access to this room.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
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

/**
 * 4. Client Notification: Follow-up request declined
 */
export function generateFollowUpDeclinedEmailHTML(data: EmailFollowUpDeclinedData): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Follow-up Request Update - Foundarly</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 580px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0;">
          <tr>
            <td style="background: linear-gradient(135deg, #64748b 0%, #475569 100%); padding: 32px 28px; text-align: center;">
              <h1 style="margin: 0 0 6px 0; color: #ffffff; font-size: 22px; font-weight: 700;">Follow-up Request Update</h1>
              <p style="margin: 0; color: #e2e8f0; font-size: 14px;">Consultation Follow-up</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 28px;">
              <p style="font-size: 15px; line-height: 24px; margin: 0 0 16px 0;">Hello <strong>${escapeHTML(data.clientName)}</strong>,</p>
              <p style="font-size: 14px; line-height: 22px; color: #475569; margin: 0 0 24px 0;">
                Your consultant <strong>${escapeHTML(data.consultantName)}</strong> is unfortunately unable to accommodate this follow-up request at this time.
              </p>

              ${data.declinedReason ? `
                <div style="background-color: #f1f5f9; border-left: 3px solid #64748b; padding: 14px 16px; border-radius: 4px; margin-bottom: 24px;">
                  <p style="margin: 0; font-size: 13px; color: #334155;"><strong>Reason provided:</strong> ${escapeHTML(data.declinedReason)}</p>
                </div>
              ` : ''}

              <p style="font-size: 13px; color: #64748b; line-height: 20px;">
                You may reach out to our support team at <a href="mailto:hello@foundarlybusinessworld.in" style="color: #f59e0b;">hello@foundarlybusinessworld.in</a> if you need further assistance.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function generateFollowUpDeclinedEmailText(data: EmailFollowUpDeclinedData): string {
  return `Follow-up Request Update - Foundarly

Dear ${data.clientName},

Your consultant ${data.consultantName} was unable to accommodate your follow-up request.
${data.declinedReason ? `Reason: "${data.declinedReason}"\n` : ''}

Booking Reference: ${data.bookingId}

If you have questions or require further assistance, please contact us at hello@foundarlybusinessworld.in.

---
Foundarly Consultation Platform`;
}

