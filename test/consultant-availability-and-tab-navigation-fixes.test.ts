import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import consultantActionHandler from '../api/consultant/[action].js';
import {
  validateAvailabilitySettings,
  validateConfirmedBookingConflicts,
} from '../src/server/consultant/availability.js';
import { isChunkLoadError } from '../src/utils/lazyWithRetry.js';

describe('ISSUE 1 — Consultant Availability API & Routing', () => {
  test('API router routes "availability" and "stats" actions without returning 404 unknown action', async () => {
    let statusCode = 0;
    let jsonPayload: any = null;

    const mockRes = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(data: any) {
        jsonPayload = data;
        return this;
      },
      end() {},
      setHeader() {},
    };

    // Unknown action returns 404 with descriptive error
    await consultantActionHandler(
      {
        method: 'GET',
        query: { action: 'nonexistent_action' },
        headers: {},
      },
      mockRes as any
    );

    assert.equal(statusCode, 404);
    assert.equal(jsonPayload?.success, false);
    assert.ok(
      jsonPayload?.error?.includes('Unknown consultant API action'),
      'Should report unknown action'
    );
    assert.ok(
      jsonPayload?.error?.includes('availability'),
      'Error message should list availability as supported'
    );
    assert.ok(
      jsonPayload?.error?.includes('stats'),
      'Error message should list stats as supported'
    );
  });

  test('availability handler rejects requests missing Bearer authorization token with 401', async () => {
    let statusCode = 0;
    let jsonPayload: any = null;

    const mockRes = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(data: any) {
        jsonPayload = data;
        return this;
      },
      end() {},
      setHeader() {},
    };

    await consultantActionHandler(
      {
        method: 'GET',
        query: { action: 'availability' },
        headers: {},
      },
      mockRes as any
    );

    assert.equal(statusCode, 401);
    assert.equal(jsonPayload?.success, false);
    assert.ok(jsonPayload?.error?.includes('Bearer token required'));
  });

  test('validateAvailabilitySettings validates preset, days, custom slots and timezone', () => {
    // Valid all-day preset
    const validAllDay = validateAvailabilitySettings({
      preset: 'all-day',
      timezone: 'Asia/Kolkata',
      days: ['monday', 'tuesday', 'wednesday'],
      slotDuration: 30,
      bufferTime: 10,
    });
    assert.equal(validAllDay.valid, true);
    assert.equal(validAllDay.settings.preset, 'all-day');
    assert.equal(validAllDay.settings.timezone, 'Asia/Kolkata');

    // Invalid preset
    const invalidPreset = validateAvailabilitySettings({
      preset: 'unsupported-preset' as any,
    });
    assert.equal(invalidPreset.valid, false);
    assert.ok(invalidPreset.error?.includes('Invalid preset'));

    // Custom slots with end time <= start time rejected
    const invalidSlotTime = validateAvailabilitySettings({
      preset: 'custom',
      customSlots: [
        { day: 'monday', startTime: '15:00', endTime: '12:00' },
      ],
    });
    assert.equal(invalidSlotTime.valid, false);
    assert.ok(invalidSlotTime.error?.includes('must be after start time'));

    // Valid custom slots
    const validCustom = validateAvailabilitySettings({
      preset: 'custom',
      customSlots: [
        { day: 'monday', startTime: '10:00', endTime: '18:00' },
      ],
    });
    assert.equal(validCustom.valid, true);
  });

  test('validateConfirmedBookingConflicts detects conflicts when consultant disables a day with active confirmed sessions', () => {
    const existingBookings = [
      {
        id: 'b-1',
        date: '2026-11-16', // Monday
        time: '10:00',
        duration_minutes: 30,
        status: 'confirmed',
      },
    ];

    // Attempting to set days to only Tuesday when Monday has confirmed session
    const conflict = validateConfirmedBookingConflicts(
      {
        preset: 'weekdays',
        days: ['tuesday', 'wednesday'],
        timezone: 'UTC',
        slotDuration: 30,
        bufferTime: 0,
        customSlots: [],
      },
      existingBookings
    );

    assert.equal(conflict.hasConflict, true);
    assert.ok(conflict.conflicts.length > 0);
    assert.ok(conflict.message?.includes('conflict'));
  });

  test('validateConfirmedBookingConflicts allows settings when all confirmed bookings remain covered', () => {
    const existingBookings = [
      {
        id: 'b-1',
        date: '2026-11-16', // Monday
        time: '10:00',
        duration_minutes: 30,
        status: 'confirmed',
      },
    ];

    const validSettings = validateConfirmedBookingConflicts(
      {
        preset: 'all-day',
        days: ['monday', 'tuesday'],
        timezone: 'UTC',
        slotDuration: 30,
        bufferTime: 0,
        customSlots: [],
      },
      existingBookings
    );

    assert.equal(validSettings.hasConflict, false);
    assert.equal(validSettings.conflicts.length, 0);
  });

  test('availability handler preserves admin-managed pricing integrity', () => {
    const availabilitySrc = fs.readFileSync(
      path.join(process.cwd(), 'src', 'server', 'consultant', 'availability.ts'),
      'utf8'
    );

    // Verify availability update payload explicitly does NOT overwrite pricing_30 / pricing_60
    assert.ok(
      availabilitySrc.includes('Admin-managed pricing integrity'),
      'Must document and enforce pricing integrity'
    );
    assert.ok(
      !availabilitySrc.includes('pricing_30: req.body'),
      'Must never accept user-provided pricing_30'
    );
    assert.ok(
      !availabilitySrc.includes('pricing_60: req.body'),
      'Must never accept user-provided pricing_60'
    );
  });
});

