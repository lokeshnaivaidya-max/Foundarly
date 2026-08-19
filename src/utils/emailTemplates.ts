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
Contact: officialfoundarly@gmail.com
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
Contact: officialfoundarly@gmail.com`;
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
Contact: officialfoundarly@gmail.com`;
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
                If you have questions, please reach out to us at <a href="mailto:officialfoundarly@gmail.com" style="color: #b45309; text-decoration: underline;">officialfoundarly@gmail.com</a>.
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
Contact: officialfoundarly@gmail.com`;
}
