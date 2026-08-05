# Agora Video Call - Quick Start

## ✅ Migration Complete!

Your meeting system now uses Agora Video SDK instead of Jitsi.

## What You Need to Know

### 1. It's Already Configured ✅
- Agora SDK installed: `agora-rtc-sdk-ng@4.24.3`
- App ID configured: `d5eaf592322846eab2879d2bc086af78`
- Service wrapper ready: `src/services/agora.ts`
- Meeting page updated: `src/pages/Meeting.tsx`

### 2. How to Test

**Simple 2-Tab Test:**
```bash
# Terminal 1: Start dev server
npm run dev

# Browser Tab 1: Login as user, create booking, join meeting
# Browser Tab 2 (incognito): Login as consultant, join same meeting
# Both should see/hear each other!
```

### 3. Key Features

✅ **Multi-user video calls** - See all participants in grid layout  
✅ **Audio/video controls** - Mute, unmute, video on/off  
✅ **Session timer** - Countdown with auto-end  
✅ **Access control** - Only booked user + consultant can join  
✅ **Responsive design** - Works on desktop and mobile  
✅ **Real-time sync** - Instant participant join/leave notifications  

### 4. What Changed from Jitsi

| Feature | Jitsi (Old) | Agora (New) |
|---------|-------------|-------------|
| Video Quality | Good | Better |
| Latency | ~500ms | ~200ms |
| Control | Limited | Full API |
| Customization | Basic | Advanced |
| Scalability | Good | Excellent |
| Support | Community | Professional |
| Cost | Free | Free tier + paid |

### 5. Free Tier Limits

- **10,000 minutes/month FREE**
- After that: ~$0.99 per 1,000 minutes
- Example: 100 sessions × 60 min = 6,000 min = **FREE**

### 6. Testing Checklist

Quick test (5 minutes):
- [ ] Join meeting in two tabs
- [ ] See both videos
- [ ] Hear both audio
- [ ] Test mute/unmute
- [ ] Test video on/off
- [ ] Test end call

Full test (15 minutes):
- [ ] Test timer countdown
- [ ] Test auto-end at time limit
- [ ] Test 3+ participants
- [ ] Test on mobile
- [ ] Test network interruption

### 7. Common Issues & Fixes

**"Video service not configured"**
→ Check `.env` has `VITE_AGORA_APP_ID`

**"Cannot see remote user"**
→ Both users must click "Join Video Call"
→ Wait 2-3 seconds for connection

**"No audio/video"**
→ Check browser permissions (camera/mic)
→ Try Chrome (best compatibility)

**"Poor quality"**
→ Check network speed (need 1+ Mbps)
→ Close other apps using bandwidth

### 8. Browser Console Logs

**Success looks like:**
```
=== START CALL FUNCTION CALLED ===
Joining Agora channel: foundarly-xxxxx
Successfully joined channel
Playing local video
Connected to video call!
User 12345 joined
Participant joined the meeting
```

**Errors look like:**
```
❌ Failed to join channel
❌ Permission denied
❌ Network error
```

### 9. Production Considerations

**For Testing (Current Setup):**
- ✅ Using App ID only
- ✅ Works for development
- ✅ Free tier: 10,000 min/month

**For Production (Future):**
- ⚠️ Need token authentication
- ⚠️ Generate tokens server-side
- ⚠️ More secure, prevents abuse

See `AGORA-IMPLEMENTATION-GUIDE.md` for token setup.

### 10. Next Steps

**Immediate:**
1. Test with 2 users (different tabs)
2. Verify video/audio works
3. Test all controls

**Soon:**
1. Test with real users
2. Monitor usage in Agora Console
3. Test on mobile devices

**Later:**
1. Implement token authentication
2. Add screen sharing
3. Add recording (optional)
4. Add analytics

### 11. Documentation

- **Testing Guide**: `AGORA-TESTING-GUIDE.md` - Detailed testing instructions
- **Implementation Guide**: `AGORA-IMPLEMENTATION-GUIDE.md` - Technical details
- **Migration Summary**: `AGORA-MIGRATION-COMPLETE.md` - What changed

### 12. Support

**Agora Resources:**
- Console: https://console.agora.io
- Docs: https://docs.agora.io
- Samples: https://github.com/AgoraIO/API-Examples-Web

**Your Files:**
- Service: `src/services/agora.ts`
- Meeting Page: `src/pages/Meeting.tsx`
- Config: `.env` (VITE_AGORA_APP_ID)

---

## 🚀 Ready to Test!

1. Start server: `npm run dev`
2. Create booking
3. Open meeting in 2 tabs
4. Click "Join Video Call" in both
5. See magic happen! ✨

**Questions?** Check the documentation files or Agora docs.
