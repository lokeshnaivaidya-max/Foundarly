import test from 'node:test';
import assert from 'node:assert/strict';
import { 
  trackClientError, 
  getRecordedErrors, 
  getTrackedErrorById, 
  clearRecordedErrors, 
  generateErrorReferenceId,
  sanitizeErrorMessage
} from '../src/services/errorTracker';
import { isMeetingUrl, normalizeMeetingPath } from '../src/utils/meetingRedirect';

test('generateErrorReferenceId creates 8-character uppercase alphanumeric reference IDs', () => {
  const id = generateErrorReferenceId();
  assert.match(id, /^ERR_[A-Z0-9]{8}$/);
});

test('sanitizeErrorMessage strips sensitive credentials and tokens', () => {
  const raw = 'Failed request with Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.doNotLeak and password=supersecret123';
  const clean = sanitizeErrorMessage(raw);
  assert.ok(!clean.includes('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'));
  assert.ok(!clean.includes('supersecret123'));
  assert.ok(clean.includes('[REDACTED_TOKEN]') || clean.includes('[REDACTED_JWT]'));
  assert.ok(clean.includes('password=[REDACTED]'));
});

test('sanitizeErrorMessage prioritizes UPI handles over generic email addresses', () => {
  const upiMessage = 'Payment failed for VPA client@okhdfcbank and merchant@upi and founder@paytm';
  const cleanUpi = sanitizeErrorMessage(upiMessage);
  assert.ok(cleanUpi.includes('[REDACTED_UPI]'));
  assert.ok(!cleanUpi.includes('client@okhdfcbank'));
  assert.ok(!cleanUpi.includes('merchant@upi'));
  assert.ok(!cleanUpi.includes('founder@paytm'));
  // Ensure it was tagged as [REDACTED_UPI], not [REDACTED_EMAIL]
  assert.equal(cleanUpi, 'Payment failed for VPA [REDACTED_UPI] and [REDACTED_UPI] and [REDACTED_UPI]');

  const emailMessage = 'Contact support at lokesh.naivaidya@gmail.com or hello@foundarlybusinessworld.in';
  const cleanEmail = sanitizeErrorMessage(emailMessage);
  assert.ok(!cleanEmail.includes('lokesh.naivaidya@gmail.com'));
  assert.ok(!cleanEmail.includes('hello@foundarlybusinessworld.in'));
  assert.ok(cleanEmail.includes('[REDACTED_EMAIL]'));
  assert.equal(cleanEmail, 'Contact support at [REDACTED_EMAIL] or [REDACTED_EMAIL]');
});

test('sanitizeErrorMessage redacts payment cards, UTRs, Razorpay IDs, UPI, phones, and Supabase keys', () => {
  const rawPaymentData = 'Card 4111 2222 3333 4444 failed with cvv: 123. UTR: 123456789012. Order: order_ABCD1234EFGH5678. Payment: pay_29QQoUBcxrhLEF. RazorpayKey: rzp_live_IL123456789012. Supabase: sb_publishable_abcdefghijklmnop123456. UPI: client@okhdfcbank. Phone: +91 9876543210. Url: https://app.com/callback?token=secret123&apiKey=testkey999';
  const clean = sanitizeErrorMessage(rawPaymentData);
  assert.ok(!clean.includes('4111 2222 3333 4444'), 'Card number must be redacted');
  assert.ok(!clean.includes('123456789012'), 'UTR must be redacted');
  assert.ok(!clean.includes('order_ABCD1234EFGH5678'), 'Order ID must be redacted');
  assert.ok(!clean.includes('pay_29QQoUBcxrhLEF'), 'Payment ID must be redacted');
  assert.ok(!clean.includes('rzp_live_IL123456789012'), 'Razorpay key must be redacted');
  assert.ok(!clean.includes('sb_publishable_abcdefghijklmnop123456'), 'Supabase key must be redacted');
  assert.ok(!clean.includes('client@okhdfcbank'), 'UPI handle must be redacted');
  assert.ok(!clean.includes('9876543210'), 'Phone number must be redacted');
  assert.ok(!clean.includes('secret123'), 'URL token must be redacted');
  assert.ok(!clean.includes('testkey999'), 'URL apiKey must be redacted');
  assert.ok(clean.includes('[REDACTED_CARD]'));
  assert.ok(clean.includes('[REDACTED_UTR]'));
  assert.ok(clean.includes('[REDACTED_PAYMENT_ID]'));
  assert.ok(clean.includes('[REDACTED_SUPABASE_KEY]'));
  assert.ok(clean.includes('[REDACTED_UPI]'));
  assert.ok(clean.includes('[REDACTED_PHONE]'));
});

