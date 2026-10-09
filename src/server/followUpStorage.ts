import fs from 'fs';
import path from 'path';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { FollowUpRequest, FollowUpStatus } from '../utils/meetingRejoin.js';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const STORAGE_FILE = path.join(DATA_DIR, 'follow_up_requests.json');

// Ensure local persistence directory exists
try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
} catch (e) {
  console.warn('[FollowUpStorage] Failed to create data dir:', e);
}

// In-memory cache for ultra-fast and atomic operations
const memoryStore = new Map<string, FollowUpRequest>();

// Load existing data from file if present
function loadFromFile() {
  try {
    if (fs.existsSync(STORAGE_FILE)) {
      const raw = fs.readFileSync(STORAGE_FILE, 'utf-8');
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        list.forEach((item: FollowUpRequest) => {
          if (item && item.id) {
            memoryStore.set(item.id, item);
          }
        });
      }
    }
  } catch (err) {
    console.warn('[FollowUpStorage] Warning loading local file store:', err);
  }
}

loadFromFile();

function saveToFile() {
  try {
    const list = Array.from(memoryStore.values());
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(list, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[FollowUpStorage] Warning saving local file store:', err);
  }
}

export class FollowUpStorage {
  private supabase: SupabaseClient;

  constructor(supabaseClient?: SupabaseClient) {
    if (supabaseClient) {
      this.supabase = supabaseClient;
    } else {
      const url = process.env.VITE_SUPABASE_URL || 'https://rfyxnshvtfswvaogjzwq.supabase.co';
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_QPkFtczpj8_WzxPf4ZoENw_ZpnfN9vd';
      this.supabase = createClient(url, key);
    }
  }

  /**
   * Find an active (pending, alternative_proposed, confirmed) follow-up request for a booking.
   */
  async findActiveByBookingId(bookingId: string): Promise<FollowUpRequest | null> {
    // 1. Check in-memory store first
    for (const item of memoryStore.values()) {
      if (item.booking_id === bookingId) {
        if (['pending_consultant', 'alternative_proposed', 'confirmed'].includes(item.status)) {
          return item;
        }
      }
    }

    // 2. Query Supabase
    try {
      const { data, error } = await this.supabase
        .from('follow_up_requests')
        .select('*')
        .eq('booking_id', bookingId)
        .in('status', ['pending_consultant', 'alternative_proposed', 'confirmed'])
        .order('created_at', { ascending: false })
        .limit(1);

      if (!error && data && data.length > 0) {
        const item = data[0] as FollowUpRequest;
        memoryStore.set(item.id, item);
        saveToFile();
        return item;
      }
    } catch {
      // Supabase table may not exist yet; fall back safely
    }

    return null;
  }

  /**
   * Get the most recent follow-up request for a booking (regardless of status).
   */
  async getLatestByBookingId(bookingId: string): Promise<FollowUpRequest | null> {
    // Try Supabase first
    try {
      const { data, error } = await this.supabase
        .from('follow_up_requests')
        .select('*')
        .eq('booking_id', bookingId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (!error && data && data.length > 0) {
        const item = data[0] as FollowUpRequest;
        memoryStore.set(item.id, item);
        saveToFile();
        return item;
      }
    } catch {
      // Supabase query fallback
    }

    // Check memory store
    let latest: FollowUpRequest | null = null;
    for (const item of memoryStore.values()) {
      if (item.booking_id === bookingId) {
        if (!latest || new Date(item.created_at).getTime() > new Date(latest.created_at).getTime()) {
          latest = item;
        }
      }
    }

    return latest;
  }

  /**
   * Get request by ID.
   */
  async getById(id: string): Promise<FollowUpRequest | null> {
    if (memoryStore.has(id)) {
      return memoryStore.get(id)!;
    }

    try {
      const { data, error } = await this.supabase
        .from('follow_up_requests')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (!error && data) {
        const item = data as FollowUpRequest;
        memoryStore.set(item.id, item);
        saveToFile();
        return item;
      }
    } catch {
      // Fallback
    }

    return null;
  }

  /**
   * Create a new follow-up request.
   */
  async create(record: Omit<FollowUpRequest, 'id' | 'created_at' | 'updated_at'> & { id?: string }): Promise<FollowUpRequest> {
    const now = new Date().toISOString();
    const id = record.id || `fu_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const newItem: FollowUpRequest = {
      ...record,
      id,
      created_at: now,
      updated_at: now,
    };

    // Store in memory and local file
    memoryStore.set(id, newItem);
    saveToFile();

    // Persist to Supabase asynchronously / best-effort
    try {
      await this.supabase.from('follow_up_requests').insert({
        ...newItem,
      });
    } catch (err) {
      console.warn('[FollowUpStorage] Supabase insert fallback notice:', err);
    }

    return newItem;
  }

  /**
   * Update an existing request.
   */
  async update(id: string, updates: Partial<FollowUpRequest>): Promise<FollowUpRequest | null> {
    const existing = await this.getById(id);
    if (!existing) return null;

    const updated: FollowUpRequest = {
      ...existing,
      ...updates,
      updated_at: new Date().toISOString(),
    };

    memoryStore.set(id, updated);
    saveToFile();

    // Update in Supabase
    try {
      await this.supabase
        .from('follow_up_requests')
        .update({
          ...updates,
          updated_at: updated.updated_at,
        })
        .eq('id', id);
    } catch (err) {
      console.warn('[FollowUpStorage] Supabase update fallback notice:', err);
    }

    return updated;
  }

  /**
   * List follow-up requests for a client (by client_id or email).
   */
  async listForClient(userId: string, email?: string | null): Promise<FollowUpRequest[]> {
    const results: FollowUpRequest[] = [];
    const seen = new Set<string>();

    const normalizedEmail = (email || '').toLowerCase().trim();

    // From memory
    for (const item of memoryStore.values()) {
      const matchId = item.client_id && item.client_id === userId;
      const matchEmail = normalizedEmail && item.client_email && item.client_email.toLowerCase().trim() === normalizedEmail;
      if (matchId || matchEmail) {
        if (!seen.has(item.id)) {
          seen.add(item.id);
          results.push(item);
        }
      }
    }

    // Try Supabase
    try {
      let query = this.supabase.from('follow_up_requests').select('*');
      if (normalizedEmail) {
        query = query.or(`client_id.eq.${userId},client_email.eq.${normalizedEmail}`);
      } else {
        query = query.eq('client_id', userId);
      }
      const { data, error } = await query.order('created_at', { ascending: false });
      if (!error && data) {
        for (const row of data) {
          if (!seen.has(row.id)) {
            seen.add(row.id);
            results.push(row as FollowUpRequest);
            memoryStore.set(row.id, row as FollowUpRequest);
          }
        }
      }
    } catch {
      // Fallback
    }

    return results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  /**
   * List follow-up requests for a consultant (by consultant_id, consultant user_id, or email).
   */
  async listForConsultant(consultantId?: string | null, consultantUserId?: string | null, consultantEmail?: string | null): Promise<FollowUpRequest[]> {
    const results: FollowUpRequest[] = [];
    const seen = new Set<string>();

    const normalizedEmail = (consultantEmail || '').toLowerCase().trim();

    // From memory
    for (const item of memoryStore.values()) {
      const matchCId = consultantId && item.consultant_id === consultantId;
      const matchCEmail = normalizedEmail && item.consultant_email && item.consultant_email.toLowerCase().trim() === normalizedEmail;
      if (matchCId || matchCEmail) {
        if (!seen.has(item.id)) {
          seen.add(item.id);
          results.push(item);
        }
      }
    }

    // Try Supabase
    try {
      if (consultantId || normalizedEmail) {
        let query = this.supabase.from('follow_up_requests').select('*');
        if (consultantId && normalizedEmail) {
          query = query.or(`consultant_id.eq.${consultantId},consultant_email.eq.${normalizedEmail}`);
        } else if (consultantId) {
          query = query.eq('consultant_id', consultantId);
        } else {
          query = query.eq('consultant_email', normalizedEmail);
        }

        const { data, error } = await query.order('created_at', { ascending: false });
        if (!error && data) {
          for (const row of data) {
            if (!seen.has(row.id)) {
              seen.add(row.id);
              results.push(row as FollowUpRequest);
              memoryStore.set(row.id, row as FollowUpRequest);
            }
          }
        }
      }
    } catch {
      // Fallback
    }

    return results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  /**
   * Clean up or test resets
   */
  clearAll() {
    memoryStore.clear();
    saveToFile();
  }
}

export const followUpStorage = new FollowUpStorage();
