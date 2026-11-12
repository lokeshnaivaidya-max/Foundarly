import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import {
  parseAvailabilitySettings,
  serializeAvailabilitySettings,
  validateAvailabilitySettings,
  validateConfirmedBookingConflicts,
  ConsultantAvailabilitySettings,
  APP_TIMEZONE,
  getNowInIST,
} from '../../utils/timeSlots.js';
import { isAllowedAdminEmail } from '../../lib/authorization.js';
import { secureLog } from '../../utils/security.js';

export {
  validateAvailabilitySettings,
  validateConfirmedBookingConflicts,
};

dotenv.config();

interface RequestLike {
  method?: string;
  query?: Record<string, string | string[] | undefined>;
  headers?: Record<string, string | string[] | undefined>;
  body?: any;
}

interface ResponseLike {
  status: (code: number) => ResponseLike;
  json: (data: unknown) => ResponseLike;
  end: () => void;
  setHeader: (name: string, value: string) => void;
}

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://rfyxnshvtfswvaogjzwq.supabase.co';
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  'sb_publishable_QPkFtczpj8_WzxPf4ZoENw_ZpnfN9vd';

const supabaseAdminClient = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export default async function handler(req: RequestLike, res: ResponseLike) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET' && req.method !== 'PUT') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const authHeader = req.headers?.authorization;
  const token = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : null;

  if (!token) {
    return res.status(401).json({ success: false, error: 'Authentication required. Missing Bearer token.' });
  }

  try {
    const deadline = Date.now() + 8000;
    const bounded = async <T>(operation: PromiseLike<T>, label: string, ms = 4000): Promise<T> => {
      const remaining = Math.min(ms, deadline - Date.now());
      if (remaining < 250) {
        throw new Error(`Server deadline exceeded before ${label}`);
      }
      return await Promise.race([
        Promise.resolve(operation),
        new Promise<T>((_, reject) =>
          setTimeout(() => reject(new Error(`${label} timed out after ${Math.round(remaining)}ms`)), remaining)
        ),
      ]);
    };

    const { data: { user }, error: userError } = await bounded(
      supabaseAdminClient.auth.getUser(token),
      'auth user verification'
    );
    if (userError || !user) {
      return res.status(401).json({ success: false, error: 'Invalid or expired session token.' });
    }

    const userId = user.id;
    const userEmail = (user.email || '').toLowerCase().trim();

    const hasServiceRoleKey = Boolean(
      process.env.SUPABASE_SERVICE_ROLE_KEY &&
      process.env.SUPABASE_SERVICE_ROLE_KEY.trim().length > 20 &&
      !process.env.SUPABASE_SERVICE_ROLE_KEY.includes('publishable')
    );

    const authenticatedClient = createClient(supabaseUrl, process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_QPkFtczpj8_WzxPf4ZoENw_ZpnfN9vd', {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const activeDbClient = hasServiceRoleKey ? supabaseAdminClient : authenticatedClient;

    // Look up consultant matching authenticated user ID or verified email
    let consultantQuery = activeDbClient
      .from('consultants')
      .select('id, name, email, user_id, preferred_time, availability, pricing_30, pricing_60, is_active, social_links')
      .eq('is_active', true);

    if (userEmail) {
      consultantQuery = consultantQuery.or(`user_id.eq.${userId},email.ilike.${userEmail}`);
    } else {
      consultantQuery = consultantQuery.eq('user_id', userId);
    }

    const { data: consultants, error: consultantErr } = await bounded(consultantQuery.limit(1), 'consultant lookup');
    const consultant = consultants?.[0] || null;

    if (!consultant) {
      return res.status(403).json({
        success: false,
        error: 'No active consultant profile linked to your account.',
      });
    }

    // --- GET /api/consultant/availability ---
    if (req.method === 'GET') {
      let originalApplicationTiming = consultant.preferred_time || 'Flexible (Any Time)';
      let applicationSubmittedAt: string | null = null;

      if (consultant.email) {
        try {
          const { data: apps } = await bounded(
            activeDbClient
              .from('consultant_applications')
              .select('preferred_session_timing, created_at, status')
              .ilike('email', consultant.email.trim())
              .order('created_at', { ascending: false })
              .limit(1),
            'consultant application lookup'
          );

          if (apps && apps.length > 0 && apps[0].preferred_session_timing) {
            originalApplicationTiming = apps[0].preferred_session_timing;
            applicationSubmittedAt = apps[0].created_at || null;
          }
        } catch (appErr) {
          secureLog.warn('[Consultant Availability] Application preference lookup notice:', { error: appErr });
        }
      }

      // Fetch upcoming confirmed bookings so consultant can see them and avoid conflicts
      const todayIST = getNowInIST().dateStr;
      const { data: confirmedBookings = [] } = await bounded(
        activeDbClient
          .from('bookings')
          .select('id, name, email, date, time, status, session_duration')
          .eq('consultant_id', consultant.id)
          .eq('status', 'confirmed')
          .gte('date', todayIST)
          .order('date', { ascending: true })
          .order('time', { ascending: true }),
        'confirmed bookings lookup'
      );

      const parsedSettings = parseAvailabilitySettings(consultant);

      return res.status(200).json({
        success: true,
        consultantId: consultant.id,
        consultantName: consultant.name,
        consultantEmail: consultant.email,
        settings: parsedSettings,
        originalApplication: {
          preferredTiming: originalApplicationTiming,
          submittedAt: applicationSubmittedAt,
        },
        adminPricing: {
          pricing_30: consultant.pricing_30 || 1000,
          pricing_60: consultant.pricing_60 || 1299,
          currency: 'INR',
        },
        confirmedBookings: confirmedBookings || [],
      });
    }

    // --- PUT /api/consultant/availability ---
    if (req.method === 'PUT') {
      let submittedSettings = req.body?.settings;
      if (typeof req.body === 'string') {
        try {
          const parsedBody = JSON.parse(req.body);
          submittedSettings = parsedBody.settings || parsedBody;
        } catch {
          // ignore
        }
      }

      if (!submittedSettings || typeof submittedSettings !== 'object') {
        return res.status(400).json({
          success: false,
          error: 'Valid availability settings object is required.',
        });
      }

      // 1. Structure validation
      const validation = validateAvailabilitySettings(submittedSettings);
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          error: validation.error || 'Invalid availability settings.',
        });
      }

      // 2. Confirmed Bookings Safeguard: Prevent changes from invalidating confirmed bookings
      const todayIST = getNowInIST().dateStr;
      const { data: confirmedBookings = [] } = await bounded(
        activeDbClient
          .from('bookings')
          .select('id, name, email, date, time, status, session_duration')
          .eq('consultant_id', consultant.id)
          .eq('status', 'confirmed')
          .gte('date', todayIST),
        'confirmed bookings conflict check'
      );

      const conflictCheck = validateConfirmedBookingConflicts(submittedSettings, confirmedBookings || []);
      if (conflictCheck.hasConflict) {
        return res.status(409).json({
          success: false,
          error: conflictCheck.errorMessage,
          conflicts: conflictCheck.conflicts,
        });
      }

      // 3. Strict Authorization Scope:
      // Preserves admin-managed pricing. Consultant cannot alter platform fees!
      const mergedSettings: ConsultantAvailabilitySettings = {
        version: 1,
        weeklySchedule: submittedSettings.weeklySchedule,
        slotDurationMinutes: Number(submittedSettings.slotDurationMinutes) || 60,
        bufferMinutes: Number(submittedSettings.bufferMinutes) || 0,
        blockedDates: Array.isArray(submittedSettings.blockedDates) ? submittedSettings.blockedDates : [],
        pricing: {
          pricing_30: consultant.pricing_30 || 1000,
          pricing_60: consultant.pricing_60 || 1299,
          currency: 'INR',
        },
        timezone: APP_TIMEZONE,
        updatedAt: new Date().toISOString(),
      };

      const serialized = serializeAvailabilitySettings(mergedSettings);

      const existingSocial = (consultant.social_links && typeof consultant.social_links === 'object')
        ? (consultant.social_links as Record<string, any>)
        : {};

      const primaryPayload: Record<string, any> = {
        availability: serialized.availabilityJson,
        availability_settings: mergedSettings,
        preferred_time: serialized.preferredTimeText,
        social_links: {
          ...existingSocial,
          availability_settings: mergedSettings,
        },
      };

      let { data: updated, error: updateErr } = await bounded(
        activeDbClient
          .from('consultants')
          .update(primaryPayload)
          .eq('id', consultant.id)
          .select()
          .maybeSingle(),
        'consultant availability update'
      );

      // Fallback: If PostgREST schema cache does not have availability_settings column yet,
      // update without the top-level availability_settings column, storing into availability and social_links
      if (updateErr && (
        updateErr.message?.toLowerCase().includes('availability_settings') ||
        (updateErr as any).details?.toLowerCase().includes('availability_settings') ||
        (updateErr as any).code === 'PGRST204'
      )) {
        console.warn('[Consultant Availability] Column availability_settings missing in schema cache, using fallback:', updateErr.message);
        const fallbackPayload: Record<string, any> = {
          availability: serialized.availabilityJson,
          preferred_time: serialized.preferredTimeText,
          social_links: {
            ...existingSocial,
            availability_settings: mergedSettings,
          },
        };
        const fallbackRes = await bounded(
          activeDbClient
            .from('consultants')
            .update(fallbackPayload)
            .eq('id', consultant.id)
            .select()
            .maybeSingle(),
          'fallback availability update'
        );
        updated = fallbackRes.data;
        updateErr = fallbackRes.error;
      }

      if (updateErr) {
        console.error('[Consultant Availability] Failed to update availability in Supabase:', updateErr);
        return res.status(500).json({
          success: false,
          error: updateErr.message || 'Failed to persist availability updates.',
        });
      }

      secureLog.info('[Consultant Availability] Availability updated successfully', {
        consultantId: consultant.id,
        userId,
      });

      return res.status(200).json({
        success: true,
        message: 'Your availability has been updated successfully and is now active for customer bookings.',
        settings: mergedSettings,
        preferredTimeText: serialized.preferredTimeText,
      });
    }
  } catch (err: any) {
    console.error('[Consultant Availability Endpoint] Error:', err);
    return res.status(500).json({
      success: false,
      error: err?.message || 'Failed to process consultant availability request.',
    });
  }
}
