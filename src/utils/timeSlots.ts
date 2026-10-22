/**
 * Foundarly Time Slot & Consultation Scheduling Utilities
 *
 * Rules:
 * - Application Timezone is strictly India Standard Time (IST: Asia/Kolkata, UTC+05:30).
 * - Timestamps are persisted in unambiguous formats and converted accurately.
 * - Double-booking is strictly prohibited: active bookings (status != 'cancelled'/'rejected') reserve the slot.
 * - Past slots (or slots starting within a 15-minute buffer) cannot be booked for today.
 * - Legacy meetings with "Flexible" or missing times return null targets so UIs can show a clear pending state instead of NaN.
 */

export const APP_TIMEZONE = 'Asia/Kolkata';
export const APP_TIMEZONE_OFFSET_MINUTES = 330; // +05:30 in minutes
export const APP_TIMEZONE_OFFSET_MS = APP_TIMEZONE_OFFSET_MINUTES * 60 * 1000;

export interface TimeSlot {
  time: string;           // "10:00 AM"
  startTime24: string;    // "10:00"
  endTime24: string;      // "11:00"
  label: string;          // "10:00 AM – 11:00 AM IST"
  available: boolean;     // Can this slot be selected?
  reason?: 'booked' | 'past' | 'unavailable_day' | 'holiday' | 'blocked_date';
  holidayReason?: string;
}

export interface TimeWindow {
  start: string; // "10:00" (24h format HH:mm)
  end: string;   // "13:00" (24h format HH:mm)
}

export interface WeekdaySchedule {
  enabled: boolean;
  windows: TimeWindow[];
}

export type WeekdayKey = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export interface BlockedDate {
  date: string; // YYYY-MM-DD
  reason?: string;
}

export interface ConsultantPricingConfig {
  pricing_30: number; // e.g. 1000 INR
  pricing_60: number; // e.g. 1299 INR
  currency: string;   // "INR"
}

export interface ConsultantAvailabilitySettings {
  version: number;
  weeklySchedule: Record<WeekdayKey, WeekdaySchedule>;
  slotDurationMinutes: number; // 30 or 60 (or custom 15-120)
  bufferMinutes: number;       // 0, 5, 10, 15, 30
  blockedDates: BlockedDate[];
  pricing: ConsultantPricingConfig;
  timezone: string;           // "Asia/Kolkata"
  updatedAt?: string;
}

export const WEEKDAY_ORDER: WeekdayKey[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

export const WEEKDAY_LABELS: Record<WeekdayKey, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
};

/**
 * Returns the current date and time components in India Standard Time (IST).
 */
export function getNowInIST(referenceDate: Date = new Date()): {
  year: number;
  month: number;
  day: number;
  hours: number;
  minutes: number;
  dateStr: string; // YYYY-MM-DD
} {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(referenceDate);
  const partMap: Record<string, string> = {};
  for (const p of parts) {
    partMap[p.type] = p.value;
  }

  const year = parseInt(partMap.year, 10);
  const month = parseInt(partMap.month, 10);
  const day = parseInt(partMap.day, 10);
  let hours = parseInt(partMap.hour, 10);
  if (hours === 24) hours = 0;
  const minutes = parseInt(partMap.minute, 10);

  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  return { year, month, day, hours, minutes, dateStr };
}

/**
 * Parses time string like "10:00 AM", "2:30 PM", "14:30", or "10:00".
 * Returns { hours, minutes } in 24-hour format, or null if invalid or "Flexible".
 */
export function parseTimeString(timeStr?: string | null): { hours: number; minutes: number } | null {
  if (!timeStr || typeof timeStr !== 'string') return null;
  const clean = timeStr.trim();
  if (clean.toLowerCase() === 'flexible' || clean.toLowerCase() === 'unscheduled') {
    return null;
  }

  // 12-hour format: "10:00 AM", "02:30 PM", "9:00am"
  const ampmMatch = clean.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)$/i);
  if (ampmMatch) {
    let hours = parseInt(ampmMatch[1], 10);
    const minutes = parseInt(ampmMatch[2], 10);
    const meridiem = ampmMatch[3].toUpperCase();

    if (hours < 1 || hours > 12 || minutes < 0 || minutes > 59) return null;
    if (meridiem === 'PM' && hours < 12) hours += 12;
    if (meridiem === 'AM' && hours === 12) hours = 0;
    return { hours, minutes };
  }

  // 24-hour format: "14:30", "09:00", "14:30:00"
  const militaryMatch = clean.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (militaryMatch) {
    const hours = parseInt(militaryMatch[1], 10);
    const minutes = parseInt(militaryMatch[2], 10);
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
    return { hours, minutes };
  }

  return null;
}

