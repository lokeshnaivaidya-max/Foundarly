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
  reason?: 'booked' | 'past' | 'unavailable_day';
}

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
 * Generates valid consultation time slots for a given consultant and date,
 * respecting the consultant's preferred window, already booked slots, and past slots.
 */
export function generateAvailableSlots(options: {
  dateStr: string;
  preferredTime?: string | null;
  consultantPreferredTime?: string | null;
  bookedSlots?: string[];
  bookedTimes?: string[];
  durationMinutes?: number;
  sessionDuration?: number;
  referenceNow?: Date;
}): TimeSlot[] {
  const {
    dateStr,
    preferredTime,
    consultantPreferredTime,
    bookedSlots = [],
    bookedTimes = [],
    durationMinutes = 60,
    sessionDuration,
    referenceNow = new Date(),
  } = options;

  if (!dateStr) return [];

  const effectivePreferredTime = preferredTime ?? consultantPreferredTime;
  const effectiveBooked = [...bookedSlots, ...bookedTimes];
  const effectiveDuration = sessionDuration ?? durationMinutes ?? 60;

  // Parse availability window
  const { startHour, endHour } = parseConsultantAvailabilityHours(effectivePreferredTime);

  // Normalize booked slots set for fast O(1) matching
  const bookedSet = new Set<string>();
  for (const b of effectiveBooked) {
    if (!b) continue;
    bookedSet.add(normalizeTimeSlot(b));
    // Also store raw trimmed
    bookedSet.add(b.trim());
  }

  const slots: TimeSlot[] = [];
  const stepMinutes = effectiveDuration > 0 ? effectiveDuration : 60;
  const startMinutes = startHour * 60;
  const endMinutes = endHour * 60;

  for (let m = startMinutes; m + stepMinutes <= endMinutes; m += stepMinutes) {
    const slotHour = Math.floor(m / 60);
    const slotMin = m % 60;
    const endSlotM = m + stepMinutes;
    const endSlotHour = Math.floor(endSlotM / 60);
    const endSlotMin = endSlotM % 60;

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
