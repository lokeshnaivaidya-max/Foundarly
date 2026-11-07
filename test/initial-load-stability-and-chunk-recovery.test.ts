import test from 'node:test';
import assert from 'node:assert/strict';
import { isChunkLoadError } from '../src/utils/lazyWithRetry';
import { normalizeMeetingPath, isMeetingUrl, getMeetingRedirect } from '../src/utils/meetingRedirect';

// Mock storage helper for testing storage parsing logic
function parseStoredChatMessages(saved: string | null): any[] {
  try {
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return parsed.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) }));
      }
    }
  } catch {
    // ignore
  }
  return [];
}

function parseStoredPreviewConsultant(stored: string | null): { id: string; name: string } | null {
  try {
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && typeof parsed === 'object' && typeof parsed.id === 'string') {
        return parsed;
      }
    }
  } catch {
    // ignore
  }
  return null;
}

test('isChunkLoadError accurately detects chunk and dynamic import failures', () => {
  assert.equal(isChunkLoadError(new Error('Failed to fetch dynamically imported module: /assets/ConsultantDashboard-xyz.js')), true);
  assert.equal(isChunkLoadError(new Error('error loading dynamically imported module')), true);
  assert.equal(isChunkLoadError(new Error('Importing a module script failed.')), true);
  assert.equal(isChunkLoadError(new Error('Loading chunk 42 failed.')), true);
  
  const chunkError = new Error('Network error loading module');
  chunkError.name = 'ChunkLoadError';
  assert.equal(isChunkLoadError(chunkError), true);

  // Unrelated runtime errors should NOT be classified as chunk errors
  assert.equal(isChunkLoadError(new Error('TypeError: Cannot read properties of undefined')), false);
  assert.equal(isChunkLoadError(new Error('SyntaxError: Unexpected token < in JSON at position 0')), false);
  assert.equal(isChunkLoadError(null), false);
  assert.equal(isChunkLoadError(undefined), false);
  assert.equal(isChunkLoadError('string error'), false);
});

test('parseStoredChatMessages is immune to corrupted non-array storage values', () => {
  // Corrupted stringified objects, numbers, booleans, or null
  assert.deepEqual(parseStoredChatMessages('{"message": "corrupted object"}'), []);
  assert.deepEqual(parseStoredChatMessages('12345'), []);
  assert.deepEqual(parseStoredChatMessages('"invalid string"'), []);
  assert.deepEqual(parseStoredChatMessages('null'), []);
  assert.deepEqual(parseStoredChatMessages('{invalid json'), []);
  assert.deepEqual(parseStoredChatMessages(null), []);

  // Valid array
  const valid = JSON.stringify([{ id: '1', text: 'Hello', timestamp: '2026-11-04T12:00:00Z', isBot: true }]);
  const result = parseStoredChatMessages(valid);
  assert.equal(result.length, 1);
  assert.equal(result[0].id, '1');
  assert.equal(result[0].text, 'Hello');
  assert.ok(result[0].timestamp instanceof Date);
});

test('parseStoredPreviewConsultant enforces strict object schema with id', () => {
  // Malformed values
  assert.equal(parseStoredPreviewConsultant('123'), null);
  assert.equal(parseStoredPreviewConsultant('"consultant"'), null);
  assert.equal(parseStoredPreviewConsultant('{}'), null);
  assert.equal(parseStoredPreviewConsultant('{"name": "No ID"}'), null);
  assert.equal(parseStoredPreviewConsultant('null'), null);
  assert.equal(parseStoredPreviewConsultant(null), null);

  // Valid object
  const valid = JSON.stringify({ id: 'c-123', name: 'Dr. Jane Doe' });
  const parsed = parseStoredPreviewConsultant(valid);
  assert.ok(parsed !== null);
  assert.equal(parsed?.id, 'c-123');
  assert.equal(parsed?.name, 'Dr. Jane Doe');
});

test('normalizeMeetingPath safely handles malformed and non-string types without throwing', () => {
  // Nullish or non-string inputs that previously could throw target.trim()
  assert.equal(normalizeMeetingPath(null), null);
  assert.equal(normalizeMeetingPath(undefined), null);
  assert.equal(normalizeMeetingPath(123 as any), null);
  assert.equal(normalizeMeetingPath(true as any), null);

  // Malformed objects
  assert.equal(normalizeMeetingPath({ pathname: '' }), null);
  assert.equal(normalizeMeetingPath({ pathname: '/dashboard' }), null);

  // Valid string paths
  assert.equal(normalizeMeetingPath('/meeting/session-123?token=abc#section'), '/meeting/session-123?token=abc#section');
  assert.equal(normalizeMeetingPath('https://www.foundarlybusinessworld.in/meeting/room-456'), '/meeting/room-456');
  assert.equal(normalizeMeetingPath({ pathname: '/meeting/abc', search: '?role=client' }), '/meeting/abc?role=client');
});

test('isMeetingUrl correctly validates meeting URLs and rejects arbitrary paths', () => {
  assert.equal(isMeetingUrl('/meeting/abc'), true);
  assert.equal(isMeetingUrl('https://example.com/meeting/room-123'), true);
  assert.equal(isMeetingUrl('/consultants'), false);
  assert.equal(isMeetingUrl('/login'), false);
  assert.equal(isMeetingUrl(null), false);
  assert.equal(isMeetingUrl(undefined), false);
  assert.equal(isMeetingUrl(42 as any), false);
});
