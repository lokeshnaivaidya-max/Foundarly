# Agora Video Call Testing Guide

## Quick Start Testing

### 1. Start Development Server
```bash
npm run dev
```

### 2. Create Test Booking

1. Login as a user
2. Go to Consultants page
3. Book a session with any consultant
4. Note the meeting room ID (format: `foundarly-xxxxx`)

### 3. Test Video Call

#### Option A: Two Browser Windows (Same Computer)
1. Open first window: Login as the user who booked
2. Open second window (incognito): Login as the consultant
3. Both navigate to: `/meeting/foundarly-xxxxx`
4. Click "Join Video Call" in both windows
5. You should see each other!

#### Option B: Two Devices
1. Device 1: Login as user, join meeting
2. Device 2: Login as consultant, join meeting
3. Both should see/hear each other

## What to Test

### ✅ Basic Functionality
- [ ] Join meeting successfully
- [ ] See your own video (local)
- [ ] See other participant's video (remote)
- [ ] Hear other participant's audio
- [ ] Other participant can hear you

### ✅ Controls
- [ ] Mute button works (audio stops)
- [ ] Unmute button works (audio resumes)
- [ ] Video off button works (video stops, shows placeholder)
- [ ] Video on button works (video resumes)
- [ ] End call button works (leaves meeting)

### ✅ Timer Features
- [ ] Session timer appears when call starts
- [ ] Timer counts down correctly (MM:SS format)
- [ ] Timer turns yellow at 5 minutes
- [ ] Timer turns red and pulses at 1 minute
- [ ] Warning toast at 5 minutes
- [ ] Warning toast at 1 minute
- [ ] Warning toast at 30 seconds
- [ ] Call auto-ends when timer reaches 0:00

### ✅ UI/UX
- [ ] Video grid adapts to participant count
- [ ] Name labels show on videos
- [ ] "You" label on local video
- [ ] Smooth animations
- [ ] Responsive on mobile
- [ ] No layout shifts

### ✅ Edge Cases
- [ ] Rejoin after leaving works
- [ ] Multiple participants (3+ users) work
- [ ] Network interruption handling
- [ ] Camera/mic permission denied handling
- [ ] Leaving and coming back works

## Expected Behavior

### When You Join
```
1. Click "Join Video Call"
2. See "Connecting to video call..." toast
3. Browser asks for camera/mic permissions (first time)
4. See your video appear (local)
5. See "Connected to video call!" toast
6. Timer starts counting down
```

### When Another User Joins
```
1. See "Participant joined the meeting" toast
2. Their video appears in grid
3. Hear their audio automatically
4. Grid layout adjusts (1 col → 2 col split)
```

### When User Leaves
```
1. See "Participant left the meeting" toast
2. Their video disappears
3. Grid layout adjusts back
```

### When Timer Expires
```
1. Timer reaches 0:00
2. See "Session time has ended" toast
3. Call automatically ends
4. Redirect to review page
```

## Browser Console Logs

### Successful Join
```
=== START CALL FUNCTION CALLED ===
Booking: {id: "...", ...}
Joining Agora channel: foundarly-xxxxx
Successfully joined channel
Playing local video
Connected to video call!
```

### Remote User Joins
```
User 12345 joined
Participant joined the meeting
User 12345 published video
Playing remote video for user 12345
User 12345 published audio
Playing remote audio for user 12345
```

### Errors to Watch For
```
❌ "Failed to join channel" → Check App ID in .env
❌ "Failed to initialize Agora client" → SDK not installed
❌ "Permission denied" → User blocked camera/mic
❌ "Network error" → Check internet connection
```

## Troubleshooting

### Issue: "Video service not configured"
**Solution**: Check `.env` file has `VITE_AGORA_APP_ID`

### Issue: "Failed to join channel"
**Solutions**:
1. Verify App ID is correct: `d5eaf592322846eab2879d2bc086af78`
2. Check Agora Console for account status
3. Verify SDK is installed: `npm list agora-rtc-sdk-ng`

### Issue: No video/audio
**Solutions**:
1. Check browser permissions (camera/mic)
2. Try different browser (Chrome recommended)
3. Check device not in use by another app
4. Check browser console for errors