test('trackClientError captures and sanitizes stack traces and component stacks', () => {
  clearRecordedErrors();

  const err = new TypeError("Failed to load user profile with token leak");
  err.stack = "TypeError: Failed to load user profile with token leak\n    at authenticate (https://foundarly.in/auth?token=leakSecret123&code=auth987):12:4\n    at verifyVPA (user client@okhdfcbank, payment pay_29QQoUBcxrhLEF)\n    at Login (src/pages/Login.tsx:60:8)";

  const record = trackClientError(err, { 
    component: 'LoginPage', 
    info: 'in LoginPage (email="ceo@foundarlybusinessworld.in", phone="+91 9876543210")\n    in Router' 
  });

  assert.ok(record.id.startsWith('ERR_'));
  assert.equal(record.component, 'LoginPage');

  // Verify stack trace sanitization
  assert.ok(record.sanitizedStack, 'sanitizedStack must be present');
  assert.ok(!record.sanitizedStack?.includes('leakSecret123'), 'Stack must not contain token parameter value');
  assert.ok(!record.sanitizedStack?.includes('client@okhdfcbank'), 'Stack must not contain UPI handle');
  assert.ok(!record.sanitizedStack?.includes('pay_29QQoUBcxrhLEF'), 'Stack must not contain payment ID');
  assert.ok(record.sanitizedStack?.includes('[REDACTED_UPI]'), 'Stack must contain [REDACTED_UPI]');
  assert.ok(record.sanitizedStack?.includes('[REDACTED_PAYMENT_ID]'), 'Stack must contain [REDACTED_PAYMENT_ID]');

  // Verify component stack sanitization
  assert.ok(record.componentStack, 'componentStack must be present');
  assert.ok(!record.componentStack?.includes('ceo@foundarlybusinessworld.in'), 'Component stack must not contain email');
  assert.ok(!record.componentStack?.includes('9876543210'), 'Component stack must not contain phone number');
  assert.ok(record.componentStack?.includes('[REDACTED_EMAIL]'), 'Component stack must contain [REDACTED_EMAIL]');
  assert.ok(record.componentStack?.includes('[REDACTED_PHONE]'), 'Component stack must contain [REDACTED_PHONE]');

  // Lookup by ID
  const found = getTrackedErrorById(record.id);
  assert.ok(found !== undefined);
  assert.equal(found?.id, record.id);
  assert.equal(found?.message, record.message);
});

test('Login.tsx exports and meetingRedirect utilities are defined and callable', () => {
  assert.equal(typeof isMeetingUrl, 'function');
  assert.equal(typeof normalizeMeetingPath, 'function');

  assert.equal(isMeetingUrl('/meeting/abc-123'), true);
  assert.equal(isMeetingUrl('https://www.foundarlybusinessworld.in/meeting/room-1'), true);
  assert.equal(isMeetingUrl('/dashboard'), false);
  assert.equal(isMeetingUrl(null), false);

  assert.equal(normalizeMeetingPath('/meeting/abc-123'), '/meeting/abc-123');
  assert.equal(normalizeMeetingPath({ pathname: '/meeting/abc-123' }), '/meeting/abc-123');
  assert.equal(normalizeMeetingPath('/home'), null);
});
