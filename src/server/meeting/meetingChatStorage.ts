/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Foundarly Meeting Chat Storage
 * Authoritatively maintains meeting-specific chat message history,
 * allowing participants to retrieve message logs on join, refresh, or reconnect.
 */

import fs from 'fs';
import path from 'path';

export interface StoredChatMessage {
  id: string;
  roomId: string;
  bookingId: string;
  senderId: string;
  senderName: string;
  senderRole: 'client' | 'consultant' | 'admin';
  text: string;
  timestamp: string;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const STORAGE_FILE = path.join(DATA_DIR, 'meeting_chats.json');

// Map canonical roomId -> StoredChatMessage[]
const chatStore = new Map<string, StoredChatMessage[]>();

try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
} catch (e) {
  console.warn('[MeetingChatStorage] Failed to create data dir:', e);
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
        Object.entries(data).forEach(([key, messages]) => {
          if (Array.isArray(messages)) {
            chatStore.set(key, messages);
          }
        });
      }
    }
  } catch (err) {
    console.warn('[MeetingChatStorage] Warning loading chats store:', err);
  }
}

loadFromFile();

function saveToFile(): void {
  try {
    const obj: Record<string, StoredChatMessage[]> = {};
    for (const [key, messages] of chatStore.entries()) {
      obj[key] = messages;
    }
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(obj, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[MeetingChatStorage] Warning saving chats store:', err);
  }
}

export const meetingChatStorage = {
  getMessages(roomIdOrBookingId: string): StoredChatMessage[] {
    const canonical = canonicalize(roomIdOrBookingId);
    if (!canonical) return [];
    return chatStore.get(canonical) || [];
  },

  appendMessage(roomIdOrBookingId: string, data: { senderId?: string; senderName?: string; senderRole?: any; text?: string; id?: string; timestamp?: string }): StoredChatMessage {
    const canonical = canonicalize(roomIdOrBookingId);
    if (!canonical) throw new Error('Invalid roomId or bookingId');

    const cleanMsg: StoredChatMessage = {
      id: data.id || `msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      roomId: `foundarly-${canonical}`,
      bookingId: canonical,
      senderId: data.senderId || 'unknown',
      senderName: data.senderName || 'Participant',
      senderRole: data.senderRole || 'client',
      text: (data.text || '').trim().slice(0, 2000), // Enforce 2000 chars limit
      timestamp: data.timestamp || new Date().toISOString(),
    };

    const existing = chatStore.get(canonical) || [];
    existing.push(cleanMsg);
    if (existing.length > 500) {
      existing.shift();
    }
    chatStore.set(canonical, existing);
    saveToFile();
    return cleanMsg;
  },

  addMessage(msg: StoredChatMessage): StoredChatMessage {
    return this.appendMessage(msg.roomId || msg.bookingId, msg);
  },

  clearMessages(roomIdOrBookingId?: string): void {
    if (roomIdOrBookingId) {
      const canonical = canonicalize(roomIdOrBookingId);
      chatStore.delete(canonical);
      saveToFile();
    } else {
      chatStore.clear();
      saveToFile();
    }
  },

  clearChatForTesting(roomIdOrBookingId?: string): void {
    this.clearMessages(roomIdOrBookingId);
  }
};

