import { describe, it, expect } from 'vitest';
import {
  generateParticipantWaitingEmailHTML,
  generateParticipantWaitingEmailText,
  EmailParticipantWaitingData,
} from '@/utils/emailTemplates';

describe('Participant Waiting Email Notifications', () => {
  const mockBooking = {
    bookingId: 'b1234567-89ab-cdef-0123-456789abcdef',
    meetingRoomId: 'foundarly-b1234567-89ab-cdef-0123-456789abcdef',
    meetingLink: 'https://foundarlybusinessworld.in/meeting/foundarly-b1234567-89ab-cdef-0123-456789abcdef',
    date: '2026-10-16',
    time: '15:00',
  };

  describe('1. Client Waiting in Room Notification (Sent to Consultant)', () => {
    const clientWaitingData: EmailParticipantWaitingData = {
      ...mockBooking,
      recipientName: 'Dr. John Consultant',
      recipientEmail: 'consultant@foundarly.com',
      waitingUserName: 'Alice Client',
      waitingUserRole: 'client',
      isFollowUp: false,
    };

    it('generates email HTML with client waiting message and join link for consultant', () => {
      const html = generateParticipantWaitingEmailHTML(clientWaitingData);

      expect(html).toContain('Alice Client');
      expect(html).toContain('Dr. John Consultant');
      expect(html).toContain('waiting in the meeting room');
      expect(html).toContain('Consultation Meeting');
      expect(html).toContain(mockBooking.meetingLink);
      expect(html).toContain(mockBooking.meetingRoomId);
      expect(html).toContain('Join Meeting Now');
    });

    it('generates email plain-text fallback with all critical details', () => {
      const text = generateParticipantWaitingEmailText(clientWaitingData);

      expect(text).toContain('Alice Client');
      expect(text).toContain('Dr. John Consultant');
      expect(text).toContain(mockBooking.meetingLink);
      expect(text).toContain(mockBooking.meetingRoomId);
      expect(text).toContain('Client');
    });
  });

  describe('2. Consultant Waiting in Room Notification (Sent to Client)', () => {
    const consultantWaitingData: EmailParticipantWaitingData = {
      ...mockBooking,
      recipientName: 'Alice Client',
      recipientEmail: 'client@example.com',
      waitingUserName: 'Dr. John Consultant',
      waitingUserRole: 'consultant',
      isFollowUp: true,
    };

    it('generates email HTML with consultant waiting message for 7-day follow-up', () => {
      const html = generateParticipantWaitingEmailHTML(consultantWaitingData);

      expect(html).toContain('Dr. John Consultant');
      expect(html).toContain('Alice Client');
      expect(html).toContain('Your consultant is waiting in the meeting room');
      expect(html).toContain('7-Day Follow-Up Clarification');
      expect(html).toContain(mockBooking.meetingLink);
      expect(html).toContain(mockBooking.meetingRoomId);
      expect(html).toContain('Join Meeting Now');
    });

    it('generates email plain text for consultant waiting', () => {
      const text = generateParticipantWaitingEmailText(consultantWaitingData);

      expect(text).toContain('Dr. John Consultant');
      expect(text).toContain('Alice Client');
      expect(text).toContain(mockBooking.meetingLink);
      expect(text).toContain('Consultant');
      expect(text).toContain('7-Day Follow-Up Clarification');
    });
  });

  describe('3. Meeting Link and Room ID Integrity', () => {
    it('ensures the exact same meeting link is embedded without modification', () => {
      const customUrl = 'https://custom-domain.com/meeting/foundarly-xyz-999';
      const data: EmailParticipantWaitingData = {
        bookingId: 'xyz-999',
        recipientName: 'Test Recipient',
        recipientEmail: 'recipient@test.com',
        waitingUserName: 'Test Sender',
        waitingUserRole: 'client',
        meetingLink: customUrl,
        meetingRoomId: 'foundarly-xyz-999',
      };

      const html = generateParticipantWaitingEmailHTML(data);
      const text = generateParticipantWaitingEmailText(data);

      expect(html).toContain(customUrl);
      expect(text).toContain(customUrl);
    });
  });
});
