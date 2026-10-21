import fs from 'fs';
import path from 'path';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const STORAGE_FILE = path.join(DATA_DIR, 'sent_completion_emails.json');

const sentCompletionSet = new Set<string>();

// Ensure local persistence directory exists
try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
} catch (e) {
  console.warn('[CompletionEmailStorage] Failed to create data dir:', e);
}

// Load existing sent booking IDs
function loadFromFile(): void {
  try {
    if (fs.existsSync(STORAGE_FILE)) {
      const raw = fs.readFileSync(STORAGE_FILE, 'utf-8');
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        list.forEach((id: string) => {
          if (id && typeof id === 'string') {
            sentCompletionSet.add(id.trim());
          }
        });
      }
    }
  } catch (err) {
    console.warn('[CompletionEmailStorage] Warning loading sent emails store:', err);
  }
}

loadFromFile();

function saveToFile(): void {
  try {
    const list = Array.from(sentCompletionSet);
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(list, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[CompletionEmailStorage] Warning saving sent emails store:', err);
  }
}

export const completionEmailStorage = {
  isSent(bookingId: string): boolean {
    if (!bookingId) return false;
    const cleanId = bookingId.trim().replace(/^foundarly-/, '');
    return sentCompletionSet.has(cleanId) || sentCompletionSet.has(bookingId.trim());
  },

  markSent(bookingId: string): void {
    if (!bookingId) return;
    const cleanId = bookingId.trim().replace(/^foundarly-/, '');
    sentCompletionSet.add(cleanId);
    sentCompletionSet.add(bookingId.trim());
    saveToFile();
  },

  reset(bookingId?: string): void {
    if (bookingId) {
      const cleanId = bookingId.trim().replace(/^foundarly-/, '');
      sentCompletionSet.delete(cleanId);
      sentCompletionSet.delete(bookingId.trim());
      saveToFile();
    } else {
      sentCompletionSet.clear();
      saveToFile();
    }
  }
};
