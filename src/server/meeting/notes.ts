import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { meetingNotesStorage, MeetingNotesData } from './meetingNotesStorage.js';
import { checkDistributedRateLimit, extractClientIp } from '../rateLimiter.js';
import { validateParticipantAccess } from '../../utils/meetingRejoin.js';

dotenv.config();

interface RequestLike {
  method?: string;
  body?: unknown;
  query?: Record<string, string | string[] | undefined>;
  headers?: Record<string, string | string[] | undefined>;
}

interface ResponseLike {
  status: (code: number) => ResponseLike;
  json: (data: unknown) => ResponseLike;
  end: () => void;
  setHeader: (name: string, value: string) => void;
}

export default async function handler(req: RequestLike, res: ResponseLike) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Rate Limiting by IP
  const ip = extractClientIp(req);
  const rateLimit = await checkDistributedRateLimit(`meeting_notes_rate_${ip}`, 120, 60000);
  if (!rateLimit.allowed) {
    if (rateLimit.retryAfter) {
      res.setHeader('Retry-After', String(rateLimit.retryAfter));
    }
    return res.status(429).json({
      success: false,
      error: 'Too many requests. Please slow down and try again.',
      code: 'RATE_LIMITED',
    });
  }

  // Authenticate session user token
  const authHeader = req.headers?.authorization || req.headers?.Authorization;
  const token = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
    ? authHeader.substring(7).trim()
    : null;

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Authentication token required.',
      code: 'UNAUTHENTICATED',
    });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://rfyxnshvtfswvaogjzwq.supabase.co';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_QPkFtczpj8_WzxPf4ZoENw_ZpnfN9vd';
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData?.user) {
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired user session.',
      code: 'INVALID_TOKEN',
    });
  }

  const user = userData.user;

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }

  const queryRoomId = typeof req.query?.roomId === 'string' ? req.query.roomId : undefined;
  const bodyRecord = (body || {}) as {
    action?: string;
    roomId?: string;
    sharedNotes?: string;
    item?: {
      text: string;
      assignee?: 'client' | 'consultant' | 'both';
      priority?: 'high' | 'medium' | 'normal';
      dueDate?: string;
    };
    itemId?: string;
    completed?: boolean;
  };

  let cleanRoomId = (bodyRecord.roomId || queryRoomId || '').trim();
  if (cleanRoomId.includes('/meeting/')) {
    cleanRoomId = cleanRoomId.split('/meeting/').pop() || cleanRoomId;
  }
  cleanRoomId = cleanRoomId.split('?')[0].split('#')[0].replace(/\/+$/, '').trim();

  if (!cleanRoomId || cleanRoomId.length > 255) {
    return res.status(400).json({
      success: false,
      error: 'Valid meeting room ID is required.',
      code: 'INVALID_ROOM_ID',
    });
  }

  // Authorize participant access for the given room
  try {
    const rawBookingId = cleanRoomId.startsWith('foundarly-')
      ? cleanRoomId.replace('foundarly-', '')
      : cleanRoomId;
    const prefixedRoomId = cleanRoomId.startsWith('foundarly-')
      ? cleanRoomId
      : `foundarly-${cleanRoomId}`;
    const isRawUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawBookingId);
    const isCleanUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanRoomId);

    let booking: any = null;
    let consultantObj: any = null;

    // 1. Try RPC lookup
    try {
      const { data: rpcData, error: rpcError } = await supabase
        .rpc('lookup_meeting_room', { p_room_id: cleanRoomId });

      if (!rpcError && Array.isArray(rpcData) && rpcData.length > 0) {
        const row = rpcData[0];
        booking = row;
        if (row.consultant_name || row.consultant_email || row.consultant_user_id) {
          consultantObj = {
            id: row.consultant_id,
            name: row.consultant_name,
            email: row.consultant_email,
            title: row.consultant_title,
            user_id: row.consultant_user_id,
          };
        }
      }
    } catch {
      // Non-blocking
    }

    // 2. Direct query fallback
    if (!booking) {
      const orFilters: string[] = [
        `meeting_room_id.eq.${cleanRoomId}`,
        `meeting_room_id.eq.${prefixedRoomId}`,
        `meeting_room_id.eq.${rawBookingId}`,
      ];
      if (isRawUuid) orFilters.push(`id.eq.${rawBookingId}`);
      if (isCleanUuid && cleanRoomId !== rawBookingId) orFilters.push(`id.eq.${cleanRoomId}`);

      const { data: bookings } = await supabase
        .from('bookings')
        .select('*, consultants(id, name, title, email, user_id)')
        .or(orFilters.join(','))
        .limit(1);

      if (bookings && bookings.length > 0) {
        booking = bookings[0];
        consultantObj = Array.isArray(booking.consultants)
          ? booking.consultants[0]
          : booking.consultants;
      }
    }

    if (!booking) {
      return res.status(404).json({
        success: false,
        error: 'Meeting session not found or invalid room ID.',
        code: 'ROOM_NOT_FOUND',
      });
    }

    const adminEmails = (process.env.ADMIN_EMAILS || 'admin@foundarly.com')
      .split(',')
      .map(e => e.trim().toLowerCase());
    const isAdmin = Boolean(user.email && adminEmails.includes(user.email.toLowerCase()));

    const authResult = validateParticipantAccess(user, booking, consultantObj, isAdmin);
    if (!authResult.authorized) {
      return res.status(403).json({
        success: false,
        error: authResult.reason || 'You are not authorized to view or edit notes for this meeting.',
        code: authResult.code || 'UNAUTHORIZED_PARTICIPANT',
      });
    }

    const participantName = (user.user_metadata?.full_name || user.email?.split('@')[0] || 'Participant').trim();
    const userRole = authResult.role || 'client';
    const userAudit = {
      id: user.id,
      name: participantName,
      role: userRole,
    };

    const action = (bodyRecord.action || (req.method === 'GET' ? 'get' : 'get')).toLowerCase();

    if (action === 'get') {
      const notes = meetingNotesStorage.getNotes(cleanRoomId);
      return res.status(200).json({
        success: true,
        notes,
        role: userRole,
      });
    }

    if (action === 'update_notes') {
      const updatedNotes = meetingNotesStorage.updateSharedNotes(
        cleanRoomId,
        bodyRecord.sharedNotes || '',
        userAudit
      );
      return res.status(200).json({
        success: true,
        notes: updatedNotes,
      });
    }

    if (action === 'add_action_item') {
      if (!bodyRecord.item?.text || !bodyRecord.item.text.trim()) {
        return res.status(400).json({
          success: false,
          error: 'Action item text is required.',
        });
      }
      const { notes, item } = meetingNotesStorage.addActionItem(
        cleanRoomId,
        bodyRecord.item,
        userAudit
      );
      return res.status(200).json({
        success: true,
        notes,
        item,
      });
    }

    if (action === 'toggle_action_item') {
      if (!bodyRecord.itemId) {
        return res.status(400).json({
          success: false,
          error: 'itemId is required.',
        });
      }
      const { notes, item } = meetingNotesStorage.toggleActionItem(
        cleanRoomId,
        bodyRecord.itemId,
        bodyRecord.completed,
        userAudit
      );
      return res.status(200).json({
        success: true,
        notes,
        item,
      });
    }

    if (action === 'delete_action_item') {
      if (!bodyRecord.itemId) {
        return res.status(400).json({
          success: false,
          error: 'itemId is required.',
        });
      }
      const notes = meetingNotesStorage.deleteActionItem(
        cleanRoomId,
        bodyRecord.itemId,
        userAudit
      );
      return res.status(200).json({
        success: true,
        notes,
      });
    }

    return res.status(400).json({
      success: false,
      error: `Unknown action: ${action}`,
    });
  } catch (err: unknown) {
    console.error('[Meeting Notes API] Exception:', err);
    return res.status(500).json({
      success: false,
      error: 'Internal server error processing meeting notes.',
      code: 'SERVER_ERROR',
    });
  }
}
