# Agora Token Setup

## Install Required Package

You need to install the Agora token generation package:

```bash
npm install agora-access-token
```

or

```bash
yarn add agora-access-token
```

## Environment Variables Added

Added to your `.env` file:
- `VITE_AGORA_APP_CERTIFICATE=620cccf9c8e94046aa4da9359c6d7275`

## Security Note

⚠️ **IMPORTANT**: In production, you should:

1. **Move token generation to your backend server**
2. **Never expose App Certificate in frontend code**
3. **Create an API endpoint like `/api/agora/token`**
4. **Generate tokens on-demand from your server**

For development/testing, the current setup will work, but tokens are generated client-side which is not secure for production.

## Production Backend Example

```javascript
// backend/routes/agora.js
const { RtcTokenBuilder, RtcRole } = require('agora-access-token');

app.post('/api/agora/token', (req, res) => {
  const { channelName, uid } = req.body;
  
  const token = RtcTokenBuilder.buildTokenWithUid(
    process.env.AGORA_APP_ID,
    process.env.AGORA_APP_CERTIFICATE,
    channelName,
    uid,
    RtcRole.PUBLISHER,
    Math.floor(Date.now() / 1000) + 3600
  );
  
  res.json({ token });
});
```

## Current Status

✅ App ID configured
✅ App Certificate configured  
✅ Token generation service created
⏳ Need to install `agora-access-token` package
⏳ Need to update Agora service to use tokens