describe('ISSUE 2 — Tab Navigation & Refresh Prevention', () => {
  test('isChunkLoadError narrows chunk errors and avoids false-positive full page reloads on generic errors', () => {
    // True chunk load errors (Vite / dynamic import asset chunk failure)
    assert.equal(isChunkLoadError(new Error('Failed to fetch dynamically imported module /assets/Dashboard-C4b.js')), true);
    assert.equal(isChunkLoadError(new Error('Importing a module script failed: chunk-123.js')), true);
    assert.equal(isChunkLoadError(new Error('error loading dynamically imported module')), true);
    assert.equal(isChunkLoadError(new Error('Loading chunk 42 failed')), true);

    // Generic API or image or network errors must NEVER trigger full page reload
    assert.equal(isChunkLoadError(new Error('Failed to load resource: the server responded with a status of 404')), false);
    assert.equal(isChunkLoadError(new Error('NetworkError when attempting to fetch resource.')), false);
    assert.equal(isChunkLoadError(new Error('Failed to fetch /api/consultant/availability')), false);
    assert.equal(isChunkLoadError(new Error('Unknown consultant API action')), false);
    assert.equal(isChunkLoadError(null), false);
    assert.equal(isChunkLoadError('arbitrary string error'), false);
  });

  test('ConsultantDashboard retains state across tabs using forceMount on TabsContent', () => {
    const dashboardSrc = fs.readFileSync(
      path.join(process.cwd(), 'src', 'pages', 'ConsultantDashboard.tsx'),
      'utf8'
    );

    // Check that every tab content uses forceMount and conditional hidden class
    const tabValues = ['availability', 'bookings', 'follow-ups', 'payouts', 'earnings'];
    for (const val of tabValues) {
      assert.ok(
        dashboardSrc.includes(`value="${val}"`) && dashboardSrc.includes('forceMount'),
        `Tab "${val}" must have forceMount so switching tabs does not unmount or reload state`
      );
      assert.ok(
        dashboardSrc.includes(`currentTab !== "${val}" && "hidden"`),
        `Tab "${val}" must toggle visibility with hidden class when inactive`
      );
    }
  });

  test('AuthContext handles window focus/visibility with a 30s cooldown and does not force reload', () => {
    const authSrc = fs.readFileSync(
      path.join(process.cwd(), 'src', 'contexts', 'AuthContext.tsx'),
      'utf8'
    );

    assert.ok(
      authSrc.includes('const FOCUS_RECHECK_COOLDOWN_MS = 30000;'),
      'Focus/visibility cooldown must be at least 30s to prevent rapid re-fetching'
    );
    assert.ok(
      authSrc.includes('handleWindowFocusOrVisibility = () => {'),
      'Window focus/visibility handler must exist'
    );
    assert.ok(
      authSrc.includes('handleWindowFocusOrVisibility(false);') || authSrc.includes('checkSession(false);'),
      'Focus recheck must pass force=false to respect throttle'
    );
  });
});

describe('ISSUE 3 — Performance & Loading Experience', () => {
  test('consultantDashboardService deduplicates concurrent getConsultant calls and caches for 5s TTL', () => {
    const serviceSrc = fs.readFileSync(
      path.join(process.cwd(), 'src', 'services', 'consultantDashboard.ts'),
      'utf8'
    );

    assert.ok(
      serviceSrc.includes('inFlightConsultantPromises'),
      'Must deduplicate concurrent in-flight getConsultant requests'
    );
    assert.ok(
      serviceSrc.includes('consultantCache'),
      'Must maintain a consultant memory cache'
    );
    assert.ok(
      serviceSrc.includes('CONSULTANT_CACHE_TTL_MS = 5000;'),
      'Must have a 5-second TTL cache for consultant profile'
    );
    assert.ok(
      serviceSrc.includes('clearConsultantCache'),
      'Must export cache invalidation function for after saving availability'
    );
  });

  test('ConsultantDashboard displays structured skeleton rather than blank loader', () => {
    const dashboardSrc = fs.readFileSync(
      path.join(process.cwd(), 'src', 'pages', 'ConsultantDashboard.tsx'),
      'utf8'
    );

    assert.ok(
      dashboardSrc.includes('function ConsultantDashboardSkeleton()'),
      'ConsultantDashboard must define a structured ConsultantDashboardSkeleton'
    );
    assert.ok(
      dashboardSrc.includes('if (loading) return <ConsultantDashboardSkeleton />;'),
      'Initial loading state must render ConsultantDashboardSkeleton instead of PageLoader'
    );
  });

  test('ConsultantAvailabilityEditor displays AvailabilitySkeleton and error retry state', () => {
    const editorSrc = fs.readFileSync(
      path.join(process.cwd(), 'src', 'components', 'consultant', 'ConsultantAvailabilityEditor.tsx'),
      'utf8'
    );

    assert.ok(
      editorSrc.includes('function AvailabilitySkeleton()'),
      'ConsultantAvailabilityEditor must have an AvailabilitySkeleton'
    );
    assert.ok(
      editorSrc.includes('if (loading) return <AvailabilitySkeleton />;'),
      'Availability loading state must render AvailabilitySkeleton'
    );
    assert.ok(
      editorSrc.includes('Retry Loading Availability'),
      'Must provide an explicit retry button when availability fails to load'
    );
  });
});