/**
 * Formats 24-hour hours and minutes into "hh:mm A" (e.g. 10:00 AM, 02:30 PM).
 */
export function formatTime12Hour(hours: number, minutes: number = 0): string {
  const meridiem = hours >= 12 ? 'PM' : 'AM';
  let h12 = hours % 12;
  if (h12 === 0) h12 = 12;
  return `${String(h12).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${meridiem}`;
}

/**
 * Normalizes any time string (e.g. "14:00", "2:00 PM", "14:00:00") into standard "02:00 PM" format.
 */
export function normalizeTimeSlot(timeStr: string): string {
  const parsed = parseTimeString(timeStr);
  if (!parsed) return timeStr.trim();
  return formatTime12Hour(parsed.hours, parsed.minutes);
}

/**
 * Parses a date (YYYY-MM-DD or ISO) and a time string into a concrete UTC Date object in IST.
 * Returns null if the date or time cannot be parsed into a valid timestamp.
 */
export function parseBookingDateTime(dateStr?: string | null, timeStr?: string | null): Date | null {
  if (!dateStr || !timeStr) return null;

  const parsedTime = parseTimeString(timeStr);
  if (!parsedTime) return null;

  let year: number;
  let month: number;
  let day: number;

  if (dateStr.includes('T')) {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    const ist = getNowInIST(d);
    year = ist.year;
    month = ist.month;
    day = ist.day;
  } else {
    const parts = dateStr.split('-');
    if (parts.length !== 3) return null;
    year = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10);
    day = parseInt(parts[2], 10);
    if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
  }

  // Create date in UTC, then subtract 5 hours and 30 minutes to find the UTC moment corresponding to this IST time
  const utcEpoch = Date.UTC(year, month - 1, day, parsedTime.hours, parsedTime.minutes, 0) - APP_TIMEZONE_OFFSET_MS;
  const result = new Date(utcEpoch);
  return isNaN(result.getTime()) ? null : result;
}

/**
 * Formats date and time into an unambiguous ISO 8601 string with +05:30 IST offset.
 * Supports both Date instance or (dateStr, timeStr) parameters.
 * Example: "2026-10-22T10:00:00+05:30"
 */
export function formatISTISOString(dateOrDateStr: Date | string, timeStr?: string | null): string | null {
  if (dateOrDateStr instanceof Date) {
    if (isNaN(dateOrDateStr.getTime())) return null;
    const ist = getNowInIST(dateOrDateStr);
    const hh = String(ist.hours).padStart(2, '0');
    const mm = String(ist.minutes).padStart(2, '0');
    return `${ist.dateStr}T${hh}:${mm}:00+05:30`;
  }

  if (!timeStr) return null;
  const parsedTime = parseTimeString(timeStr);
  if (!parsedTime) return null;

  const cleanDate = dateOrDateStr.includes('T') ? dateOrDateStr.split('T')[0] : dateOrDateStr;
  const hh = String(parsedTime.hours).padStart(2, '0');
  const mm = String(parsedTime.minutes).padStart(2, '0');
  return `${cleanDate}T${hh}:${mm}:00+05:30`;
}

/**
 * Parses a consultant's preferred_time configuration string into start and end hours (24h format).
 * Defaults to 10:00 to 18:00 (10 AM to 6 PM IST) if unspecified or flexible.
 */
