# 🔧 Razorpay Popup Issue - Troubleshooting Guide

## ❌ Common Issue: Popup Not Opening

### Problem
Razorpay checkout popup doesn't open when clicking "Pay & Confirm Booking" button.

---

## ✅ Solution Applied

### 1. Removed `order_id` Parameter

**Issue:** Using `order_id` without creating an order via Razorpay Orders API causes authentication errors.

**Fix:** Removed `order_id` from checkout options. This parameter is only needed when using Razorpay Orders API.

**Before:**
```javascript
const razorpayOptions = {
  key: keyId,
  amount: options.amount * 100,
  order_id: options.bookingId, // ❌ This causes issues
  // ...
};
```

**After:**
```javascript
const razorpayOptions = {
  key: keyId,
  amount: options.amount * 100,
  // order_id removed ✅
  // ...
};
```

### 2. Added Key Validation

Added validation to ensure Razorpay key is in correct format:

```javascript
if (!keyId.startsWith('rzp_test_') && !keyId.startsWith('rzp_live_')) {
  throw new Error('Invalid Razorpay key format');
}
```

### 3. Added Error Handling

Added try-catch around `rzp.open()` to catch popup blocking errors.

---

## 🔑 Razorpay Key Format

### Test Mode Keys:
```
Key ID: rzp_test_XXXXXXXXXXXXXXXX (24 characters after rzp_test_)
Key Secret: XXXXXXXXXXXXXXXXXXXXXXXX (24 characters)
```

### Your Current Key:
```
VITE_RAZORPAY_KEY_ID=rzp_test_Sc4KU
```

**⚠️ WARNING:** Your key appears incomplete! 

### Get Complete Keys:

