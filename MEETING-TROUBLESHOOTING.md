# Meeting Video Call Troubleshooting Guide

## 🔍 Current Issue
Meeting page loads but video call doesn't start when clicking "Join Video Call" button.

## 📋 Debugging Steps

### Step 1: Check Browser Console
Open your browser's Developer Tools (F12) and check the Console tab for errors.

**What to look for:**
```
✅ "Loading Jitsi script..."
✅ "Jitsi script loaded successfully"
✅ "Starting video call..."
✅ "Initializing Jitsi with display name: [name]"
✅ "Video call container initialized"
✅ "Successfully joined video conference"

❌ Any red error messages
❌ "Failed to load Jitsi script"
❌ "Jitsi API failed to load"
```

### Step 2: Check Network Tab
In Developer Tools, go to Network tab and look for:

**Expected requests:**
```
✅ external_api.js (from meet.jit.si) - Status 200
✅ Other Jitsi resources loading
```

**If you see:**
```
❌ external_api.js - Status 404 or Failed
   → Jitsi server might be blocked or down
   
❌ CORS errors
   → Browser security blocking the request
```

### Step 3: Check Camera/Microphone Permissions

**Browser should prompt for:**
- Camera access
- Microphone access

**If not prompted:**
1. Click the lock icon in address bar
2. Check camera/mic permissions
3. Set to "Allow"
4. Refresh page

### Step 4: Test Jitsi Directly

Open a new tab and go to:
```
https://meet.jit.si/test-room-123
```

**If this works:**
- ✅ Jitsi is accessible
- ✅ Your browser supports it
- ✅ Camera/mic work
- → Issue is in our code

**If this doesn't work:**
- ❌ Network/firewall blocking Jitsi
- ❌ Browser compatibility issue
- ❌ Camera/mic hardware issue

## 🛠️ Common Fixes

### Fix 1: Clear Browser Cache
```
1. Press Ctrl+Shift+Delete (or Cmd+Shift+Delete on Mac)
2. Select "Cached images and files"
3. Click "Clear data"
4. Refresh the page
```

### Fix 2: Try Different Browser
Test in this order:
1. Chrome (best support)
2. Firefox
3. Edge
4. Safari (may have issues)

### Fix 3: Check HTTPS
Jitsi requires HTTPS in production. If testing locally:
```
✅ http://localhost:8081 - Should work
❌ http://192.168.x.x - May not work
```

### Fix 4: Disable Browser Extensions
Some extensions block video calls:
- Ad blockers
- Privacy extensions
- VPN extensions

**Test in Incognito/Private mode** to rule this out.

### Fix 5: Check Firewall/Antivirus
Some security software blocks WebRTC:
1. Temporarily disable antivirus
2. Test meeting again
3. If it works, add exception for meet.jit.si

## 🔧 Code-Level Debugging

### Add More Console Logs

I've already added extensive logging. Check console for:

```javascript
// You should see these logs in order:
1. "Starting video call..." 
2. "Loading Jitsi script..."
3. "Jitsi script loaded successfully"
4. "Initializing Jitsi with display name: [name]"
5. "Video call container initialized"
6. "Successfully joined video conference"
```

**If logs stop at a certain point**, that's where the issue is.

### Check Container Element

In console, run:
```javascript
document.querySelector('[ref="jitsi-container"]')
```

Should return the div element. If null, container isn't rendering.

### Check Jitsi API Loaded

In console, run:
```javascript
window.JitsiMeetExternalAPI
```

Should return a function. If undefined, script didn't load.

## 🚨 Specific Error Solutions

### Error: "Failed to load Jitsi script"
**Cause:** Network can't reach meet.jit.si
**Fix:** 
- Check internet connection
- Try different network (mobile hotspot)
- Check if meet.jit.si is accessible in your region

### Error: "Jitsi API failed to load"
**Cause:** Script loaded but API not initialized
**Fix:**
- Clear cache and reload
- Check browser console for JavaScript errors
- Try different browser

