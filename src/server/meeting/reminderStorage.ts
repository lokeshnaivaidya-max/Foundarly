/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Foundarly Meeting Reminder Storage
 * Tracks and persists dispatched meeting reminder emails to ensure exactly-once
 * delivery per hourly interval, prevents duplicate notifications, and survives restarts.
 */

import fs from 'fs';
import path from 'path';

export interface SentReminderRecord {
  bookingId: string;
  scheduledStartIso: string;
  hoursRemaining: number;
  recipientRole: 'client' | 'consultant';
  recipientEmail: string;
  sentAt: string;
  messageId?: string;
  status: 'sent' | 'failed';
  error?: string;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const STORAGE_FILE = path.join(DATA_DIR, 'meeting_reminders.json');

const reminderStore = new Map<string, SentReminderRecord>();

// Ensure local persistence directory exists
try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
} catch (e) {
  console.warn('[MeetingReminderStorage] Failed to create data dir:', e);
}

/**
 * Generate a unique, deterministic key for a reminder dispatch:
 * Booking ID + Scheduled Start Time + Interval Hour + Recipient Role.
 * If a meeting is rescheduled, scheduledStartIso changes automatically,
 * preventing stale intervals from suppressing valid new reminders.
 */
export function buildReminderKey(
  bookingId: string,
  scheduledStartIso: string,
  hoursRemaining: number,
  recipientRole: 'client' | 'consultant'
): string {
  const cleanId = (bookingId || '').trim().replace(/^foundarly-/, '');
  const cleanDate = (scheduledStartIso || '').trim();
  return `${cleanId}_${cleanDate}_${hoursRemaining}h_${recipientRole}`;
}

function loadFromFile(): void {
  try {
    if (fs.existsSync(STORAGE_FILE)) {
      const raw = fs.readFileSync(STORAGE_FILE, 'utf-8');
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        list.forEach((record: SentReminderRecord) => {
          if (record && record.bookingId && record.scheduledStartIso) {
            const key = buildReminderKey(
              record.bookingId,
              record.scheduledStartIso,
              record.hoursRemaining,
              record.recipientRole
            );
            reminderStore.set(key, record);
          }
        });
      }
    }
  } catch (err) {
    console.warn('[MeetingReminderStorage] Warning loading reminders store:', err);
  }
}

loadFromFile();

function saveToFile(): void {
  try {
    const list = Array.from(reminderStore.values());
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(list, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[MeetingReminderStorage] Warning saving reminders store:', err);
  }
}

export const reminderStorage = {
  isReminderSent(
    bookingId: string,
    scheduledStartIso: string,
    hoursRemaining: number,
    recipientRole: 'client' | 'consultant'
  ): boolean {
    if (!bookingId || !scheduledStartIso) return false;
    const key = buildReminderKey(bookingId, scheduledStartIso, hoursRemaining, recipientRole);
    const existing = reminderStore.get(key);
    return Boolean(existing && existing.status === 'sent');
  },

  hasSentReminder(
    bookingId: string,
    scheduledStartIso: string,
    hoursRemaining: number,
    recipientRole: 'client' | 'consultant'
  ): boolean {
    return this.isReminderSent(bookingId, scheduledStartIso, hoursRemaining, recipientRole);
  },

  recordReminderSent(
    arg1: string | SentReminderRecord,
    scheduledStartIso?: string,
    hoursRemaining?: number,
    recipientRole?: 'client' | 'consultant',
    recipientEmail?: string
  ): void {
    if (typeof arg1 === 'object') {
      const record = arg1;
      if (!record.bookingId || !record.scheduledStartIso) return;
      const key = buildReminderKey(
        record.bookingId,
        record.scheduledStartIso,
        record.hoursRemaining,
        record.recipientRole
      );
      reminderStore.set(key, record);
      saveToFile();
      return;
    }

    const bookingId = arg1;
    if (!bookingId || !scheduledStartIso) return;
    const key = buildReminderKey(
      bookingId,
      scheduledStartIso,
      hoursRemaining || 1,
      recipientRole || 'client'
    );
    const record: SentReminderRecord = {
      bookingId,
      scheduledStartIso,
      hoursRemaining: hoursRemaining || 1,
      recipientRole: recipientRole || 'client',
      recipientEmail: recipientEmail || '',
      sentAt: new Date().toISOString(),
      status: 'sent',
    };
    reminderStore.set(key, record);
    saveToFile();
  },


  getSentRemindersForBooking(bookingId: string): SentReminderRecord[] {
    const cleanId = (bookingId || '').trim().replace(/^foundarly-/, '');
    const results: SentReminderRecord[] = [];
    for (const record of reminderStore.values()) {
      if (record.bookingId.replace(/^foundarly-/, '') === cleanId) {
        results.push(record);
      }
    }
    return results;
  },

  getAllReminders(): SentReminderRecord[] {
    return Array.from(reminderStore.values());
  },

  reset(bookingId?: string): void {
    if (bookingId) {
      const cleanId = bookingId.trim().replace(/^foundarly-/, '');
      for (const [key, record] of reminderStore.entries()) {
        if (record.bookingId.replace(/^foundarly-/, '') === cleanId) {
          reminderStore.delete(key);
        }
      }
      saveToFile();
    } else {
      reminderStore.clear();
      saveToFile();
    }
  }
};
