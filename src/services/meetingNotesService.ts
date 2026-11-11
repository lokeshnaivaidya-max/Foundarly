/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Foundarly Meeting Notes & Action Items Client Service
 * Provides secure communication with the meeting notes endpoint,
 * real-time broadcast helpers, local recovery cache, and export formatting.
 */

import { supabase } from '@/lib/supabase';
import { getStoredSession } from '@/contexts/AuthContext';
import { MeetingNotesData, MeetingActionItem } from '@/server/meeting/meetingNotesStorage';

export type { MeetingNotesData, MeetingActionItem };

const LOCAL_STORAGE_KEY_PREFIX = 'foundarly_meeting_notes_';
const PRIVATE_NOTES_KEY_PREFIX = 'foundarly_private_notes_';

function canonicalize(roomIdOrBookingId: string): string {
  if (!roomIdOrBookingId) return '';
  let id = roomIdOrBookingId.trim();
  if (id.includes('/meeting/')) {
    id = id.split('/meeting/').pop() || id;
  }
  return id.replace(/^foundarly-/, '').split('?')[0].split('#')[0].trim();
}

async function getAuthToken(): Promise<string | null> {
  const { data: sessionData } = await supabase.auth.getSession();
  let token = sessionData?.session?.access_token;
  if (!token) {
    const stored = getStoredSession();
    if (stored?.access_token) {
      token = stored.access_token;
    }
  }
  return token || null;
}

