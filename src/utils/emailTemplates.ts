/**
 * Email templates for Foundarly booking confirmations
 * Designed with Foundarly's signature White & Gold brand aesthetic
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

export function generateUserEmailHTML(data: EmailBookingData): string {
  const formattedDate = formatSessionDate(data.date);
  const timing = data.time && data.time !== 'Flexible' ? data.time : 'Flexible Time';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Booking Confirmed - Foundarly</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06); border: 1px solid #f1f5f9;">
          
          <!-- Brand Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #F5A623 0%, #D48806 100%); padding: 36px 32px; text-align: center;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <div style="background: rgba(255, 255, 255, 0.2); width: 48px; height: 48px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 12px;">
                      <span style="font-size: 24px; color: #ffffff; line-height: 48px;">✓</span>
                    </div>
                    <h1 style="margin: 0; color: #ffffff; font-size: 26px; font-weight: 700; letter-spacing: -0.02em;">Booking Confirmed!</h1>
                    <p style="margin: 8px 0 0; color: rgba(255, 255, 255, 0.92); font-size: 15px;">Your consultation session is scheduled</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 36px 32px;">
              <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: #1e293b;">
                Hi <strong>${escapeHTML(data.userName)}</strong>,
              </p>
              <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.6; color: #475569;">
                Great news! Your consultation with <strong style="color: #D48806;">${escapeHTML(data.consultantName)}</strong> has been successfully confirmed and paid.
              </p>

              <!-- Session Details Card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fdfbf7; border-radius: 12px; border: 1px solid #fef3c7; margin: 24px 0;">
                <tr>
                  <td style="padding: 20px 24px;">
                    <h3 style="margin: 0 0 16px; color: #92400e; font-size: 16px; font-weight: 600;">Session Details</h3>
                    <table width="100%" cellpadding="6" cellspacing="0" style="font-size: 14px;">
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
                        <td style="color: #0f172a; font-family: monospace; font-size: 12px; text-align: right; padding: 6px 0;">${data.bookingId}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Join Call Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 28px 0;">
                <tr>
                  <td align="center">
                    <a href="${data.meetingLink}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background: linear-gradient(135deg, #F5A623 0%, #D48806 100%); color: #ffffff; text-decoration: none; padding: 14px 36px; border-radius: 8px; font-size: 15px; font-weight: 600; box-shadow: 0 4px 12px rgba(245, 166, 35, 0.28);">
                      Join Video Meeting
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 20px; color: #64748b; font-size: 13px; text-align: center;">
                You can join the meeting 5 minutes before your scheduled start time.
              </p>

              <!-- Direct Link Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; margin: 20px 0; padding: 14px;">
                <tr>
                  <td>
                    <p style="margin: 0 0 6px; color: #64748b; font-size: 11px; text-transform: uppercase; font-weight: 600; letter-spacing: 0.05em;">Direct Meeting Link</p>
                    <a href="${data.meetingLink}" style="color: #D48806; font-size: 13px; word-break: break-all; text-decoration: none; font-family: monospace;">${data.meetingLink}</a>
                  </td>
                </tr>
              </table>

              <p style="margin: 24px 0 0; color: #64748b; font-size: 14px; line-height: 1.5;">
                If you have any questions or need assistance, reply to this email or visit your <a href="${data.meetingLink.split('/meeting/')[0]}/my-bookings" style="color: #D48806; text-decoration: none; font-weight: 500;">Foundarly Dashboard</a>.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 24px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0 0 6px; color: #64748b; font-size: 13px; font-weight: 600;">Foundarly Consultation Platform</p>
              <p style="margin: 0 0 6px; color: #94a3b8; font-size: 12px;">© ${new Date().getFullYear()} Foundarly. All rights reserved.</p>
              <p style="margin: 0; color: #94a3b8; font-size: 11px;">This is an automated booking confirmation email.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function generateConsultantEmailHTML(data: EmailBookingData): string {
  const formattedDate = formatSessionDate(data.date);
  const timing = data.time && data.time !== 'Flexible' ? data.time : 'Flexible Time';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Booking Received - Foundarly</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06); border: 1px solid #f1f5f9;">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #F5A623 0%, #D48806 100%); padding: 36px 32px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 26px; font-weight: 700;">🎉 New Booking Scheduled!</h1>
              <p style="margin: 8px 0 0; color: rgba(255, 255, 255, 0.92); font-size: 15px;">A client has booked a consultation with you</p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 36px 32px;">
              <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: #1e293b;">
                Hi <strong>${escapeHTML(data.consultantName)}</strong>,
              </p>
              <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.6; color: #475569;">
                You have a new confirmed consultation booking with <strong style="color: #D48806;">${escapeHTML(data.userName)}</strong>.
              </p>

              <!-- Session Details -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fdfbf7; border-radius: 12px; border: 1px solid #fef3c7; margin: 24px 0;">
                <tr>
                  <td style="padding: 20px 24px;">
                    <h3 style="margin: 0 0 16px; color: #92400e; font-size: 16px; font-weight: 600;">Client & Session Details</h3>
                    <table width="100%" cellpadding="6" cellspacing="0" style="font-size: 14px;">
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
                        <td style="color: #64748b; padding: 6px 0; vertical-align: top;">Message:</td>
                        <td style="color: #0f172a; text-align: right; padding: 6px 0;">${escapeHTML(data.message)}</td>
                      </tr>` : ''}
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 28px 0;">
                <tr>
                  <td align="center">
                    <a href="${data.meetingLink}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background: linear-gradient(135deg, #F5A623 0%, #D48806 100%); color: #ffffff; text-decoration: none; padding: 14px 36px; border-radius: 8px; font-size: 15px; font-weight: 600; box-shadow: 0 4px 12px rgba(245, 166, 35, 0.28);">
                      Open Meeting Room
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Link Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; margin: 20px 0; padding: 14px;">
                <tr>
                  <td>
                    <p style="margin: 0 0 6px; color: #64748b; font-size: 11px; text-transform: uppercase; font-weight: 600; letter-spacing: 0.05em;">Meeting Link</p>
                    <a href="${data.meetingLink}" style="color: #D48806; font-size: 13px; word-break: break-all; text-decoration: none; font-family: monospace;">${data.meetingLink}</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 24px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0 0 6px; color: #64748b; font-size: 13px; font-weight: 600;">Foundarly Consultation Platform</p>
              <p style="margin: 0; color: #94a3b8; font-size: 12px;">© ${new Date().getFullYear()} Foundarly. All rights reserved.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function escapeHTML(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