### Error: "NotAllowedError: Permission denied"
**Cause:** Camera/mic permissions denied
**Fix:**
1. Click lock icon in address bar
2. Reset permissions
3. Reload page
4. Allow when prompted

### Error: "NotFoundError: Requested device not found"
**Cause:** No camera/mic detected
**Fix:**
- Plug in webcam/headset
- Check device manager (Windows) or System Preferences (Mac)
- Restart browser

### Error: "NotReadableError: Could not start video source"
**Cause:** Camera in use by another app
**Fix:**
- Close other apps using camera (Zoom, Teams, Skype)
- Restart browser
- Restart computer if needed

## 📱 Mobile-Specific Issues

### iOS Safari
- May require user gesture to start video
- Ensure button click triggers startCall directly
- Check iOS version (needs iOS 14.3+)

### Android Chrome
- Usually works well
- Check Chrome version (needs 90+)
- Ensure camera permissions granted in Android settings

## 🧪 Testing Checklist

Run through this checklist:

- [ ] Browser console shows no errors
- [ ] Network tab shows external_api.js loaded (200 status)
- [ ] Camera/mic permissions granted
- [ ] https://meet.jit.si/test works in same browser
- [ ] Tested in Chrome (recommended)
- [ ] Tested in incognito mode
- [ ] No VPN or ad blocker active
- [ ] Internet connection stable
- [ ] Firewall not blocking WebRTC
- [ ] Meeting ID is valid (foundarly-xxxxx format)
- [ ] User has access to the booking
- [ ] Booking status is "confirmed"
- [ ] Meeting time is within join window

## 🔍 What to Check in Your Case

Based on your message, the meeting page loads correctly showing:
- ✅ Meeting Link
- ✅ Copy button
- ✅ "Session is ready to join" message
- ✅ "Join Video Call" button

**This means:**
- ✅ Meeting found in database
- ✅ Access control passed
- ✅ Time-based logic working (status = "live")
- ✅ UI rendering correctly

**The issue is likely:**
- ❌ Jitsi script not loading
- ❌ Camera/mic permissions
- ❌ Browser compatibility
- ❌ Network blocking Jitsi

## 🎯 Next Steps

1. **Open browser console** (F12)
2. **Click "Join Video Call"** button
3. **Watch console logs** - what's the last message you see?
4. **Check Network tab** - does external_api.js load?
5. **Report back** with:
   - Last console log message
   - Any error messages (red text)
   - Browser name and version
   - Operating system

## 💡 Quick Test

Try this in your browser console while on the meeting page:

```javascript
// Test 1: Check if Jitsi API is available
console.log("Jitsi API:", typeof window.JitsiMeetExternalAPI);

// Test 2: Manually load Jitsi script
const script = document.createElement('script');
script.src = 'https://meet.jit.si/external_api.js';
script.onload = () => console.log('✅ Jitsi loaded!');
script.onerror = () => console.log('❌ Jitsi failed to load');
document.head.appendChild(script);

// Test 3: Check container exists
console.log("Container:", document.querySelector('[style*="height"]'));
```

## 📞 Still Not Working?

If you've tried everything above and it still doesn't work, please provide:

1. **Browser Console Output** (copy all logs)
2. **Network Tab Screenshot** (showing external_api.js request)
3. **Browser & Version** (e.g., Chrome 120)
4. **Operating System** (e.g., Windows 11)
5. **Any Error Messages** (exact text)

This will help me identify the exact issue and provide a specific fix!

## ✅ Expected Working Flow

When everything works correctly, you should see:

1. Click "Join Video Call" button
2. Toast: "Loading video call..."
3. Browser prompts for camera/mic (first time only)
4. Black screen appears (Jitsi loading)
5. Jitsi interface loads with video preview
6. Toast: "Joined the meeting!"
7. You see yourself in the video
8. Controls appear at bottom (mute, video, screen share, etc.)

If you're not seeing this flow, use the debugging steps above to find where it breaks!
