/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Foundarly Comprehensive Email Templates & Meeting Links QA Test Suite
 * Validates brand consistency, professional subject lines, responsive markup,
 * button destinations, shared meeting room IDs, and 7-day rejoin policy.
 */

import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  FOUNDARLY_BRAND,
  formatSessionDate,
  generateUserEmailHTML,
  generateUserEmailText,
  generateConsultantEmailHTML,
  generateConsultantEmailText,
  generateMeetingReminderEmailHTML,
  generateMeetingReminderEmailText,
  generateMeetingRoomInviteEmailHTML,
  generateMeetingRoomInviteEmailText,
  generateRescheduleRequestedEmailHTML,
  generateRescheduleRequestedEmailText,
  generateRescheduleConfirmedEmailHTML,
  generateRescheduleConfirmedEmailText,
  generateBookingRejectedEmailHTML,
  generateBookingRejectedEmailText,
  generatePaymentConfirmationEmailHTML,
  generatePaymentConfirmationEmailText,
  generateEmailVerificationEmailHTML,
  generateEmailVerificationEmailText,
  generatePasswordResetEmailHTML,
  generatePasswordResetEmailText,
  generateApplicationApprovedEmailHTML,
  generateApplicationApprovedEmailText,
  generateApplicationRejectedEmailHTML,
  generateApplicationRejectedEmailText,
  generateFollowUpRequestedEmailHTML,
  generateFollowUpRequestedEmailText,
  generateFollowUpAlternativeEmailHTML,
  generateFollowUpAlternativeEmailText,
  generateFollowUpConfirmedEmailHTML,
  generateFollowUpConfirmedEmailText,
  generateFollowUpDeclinedEmailHTML,
  generateFollowUpDeclinedEmailText,
  generateParticipantWaitingEmailHTML,
  generateParticipantWaitingEmailText,
  generateSessionCompletedEmailHTML,
  generateSessionCompletedEmailText,
  EmailBookingData,
  EmailMeetingReminderData,
  EmailMeetingRoomInviteData,
  EmailRescheduleData,
  EmailPaymentConfirmationData,
  EmailSessionCompletedData,
  EmailParticipantWaitingData,
} from '../src/utils/emailTemplates.js';

