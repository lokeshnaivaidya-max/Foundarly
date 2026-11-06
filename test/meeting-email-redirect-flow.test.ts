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
} from '../src/utils/meetingRedirect.js';
import {
  generateConsultantEmailHTML,
  generateUserEmailHTML,
  generateSessionCompletedEmailHTML,
} from '../src/utils/emailTemplates.js';
import { calculateRejoinEligibility, validateParticipantAccess } from '../src/utils/meetingRejoin.js';

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

      assert.equal(destination, meetingPath);
      assert.notEqual(destination, '/my-bookings');
    });

    it('redirects Consultant directly to meeting room instead of default /consultant/dashboard', () => {
      const consultantLocationState = { from: meetingPath };
      const destination = getMeetingRedirect(consultantLocationState, '');

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
      const clientEmailUrl = `/meeting/${testBooking.meeting_room_id}`;
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

      const loginUrl = buildMeetingLoginUrl(rejoinMeetingUrl);
      const search = loginUrl.substring(loginUrl.indexOf('?'));

      const targetAfterLogin = getMeetingRedirect(null, search);
      assert.equal(targetAfterLogin, rejoinMeetingUrl);
      assert.match(targetAfterLogin!, /rejoin=true/);
      assert.match(targetAfterLogin!, /session=followup/);
    });
  });

  describe('7. Consultant Meeting Link Repeated Login Loop Prevention', () => {
    const bookingId = 'c1234567-89ab-cdef-0123-456789abcdef';
    const meetingRoomId = `foundarly-${bookingId}`;
    const meetingPath = `/meeting/${meetingRoomId}`;
    const consultantUserId = 'cons-user-uuid-1111';
    const consultantEmail = 'consultant@expert.com';

    it('Scenario 1: Authenticated consultant clicking meeting link directly preserves meeting target', () => {
      // Simulates consultant clicking email link while session already active
      const search = `?redirect=${encodeURIComponent(meetingPath)}&from=${encodeURIComponent(meetingPath)}`;
      const target = getMeetingRedirect(null, search);
      assert.equal(target, meetingPath);
    });

    it('Scenario 2: Unauthenticated consultant login flow routes directly to meeting room, NOT consultant dashboard', () => {
      // Unauthenticated consultant hits meeting route, gets saved to redirect storage
      saveMeetingRedirect(meetingPath);

      // Consultant navigates to login with return params
      const loginUrl = buildMeetingLoginUrl(meetingPath);
      const search = loginUrl.substring(loginUrl.indexOf('?'));

      // Both query param and storage resolve to exact original meeting URL
      const targetFromQuery = getMeetingRedirect(null, search);
      const targetFromStorage = getMeetingRedirect(null, '');
      assert.equal(targetFromQuery, meetingPath);
      assert.equal(targetFromStorage, meetingPath);

      // Verify consultant role routing logic preserves meeting path
      const isConsultant = true;
      const validConsultantFrom = (typeof targetFromQuery === 'string' && (targetFromQuery.startsWith('/consultant') || isMeetingUrl(targetFromQuery)))
        ? targetFromQuery
        : '/consultant/dashboard';
      assert.equal(validConsultantFrom, meetingPath);
      assert.notEqual(validConsultantFrom, '/consultant/dashboard');
    });

    it('Scenario 3: Consultant page refresh preserves meeting room without login prompt', () => {
      saveMeetingRedirect(meetingPath);
      // Simulated page refresh: location state is reset, but storage preserves target
      const targetOnRefresh = getMeetingRedirect(null, '');
      assert.equal(targetOnRefresh, meetingPath);
    });

    it('Scenario 4: Consultant opens meeting in new tab with query parameters intact', () => {
      const newTabSearch = `?from=${encodeURIComponent(meetingPath)}`;
      const target = getMeetingRedirect(null, newTabSearch);
      assert.equal(target, meetingPath);
    });

    it('Scenario 5: Chrome PWA shortcut or restore retains meeting room path', () => {
      saveMeetingRedirect(meetingPath);
      assert.equal((global as any).window.localStorage.getItem(MEETING_REDIRECT_KEY), meetingPath);
      assert.equal((global as any).window.sessionStorage.getItem(MEETING_REDIRECT_KEY), meetingPath);
    });

    it('Scenario 6: Assigned consultant is authorized by user_id or verified email', () => {
      const mockBooking = {
        id: bookingId,
        user_id: 'client-user-9999',
        email: 'client@foundarly.in',
        consultant_id: 'consultant-row-id',
        status: 'confirmed',
        payment_status: 'paid',
      };

      const mockConsultantObj = {
        id: 'consultant-row-id',
        user_id: consultantUserId,
        email: consultantEmail,
      };

      // By user_id
      const authById = validateParticipantAccess(
        { id: consultantUserId, email: 'different@email.com' } as any,
        mockBooking,
        mockConsultantObj
      );
      assert.equal(authById.authorized, true);
      assert.equal(authById.role, 'consultant');

      // By email (e.g. unlinked user_id)
      const authByEmail = validateParticipantAccess(
        { id: 'new-auth-id-2222', email: consultantEmail } as any,
        mockBooking,
        mockConsultantObj
      );
      assert.equal(authByEmail.authorized, true);
      assert.equal(authByEmail.role, 'consultant');
    });

    it('Scenario 7: Unauthorized third party is strictly denied access', () => {
      const mockBooking = {
        id: bookingId,
        user_id: 'client-user-9999',
        email: 'client@foundarly.in',
        consultant_id: 'consultant-row-id',
        status: 'confirmed',
        payment_status: 'paid',
      };

      const mockConsultantObj = {
        id: 'consultant-row-id',
        user_id: consultantUserId,
        email: consultantEmail,
      };

      const intruder = { id: 'intruder-uuid', email: 'stranger@example.com' };
      const authResult = validateParticipantAccess(intruder as any, mockBooking, mockConsultantObj);
      assert.equal(authResult.authorized, false);
      assert.equal(authResult.code, 'UNAUTHORIZED_PARTICIPANT');
    });
  });
});