export function parseConsultantAvailabilityHours(preferredTime?: string | null): {
  startHour: number;
  endHour: number;
  daysAllowed?: number[]; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
} {
  if (!preferredTime || typeof preferredTime !== 'string') {
    return { startHour: 10, endHour: 18 };
  }

  const clean = preferredTime.trim().toLowerCase();

  // Keyword-based presets
  if (clean.includes('morning')) {
    // 9 AM - 1 PM (or 8 AM - 12 PM if explicitly 8)
    return { startHour: clean.includes('8') ? 8 : 9, endHour: clean.includes('8') ? 12 : 13 };
  }
  if (clean.includes('afternoon')) {
    return { startHour: 13, endHour: 17 };
  }
  if (clean.includes('evening')) {
    return { startHour: 17, endHour: 21 };
  }
  if (clean.includes('night')) {
    return { startHour: 20, endHour: 23 };
  }
  if (clean.includes('flexible')) {
    return { startHour: 9, endHour: 18 };
  }

  // Regex range match: e.g. "10:00 AM - 6:00 PM", "8 AM – 12 PM", "2 PM - 5 PM"
  const rangeMatch = clean.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:–|-|to)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (rangeMatch) {
    let startH = parseInt(rangeMatch[1], 10);
    const startMeridiem = rangeMatch[3]?.toLowerCase();
    let endH = parseInt(rangeMatch[4], 10);
    const endMeridiem = rangeMatch[6]?.toLowerCase();

    if (startMeridiem === 'pm' && startH < 12) startH += 12;
    if (startMeridiem === 'am' && startH === 12) startH = 0;

    if (endMeridiem === 'pm' && endH < 12) endH += 12;
    if (endMeridiem === 'am' && endH === 12) endH = 0;

    // Sanity check: if end <= start, assume PM for end if start is AM/early
    if (endH <= startH && endH < 12) endH += 12;

    if (startH >= 0 && endH <= 24 && endH > startH) {
      return { startHour: startH, endHour: endH };
    }
  }

  return { startHour: 10, endHour: 18 };
}

/**
 * Checks if a given time slot has already passed relative to current IST time.
 * Includes a 15-minute booking buffer so users cannot book slots starting in the next 15 minutes.
 */
export function isSlotInPast(
  dateStr: string,
  timeStr: string,
  referenceNow: Date = new Date(),
  bufferMinutes: number = 15
): boolean {
  const slotDate = parseBookingDateTime(dateStr, timeStr);
  if (!slotDate) return true;

  const thresholdMs = referenceNow.getTime() + (bufferMinutes * 60 * 1000);
  return slotDate.getTime() <= thresholdMs;
}

/**
 * Converts a 24-hour time string "HH:mm" to minutes from midnight (0..1439).
 */
export function time24ToMinutes(timeStr: string): number {
  const parsed = parseTimeString(timeStr);
  if (!parsed) return 0;
  return parsed.hours * 60 + parsed.minutes;
}

/**
 * Converts minutes from midnight into 24-hour format "HH:mm".
 */
export function minutesToTime24(totalMinutes: number): string {
  const normalized = Math.max(0, Math.min(1439, totalMinutes));
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Gets the lowercase day-of-week key for a given date in India Standard Time.
 */
export function getDayOfWeekInIST(dateStr: string): WeekdayKey {
  // Use noon IST for the date to avoid any boundary shifts
  const istDate = parseBookingDateTime(dateStr, "12:00 PM") || new Date(dateStr);
  const dayIndex = new Intl.DateTimeFormat('en-US', { timeZone: APP_TIMEZONE, weekday: 'long' })
    .format(istDate)
    .toLowerCase();

  const validKey = WEEKDAY_ORDER.find(k => k === dayIndex);
  return validKey || 'monday';
}

/**
 * Validates a single TimeWindow.
 * Start and end must be valid times, and start must be strictly before end.
 */
export function validateTimeWindow(window: TimeWindow): { valid: boolean; error?: string } {
  if (!window || typeof window.start !== 'string' || typeof window.end !== 'string') {
    return { valid: false, error: 'Start and end times are required.' };
  }

  const startParsed = parseTimeString(window.start);
  const endParsed = parseTimeString(window.end);

  if (!startParsed) {
    return { valid: false, error: `Invalid start time format: "${window.start}".` };
  }
  if (!endParsed) {
    return { valid: false, error: `Invalid end time format: "${window.end}".` };
  }

  const startM = startParsed.hours * 60 + startParsed.minutes;
  const endM = endParsed.hours * 60 + endParsed.minutes;

  if (startM >= endM) {
    return { valid: false, error: `Window start (${window.start}) must be earlier than end (${window.end}).` };
  }

  return { valid: true };
}

/**
 * Validates an array of time windows on a single weekday for overlaps and proper ordering.
 */
export function validateWindowsNoOverlap(windows: TimeWindow[]): { valid: boolean; error?: string } {
  if (!Array.isArray(windows) || windows.length <= 1) {
    if (windows?.length === 1) {
      return validateTimeWindow(windows[0]);
    }
    return { valid: true };
  }

  // Validate each window individually
  for (const w of windows) {
    const singleValidation = validateTimeWindow(w);
    if (!singleValidation.valid) return singleValidation;
  }

  // Sort windows by start time in minutes
  const sorted = [...windows].map(w => ({
    ...w,
    startM: time24ToMinutes(w.start),
    endM: time24ToMinutes(w.end),
  })).sort((a, b) => a.startM - b.startM);

  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i];
    const next = sorted[i + 1];

    if (current.endM > next.startM) {
      return {
        valid: false,
        error: `Overlapping time windows detected: [${current.start} - ${current.end}] overlaps with [${next.start} - ${next.end}].`,
      };
    }
  }

  return { valid: true };
}