describe('Foundarly Email Notification System & Link Verification Suite', () => {

  const baseBookingData: EmailBookingData = {
    bookingId: 'f94e1122-3344-5566-7788-99aabbccdde0',
    userName: 'Jane Doe',
    userEmail: 'jane.doe@example.com',
    consultantName: 'Dr. Sarah Jenkins',
    consultantEmail: 'sarah.jenkins@foundarlybusinessworld.in',
    date: '2026-11-15',
    time: '14:30',
    duration: 60,
    meetingRoomId: 'foundarly-f94e1122-3344-5566-7788-99aabbccdde0',
    meetingLink: 'https://www.foundarlybusinessworld.in/meeting/foundarly-f94e1122-3344-5566-7788-99aabbccdde0',
    price: 2500,
    message: 'Need strategic guidance on B2B SaaS go-to-market and investor pitches.',
  };

  test('1. Website Branding, Palette & Logo Consistency Across Templates', () => {
    assert.equal(FOUNDARLY_BRAND.name, 'Foundarly');
    assert.equal(FOUNDARLY_BRAND.domain, 'https://www.foundarlybusinessworld.in');
    assert.equal(FOUNDARLY_BRAND.logoUrl, 'https://www.foundarlybusinessworld.in/logo.png');
    assert.equal(FOUNDARLY_BRAND.supportEmail, 'hello@foundarlybusinessworld.in');

    const clientHtml = generateUserEmailHTML(baseBookingData);
    assert.ok(clientHtml.includes(FOUNDARLY_BRAND.logoUrl), 'Client email must contain official logo URL');
    assert.ok(clientHtml.includes('FOUNDARLY • BUSINESS WORLD'), 'Header must contain official uppercase wordmark');
    assert.ok(clientHtml.includes('#d97706'), 'Must contain Foundarly primary gold color');
    assert.ok(clientHtml.includes('#0f172a'), 'Must contain Foundarly deep navy header/accent');
    assert.ok(clientHtml.includes('hello@foundarlybusinessworld.in'), 'Must contain official support email');
    assert.ok(clientHtml.includes('https://www.foundarlybusinessworld.in'), 'Must contain official domain in footer');
  });

  test('2. Client Booking Confirmation: CTA Button Destination & Shared Room ID', () => {
    const html = generateUserEmailHTML(baseBookingData);
    const text = generateUserEmailText(baseBookingData);

    // Verify Meeting Link & Button
    assert.ok(html.includes('href="https://www.foundarlybusinessworld.in/meeting/foundarly-f94e1122-3344-5566-7788-99aabbccdde0"'));
    assert.ok(html.includes('Join Video Meeting Room'));
    assert.ok(html.includes('Direct Link to Join:'));
    assert.ok(html.includes('https://www.foundarlybusinessworld.in/my-bookings'));
    assert.ok(html.includes('Foundarly 7-Day Post-Meeting Rejoin Guarantee'));

    // Check Plain Text fallback
    assert.ok(text.includes(baseBookingData.meetingLink));
    assert.ok(text.includes('Booking ID: f94e1122-3344-5566-7788-99aabbccdde0'));
    assert.ok(text.includes('Dr. Sarah Jenkins'));
    assert.ok(text.includes('Jane Doe'));
  });

  test('3. Consultant Booking Notification: Button Destination & Dashboard Link', () => {
    const html = generateConsultantEmailHTML(baseBookingData);
    const text = generateConsultantEmailText(baseBookingData);

    assert.ok(html.includes('href="https://www.foundarlybusinessworld.in/meeting/foundarly-f94e1122-3344-5566-7788-99aabbccdde0"'));
    assert.ok(html.includes('Open Video Meeting Room'));
    assert.ok(html.includes('https://www.foundarlybusinessworld.in/consultant/dashboard'));
    assert.ok(html.includes('Consultant Dashboard'));
    assert.ok(html.includes('Client Topic / Note:'));

    assert.ok(text.includes('New Consultation Booking – Foundarly'));
    assert.ok(text.includes(baseBookingData.meetingLink));
    assert.ok(text.includes('https://www.foundarlybusinessworld.in/consultant/dashboard'));
  });

  test('4. Meeting Room ID Symmetry: Client and Consultant use Identical Room Link', () => {
    const clientHtml = generateUserEmailHTML(baseBookingData);
    const consultantHtml = generateConsultantEmailHTML(baseBookingData);

    // Extract href for meeting link
    const clientRoomMatch = clientHtml.match(/href="([^"]+\/meeting\/[^"]+)"/);
    const consultantRoomMatch = consultantHtml.match(/href="([^"]+\/meeting\/[^"]+)"/);

    assert.ok(clientRoomMatch && clientRoomMatch[1], 'Client meeting link must be present');
    assert.ok(consultantRoomMatch && consultantRoomMatch[1], 'Consultant meeting link must be present');

    // CRITICAL: Both client and consultant must enter the EXACT SAME meeting room ID
    assert.equal(
      clientRoomMatch[1],
      consultantRoomMatch[1],
      'Client and Consultant must receive identical meeting room links for the booking'
    );
    assert.equal(
      clientRoomMatch[1],
      'https://www.foundarlybusinessworld.in/meeting/foundarly-f94e1122-3344-5566-7788-99aabbccdde0'
    );
  });

  test('5. Meeting Reminder: Validates Button, Starting Time & Dashboard Link', () => {
    const reminderData: EmailMeetingReminderData = {
      bookingId: baseBookingData.bookingId,
      recipientName: 'Jane Doe',
      recipientEmail: 'jane.doe@example.com',
      recipientRole: 'client',
      partnerName: 'Dr. Sarah Jenkins',
      date: '2026-11-15',
      time: '14:30',
      duration: 60,
      meetingLink: baseBookingData.meetingLink,
      meetingRoomId: baseBookingData.meetingRoomId!,
      timeframeLabel: 'Starting in 15 Minutes',
    };

    const html = generateMeetingReminderEmailHTML(reminderData);
    const text = generateMeetingReminderEmailText(reminderData);

    assert.ok(html.includes('Your Foundarly Meeting Reminder'));
    assert.ok(html.includes('Starting in 15 Minutes'));
    assert.ok(html.includes('Open Video Meeting Room'));
    assert.ok(html.includes(baseBookingData.meetingLink));
    assert.ok(html.includes('https://www.foundarlybusinessworld.in/my-bookings'));

    assert.ok(text.includes('Your Foundarly Meeting Reminder'));
    assert.ok(text.includes(baseBookingData.meetingLink));
  });

  test('6. Meeting Room Invitation: Destination and Recipient Details', () => {
    const inviteData: EmailMeetingRoomInviteData = {
      bookingId: baseBookingData.bookingId,
      recipientName: 'Jane Doe',
      recipientEmail: 'jane.doe@example.com',
      inviterName: 'Dr. Sarah Jenkins',
      consultantName: 'Dr. Sarah Jenkins',
      clientName: 'Jane Doe',
      date: '2026-11-15',
      time: '14:30',
      duration: 60,
      meetingLink: baseBookingData.meetingLink,
      meetingRoomId: baseBookingData.meetingRoomId!,
      customMessage: 'Please have your financial projection deck ready.',
    };

    const html = generateMeetingRoomInviteEmailHTML(inviteData);
    const text = generateMeetingRoomInviteEmailText(inviteData);

    assert.ok(html.includes('Meeting Room Invitation'));
    assert.ok(html.includes('Join Video Meeting Room'));
    assert.ok(html.includes('Please have your financial projection deck ready.'));
    assert.ok(html.includes(baseBookingData.meetingLink));

    assert.ok(text.includes('Join Video Meeting Room – Foundarly Consultation'));
    assert.ok(text.includes(baseBookingData.meetingLink));
  });

  test('7. Reschedule Flow: Request Notification & Confirmed Schedule', () => {
    const rescheduleData: EmailRescheduleData = {
      bookingId: baseBookingData.bookingId,
      clientName: 'Jane Doe',
      clientEmail: 'jane.doe@example.com',
      consultantName: 'Dr. Sarah Jenkins',
      consultantEmail: 'sarah.jenkins@foundarlybusinessworld.in',
      originalDate: '2026-11-15',
      originalTime: '14:30',
      newDate: '2026-11-18',
      newTime: '16:00',
      reason: 'Urgent board meeting scheduled at original time.',
      meetingLink: baseBookingData.meetingLink,
      dashboardUrl: 'https://www.foundarlybusinessworld.in/consultant/dashboard',
    };

    // Request email
    const reqHtml = generateRescheduleRequestedEmailHTML(rescheduleData);
    const reqText = generateRescheduleRequestedEmailText(rescheduleData);

    assert.ok(reqHtml.includes('Reschedule Request'));
    assert.ok(reqHtml.includes('Review on Consultant Dashboard'));
    assert.ok(reqHtml.includes('https://www.foundarlybusinessworld.in/consultant/dashboard'));
    assert.ok(reqHtml.includes('Urgent board meeting scheduled'));
    assert.ok(reqText.includes('Consultation Reschedule Request – Foundarly'));

    // Confirmed email
    const confHtml = generateRescheduleConfirmedEmailHTML(rescheduleData);
    const confText = generateRescheduleConfirmedEmailText(rescheduleData);

    assert.ok(confHtml.includes('Consultation Rescheduled'));
    assert.ok(confHtml.includes('Open Video Meeting Room'));
    assert.ok(confHtml.includes(baseBookingData.meetingLink));
    assert.ok(confText.includes('Your Consultation Has Been Rescheduled – Foundarly'));
  });

  test('8. Booking Cancellation / Rejection Email: Feedback & Alternative Support', () => {
    const rejectHtml = generateBookingRejectedEmailHTML({
      bookingId: baseBookingData.bookingId,
      userName: 'Jane Doe',
      userEmail: 'jane.doe@example.com',
      consultantName: 'Dr. Sarah Jenkins',
      date: '2026-11-15',
      time: '14:30',
      reason: 'Consultant unavailable due to international keynote conference.',
      supportUrl: 'https://www.foundarlybusinessworld.in',
    });

    assert.ok(rejectHtml.includes('Consultation Booking Update'));
    assert.ok(rejectHtml.includes('cancelled'));
    assert.ok(rejectHtml.includes('Consultant unavailable due to international keynote conference.'));
    assert.ok(rejectHtml.includes('https://www.foundarlybusinessworld.in/consultants'));
    assert.ok(rejectHtml.includes('Explore Other Consultants'));
    assert.ok(rejectHtml.includes('mailto:hello@foundarlybusinessworld.in'));
  });

  test('9. Payment Confirmation: Receipt, Meeting Room & Dashboard Links', () => {
    const paymentData: EmailPaymentConfirmationData = {
      bookingId: baseBookingData.bookingId,
      userName: 'Jane Doe',
      userEmail: 'jane.doe@example.com',
      consultantName: 'Dr. Sarah Jenkins',
      amount: 2500,
      currency: 'INR',
      paymentMethod: 'UPI',
      transactionId: 'UPI-TXN-998877665544',
      date: '2026-11-15',
      time: '14:30',
      duration: 60,
      meetingLink: baseBookingData.meetingLink,
      meetingRoomId: baseBookingData.meetingRoomId!,
    };

    const html = generatePaymentConfirmationEmailHTML(paymentData);
    const text = generatePaymentConfirmationEmailText(paymentData);

    assert.ok(html.includes('Payment Confirmation'));
    assert.ok(html.includes('₹2500'));
    assert.ok(html.includes('UPI-TXN-998877665544'));
    assert.ok(html.includes('Open Video Meeting Room'));
    assert.ok(html.includes(baseBookingData.meetingLink));
    assert.ok(html.includes('https://www.foundarlybusinessworld.in/my-bookings'));

    assert.ok(text.includes('Payment Confirmation – Foundarly'));
    assert.ok(text.includes('₹2500'));
    assert.ok(text.includes('UPI-TXN-998877665544'));
  });

  test('10. Email Verification & Password Reset Action Buttons', () => {
    const verifyHtml = generateEmailVerificationEmailHTML({
      userName: 'Jane Doe',
      userEmail: 'jane.doe@example.com',
      verificationUrl: 'https://www.foundarlybusinessworld.in/login?verify_token=tok123456',
    });
    assert.ok(verifyHtml.includes('Verify Your Email'));
    assert.ok(verifyHtml.includes('Verify Email Address'));
    assert.ok(verifyHtml.includes('href="https://www.foundarlybusinessworld.in/login?verify_token=tok123456"'));

    const resetHtml = generatePasswordResetEmailHTML({
      userName: 'Jane Doe',
      userEmail: 'jane.doe@example.com',
      resetUrl: 'https://www.foundarlybusinessworld.in/reset-password?token=res987654',
    });
    assert.ok(resetHtml.includes('Reset Your Password'));
    assert.ok(resetHtml.includes('Reset Password'));
    assert.ok(resetHtml.includes('href="https://www.foundarlybusinessworld.in/reset-password?token=res987654"'));
  });

  test('11. 7-Day Follow-Up & Rejoin Policy Email Integrity', () => {
    const completedData: EmailSessionCompletedData = {
      bookingId: baseBookingData.bookingId,
      userName: 'Jane Doe',
      userEmail: 'jane.doe@example.com',
      consultantName: 'Dr. Sarah Jenkins',
      consultantEmail: 'sarah.jenkins@foundarlybusinessworld.in',
      recipientRole: 'client',
      recipientName: 'Jane Doe',
      recipientEmail: 'jane.doe@example.com',
      date: '2026-11-15',
      time: '14:30',
      sessionDuration: 60,
      meetingRoomId: baseBookingData.meetingRoomId!,
      meetingLink: baseBookingData.meetingLink,
      rejoinDeadline: '2026-11-22T15:30:00.000Z',
      rejoinExpiryFormatted: 'November 22, 2026 at 3:30 PM UTC',
      rejoinDaysRemaining: 7,
    };

    const html = generateSessionCompletedEmailHTML(completedData);
    const text = generateSessionCompletedEmailText(completedData);

    assert.ok(html.includes('7-Day Follow-Up Clarification Policy'));
    assert.ok(html.includes('rejoin the exact same meeting room'));
    assert.ok(html.includes('November 22, 2026 at 3:30 PM UTC'));
    assert.ok(html.includes('Rejoin Consultation Room'));
    assert.ok(html.includes('Rejoin Meeting'));
    assert.ok(html.includes('My Bookings'));
    assert.ok(html.includes(baseBookingData.meetingLink));

    assert.ok(text.includes('7-DAY FOLLOW-UP CLARIFICATION POLICY'));
    assert.ok(text.includes('November 22, 2026 at 3:30 PM UTC'));
    assert.ok(text.includes('Rejoin Meeting'));
    assert.ok(text.includes(baseBookingData.meetingLink));
  });

  test('12. Waiting Participant Email: Correct Join Button & Status', () => {
    const waitingData: EmailParticipantWaitingData = {
      bookingId: baseBookingData.bookingId,
      recipientName: 'Dr. Sarah Jenkins',
      recipientEmail: 'sarah.jenkins@foundarlybusinessworld.in',
      waitingUserName: 'Jane Doe',
      waitingUserRole: 'client',
      meetingLink: baseBookingData.meetingLink,
      meetingRoomId: baseBookingData.meetingRoomId!,
      date: '2026-11-15',
      time: '14:30',
      isFollowUp: false,
    };

    const html = generateParticipantWaitingEmailHTML(waitingData);
    const text = generateParticipantWaitingEmailText(waitingData);

    assert.ok(html.includes('Jane Doe is waiting in the meeting room'));
    assert.ok(html.includes('Join Meeting Now'));
    assert.ok(html.includes(baseBookingData.meetingLink));

    assert.ok(text.includes('Jane Doe is waiting in the room'));
    assert.ok(text.includes(baseBookingData.meetingLink));
  });

  test('13. Comprehensive Link Audit: Zero Localhost/Insecure URLs & Valid Route Destinations', () => {
    // Generate all email templates with diverse inputs (including dirty inputs like localhost or relative links)
    const templates: { name: string; html: string; text: string }[] = [
      {
        name: 'User Booking Confirmation',
        html: generateUserEmailHTML({ ...baseBookingData, meetingLink: 'http://localhost:3000/meeting/foundarly-123' }),
        text: generateUserEmailText(baseBookingData),
      },
      {
        name: 'Consultant Booking Notification',
        html: generateConsultantEmailHTML({ ...baseBookingData, meetingLink: 'http://localhost:3000/meeting/foundarly-123' }),
        text: generateConsultantEmailText(baseBookingData),
      },
      {
        name: 'Meeting Reminder (Client)',
        html: generateMeetingReminderEmailHTML({
          bookingId: baseBookingData.bookingId,
          recipientName: 'Jane Doe',
          recipientEmail: 'jane.doe@example.com',
          recipientRole: 'client',
          partnerName: 'Dr. Sarah Jenkins',
          date: '2026-11-15',
          time: '14:30',
          duration: 60,
          meetingLink: 'http://127.0.0.1:3000/meeting/foundarly-123',
          meetingRoomId: 'foundarly-123',
        }),
        text: generateMeetingReminderEmailText({
          bookingId: baseBookingData.bookingId,
          recipientName: 'Jane Doe',
          recipientEmail: 'jane.doe@example.com',
          recipientRole: 'client',
          partnerName: 'Dr. Sarah Jenkins',
          date: '2026-11-15',
          time: '14:30',
          duration: 60,
          meetingLink: 'https://www.foundarlybusinessworld.in/meeting/foundarly-123',
          meetingRoomId: 'foundarly-123',
        }),
      },
      {
        name: 'Meeting Room Invite',
        html: generateMeetingRoomInviteEmailHTML({
          bookingId: baseBookingData.bookingId,
          recipientName: 'Jane Doe',
          recipientEmail: 'jane.doe@example.com',
          inviterName: 'Dr. Sarah Jenkins',
          consultantName: 'Dr. Sarah Jenkins',
          clientName: 'Jane Doe',
          date: '2026-11-15',
          time: '14:30',
          duration: 60,
          meetingLink: 'https://foundarly-delta.vercel.app/meeting/foundarly-123',
          meetingRoomId: 'foundarly-123',
        }),
        text: generateMeetingRoomInviteEmailText({
          bookingId: baseBookingData.bookingId,
          recipientName: 'Jane Doe',
          recipientEmail: 'jane.doe@example.com',
          inviterName: 'Dr. Sarah Jenkins',
          consultantName: 'Dr. Sarah Jenkins',
          clientName: 'Jane Doe',
          date: '2026-11-15',
          time: '14:30',
          duration: 60,
          meetingLink: 'https://www.foundarlybusinessworld.in/meeting/foundarly-123',
          meetingRoomId: 'foundarly-123',
        }),
      },
      {
        name: 'Reschedule Requested',
        html: generateRescheduleRequestedEmailHTML({
          bookingId: baseBookingData.bookingId,
          clientName: 'Jane Doe',
          clientEmail: 'jane.doe@example.com',
          consultantName: 'Dr. Sarah Jenkins',
          originalDate: '2026-11-15',
          originalTime: '14:30',
          newDate: '2026-11-18',
          newTime: '16:00',
          reason: 'Client travel',
          dashboardUrl: 'http://localhost:3000/consultant/dashboard',
        }),
        text: generateRescheduleRequestedEmailText({
          bookingId: baseBookingData.bookingId,
          clientName: 'Jane Doe',
          clientEmail: 'jane.doe@example.com',
          consultantName: 'Dr. Sarah Jenkins',
          originalDate: '2026-11-15',
          originalTime: '14:30',
          newDate: '2026-11-18',
          newTime: '16:00',
        }),
      },
      {
        name: 'Payment Confirmation',
        html: generatePaymentConfirmationEmailHTML({
          bookingId: baseBookingData.bookingId,
          userName: 'Jane Doe',
          userEmail: 'jane.doe@example.com',
          consultantName: 'Dr. Sarah Jenkins',
          amount: 2500,
          currency: 'INR',
          transactionId: 'UPI-TXN-9876543210',
          date: '2026-11-15',
          time: '14:30',
          duration: 60,
          meetingLink: 'http://localhost:3000/meeting/foundarly-123',
          meetingRoomId: 'foundarly-123',
        }),
        text: generatePaymentConfirmationEmailText({
          bookingId: baseBookingData.bookingId,
          userName: 'Jane Doe',
          userEmail: 'jane.doe@example.com',
          consultantName: 'Dr. Sarah Jenkins',
          amount: 2500,
          currency: 'INR',
          date: '2026-11-15',
          time: '14:30',
          duration: 60,
          meetingLink: 'https://www.foundarlybusinessworld.in/meeting/foundarly-123',
          meetingRoomId: 'foundarly-123',
        }),
      },
      {
        name: 'Email Verification',
        html: generateEmailVerificationEmailHTML({
          userName: 'Jane Doe',
          userEmail: 'jane.doe@example.com',
          verificationUrl: 'http://localhost:3000/login?verify_token=test-token-123',
        }),
        text: generateEmailVerificationEmailText({
          userName: 'Jane Doe',
          userEmail: 'jane.doe@example.com',
          verificationUrl: 'https://www.foundarlybusinessworld.in/login?verify_token=test-token-123',
        }),
      },
      {
        name: 'Password Reset',
        html: generatePasswordResetEmailHTML({
          userName: 'Jane Doe',
          userEmail: 'jane.doe@example.com',
          resetUrl: 'http://localhost:3000/reset-password?token=test-reset-123',
        }),
        text: generatePasswordResetEmailText({
          userName: 'Jane Doe',
          userEmail: 'jane.doe@example.com',
          resetUrl: 'https://www.foundarlybusinessworld.in/reset-password?token=test-reset-123',
        }),
      },
      {
        name: 'Consultant Application Approved',
        html: generateApplicationApprovedEmailHTML({
          applicantName: 'Dr. Sarah Jenkins',
          applicantEmail: 'sarah.jenkins@foundarlybusinessworld.in',
          dashboardUrl: '/consultant/dashboard',
        }),
        text: generateApplicationApprovedEmailText({
          applicantName: 'Dr. Sarah Jenkins',
          applicantEmail: 'sarah.jenkins@foundarlybusinessworld.in',
        }),
      },
      {
        name: 'Consultant Application Rejected',
        html: generateApplicationRejectedEmailHTML({
          applicantName: 'John Candidate',
          applicantEmail: 'john@example.com',
          reason: 'Application does not meet current criteria',
        }),
        text: generateApplicationRejectedEmailText({
          applicantName: 'John Candidate',
          applicantEmail: 'john@example.com',
        }),
      },
      {
        name: 'Session Completed (7-Day Rejoin)',
        html: generateSessionCompletedEmailHTML({
          bookingId: baseBookingData.bookingId,
          userName: 'Jane Doe',
          userEmail: 'jane.doe@example.com',
          consultantName: 'Dr. Sarah Jenkins',
          recipientRole: 'client',
          recipientName: 'Jane Doe',
          recipientEmail: 'jane.doe@example.com',
          date: '2026-11-15',
          time: '14:30',
          sessionDuration: 60,
          meetingRoomId: 'foundarly-123',
          meetingLink: 'http://localhost:3000/meeting/foundarly-123',
          rejoinDeadline: '2026-11-22T15:30:00.000Z',
          rejoinExpiryFormatted: 'November 22, 2026 at 3:30 PM UTC',
          rejoinDaysRemaining: 7,
        }),
        text: generateSessionCompletedEmailText({
          bookingId: baseBookingData.bookingId,
          userName: 'Jane Doe',
          userEmail: 'jane.doe@example.com',
          consultantName: 'Dr. Sarah Jenkins',
          recipientRole: 'client',
          recipientName: 'Jane Doe',
          recipientEmail: 'jane.doe@example.com',
          date: '2026-11-15',
          time: '14:30',
          sessionDuration: 60,
          meetingRoomId: 'foundarly-123',
          meetingLink: 'https://www.foundarlybusinessworld.in/meeting/foundarly-123',
          rejoinDeadline: '2026-11-22T15:30:00.000Z',
          rejoinExpiryFormatted: 'November 22, 2026 at 3:30 PM UTC',
          rejoinDaysRemaining: 7,
        }),
      },
    ];

    const validPaths = [
      '/',
      '/my-bookings',
      '/consultant/dashboard',
      '/consultants',
      '/login',
      '/reset-password',
      '/pricing',
      '/terms',
      '/privacy',
      '/meeting/foundarly-123',
      '/meeting/foundarly-f94e1122-3344-5566-7788-99aabbccdde0',
    ];

    for (const t of templates) {
      // 1. Extract all href attributes
      const hrefRegex = /href="([^"]+)"/g;
      let match;
      let linkCount = 0;

      while ((match = hrefRegex.exec(t.html)) !== null) {
        const rawUrl = match[1];
        linkCount++;

        // No localhost or staging hostnames
        assert.ok(!rawUrl.includes('localhost'), `[${t.name}] Link ${rawUrl} must not contain localhost`);
        assert.ok(!rawUrl.includes('127.0.0.1'), `[${t.name}] Link ${rawUrl} must not contain 127.0.0.1`);
        assert.ok(!rawUrl.includes('vercel.app'), `[${t.name}] Link ${rawUrl} must not contain vercel.app`);
        assert.ok(!rawUrl.includes('run.app'), `[${t.name}] Link ${rawUrl} must not contain run.app`);

        if (rawUrl.startsWith('mailto:')) {
          assert.ok(rawUrl.includes('@foundarlybusinessworld.in'), `[${t.name}] Support email must be @foundarlybusinessworld.in`);
        } else {
          assert.ok(rawUrl.startsWith('https://www.foundarlybusinessworld.in'), `[${t.name}] URL must start with canonical HTTPS domain: ${rawUrl}`);
          const parsed = new URL(rawUrl);
          assert.equal(parsed.protocol, 'https:');
          assert.equal(parsed.hostname, 'www.foundarlybusinessworld.in');
          
          const isKnownPath = validPaths.some((vp) => parsed.pathname === vp || parsed.pathname.startsWith('/meeting/'));
          assert.ok(isKnownPath, `[${t.name}] Path "${parsed.pathname}" must be a registered application route`);
        }
      }

      assert.ok(linkCount >= 2, `[${t.name}] Must have at least 2 verified links (found ${linkCount})`);
    }
  });
});
