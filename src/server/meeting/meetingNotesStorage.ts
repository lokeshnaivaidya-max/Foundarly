/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Foundarly Meeting Notes & Action Items Storage
 * Authoritatively maintains meeting-specific shared notes and action items,
 * allowing consultants and clients to collaborate on live session takeaways
 * and retrieve them on reconnect, refresh, or within the 7-day follow-up window.
 */

import fs from 'fs';
import path from 'path';

export interface MeetingActionItem {
  id: string;
  text: string;
  assignee: 'client' | 'consultant' | 'both';
  priority: 'high' | 'medium' | 'normal';
  dueDate?: string;
  completed: boolean;
  createdBy: {
    id: string;
    name: string;
    role: string;
  };
  createdAt: string;
  completedAt?: string | null;
}

export interface MeetingNotesData {
  bookingId: string;
  roomId: string;
  sharedNotes: string;
  actionItems: MeetingActionItem[];
  lastUpdatedBy?: {
    id: string;
    name: string;
    role: string;
  };
  lastUpdatedAt: string;
  version: number;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const STORAGE_FILE = path.join(DATA_DIR, 'meeting_notes.json');

// Map canonical roomId -> MeetingNotesData
const notesStore = new Map<string, MeetingNotesData>();

try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
} catch (e) {
  console.warn('[MeetingNotesStorage] Failed to create data dir:', e);
}

function canonicalize(roomIdOrBookingId: string): string {
  if (!roomIdOrBookingId) return '';
  let id = roomIdOrBookingId.trim();
  if (id.includes('/meeting/')) {
    id = id.split('/meeting/').pop() || id;
  }
  return id.replace(/^foundarly-/, '').split('?')[0].split('#')[0].trim();
}

function loadFromFile(): void {
  try {
    if (fs.existsSync(STORAGE_FILE)) {
      const raw = fs.readFileSync(STORAGE_FILE, 'utf-8');
      const data = JSON.parse(raw);
      if (typeof data === 'object' && data !== null) {
        Object.entries(data).forEach(([key, notes]) => {
          if (notes && typeof notes === 'object') {
            notesStore.set(key, notes as MeetingNotesData);
          }
        });
      }
    }
  } catch (err) {
    console.warn('[MeetingNotesStorage] Warning loading notes store:', err);
  }
}

loadFromFile();

function saveToFile(): void {
  try {
    const obj: Record<string, MeetingNotesData> = {};
    for (const [key, notes] of notesStore.entries()) {
      obj[key] = notes;
    }
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(obj, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[MeetingNotesStorage] Warning saving notes store:', err);
  }
}

export const meetingNotesStorage = {
  getNotes(roomIdOrBookingId: string): MeetingNotesData {
    const canonical = canonicalize(roomIdOrBookingId);
    if (!canonical) {
      return {
        bookingId: '',
        roomId: '',
        sharedNotes: '',
        actionItems: [],
        lastUpdatedAt: new Date().toISOString(),
        version: 1,
      };
    }

    const existing = notesStore.get(canonical);
    if (existing) {
      return existing;
    }

    const initial: MeetingNotesData = {
      bookingId: canonical,
      roomId: `foundarly-${canonical}`,
      sharedNotes: '',
      actionItems: [],
      lastUpdatedAt: new Date().toISOString(),
      version: 1,
    };
    notesStore.set(canonical, initial);
    saveToFile();
    return initial;
  },

  updateSharedNotes(
    roomIdOrBookingId: string,
    notesText: string,
    user: { id: string; name: string; role: string }
  ): MeetingNotesData {
    const current = this.getNotes(roomIdOrBookingId);
    const canonical = canonicalize(roomIdOrBookingId);

    const updated: MeetingNotesData = {
      ...current,
      sharedNotes: (notesText || '').slice(0, 50000), // 50,000 char capacity
      lastUpdatedBy: user,
      lastUpdatedAt: new Date().toISOString(),
      version: (current.version || 0) + 1,
    };

    notesStore.set(canonical, updated);
    saveToFile();
    return updated;
  },

  addActionItem(
    roomIdOrBookingId: string,
    itemData: {
      text: string;
      assignee?: 'client' | 'consultant' | 'both';
      priority?: 'high' | 'medium' | 'normal';
      dueDate?: string;
    },
    user: { id: string; name: string; role: string }
  ): { notes: MeetingNotesData; item: MeetingActionItem } {
    const current = this.getNotes(roomIdOrBookingId);
    const canonical = canonicalize(roomIdOrBookingId);

    const cleanText = (itemData.text || '').trim().slice(0, 500);
    if (!cleanText) {
      throw new Error('Action item text is required');
    }

    const newItem: MeetingActionItem = {
      id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      text: cleanText,
      assignee: itemData.assignee || 'both',
      priority: itemData.priority || 'normal',
      dueDate: itemData.dueDate || undefined,
      completed: false,
      createdBy: user,
      createdAt: new Date().toISOString(),
      completedAt: null,
    };

    const actionItems = [...current.actionItems, newItem];
    const updated: MeetingNotesData = {
      ...current,
      actionItems,
      lastUpdatedBy: user,
      lastUpdatedAt: new Date().toISOString(),
      version: (current.version || 0) + 1,
    };

    notesStore.set(canonical, updated);
    saveToFile();
    return { notes: updated, item: newItem };
  },

  toggleActionItem(
    roomIdOrBookingId: string,
    itemId: string,
    completed?: boolean,
    user?: { id: string; name: string; role: string }
  ): { notes: MeetingNotesData; item: MeetingActionItem | null } {
    const current = this.getNotes(roomIdOrBookingId);
    const canonical = canonicalize(roomIdOrBookingId);

    let targetItem: MeetingActionItem | null = null;
    const actionItems = current.actionItems.map((item) => {
      if (item.id === itemId) {
        const nextCompleted = completed !== undefined ? completed : !item.completed;
        targetItem = {
          ...item,
          completed: nextCompleted,
          completedAt: nextCompleted ? new Date().toISOString() : null,
        };
        return targetItem;
      }
      return item;
    });

    const updated: MeetingNotesData = {
      ...current,
      actionItems,
      lastUpdatedBy: user || current.lastUpdatedBy,
      lastUpdatedAt: new Date().toISOString(),
      version: (current.version || 0) + 1,
    };

    notesStore.set(canonical, updated);
    saveToFile();
    return { notes: updated, item: targetItem };
  },

  deleteActionItem(
    roomIdOrBookingId: string,
    itemId: string,
    user?: { id: string; name: string; role: string }
  ): MeetingNotesData {
    const current = this.getNotes(roomIdOrBookingId);
    const canonical = canonicalize(roomIdOrBookingId);

    const actionItems = current.actionItems.filter((item) => item.id !== itemId);
    const updated: MeetingNotesData = {
      ...current,
      actionItems,
      lastUpdatedBy: user || current.lastUpdatedBy,
      lastUpdatedAt: new Date().toISOString(),
      version: (current.version || 0) + 1,
    };

    notesStore.set(canonical, updated);
    saveToFile();
    return updated;
  },

  clearNotesForTesting(roomIdOrBookingId?: string): void {
    if (roomIdOrBookingId) {
      const canonical = canonicalize(roomIdOrBookingId);
      notesStore.delete(canonical);
      saveToFile();
    } else {
      notesStore.clear();
      saveToFile();
    }
  },
};