/**
 * Creates default availability settings for a consultant.
 */
export function createDefaultAvailabilitySettings(consultant?: any): ConsultantAvailabilitySettings {
  const pricing_30 = Number(consultant?.pricing_30) > 0 ? Number(consultant.pricing_30) : 1000;
  const pricing_60 = Number(consultant?.pricing_60) > 0 ? Number(consultant.pricing_60) : 1299;

  return {
    version: 1,
    weeklySchedule: {
      monday: {
        enabled: true,
        windows: [
          { start: '10:00', end: '13:00' },
          { start: '15:00', end: '18:00' },
        ],
      },
      tuesday: {
        enabled: true,
        windows: [
          { start: '10:00', end: '13:00' },
          { start: '15:00', end: '18:00' },
        ],
      },
      wednesday: {
        enabled: true,
        windows: [
          { start: '10:00', end: '13:00' },
          { start: '15:00', end: '18:00' },
        ],
      },
      thursday: {
        enabled: true,
        windows: [
          { start: '10:00', end: '13:00' },
          { start: '15:00', end: '18:00' },
        ],
      },
      friday: {
        enabled: true,
        windows: [
          { start: '10:00', end: '13:00' },
          { start: '15:00', end: '18:00' },
        ],
      },
      saturday: {
        enabled: true,
        windows: [
          { start: '10:00', end: '14:00' },
        ],
      },
      sunday: {
        enabled: false,
        windows: [],
      },
    },
    slotDurationMinutes: 60,
    bufferMinutes: 0,
    blockedDates: [],
    pricing: {
      pricing_30,
      pricing_60,
      currency: 'INR',
    },
    timezone: APP_TIMEZONE,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Validates the full availability settings configuration.
 */
export function validateAvailabilitySettings(settings: ConsultantAvailabilitySettings): { valid: boolean; error?: string } {
  if (!settings || typeof settings !== 'object') {
    return { valid: false, error: 'Availability settings object is required.' };
  }

  if (!settings.weeklySchedule || typeof settings.weeklySchedule !== 'object') {
    return { valid: false, error: 'Weekly schedule is required.' };
  }

  for (const day of WEEKDAY_ORDER) {
    const daySchedule = settings.weeklySchedule[day];
    if (!daySchedule) continue;

    if (daySchedule.enabled && Array.isArray(daySchedule.windows)) {
      const windowCheck = validateWindowsNoOverlap(daySchedule.windows);
      if (!windowCheck.valid) {
        return { valid: false, error: `${WEEKDAY_LABELS[day]}: ${windowCheck.error}` };
      }
    }
  }

  if (settings.slotDurationMinutes && (settings.slotDurationMinutes < 15 || settings.slotDurationMinutes > 240)) {
    return { valid: false, error: 'Slot duration must be between 15 and 240 minutes.' };
  }

  if (settings.bufferMinutes !== undefined && (settings.bufferMinutes < 0 || settings.bufferMinutes > 120)) {
    return { valid: false, error: 'Buffer minutes must be between 0 and 120 minutes.' };
  }

  if (settings.pricing) {
    if (typeof settings.pricing.pricing_30 === 'number' && settings.pricing.pricing_30 < 0) {
      return { valid: false, error: '30-minute consultation price cannot be negative.' };
    }
    if (typeof settings.pricing.pricing_60 === 'number' && settings.pricing.pricing_60 < 0) {
      return { valid: false, error: '60-minute consultation price cannot be negative.' };
    }
  }

  return { valid: true };
}

/**
 * Intelligently parses structured availability settings from any consultant object or JSON payload.
 * Fallbacks gracefully to legacy preferred_time and consultant fields.
 */
export function parseAvailabilitySettings(consultantOrSettings: any): ConsultantAvailabilitySettings {
  if (!consultantOrSettings) {
    return createDefaultAvailabilitySettings();
  }

  // 1. Direct settings object
  if (consultantOrSettings.weeklySchedule && typeof consultantOrSettings.weeklySchedule === 'object') {
    return {
      version: 1,
      weeklySchedule: {
        ...createDefaultAvailabilitySettings().weeklySchedule,
        ...consultantOrSettings.weeklySchedule,
      },
      slotDurationMinutes: Number(consultantOrSettings.slotDurationMinutes) || 60,
      bufferMinutes: Number(consultantOrSettings.bufferMinutes) || 0,
      blockedDates: Array.isArray(consultantOrSettings.blockedDates) ? consultantOrSettings.blockedDates : [],
      pricing: {
        pricing_30: Number(consultantOrSettings.pricing?.pricing_30 ?? consultantOrSettings.pricing_30) || 1000,
        pricing_60: Number(consultantOrSettings.pricing?.pricing_60 ?? consultantOrSettings.pricing_60) || 1299,
        currency: 'INR',
      },
      timezone: consultantOrSettings.timezone || APP_TIMEZONE,
      updatedAt: consultantOrSettings.updatedAt || new Date().toISOString(),
    };
  }

  // 2. From availability_settings column (if parsed as object)
  if (consultantOrSettings.availability_settings && typeof consultantOrSettings.availability_settings === 'object') {
    return parseAvailabilitySettings(consultantOrSettings.availability_settings);
  }

  // 3. From JSON string in availability column
  if (typeof consultantOrSettings.availability === 'string' && consultantOrSettings.availability.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(consultantOrSettings.availability);
      if (parsed && typeof parsed === 'object') {
        return parseAvailabilitySettings(parsed);
      }
    } catch {
      // Not valid JSON, continue
    }
  }

  // 4. From social_links.availability_settings
  if (consultantOrSettings.social_links?.availability_settings) {
    return parseAvailabilitySettings(consultantOrSettings.social_links.availability_settings);
  }

  // 5. Default settings customized with consultant pricing & preferred time
  const defaults = createDefaultAvailabilitySettings(consultantOrSettings);
  if (consultantOrSettings.preferred_time) {
    const hours = parseConsultantAvailabilityHours(consultantOrSettings.preferred_time);
    const start24 = `${String(hours.startHour).padStart(2, '0')}:00`;
    const end24 = `${String(hours.endHour).padStart(2, '0')}:00`;
    for (const d of ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as WeekdayKey[]) {
      defaults.weeklySchedule[d] = {
        enabled: true,
        windows: [{ start: start24, end: end24 }],
      };
    }
  }

  return defaults;
}

/**
 * Serializes availability settings into Supabase-compatible columns:
 * - availabilityJson: string (for availability column or availability_settings)
 * - preferredTimeText: human-readable summary string
 * - pricing_30: number
 * - pricing_60: number
 */
export function serializeAvailabilitySettings(settings: ConsultantAvailabilitySettings): {
  availabilityJson: string;
  preferredTimeText: string;
  pricing_30: number;
  pricing_60: number;
} {
  const availabilityJson = JSON.stringify(settings);

  // Build concise human-readable schedule summary
  const enabledDays = WEEKDAY_ORDER.filter(d => settings.weeklySchedule[d]?.enabled);
  let preferredTimeText = 'Flexible';

  if (enabledDays.length === 7) {
    preferredTimeText = 'Mon - Sun';
  } else if (
    enabledDays.length === 6 &&
    !settings.weeklySchedule.sunday?.enabled
  ) {
    preferredTimeText = 'Mon - Sat';
  } else if (
    enabledDays.length === 5 &&
    !settings.weeklySchedule.saturday?.enabled &&
    !settings.weeklySchedule.sunday?.enabled
  ) {
    preferredTimeText = 'Mon - Fri';
  } else if (enabledDays.length > 0) {
    preferredTimeText = enabledDays.map(d => WEEKDAY_LABELS[d].slice(0, 3)).join(', ');
  } else {
    preferredTimeText = 'Unavailable';
  }

  // Collect first window or combined windows for display
  const firstEnabled = enabledDays[0];
  if (firstEnabled && settings.weeklySchedule[firstEnabled]?.windows?.length > 0) {
    const winStrs = settings.weeklySchedule[firstEnabled].windows
      .map(w => `${formatTime12Hour(time24ToMinutes(w.start) / 60, time24ToMinutes(w.start) % 60)} - ${formatTime12Hour(time24ToMinutes(w.end) / 60, time24ToMinutes(w.end) % 60)}`)
      .join(', ');
    preferredTimeText += ` (${winStrs})`;
  }

  return {
    availabilityJson,
    preferredTimeText,
    pricing_30: settings.pricing?.pricing_30 ?? 1000,
    pricing_60: settings.pricing?.pricing_60 ?? 1299,
  };
}

/**
 * Checks whether a given date is available, blocked as a holiday, or an off day for the consultant.
 */
export function checkDayAvailability(
  dateStr: string,
  settings: ConsultantAvailabilitySettings
): {
  isAvailable: boolean;
  isBlocked: boolean;
  blockedReason?: string;
  isDayOff: boolean;
  weekday: WeekdayKey;
} {
  const weekday = getDayOfWeekInIST(dateStr);

  // Check if date is in blocked dates
  const cleanDate = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
  const blockedItem = (settings.blockedDates || []).find(b => {
    const bDate = b.date.includes('T') ? b.date.split('T')[0] : b.date;
    return bDate === cleanDate;
  });

  if (blockedItem) {
    return {
      isAvailable: false,
      isBlocked: true,
      blockedReason: blockedItem.reason || 'Consultant Holiday / Blocked Date',
      isDayOff: false,
      weekday,
    };
  }

  const daySchedule = settings.weeklySchedule?.[weekday];
  if (!daySchedule || !daySchedule.enabled || !daySchedule.windows || daySchedule.windows.length === 0) {
    return {
      isAvailable: false,
      isBlocked: false,
      isDayOff: true,
      weekday,
    };
  }

  return {
    isAvailable: true,
    isBlocked: false,
    isDayOff: false,
    weekday,
  };
}

/**
 * Generates valid consultation time slots for a given consultant and date,
 * respecting structured multi-window availability, blocked dates, appointment duration,
 * buffer time, booked slots, and past slots in IST.
 */
export function generateAvailableSlots(options: {
  dateStr: string;
  preferredTime?: string | null;
  consultantPreferredTime?: string | null;
  availabilitySettings?: ConsultantAvailabilitySettings | null;
  consultant?: any;
  bookedSlots?: string[];
  bookedTimes?: string[];
  durationMinutes?: number;
  sessionDuration?: number;
  bufferMinutes?: number;
  referenceNow?: Date;
}): TimeSlot[] {
  const {
    dateStr,
    preferredTime,
    consultantPreferredTime,
    availabilitySettings,
    consultant,
    bookedSlots = [],
    bookedTimes = [],
    durationMinutes = 60,
    sessionDuration,
    bufferMinutes,
    referenceNow = new Date(),
  } = options;

  if (!dateStr) return [];

  // Determine effective settings
  let settings: ConsultantAvailabilitySettings;
  if (availabilitySettings) {
    settings = availabilitySettings;
  } else if (consultant) {
    settings = parseAvailabilitySettings(consultant);
  } else if (preferredTime || consultantPreferredTime) {
    const raw = preferredTime ?? consultantPreferredTime;
    // Check if raw is JSON
    if (typeof raw === 'string' && raw.trim().startsWith('{')) {
      settings = parseAvailabilitySettings({ availability: raw });
    } else {
      settings = parseAvailabilitySettings({ preferred_time: raw });
    }
  } else {
    settings = createDefaultAvailabilitySettings();
  }

  const effectiveDuration = sessionDuration ?? durationMinutes ?? settings.slotDurationMinutes ?? 60;
  const effectiveBuffer = bufferMinutes ?? settings.bufferMinutes ?? 0;
  const effectiveBooked = [...bookedSlots, ...bookedTimes];

  // Normalize booked slots set for fast O(1) matching
  const bookedSet = new Set<string>();
  for (const b of effectiveBooked) {
    if (!b) continue;
    bookedSet.add(normalizeTimeSlot(b));
    bookedSet.add(b.trim());
  }

  // Check day status (blocked date or day off)
  const dayStatus = checkDayAvailability(dateStr, settings);

  if (dayStatus.isBlocked) {
    return [
      {
        time: 'Holiday',
        startTime24: '00:00',
        endTime24: '23:59',
        label: `Consultant Unavailable: ${dayStatus.blockedReason || 'Blocked Date'}`,
        available: false,
        reason: 'holiday',
        holidayReason: dayStatus.blockedReason,
      },
    ];
  }

  if (dayStatus.isDayOff) {
    return [
      {
        time: 'Day Off',
        startTime24: '00:00',
        endTime24: '23:59',
        label: `Consultant does not schedule consultations on ${WEEKDAY_LABELS[dayStatus.weekday]}s.`,
        available: false,
        reason: 'unavailable_day',
      },
    ];
  }

  const daySchedule = settings.weeklySchedule[dayStatus.weekday];
  const windows = daySchedule?.windows || [];
  const slots: TimeSlot[] = [];

  for (const window of windows) {
    const startM = time24ToMinutes(window.start);
    const endM = time24ToMinutes(window.end);

    let currentM = startM;
    while (currentM + effectiveDuration <= endM) {
      const slotEndM = currentM + effectiveDuration;

      const slotHour = Math.floor(currentM / 60);
      const slotMin = currentM % 60;
      const endSlotHour = Math.floor(slotEndM / 60);
      const endSlotMin = slotEndM % 60;

      const formatted12 = formatTime12Hour(slotHour, slotMin);
      const formattedEnd12 = formatTime12Hour(endSlotHour, endSlotMin);
      const startTime24 = `${String(slotHour).padStart(2, '0')}:${String(slotMin).padStart(2, '0')}`;
      const endTime24 = `${String(endSlotHour).padStart(2, '0')}:${String(endSlotMin).padStart(2, '0')}`;

      const isPast = isSlotInPast(dateStr, formatted12, referenceNow);
      const isBooked = bookedSet.has(formatted12) || bookedSet.has(startTime24);

      let available = true;
      let reason: 'booked' | 'past' | undefined;

      if (isBooked) {
        available = false;
        reason = 'booked';
      } else if (isPast) {
        available = false;
        reason = 'past';
      }

      slots.push({
        time: formatted12,
        startTime24,
        endTime24,
        label: `${formatted12} – ${formattedEnd12} IST`,
        available,
        reason,
      });

      // Next slot begins after slot duration + configured buffer time
      currentM = slotEndM + effectiveBuffer;
    }
  }

  return slots;
}

/**
 * Returns the countdown target timestamp in milliseconds (5 minutes before scheduled start in IST),
 * or null if the booking has no valid start time or is marked "Flexible".
 */
export function getCountdownTargetMs(
  targetDate?: string | null,
  targetTime?: string | null,
  earlyWindowMs: number = 5 * 60 * 1000
): { targetMs: number | null; isValid: boolean; scheduledStart: Date | null } {
  if (!targetDate || !targetTime) {
    return { targetMs: null, isValid: false, scheduledStart: null };
  }

  const cleanTime = targetTime.trim().toLowerCase();
  if (cleanTime === 'flexible' || cleanTime === 'unscheduled') {
    return { targetMs: null, isValid: false, scheduledStart: null };
  }

  const start = parseBookingDateTime(targetDate, targetTime);
  if (!start || isNaN(start.getTime())) {
    return { targetMs: null, isValid: false, scheduledStart: null };
  }

  const targetMs = start.getTime() - earlyWindowMs;
  return { targetMs, isValid: true, scheduledStart: start };
}