1. Go to [Razorpay Dashboard](https://dashboard.razorpay.com/)
2. Navigate to: Settings → API Keys
3. Click "Generate Test Key" or "Regenerate Test Key"
4. Copy the COMPLETE key (should be ~24 characters after `rzp_test_`)

**Example of correct format:**
```
rzp_test_1234567890ABCDEF
```

---

## 🧪 Testing Steps

### Step 1: Verify Key Format

```bash
# Check your .env file
cat .env | grep RAZORPAY

# Should show something like:
# VITE_RAZORPAY_KEY_ID=rzp_test_XXXXXXXXXXXXXXXX
```

### Step 2: Clear Browser Cache

```bash
# Chrome/Edge
Ctrl + Shift + Delete → Clear cached images and files

# Or use Incognito mode
Ctrl + Shift + N
```

### Step 3: Test Payment Flow

1. Open browser console (F12)
2. Go to booking page
3. Fill form and click "Pay & Confirm Booking"
4. Check console for errors

**Expected behavior:**
- Razorpay popup should open
- No console errors

**If popup doesn't open, check console for:**
- "Invalid Razorpay key format"
- "Payment gateway is not configured"
- "Failed to load payment gateway"

### Step 4: Test with Razorpay Test Cards

Once popup opens, use these test cards:

**Success:**
```
Card: 4111 1111 1111 1111
CVV: 123
Expiry: Any future date (e.g., 12/25)
Name: Any name
```

**Failure (for testing):**
```
Card: 4000 0000 0000 0002
CVV: 123
Expiry: Any future date
```

---

## 🐛 Common Errors & Solutions

### Error 1: "Payment gateway is not configured"

**Cause:** `VITE_RAZORPAY_KEY_ID` not set in environment variables

**Solution:**
```bash
# Add to .env
VITE_RAZORPAY_KEY_ID=rzp_test_YOUR_COMPLETE_KEY

# Restart dev server
npm run dev
```

### Error 2: "Invalid Razorpay key format"

**Cause:** Key doesn't start with `rzp_test_` or `rzp_live_`

**Solution:**
- Get correct key from Razorpay Dashboard
- Ensure no extra spaces or characters
- Key should be: `rzp_test_XXXXXXXXXXXXXXXX`

### Error 3: "Failed to load payment gateway"

**Cause:** Razorpay script blocked or network issue

**Solution:**
- Check internet connection
- Disable ad blockers
- Check browser console for script loading errors
- Try different browser

### Error 4: Popup Opens but Shows "Authentication Failed"

**Cause:** Using `order_id` without creating order via API

**Solution:**
- ✅ Already fixed! We removed `order_id` parameter
- Popup should now work without Orders API

### Error 5: "Key/Secret mismatch"

**Cause:** Using test key with live secret or vice versa

**Solution:**
- Ensure both key and secret are from same mode (test/live)
- Test key: `rzp_test_*`
- Test secret: Should also be from test mode

---

## 📋 Razorpay Integration Modes

### Mode 1: Basic Checkout (Current - ✅ Recommended)

**What we're using:**
- Direct checkout without Orders API
- Simpler integration
- No backend order creation needed

**Pros:**
- Easy to implement
- Works immediately
- No additional API calls

**Cons:**
- No order tracking before payment
- Can't pre-validate amount

**Code:**
```javascript
const razorpayOptions = {
  key: 'rzp_test_XXX',
  amount: 5000, // in paise
  currency: 'INR',
  name: 'Foundarly',
  description: 'Consultation booking',
  // No order_id needed
};
```

### Mode 2: Orders API (Advanced)

**What it requires:**
- Create order via backend API first
- Use returned `order_id` in checkout
- More secure and trackable

**When to use:**
- Production environment
- Need order tracking
- Want to validate amounts server-side

**Implementation:**
```javascript
// 1. Create order via backend
const order = await fetch('/api/create-razorpay-order', {
  method: 'POST',
  body: JSON.stringify({ amount: 5000 })
});

// 2. Use order_id in checkout
const razorpayOptions = {
  key: 'rzp_test_XXX',
  amount: order.amount,
  order_id: order.id, // Now it's valid
  // ...
};
```

---

## 🔒 Security Notes

### Current Setup (Basic Checkout):

**Frontend:**
- ✅ Key ID exposed (safe - it's public)
- ✅ Amount sent from frontend
- ✅ Signature verification in Edge Function

**Backend (Edge Function):**
- ✅ Secret key hidden
- ✅ Payment signature verified
- ✅ Booking updated only after verification

**Security Level:** Good for MVP/Testing

### Production Recommendation (Orders API):

**Frontend:**
- Key ID exposed (safe)
- Request order creation from backend

**Backend:**
- Create order with Razorpay API
- Validate amount server-side
- Return order_id to frontend
- Verify payment signature

**Security Level:** Enterprise-grade

---

## 🚀 Quick Fix Checklist

- [ ] Get complete Razorpay test key from dashboard
- [ ] Update `.env` with complete key
- [ ] Restart development server (`npm run dev`)
- [ ] Clear browser cache or use incognito
- [ ] Test booking flow
- [ ] Check browser console for errors
- [ ] Try test card: 4111 1111 1111 1111

---

## 📞 Still Not Working?

### Check These:

1. **Browser Console Errors:**
   ```
   F12 → Console tab → Look for red errors
   ```

2. **Network Tab:**
   ```
   F12 → Network tab → Check if checkout.js loads
   ```

3. **Razorpay Dashboard:**
   ```
   Check if test mode is enabled
   Verify API keys are active
   ```

4. **Environment Variables:**
   ```bash
   # Verify env vars are loaded
   console.log(import.meta.env.VITE_RAZORPAY_KEY_ID)
   ```

5. **Ad Blockers:**
   ```
   Disable ad blockers
   Try incognito mode
   ```

---

## 📚 Razorpay Documentation

### Official Docs:
- [Standard Checkout](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/)
- [Test Cards](https://razorpay.com/docs/payments/payments/test-card-details/)
- [Orders API](https://razorpay.com/docs/api/orders/)
- [Payment Verification](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/verify-payment/)

### Important Notes:
- RazorpayX (mentioned in your doc) is for PAYOUTS, not payments
- For accepting payments, use Razorpay Payment Gateway
- Test mode has no real money transactions
- All test payments are simulated

---

## ✅ Expected Behavior After Fix

1. Click "Pay & Confirm Booking"
2. Razorpay popup opens immediately
3. Enter test card details
4. Payment succeeds
5. Signature verified via Edge Function
6. Booking confirmed
7. Success message shown

---

## 🎯 Next Steps

1. **Get Complete Key:**
   - Login to Razorpay Dashboard
   - Generate/copy complete test key
   - Update `.env` file

2. **Test Locally:**
   - Restart dev server
   - Test booking flow
   - Verify popup opens

3. **Deploy:**
   - Add key to hosting platform env vars
   - Test on production
   - Monitor for errors

---

**Status:** Issue identified and fixed! Update your Razorpay key and test. ✅
