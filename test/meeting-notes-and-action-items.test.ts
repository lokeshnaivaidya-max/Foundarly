/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Foundarly In-Meeting Real-time Notes & Action Items Test Suite
 * Tests storage, CRUD operations, security authorization, and export formatting.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { meetingNotesStorage } from '../src/server/meeting/meetingNotesStorage.js';
import { validateParticipantAccess } from '../src/utils/meetingRejoin.js';
import { meetingNotesService } from '../src/services/meetingNotesService.js';

describe('Meeting Notes & Real-time Action Items Test Suite', () => {
  const testRoomId = 'test-room-notes-101';
  const consultantUser = {
    id: 'consultant-uuid-1',
    name: 'Dr. Jane Consultant',
    role: 'consultant',
  };
  const clientUser = {
    id: 'client-uuid-2',
    name: 'Alex Client',
    role: 'client',
  };

  beforeEach(() => {
    meetingNotesStorage.clearNotesForTesting(testRoomId);
  });

  describe('1. Storage & CRUD Operations', () => {
    it('returns empty notes structure with default version for fresh room', () => {
      const notes = meetingNotesStorage.getNotes(testRoomId);
      assert.equal(notes.bookingId, testRoomId);
      assert.equal(notes.sharedNotes, '');
      assert.deepEqual(notes.actionItems, []);
      assert.equal(notes.version, 1);
    });

    it('updates shared notes and increments version', () => {
      const updated = meetingNotesStorage.updateSharedNotes(
        testRoomId,
        'Discussed Q1 roadmap and hiring strategy.',
        consultantUser
      );

      assert.equal(updated.sharedNotes, 'Discussed Q1 roadmap and hiring strategy.');
      assert.equal(updated.lastUpdatedBy?.name, 'Dr. Jane Consultant');
      assert.equal(updated.version, 2);

      // Verify retrieval
      const fetched = meetingNotesStorage.getNotes(testRoomId);
      assert.equal(fetched.sharedNotes, 'Discussed Q1 roadmap and hiring strategy.');
    });

    it('adds an action item with assignee, priority, and due date', () => {
      const { notes, item } = meetingNotesStorage.addActionItem(
        testRoomId,
        {
          text: 'Review revised unit economics model',
          assignee: 'client',
          priority: 'high',
          dueDate: 'Within 48 hours',
        },
        consultantUser
      );

      assert.equal(notes.actionItems.length, 1);
      assert.equal(item.text, 'Review revised unit economics model');
      assert.equal(item.assignee, 'client');
      assert.equal(item.priority, 'high');
      assert.equal(item.dueDate, 'Within 48 hours');
      assert.equal(item.completed, false);
      assert.equal(item.completedAt, null);
      assert.equal(item.createdBy.name, 'Dr. Jane Consultant');
    });

    it('toggles action item completion status and sets timestamp', () => {
      const { item } = meetingNotesStorage.addActionItem(
        testRoomId,
        { text: 'Finalize presentation deck', assignee: 'both' },
        clientUser
      );

      // Mark completed
      const { notes: updated1, item: toggled1 } = meetingNotesStorage.toggleActionItem(
        testRoomId,
        item.id,
        true,
        clientUser
      );

      assert.equal(toggled1?.completed, true);
      assert.ok(toggled1?.completedAt !== null);

      // Toggle back to pending
      const { notes: updated2, item: toggled2 } = meetingNotesStorage.toggleActionItem(
        testRoomId,
        item.id,
        false,
        consultantUser
      );

      assert.equal(toggled2?.completed, false);
      assert.equal(toggled2?.completedAt, null);
    });

    it('deletes an action item cleanly', () => {
      const { item: item1 } = meetingNotesStorage.addActionItem(
        testRoomId,
        { text: 'Task 1', assignee: 'client' },
        clientUser
      );
      const { item: item2 } = meetingNotesStorage.addActionItem(
        testRoomId,
        { text: 'Task 2', assignee: 'consultant' },
        consultantUser
      );

      assert.equal(meetingNotesStorage.getNotes(testRoomId).actionItems.length, 2);

      const afterDelete = meetingNotesStorage.deleteActionItem(testRoomId, item1.id);
      assert.equal(afterDelete.actionItems.length, 1);
      assert.equal(afterDelete.actionItems[0].id, item2.id);
    });
  });

  describe('2. Security Authorization & Participant Access', () => {
    const authorizedBooking = {
      id: 'booking-uuid-777',
      user_id: 'client-user-123',
      email: 'client@example.com',
      consultant_id: 'consultant-id-456',
      status: 'confirmed',
      payment_status: 'paid',
    };

    const consultantRecord = {
      id: 'consultant-id-456',
      user_id: 'consultant-auth-user',
      email: 'consultant@foundarly.com',
    };

    it('authorizes scheduled client to access meeting notes', () => {
      const client = { id: 'client-user-123', email: 'client@example.com' };
      const auth = validateParticipantAccess(client, authorizedBooking, consultantRecord, false);
      assert.equal(auth.authorized, true);
      assert.equal(auth.role, 'client');
    });

    it('authorizes assigned consultant to access meeting notes', () => {
      const consultant = { id: 'consultant-auth-user', email: 'consultant@foundarly.com' };
      const auth = validateParticipantAccess(consultant, authorizedBooking, consultantRecord, false);
      assert.equal(auth.authorized, true);
      assert.equal(auth.role, 'consultant');
    });

    it('STRICT SECURITY NEGATIVE TEST: Rejects unrelated third party with UNAUTHORIZED_PARTICIPANT', () => {
      const stranger = { id: 'intruder-user-999', email: 'intruder@domain.com' };
      const auth = validateParticipantAccess(stranger, authorizedBooking, consultantRecord, false);
      assert.equal(auth.authorized, false);
      assert.equal(auth.code, 'UNAUTHORIZED_PARTICIPANT');
    });

    it('STRICT SECURITY NEGATIVE TEST: Rejects cancelled or rejected booking notes access', () => {
      const cancelledBooking = { ...authorizedBooking, status: 'cancelled' };
      const client = { id: 'client-user-123', email: 'client@example.com' };
      const auth = validateParticipantAccess(client, cancelledBooking, consultantRecord, false);
      assert.equal(auth.authorized, false);
      assert.equal(auth.code, 'BOOKING_CANCELLED');
    });
  });

  describe('3. Export & Summary Document Generation', () => {
    it('generates well-formatted Markdown summary document with progress metrics', () => {
      const mockBooking = {
        name: 'Sarah Connor',
        date: '2026-11-20',
        time: '10:00 AM',
        meeting_room_id: 'foundarly-meeting-888',
        consultants: {
          name: 'Marcus Wright',
        },
      };

      const mockNotes = {
        bookingId: 'meeting-888',
        roomId: 'foundarly-meeting-888',
        sharedNotes: 'Identified three strategic growth levers for Q1.\nKey focus on user retention.',
        actionItems: [
          {
            id: '1',
            text: 'Launch weekly user cohort analysis',
            assignee: 'client' as const,
            priority: 'high' as const,
            dueDate: 'Friday',
            completed: true,
            createdBy: { id: 'c1', name: 'Marcus', role: 'consultant' },
            createdAt: new Date().toISOString(),
          },
          {
            id: '2',
            text: 'Send enterprise pricing guide',
            assignee: 'consultant' as const,
            priority: 'normal' as const,
            completed: false,
            createdBy: { id: 'c1', name: 'Marcus', role: 'consultant' },
            createdAt: new Date().toISOString(),
          },
        ],
        lastUpdatedAt: new Date().toISOString(),
        version: 3,
      };

      const doc = meetingNotesService.generateSummaryDocument(
        mockBooking,
        mockNotes,
        'Private reflection: Follow up on enterprise contracts.'
      );

      assert.match(doc, /# FOUNDARLY CONSULTATION SUMMARY/);
      assert.match(doc, /Marcus Wright/);
      assert.match(doc, /Sarah Connor/);
      assert.match(doc, /Progress:\*\* 1 of 2 completed \(50%\)/);
      assert.match(doc, /\[x\] \*\*Launch weekly user cohort analysis\*\*/);
      assert.match(doc, /\[ \] \*\*Send enterprise pricing guide\*\*/);
      assert.match(doc, /CONFIDENTIAL PRIVATE NOTES/);
      assert.match(doc, /Follow up on enterprise contracts/);
    });
  });
});