export const meetingNotesService = {
  /**
   * Retrieves notes for the specified meeting room from the server.
   * If server is unreachable or offline, falls back gracefully to locally cached notes.
   */
  async getNotes(roomId: string): Promise<{ success: boolean; notes: MeetingNotesData; role?: string; error?: string }> {
    const canonical = canonicalize(roomId);
    if (!canonical) {
      return {
        success: false,
        error: 'Invalid meeting room ID',
        notes: this.getCachedNotes(roomId),
      };
    }

    const token = await getAuthToken();
    if (!token) {
      return {
        success: false,
        error: 'Authentication token required.',
        notes: this.getCachedNotes(roomId),
      };
    }

    try {
      const response = await fetch('/api/meeting/notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'get', roomId: canonical }),
      });

      const data = await response.json().catch(() => null);
      if (response.ok && data?.success && data?.notes) {
        this.cacheNotes(canonical, data.notes);
        return {
          success: true,
          notes: data.notes,
          role: data.role,
        };
      }

      return {
        success: false,
        error: data?.error || `Server responded with status ${response.status}`,
        notes: this.getCachedNotes(canonical),
      };
    } catch (networkErr: unknown) {
      console.warn('[MeetingNotesService] Server error fetching notes, using cache:', networkErr);
      return {
        success: false,
        error: networkErr instanceof Error ? networkErr.message : 'Network error',
        notes: this.getCachedNotes(canonical),
      };
    }
  },

  /**
   * Updates shared notes text on the server and caches locally.
   */
  async updateSharedNotes(roomId: string, sharedNotes: string): Promise<{ success: boolean; notes?: MeetingNotesData; error?: string }> {
    const canonical = canonicalize(roomId);
    const token = await getAuthToken();
    if (!token) {
      // Offline fallback: save locally
      const cached = this.getCachedNotes(canonical);
      cached.sharedNotes = sharedNotes;
      cached.lastUpdatedAt = new Date().toISOString();
      this.cacheNotes(canonical, cached);
      return { success: true, notes: cached };
    }

    try {
      const response = await fetch('/api/meeting/notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'update_notes',
          roomId: canonical,
          sharedNotes,
        }),
      });

      const data = await response.json().catch(() => null);
      if (response.ok && data?.success && data?.notes) {
        this.cacheNotes(canonical, data.notes);
        return { success: true, notes: data.notes };
      }

      return {
        success: false,
        error: data?.error || 'Failed to update shared notes.',
      };
    } catch (err: unknown) {
      console.warn('[MeetingNotesService] Failed to sync notes with server:', err);
      const cached = this.getCachedNotes(canonical);
      cached.sharedNotes = sharedNotes;
      cached.lastUpdatedAt = new Date().toISOString();
      this.cacheNotes(canonical, cached);
      return { success: true, notes: cached };
    }
  },

  /**
   * Adds an action item to the meeting room.
   */
  async addActionItem(
    roomId: string,
    item: {
      text: string;
      assignee?: 'client' | 'consultant' | 'both';
      priority?: 'high' | 'medium' | 'normal';
      dueDate?: string;
    }
  ): Promise<{ success: boolean; notes?: MeetingNotesData; item?: MeetingActionItem; error?: string }> {
    const canonical = canonicalize(roomId);
    const token = await getAuthToken();
    if (!token) {
      return { success: false, error: 'Authentication required' };
    }

    try {
      const response = await fetch('/api/meeting/notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'add_action_item',
          roomId: canonical,
          item,
        }),
      });

      const data = await response.json().catch(() => null);
      if (response.ok && data?.success && data?.notes) {
        this.cacheNotes(canonical, data.notes);
        return { success: true, notes: data.notes, item: data.item };
      }

      return {
        success: false,
        error: data?.error || 'Failed to add action item.',
      };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Network error adding action item',
      };
    }
  },

  /**
   * Toggles the completion state of an action item.
   */
  async toggleActionItem(
    roomId: string,
    itemId: string,
    completed?: boolean
  ): Promise<{ success: boolean; notes?: MeetingNotesData; item?: MeetingActionItem | null; error?: string }> {
    const canonical = canonicalize(roomId);
    const token = await getAuthToken();
    if (!token) {
      return { success: false, error: 'Authentication required' };
    }

    try {
      const response = await fetch('/api/meeting/notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'toggle_action_item',
          roomId: canonical,
          itemId,
          completed,
        }),
      });

      const data = await response.json().catch(() => null);
      if (response.ok && data?.success && data?.notes) {
        this.cacheNotes(canonical, data.notes);
        return { success: true, notes: data.notes, item: data.item };
      }

      return {
        success: false,
        error: data?.error || 'Failed to toggle action item.',
      };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Network error toggling action item',
      };
    }
  },

  /**
   * Deletes an action item.
   */
  async deleteActionItem(roomId: string, itemId: string): Promise<{ success: boolean; notes?: MeetingNotesData; error?: string }> {
    const canonical = canonicalize(roomId);
    const token = await getAuthToken();
    if (!token) {
      return { success: false, error: 'Authentication required' };
    }

    try {
      const response = await fetch('/api/meeting/notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'delete_action_item',
          roomId: canonical,
          itemId,
        }),
      });

      const data = await response.json().catch(() => null);
      if (response.ok && data?.success && data?.notes) {
        this.cacheNotes(canonical, data.notes);
        return { success: true, notes: data.notes };
      }

      return {
        success: false,
        error: data?.error || 'Failed to delete action item.',
      };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Network error deleting action item',
      };
    }
  },

  /**
   * Private user-only notes (stored locally on device, never shared with the other participant)
   */
  getPrivateNotes(roomId: string, userId?: string): string {
    if (typeof window === 'undefined' || !window.localStorage) return '';
    const canonical = canonicalize(roomId);
    const userSuffix = userId ? `_${userId}` : '';
    try {
      return window.localStorage.getItem(`${PRIVATE_NOTES_KEY_PREFIX}${canonical}${userSuffix}`) || '';
    } catch {
      return '';
    }
  },

  savePrivateNotes(roomId: string, text: string, userId?: string): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    const canonical = canonicalize(roomId);
    const userSuffix = userId ? `_${userId}` : '';
    try {
      window.localStorage.setItem(`${PRIVATE_NOTES_KEY_PREFIX}${canonical}${userSuffix}`, text);
    } catch {
      // Ignore storage errors
    }
  },

  /**
   * Client-side caching helpers
   */
  getCachedNotes(roomId: string): MeetingNotesData {
    const canonical = canonicalize(roomId);
    if (typeof window === 'undefined' || !window.sessionStorage) {
      return {
        bookingId: canonical,
        roomId: `foundarly-${canonical}`,
        sharedNotes: '',
        actionItems: [],
        lastUpdatedAt: new Date().toISOString(),
        version: 1,
      };
    }

    try {
      const raw = window.sessionStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}${canonical}`) ||
                  window.localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}${canonical}`);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch {
      // Ignore
    }

    return {
      bookingId: canonical,
      roomId: `foundarly-${canonical}`,
      sharedNotes: '',
      actionItems: [],
      lastUpdatedAt: new Date().toISOString(),
      version: 1,
    };
  },

  cacheNotes(roomId: string, data: MeetingNotesData): void {
    if (typeof window === 'undefined') return;
    const canonical = canonicalize(roomId);
    try {
      const str = JSON.stringify(data);
      window.sessionStorage?.setItem(`${LOCAL_STORAGE_KEY_PREFIX}${canonical}`, str);
      window.localStorage?.setItem(`${LOCAL_STORAGE_KEY_PREFIX}${canonical}`, str);
    } catch {
      // Ignore storage quota
    }
  },

  /**
   * Generates a comprehensive consultation summary document ready for download or copying.
   */
  generateSummaryDocument(
    booking: any,
    notes: MeetingNotesData,
    privateNotes?: string
  ): string {
    const consultantName = booking?.consultants?.name || 'Assigned Consultant';
    const clientName = booking?.name || 'Client';
    const dateStr = booking?.date ? new Date(booking.date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }) : new Date().toLocaleDateString();
    const timeStr = booking?.time || '';
    const roomRef = booking?.meeting_room_id || notes.roomId || 'foundarly-meeting';

    let doc = `# FOUNDARLY CONSULTATION SUMMARY & ACTION ITEMS\n\n`;
    doc += `**Session:** 1-on-1 Business Consultation\n`;
    doc += `**Date & Time:** ${dateStr} ${timeStr ? `• ${timeStr} IST` : ''}\n`;
    doc += `**Consultant:** ${consultantName}\n`;
    doc += `**Client:** ${clientName}\n`;
    doc += `**Meeting ID:** ${roomRef}\n`;
    doc += `**Exported At:** ${new Date().toLocaleString()}\n`;
    doc += `\n---\n\n`;

    // Action Items Section
    doc += `## 📋 ACTION ITEMS & NEXT STEPS\n\n`;
    if (!notes.actionItems || notes.actionItems.length === 0) {
      doc += `_No action items recorded for this consultation session._\n\n`;
    } else {
      const completedCount = notes.actionItems.filter(i => i.completed).length;
      doc += `**Progress:** ${completedCount} of ${notes.actionItems.length} completed (${Math.round((completedCount / notes.actionItems.length) * 100)}%)\n\n`;

      notes.actionItems.forEach((item, index) => {
        const check = item.completed ? '[x]' : '[ ]';
        const assignee = item.assignee === 'client' ? `Client (${clientName})` :
                         item.assignee === 'consultant' ? `Consultant (${consultantName})` : 'Both';
        const priority = item.priority === 'high' ? '🔥 HIGH PRIORITY' : item.priority === 'medium' ? '⚡ MEDIUM' : 'NORMAL';
        const due = item.dueDate ? ` • Due: ${item.dueDate}` : '';
        const completedText = item.completed ? ' [COMPLETED]' : '';

        doc += `${index + 1}. ${check} **${item.text}**${completedText}\n`;
        doc += `   - **Assignee:** ${assignee} | **Priority:** ${priority}${due}\n`;
      });
      doc += `\n`;
    }

    // Shared Notes Section
    doc += `## 📝 DISCUSSION NOTES & KEY TAKEAWAYS\n\n`;
    if (notes.sharedNotes && notes.sharedNotes.trim()) {
      doc += `${notes.sharedNotes.trim()}\n\n`;
    } else {
      doc += `_No shared notes recorded._\n\n`;
    }

    // Private Confidential Notes (if provided by current user)
    if (privateNotes && privateNotes.trim()) {
      doc += `## 🔒 CONFIDENTIAL PRIVATE NOTES (Self-Only)\n\n`;
      doc += `${privateNotes.trim()}\n\n`;
    }

    doc += `---\n`;
    doc += `_Generated by Foundarly Business World • https://www.foundarlybusinessworld.in_\n`;

    return doc;
  },
};