### Issue: Cannot see remote user
**Solutions**:
1. Verify both users in same channel (same meeting ID)
2. Check both users clicked "Join Video Call"
3. Wait 2-3 seconds for connection
4. Check browser console for subscription errors
5. Refresh both tabs

### Issue: Poor video quality
**Solutions**:
1. Check network speed (need 1+ Mbps)
2. Close other bandwidth-heavy apps
3. Move closer to WiFi router
4. Try wired connection

### Issue: Echo or feedback
**Solutions**:
1. Use headphones
2. Mute when not speaking
3. Don't have both tabs on same device with audio

## Testing Checklist

### Pre-Test Setup
- [ ] `.env` has `VITE_AGORA_APP_ID`
- [ ] SDK installed: `agora-rtc-sdk-ng` in package.json
- [ ] Dev server running: `npm run dev`
- [ ] Test booking created

### Basic Test (2 Users)
- [ ] User 1 joins meeting
- [ ] User 1 sees own video
- [ ] User 2 joins meeting
- [ ] User 2 sees own video
- [ ] Both users see each other
- [ ] Both users hear each other
- [ ] Mute/unmute works
- [ ] Video on/off works
- [ ] Timer counts down
- [ ] End call works

### Advanced Test (3+ Users)
- [ ] User 3 joins
- [ ] Grid layout adjusts
- [ ] All users see all videos
- [ ] All users hear all audio
- [ ] User leaves, grid adjusts
- [ ] Remaining users still connected

### Timer Test
- [ ] Create 5-minute booking
- [ ] Join call
- [ ] Wait for 5-min warning
- [ ] Wait for 1-min warning
- [ ] Wait for 30-sec warning
- [ ] Verify auto-end at 0:00
- [ ] Verify redirect to review

### Mobile Test
- [ ] Join on mobile browser
- [ ] Video works
- [ ] Audio works
- [ ] Controls work
- [ ] Layout responsive
- [ ] Timer visible

## Performance Metrics

### Good Performance
- Video latency: < 300ms
- Audio latency: < 200ms
- Connection time: < 3 seconds
- CPU usage: < 50%
- Memory usage: < 200MB

### Check Agora Console
1. Go to: https://console.agora.io
2. Login with your account
3. Check "Usage" for:
   - Active channels
   - Minutes used
   - Quality metrics
   - Error rates

## Next Steps After Testing

### If Everything Works ✅
1. Test with real users
2. Monitor Agora Console for usage
3. Plan for token authentication (production)
4. Consider adding features:
   - Screen sharing
   - Recording
   - Virtual backgrounds
   - Beauty filters

### If Issues Found ❌
1. Check browser console logs
2. Check Agora Console for errors
3. Review `AGORA-MIGRATION-COMPLETE.md`
4. Check `AGORA-IMPLEMENTATION-GUIDE.md`
5. Test with Agora demo app to isolate issue

## Production Readiness

### Before Going Live
- [ ] Token authentication implemented
- [ ] Error handling robust
- [ ] Analytics/monitoring set up
- [ ] Load testing completed
- [ ] Mobile testing completed
- [ ] Browser compatibility verified
- [ ] Fallback mechanisms in place
- [ ] Usage limits monitored

### Token Authentication (Required)
Currently using App ID only (works for testing). For production:
1. Create token generation endpoint
2. Generate tokens server-side
3. Pass token to `agoraService.join()`

See `AGORA-IMPLEMENTATION-GUIDE.md` for details.

## Support Resources

- **Agora Docs**: https://docs.agora.io/en/video-calling/get-started/get-started-sdk?platform=web
- **API Reference**: https://docs.agora.io/en/video-calling/reference/api?platform=web
- **Sample Code**: https://github.com/AgoraIO/API-Examples-Web
- **Console**: https://console.agora.io
- **Support**: support@agora.io

## Quick Debug Commands

### Check SDK Installed
```bash
npm list agora-rtc-sdk-ng
```

### Check Environment Variable
```bash
# In browser console
console.log(import.meta.env.VITE_AGORA_APP_ID)
```

### Enable Debug Logs
Add to Meeting.tsx (top of component):
```typescript
import AgoraRTC from "agora-rtc-sdk-ng";
AgoraRTC.setLogLevel(0); // 0=DEBUG, 1=INFO, 2=WARNING, 3=ERROR
```

---

**Ready to test!** Start with the basic 2-user test, then move to advanced scenarios.
