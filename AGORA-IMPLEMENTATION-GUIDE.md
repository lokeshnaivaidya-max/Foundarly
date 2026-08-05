# Agora Video SDK Implementation Guide

## Overview
This guide explains how to integrate Agora Video SDK into your consultant platform, replacing the current Jitsi implementation.

## Why Agora?

### Advantages over Jitsi:
- ✅ **Better Performance**: Lower latency, better video quality
- ✅ **More Control**: Full API control over video/audio
- ✅ **Professional**: Used by major companies (Clubhouse, Bunch, etc.)
- ✅ **Scalable**: Handles large numbers of participants
- ✅ **Features**: Screen sharing, recording, beauty filters, etc.
- ✅ **Analytics**: Built-in call quality monitoring
- ✅ **Support**: Professional support and documentation

## Setup Steps

### 1. Install Agora SDK

```bash
npm install agora-rtc-sdk-ng
```

### 2. Configuration

Already added to `.env`:
```env
VITE_AGORA_APP_ID=d5eaf592322846eab2879d2bc086af78
```

### 3. Files Created

- `src/services/agora.ts` - Agora service wrapper
- This guide document

## Implementation Plan

### Phase 1: Basic Integration (Current)
- [x] Install Agora SDK
- [x] Create Agora service wrapper
- [x] Add configuration
- [ ] Update Meeting.tsx to use Agora
- [ ] Test basic video call

### Phase 2: Features
- [ ] Screen sharing
- [ ] Recording
- [ ] Network quality indicators
- [ ] Beauty filters (optional)
- [ ] Virtual backgrounds (optional)

### Phase 3: Production
- [ ] Token generation server
- [ ] Call analytics
- [ ] Error handling
- [ ] Fallback mechanisms

## How Agora Works

### Basic Flow:
```
1. Initialize Agora Client
   ↓
2. Join Channel (with App ID + Channel Name)
   ↓
3. Create Local Tracks (audio + video)
   ↓
4. Publish Local Tracks
   ↓
5. Subscribe to Remote Users
   ↓
6. Play Remote Video/Audio
   ↓
7. Leave Channel & Cleanup
```

### Code Structure:

```typescript
// Initialize
const agoraService = new AgoraService();

// Join channel
await agoraService.join({
  appId: AGORA_APP_ID,
  channel: "meeting-room-id",
  token: null, // Optional for testing
  uid: userId
});

// Play local video
agoraService.playLocalVideo(containerElement);

// Handle remote users
client.on("user-published", async (user, mediaType) => {
  await agoraService.subscribeToUser(user, mediaType);
  if (mediaType === "video") {
    agoraService.playRemoteVideo(user, remoteContainer);
  }
  if (mediaType === "audio") {
    agoraService.playRemoteAudio(user);
  }
});

// Leave
await agoraService.leave();
```

## Agora Service API

### Methods:

#### `join(config: AgoraConfig)`
Join a channel with configuration.

**Parameters:**
- `appId`: Your Agora App ID
- `channel`: Channel name (use meeting_room_id)
- `token`: Optional authentication token
- `uid`: Optional user ID

**Returns:** Promise<void>

#### `createLocalTracks()`
Create local audio and video tracks.

**Returns:** Promise<void>

#### `publishLocalTracks()`
Publish local tracks to the channel.

**Returns:** Promise<void>

#### `playLocalVideo(container: HTMLElement | string)`
Play local video in a container.

**Parameters:**
- `container`: DOM element or element ID

#### `subscribeToUser(user, mediaType)`
Subscribe to a remote user's media.

**Parameters:**
- `user`: IAgoraRTCRemoteUser
- `mediaType`: "audio" | "video"

**Returns:** Promise<void>

#### `playRemoteVideo(user, container)`
Play remote user's video.

**Parameters:**
- `user`: IAgoraRTCRemoteUser
- `container`: DOM element or element ID

#### `playRemoteAudio(user)`
Play remote user's audio.

**Parameters:**
- `user`: IAgoraRTCRemoteUser

#### `toggleAudio(mute: boolean)`
Mute/unmute local audio.

**Parameters:**
- `mute`: true to mute, false to unmute

**Returns:** Promise<void>

#### `toggleVideo(enabled: boolean)`
Enable/disable local video.

**Parameters:**
- `enabled`: true to enable, false to disable

**Returns:** Promise<void>

#### `leave()`
Leave the channel and cleanup.

**Returns:** Promise<void>

## Integration with Meeting.tsx

### Current Structure:
```typescript
// OLD (Jitsi)
const jitsiRef = useRef<any>(null);
await loadJitsiScript();
jitsiRef.current = new window.JitsiMeetExternalAPI(...);
```

### New Structure:
```typescript
// NEW (Agora)
const [agoraClient] = useState(() => new AgoraService());

await agoraClient.join({
  appId: AGORA_CONFIG.appId,
  channel: roomId,
  uid: user.id
});

agoraClient.playLocalVideo("local-video-container");
```

## Event Handling

### Agora Events:

