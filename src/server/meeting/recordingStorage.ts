/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Foundarly Meeting Recording Metadata Storage
 * Manages authorized consultation recording entries, retention policies (30-day retention),
 * and participant consent verification records.
 */

import fs from 'fs';
import path from 'path';

export interface MeetingRecordingMetadata {
  id: string;
  roomId: string;
  bookingId: string;
  filename: string;
  durationSeconds: number;
  formattedDuration: string;
  sizeBytes: number;
  formattedSize: string;
  mimeType: string;
  downloadUrl?: string;
  recordedByUserId?: string;
  recordedByName?: string;
  consentGiven?: boolean;
  participants?: string[];
  consentingParticipants?: string[];
  createdAt: string;
  expiresAt: string; // 30-day retention
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const STORAGE_FILE = path.join(DATA_DIR, 'meeting_recordings.json');

const recordingsStore = new Map<string, MeetingRecordingMetadata[]>();

try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
} catch (e) {
  console.warn('[MeetingRecordingStorage] Failed to create data dir:', e);
}

function canonicalize(id: string): string {
  if (!id) return '';
  let clean = id.trim();
  if (clean.includes('/meeting/')) {
    clean = clean.split('/meeting/').pop() || clean;
  }
  return clean.replace(/^foundarly-/, '').split('?')[0].split('#')[0].trim();
}

function loadFromFile(): void {
  try {
    if (fs.existsSync(STORAGE_FILE)) {
      const raw = fs.readFileSync(STORAGE_FILE, 'utf-8');
      const data = JSON.parse(raw);
      if (typeof data === 'object' && data !== null) {
        Object.entries(data).forEach(([key, items]) => {
          if (Array.isArray(items)) {
            recordingsStore.set(key, items);
          }
        });
      }
    }
  } catch (err) {
    console.warn('[MeetingRecordingStorage] Warning loading recordings store:', err);
  }
}

loadFromFile();

function saveToFile(): void {
  try {
    const obj: Record<string, MeetingRecordingMetadata[]> = {};
    for (const [key, items] of recordingsStore.entries()) {
      obj[key] = items;
    }
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(obj, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[MeetingRecordingStorage] Warning saving recordings store:', err);
  }
}

export const recordingStorage = {
  getRecordings(roomIdOrBookingId: string): MeetingRecordingMetadata[] {
    const canonical = canonicalize(roomIdOrBookingId);
    if (!canonical) return [];
    const list = recordingsStore.get(canonical) || [];
    const now = new Date().getTime();
    // Filter expired recordings (retention policy)
    return list.filter(item => {
      const expiry = new Date(item.expiresAt).getTime();
      return isNaN(expiry) || expiry > now;
    });
  },

  getRecordingsByBooking(bookingId: string): MeetingRecordingMetadata[] {
    return this.getRecordings(bookingId);
  },

  saveRecording(data: Partial<MeetingRecordingMetadata> & { bookingId: string }): MeetingRecordingMetadata {
    const canonical = canonicalize(data.roomId || data.bookingId);
    if (!canonical) throw new Error('Invalid roomId or bookingId');

    const createdDate = data.createdAt ? new Date(data.createdAt) : new Date();
    // 30 days retention policy
    const expires = data.expiresAt ? new Date(data.expiresAt) : new Date(createdDate.getTime() + 30 * 24 * 60 * 60 * 1000);

    const record: MeetingRecordingMetadata = {
      id: data.id || `rec_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      roomId: `foundarly-${canonical}`,
      bookingId: canonical,
      filename: data.filename || `Foundarly-Consultation-${canonical}.webm`,
      durationSeconds: data.durationSeconds || 0,
      formattedDuration: data.formattedDuration || '00:00',
      sizeBytes: data.sizeBytes || 0,
      formattedSize: data.formattedSize || '0 MB',
      mimeType: data.mimeType || 'video/webm',
      downloadUrl: data.downloadUrl,
      recordedByUserId: data.recordedByUserId || 'system',
      recordedByName: data.recordedByName || 'System',
      consentGiven: data.consentGiven ?? true,
      participants: data.participants || [],
      consentingParticipants: data.consentingParticipants || data.participants || [],
      createdAt: createdDate.toISOString(),
      expiresAt: expires.toISOString(),
    };

    const existing = recordingsStore.get(canonical) || [];
    existing.push(record);
    recordingsStore.set(canonical, existing);
    saveToFile();
    return record;
  },

  addRecording(data: Omit<MeetingRecordingMetadata, 'id' | 'createdAt' | 'expiresAt'>): MeetingRecordingMetadata {
    return this.saveRecording(data);
  },

  pruneExpiredRecordings(retentionDays = 30): number {
    const now = Date.now();
    const cutoffMs = retentionDays * 24 * 60 * 60 * 1000;
    let prunedCount = 0;

    for (const [key, items] of recordingsStore.entries()) {
      const filtered = items.filter(item => {
        const itemCreated = new Date(item.createdAt).getTime();
        const isExpired = (now - itemCreated) > cutoffMs;
        if (isExpired) {
          prunedCount++;
          return false;
        }
        return true;
      });
      if (filtered.length !== items.length) {
        if (filtered.length === 0) {
          recordingsStore.delete(key);
        } else {
          recordingsStore.set(key, filtered);
        }
      }
    }

    if (prunedCount > 0) {
      saveToFile();
    }
    return prunedCount;
  },

  clearRecordings(roomIdOrBookingId?: string): void {
    if (roomIdOrBookingId) {
      const canonical = canonicalize(roomIdOrBookingId);
      recordingsStore.delete(canonical);
      saveToFile();
    } else {
      recordingsStore.clear();
      saveToFile();
    }
  }
};

