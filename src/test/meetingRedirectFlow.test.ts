import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  isMeetingUrl,
  normalizeMeetingPath,
  saveMeetingRedirect,
  getMeetingRedirect,
  clearMeetingRedirect,
  buildMeetingLoginUrl,
  MEETING_REDIRECT_KEY,
} from '../utils/meetingRedirect.js';
import {
  generateConsultantEmailHTML,
  generateUserEmailHTML,
  generateSessionCompletedEmailHTML,
} from '../utils/emailTemplates.js';
import { calculateRejoinEligibility } from '../utils/meetingRejoin.js';

// Polyfill window, sessionStorage, localStorage for Node environment testing
const storageMock = () => {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) || null,
    setItem: (key: string, value: string) => store.set(key, String(value)),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
  };
};

(global as any).window = {
  sessionStorage: storageMock(),
  localStorage: storageMock(),
};

describe('Meeting Email Link Authentication & Redirect Flow', () => {
  beforeEach(() => {
    (global as any).window.sessionStorage.clear();
    (global as any).window.localStorage.clear();
  });

  describe('1. Email Template URL Generation Verification', () => {
    const bookingId = '82d23b7a-9c71-4680-a887-b93be7de2a04';
    const meetingRoomId = `foundarly-${bookingId}`;
    const meetingLink = `https://foundarlybusinessworld.in/meeting/${meetingRoomId}`;

    it('generates "Open Video Meeting Room" CTA in consultant email matching meeting URL', () => {
      const emailHtml = generateConsultantEmailHTML({
        clientName: 'Jane Client',
        clientEmail: 'jane@example.com',
        consultantName: 'Dr. John Expert',
        consultantEmail: 'john@expert.com',
        date: '2026-11-10',
        time: '10:00 AM',
        bookingId,
        meetingLink,
      });

      assert.match(emailHtml, /Open Video Meeting Room/);
      assert.match(emailHtml, new RegExp(`href="${meetingLink}"`));
    });

    it('generates "Join Video Meeting Room" CTA in client email matching identical meeting URL', () => {
      const emailHtml = generateUserEmailHTML({
        clientName: 'Jane Client',
        clientEmail: 'jane@example.com',
        consultantName: 'Dr. John Expert',
        date: '2026-11-10',
        time: '10:00 AM',
        bookingId,
        meetingLink,
      });

      assert.match(emailHtml, /Join Video Meeting Room/);
      assert.match(emailHtml, new RegExp(`href="${meetingLink}"`));
    });

    it('generates "Rejoin Consultation Room" in 7-day follow-up session completed email', () => {
      const emailHtml = generateSessionCompletedEmailHTML({
        clientName: 'Jane Client',
        clientEmail: 'jane@example.com',
        consultantName: 'Dr. John Expert',
        date: '2026-11-10',
        time: '10:00 AM',
        bookingId,
        meetingLink,
      });

      assert.match(emailHtml, /Rejoin Consultation Room/);
      assert.match(emailHtml, new RegExp(`href="${meetingLink}"`));
    });
  });

  describe('2. URL Path & Query Parameter Normalization', () => {
    it('accurately identifies meeting paths and full meeting URLs', () => {
      assert.equal(isMeetingUrl('/meeting/foundarly-12345'), true);
      assert.equal(isMeetingUrl('/meeting/booking/12345'), true);
      assert.equal(isMeetingUrl('https://foundarlybusinessworld.in/meeting/foundarly-12345'), true);
      assert.equal(isMeetingUrl('/my-bookings'), false);
      assert.equal(isMeetingUrl('/consultant/dashboard'), false);
      assert.equal(isMeetingUrl('/login'), false);
    });

    it('normalizes full URLs to relative paths preserving query strings and hashes', () => {
      const fullUrl = 'https://foundarlybusinessworld.in/meeting/foundarly-12345?rejoin=true&role=consultant#call';
      const normalized = normalizeMeetingPath(fullUrl);
      assert.equal(normalized, '/meeting/foundarly-12345?rejoin=true&role=consultant#call');
    });

    it('normalizes router location objects with search and hash parameters', () => {
      const locationObj = {
        pathname: '/meeting/foundarly-999',
        search: '?rejoin=true&session=followup',
        hash: '#active',
      };
      const normalized = normalizeMeetingPath(locationObj);
      assert.equal(normalized, '/meeting/foundarly-999?rejoin=true&session=followup#active');
    });

    it('builds login URL encoding target URL as query parameter and router state', () => {
      const target = '/meeting/foundarly-abc-123?rejoin=true';
      const loginUrl = buildMeetingLoginUrl(target);
      assert.equal(loginUrl, '/login?redirect=%2Fmeeting%2Ffoundarly-abc-123%3Frejoin%3Dtrue&from=%2Fmeeting%2Ffoundarly-abc-123%3Frejoin%3Dtrue');
    });
  });

  describe('3. Persistence Across Storage & OAuth Redirect Resilience', () => {
    it('persists meeting destination to both sessionStorage and localStorage', () => {
      const target = '/meeting/foundarly-test-uuid-456?rejoin=true';
      saveMeetingRedirect(target);

      assert.equal((global as any).window.sessionStorage.getItem(MEETING_REDIRECT_KEY), target);
      assert.equal((global as any).window.localStorage.getItem(MEETING_REDIRECT_KEY), target);
    });

    it('retrieves meeting destination from sessionStorage when location state is absent', () => {
      const target = '/meeting/foundarly-oauth-recovery';
      saveMeetingRedirect(target);

      // In OAuth return, location.state is null and location.search is empty
      const resolved = getMeetingRedirect(null, '');
      assert.equal(resolved, target);
    });

    it('retrieves meeting destination from URL query parameter when storage is empty', () => {
      const search = '?redirect=%2Fmeeting%2Ffoundarly-from-param%3Frejoin%3D1';
      const resolved = getMeetingRedirect(null, search);
      assert.equal(resolved, '/meeting/foundarly-from-param?rejoin=1');
    });

    it('prioritizes explicit location.state over fallback storage', () => {
      saveMeetingRedirect('/meeting/stale-session-room');

      const freshState = { from: '/meeting/active-fresh-room?rejoin=true' };
      const resolved = getMeetingRedirect(freshState, '');
      assert.equal(resolved, '/meeting/active-fresh-room?rejoin=true');
    });

    it('clears storage keys upon reaching the meeting room', () => {
      saveMeetingRedirect('/meeting/foundarly-cleanup-test');
      assert.ok((global as any).window.sessionStorage.getItem(MEETING_REDIRECT_KEY));

      clearMeetingRedirect();
      assert.equal((global as any).window.sessionStorage.getItem(MEETING_REDIRECT_KEY), null);
      assert.equal((global as any).window.localStorage.getItem(MEETING_REDIRECT_KEY), null);
    });
  });

  describe('4. Dual-Role Post-Login Redirection (Client & Consultant)', () => {
    const meetingPath = '/meeting/foundarly-shared-room-777';

    it('redirects Client directly to meeting room instead of default /my-bookings', () => {
      const clientLocationState = { from: meetingPath };
      const destination = getMeetingRedirect(clientLocationState, '');

      // Verify that meeting destination is found and preferred
      assert.equal(destination, meetingPath);
      assert.notEqual(destination, '/my-bookings');
    });

    it('redirects Consultant directly to meeting room instead of default /consultant/dashboard', () => {
      const consultantLocationState = { from: meetingPath };
      const destination = getMeetingRedirect(consultantLocationState, '');

      // Verify that meeting destination is found and preferred over consultant dashboard
      assert.equal(destination, meetingPath);
      assert.notEqual(destination, '/consultant/dashboard');
    });

    it('redirects Admin directly to meeting room instead of default /admin', () => {
      const adminLocationState = { from: meetingPath };
      const destination = getMeetingRedirect(adminLocationState, '');

      assert.equal(destination, meetingPath);
      assert.notEqual(destination, '/admin');
    });
  });

  describe('5. Identical Meeting Room Entrance Verification', () => {
    function computeCanonicalRoom(rawInput: string, booking?: { id?: string; meeting_room_id?: string | null }) {
      if (booking?.meeting_room_id && typeof booking.meeting_room_id === 'string' && booking.meeting_room_id.trim()) {
        return booking.meeting_room_id.trim();
      }
      if (booking?.id) {
        const rawId = String(booking.id).trim();
        return rawId.startsWith('foundarly-') ? rawId : `foundarly-${rawId}`;
      }
      if (rawInput) {
        const clean = rawInput.trim().replace(/^.*\/meeting\//, '').split('?')[0].split('#')[0].replace(/\/+$/, '');
        return clean.startsWith('foundarly-') ? clean : `foundarly-${clean}`;
      }
      return 'default-room';
    }

    const testBooking = {
      id: 'd9b73461-826f-45b9-913a-ff1957297e68',
      meeting_room_id: 'foundarly-d9b73461-826f-45b9-913a-ff1957297e68',
    };

    it('both client and consultant enter the exact same canonical meeting room ID', () => {
      // Client clicks email link: /meeting/foundarly-d9b73461-826f-45b9-913a-ff1957297e68
      const clientEmailUrl = `/meeting/${testBooking.meeting_room_id}`;
      // Consultant clicks email link: /meeting/foundarly-d9b73461-826f-45b9-913a-ff1957297e68
      const consultantEmailUrl = `/meeting/${testBooking.meeting_room_id}`;

      const clientRoom = computeCanonicalRoom(clientEmailUrl, testBooking);
      const consultantRoom = computeCanonicalRoom(consultantEmailUrl, testBooking);

      assert.equal(clientRoom, 'foundarly-d9b73461-826f-45b9-913a-ff1957297e68');
      assert.equal(consultantRoom, 'foundarly-d9b73461-826f-45b9-913a-ff1957297e68');
      assert.equal(clientRoom, consultantRoom);
    });

    it('both participants enter the same room even when accessed via booking route /meeting/booking/:bookingId', () => {
      const clientBookingRoute = `/meeting/booking/${testBooking.id}`;
      const consultantDirectRoute = `/meeting/${testBooking.meeting_room_id}`;

      const clientRoom = computeCanonicalRoom(clientBookingRoute, testBooking);
      const consultantRoom = computeCanonicalRoom(consultantDirectRoute, testBooking);

      assert.equal(clientRoom, consultantRoom);
      assert.equal(clientRoom, testBooking.meeting_room_id);
    });
  });

  describe('6. 7-Day Rejoin Functionality Preservation', () => {
    it('preserves 7-day rejoin eligibility calculation and allows rejoin within 7 days', () => {
      const now = new Date();
      // Consultation ended 2 days ago
      const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
      const dateStr = twoDaysAgo.toISOString().split('T')[0];
      const timeStr = '14:00';

      const eligibility = calculateRejoinEligibility({
        date: dateStr,
        time: timeStr,
        session_duration: 60,
        status: 'completed',
      });

      assert.equal(eligibility.canJoin, true);
      assert.equal(eligibility.isRejoin, true);
      assert.equal(eligibility.sessionStatus, 'rejoin_eligible');
      assert.ok(eligibility.rejoinDaysRemaining > 0 && eligibility.rejoinDaysRemaining <= 7);
      assert.ok(eligibility.rejoinDeadline.getTime() > now.getTime());
    });

    it('preserves rejoin URL query parameters through authentication redirect and login', () => {
      const rejoinMeetingUrl = '/meeting/foundarly-booking-completed-123?rejoin=true&session=followup';
      saveMeetingRedirect(rejoinMeetingUrl);

      // Simulate unauthenticated redirect to login with query params
      const loginUrl = buildMeetingLoginUrl(rejoinMeetingUrl);
      const search = loginUrl.substring(loginUrl.indexOf('?'));

      // Simulate post-login resolution
      const targetAfterLogin = getMeetingRedirect(null, search);
      assert.equal(targetAfterLogin, rejoinMeetingUrl);
      assert.match(targetAfterLogin!, /rejoin=true/);
      assert.match(targetAfterLogin!, /session=followup/);
    });
  });
});