```typescript
const client = agoraClient.getClient();

// User joined
client.on("user-joined", (user) => {
  console.log("User joined:", user.uid);
});

// User published media
client.on("user-published", async (user, mediaType) => {
  await agoraClient.subscribeToUser(user, mediaType);
  
  if (mediaType === "video") {
    agoraClient.playRemoteVideo(user, `remote-${user.uid}`);
  }
  
  if (mediaType === "audio") {
    agoraClient.playRemoteAudio(user);
  }
});

// User unpublished media
client.on("user-unpublished", (user, mediaType) => {
  console.log(`User ${user.uid} unpublished ${mediaType}`);
  // Remove video container if needed
});

// User left
client.on("user-left", (user) => {
  console.log("User left:", user.uid);
  // Remove user's video container
});

// Network quality
client.on("network-quality", (stats) => {
  console.log("Network quality:", stats);
  // Show network indicator
});
```

## Token Authentication (Production)

For production, you need to generate tokens server-side.

### Token Server Setup:

1. **Create token generation endpoint:**
```typescript
// Backend API
POST /api/agora/token
Body: { channelName, uid, role }
Response: { token, expireTime }
```

2. **Use token in client:**
```typescript
const response = await fetch('/api/agora/token', {
  method: 'POST',
  body: JSON.stringify({
    channelName: roomId,
    uid: user.id,
    role: 'publisher'
  })
});

const { token } = await response.json();

await agoraClient.join({
  appId: AGORA_CONFIG.appId,
  channel: roomId,
  token: token,
  uid: user.id
});
```

### Token Generation (Node.js):

```javascript
const { RtcTokenBuilder, RtcRole } = require('agora-access-token');

function generateToken(channelName, uid, role) {
  const appId = process.env.AGORA_APP_ID;
  const appCertificate = process.env.AGORA_APP_CERTIFICATE;
  const expirationTimeInSeconds = 3600; // 1 hour
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

  return RtcTokenBuilder.buildTokenWithUid(
    appId,
    appCertificate,
    channelName,
    uid,
    role,
    privilegeExpiredTs
  );
}
```

## Testing

### Test Without Token (Development):

Agora allows testing without tokens for the first 10,000 minutes.

1. Use App ID only (no token)
2. Join channel with any channel name
3. Test with multiple browser tabs

### Test Checklist:

- [ ] Join channel successfully
- [ ] See local video
- [ ] Hear local audio
- [ ] See remote user's video
- [ ] Hear remote user's audio
- [ ] Mute/unmute works
- [ ] Video on/off works
- [ ] Leave channel cleanly
- [ ] Rejoin works
- [ ] Multiple users work
- [ ] Network quality indicators
- [ ] Timer countdown works
- [ ] Auto-end at time limit

## Troubleshooting

### Common Issues:

**1. "Failed to join channel"**
- Check App ID is correct
- Check channel name format
- Check network connectivity

**2. "No video/audio"**
- Check browser permissions
- Check camera/mic not in use
- Check device selection

**3. "Cannot see remote user"**
- Check both users joined same channel
- Check subscription logic
- Check video container exists

**4. "Poor video quality"**
- Check network quality
- Adjust video profile
- Check CPU usage

### Debug Mode:

```typescript
// Enable Agora debug logs
AgoraRTC.setLogLevel(0); // 0 = DEBUG, 1 = INFO, 2 = WARNING, 3 = ERROR
```

## Performance Optimization

### Video Profiles:

```typescript
// HD video
await localVideoTrack.setEncoderConfiguration({
  width: 1280,
  height: 720,
  frameRate: 30,
  bitrateMin: 600,
  bitrateMax: 1000,
});

// SD video (better for poor networks)
await localVideoTrack.setEncoderConfiguration({
  width: 640,
  height: 480,
  frameRate: 15,
  bitrateMin: 200,
  bitrateMax: 500,
});
```

### Network Adaptation:

```typescript
// Monitor network quality
client.on("network-quality", (stats) => {
  if (stats.downlinkNetworkQuality > 3) {
    // Poor network, reduce quality
    localVideoTrack.setEncoderConfiguration("480p_1");
  }
});
```

## Cost Estimation

### Agora Pricing:
- **Free Tier**: 10,000 minutes/month
- **Video HD**: ~$0.99 per 1,000 minutes
- **Audio Only**: ~$0.99 per 1,000 minutes

### Example Costs:
- 100 sessions/month × 60 min = 6,000 min = **FREE**
- 500 sessions/month × 60 min = 30,000 min = **~$20/month**
- 1,000 sessions/month × 60 min = 60,000 min = **~$50/month**

Much cheaper than hiring video infrastructure team!

## Next Steps

1. **Install SDK**: `npm install agora-rtc-sdk-ng`
2. **Test basic call**: Update Meeting.tsx
3. **Add features**: Screen share, recording
4. **Production**: Set up token server
5. **Monitor**: Add analytics

## Resources

- [Agora Docs](https://docs.agora.io/en/video-calling/get-started/get-started-sdk?platform=web)
- [API Reference](https://docs.agora.io/en/video-calling/reference/api?platform=web)
- [Sample Projects](https://github.com/AgoraIO/API-Examples-Web)
- [Token Generator](https://webdemo.agora.io/token-builder/)

## Support

If you encounter issues:
1. Check Agora Console for usage/errors
2. Review browser console logs
3. Test with Agora demo app
4. Contact Agora support (very responsive!)

---

**Status**: Ready to implement in Meeting.tsx
**Next**: Update Meeting page to use Agora instead of Jitsi
