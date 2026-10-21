import fs from 'fs';
import path from 'path';

export interface ParticipantJoinItem {
  bookingId: string;
  participantId: string;
  participantEmail?: string;
  role?: string;
  firstJoinedAt: string;
  lastJoinedAt: string;
  joinCount: number;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const STORAGE_FILE = path.join(DATA_DIR, 'meeting_participants.json');

const memoryStore = new Map<string, ParticipantJoinItem>();

// Ensure local persistence directory exists
try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
} catch (e) {
  console.warn('[MeetingParticipantStorage] Failed to create data dir:', e);
}

function getStoreKey(bookingId: string, participantId?: string): string {
  const cleanBooking = (bookingId || '').trim().replace(/^foundarly-/, '');
  const cleanParticipant = (participantId || 'unknown').trim().toLowerCase();
  return `${cleanBooking}_${cleanParticipant}`;
}

function loadFromFile(): void {
  try {
    if (fs.existsSync(STORAGE_FILE)) {
      const raw = fs.readFileSync(STORAGE_FILE, 'utf-8');
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        list.forEach((item: ParticipantJoinItem) => {
          if (item && item.bookingId) {
            const key = getStoreKey(item.bookingId, item.participantId);
            memoryStore.set(key, item);
            if (item.participantEmail) {
              const emailKey = getStoreKey(item.bookingId, item.participantEmail);
              memoryStore.set(emailKey, item);
            }
          }
        });
      }
    }
  } catch (err) {
    console.warn('[MeetingParticipantStorage] Warning loading participants store:', err);
  }
}

loadFromFile();

function saveToFile(): void {
  try {
    const list = Array.from(memoryStore.values());
    // Filter duplicates by bookingId + participantId
    const unique = Array.from(new Map(list.map(item => [`${item.bookingId}_${item.participantId}`, item])).values());
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(unique, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[MeetingParticipantStorage] Warning saving participants store:', err);
  }
}

export const meetingParticipantStorage = {
  hasJoined(bookingId: string, participantId?: string, role?: string): boolean {
    if (!bookingId) return false;
    // Without participant identity or role, never report that participant joined
    if (!participantId && !role) return false;

    const cleanBooking = bookingId.trim().replace(/^foundarly-/, '');
    const cleanParticipant = (participantId || '').trim().toLowerCase();
    const cleanRole = (role || '').trim().toLowerCase();

    if (cleanParticipant && cleanParticipant !== 'unknown') {
      const key = `${cleanBooking}_${cleanParticipant}`;
      if (memoryStore.has(key)) return true;
    }

    for (const v of memoryStore.values()) {
      if (v.bookingId.replace(/^foundarly-/, '') === cleanBooking) {
        if (cleanParticipant && cleanParticipant !== 'unknown') {
          if (
            v.participantId.toLowerCase() === cleanParticipant ||
            (v.participantEmail && v.participantEmail.toLowerCase() === cleanParticipant)
          ) {
            return true;
          }
        }
        if (cleanRole && (cleanRole === 'client' || cleanRole === 'consultant') && v.role && v.role.toLowerCase() === cleanRole) {
          return true;
        }
      }
    }
    return false;
  },

  getParticipantHistory(bookingId: string, participantId?: string, role?: string): { hasJoined: boolean; joinCount: number; firstJoinedAt?: string } {
    if (!bookingId || (!participantId && !role)) return { hasJoined: false, joinCount: 0 };
    const cleanBooking = bookingId.trim().replace(/^foundarly-/, '');
    const cleanParticipant = (participantId || '').trim().toLowerCase();
    const cleanRole = (role || '').trim().toLowerCase();

    if (cleanParticipant && cleanParticipant !== 'unknown') {
      const key = `${cleanBooking}_${cleanParticipant}`;
      const item = memoryStore.get(key);
      if (item) {
        return {
          hasJoined: true,
          joinCount: item.joinCount,
          firstJoinedAt: item.firstJoinedAt,
        };
      }
    }

    for (const v of memoryStore.values()) {
      if (v.bookingId.replace(/^foundarly-/, '') === cleanBooking) {
        if (cleanParticipant && cleanParticipant !== 'unknown') {
          if (
            v.participantId.toLowerCase() === cleanParticipant ||
            (v.participantEmail && v.participantEmail.toLowerCase() === cleanParticipant)
          ) {
            return {
              hasJoined: true,
              joinCount: v.joinCount,
              firstJoinedAt: v.firstJoinedAt,
            };
          }
        }
        if (cleanRole && (cleanRole === 'client' || cleanRole === 'consultant') && v.role && v.role.toLowerCase() === cleanRole) {
          return {
            hasJoined: true,
            joinCount: v.joinCount,
            firstJoinedAt: v.firstJoinedAt,
          };
        }
      }
    }

    return { hasJoined: false, joinCount: 0 };
  },

  recordJoin(bookingId: string, participantId: string, role?: string, email?: string): { isFirstJoin: boolean; joinCount: number } {
    if (!bookingId) return { isFirstJoin: true, joinCount: 1 };
    const cleanBooking = bookingId.trim().replace(/^foundarly-/, '');
    const cleanParticipant = (participantId || 'unknown').trim().toLowerCase();
    const cleanEmail = email ? email.trim().toLowerCase() : undefined;
    const cleanRole = role ? role.trim().toLowerCase() : undefined;
    const key = `${cleanBooking}_${cleanParticipant}`;
    const existing = memoryStore.get(key);
    const nowIso = new Date().toISOString();

    if (existing) {
      existing.lastJoinedAt = nowIso;
      existing.joinCount += 1;
      if (cleanRole && !existing.role) existing.role = cleanRole;
      if (cleanEmail && !existing.participantEmail) existing.participantEmail = cleanEmail;
      saveToFile();
      return { isFirstJoin: false, joinCount: existing.joinCount };
    }

    const newItem: ParticipantJoinItem = {
      bookingId: cleanBooking,
      participantId: cleanParticipant,
      participantEmail: cleanEmail,
      role: cleanRole,
      firstJoinedAt: nowIso,
      lastJoinedAt: nowIso,
      joinCount: 1,
    };
    memoryStore.set(key, newItem);
    if (cleanEmail) {
      memoryStore.set(`${cleanBooking}_${cleanEmail}`, newItem);
    }
    saveToFile();
    return { isFirstJoin: true, joinCount: 1 };
  },

  reset(): void {
    memoryStore.clear();
    saveToFile();
  }
};
