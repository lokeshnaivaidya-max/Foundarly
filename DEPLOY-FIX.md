# Netlify Deploy Fix

## Changes Made

1. **vite.config.ts** - Added explicit root and publicDir configuration
2. **build-test.js** - Pre-build script to verify all files exist
3. **package.json** - Added prebuild script for debugging

## Build Settings (Netlify Dashboard)

```
Build command: npm run build
Publish directory: dist
```

## Environment Variables Required

```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

## If Build Still Fails

Check the build log for the prebuild output. It will show which files are missing.

The issue appears to be that Vite cannot resolve `/src/main.tsx` from `index.html`.

## Alternative: Use Vercel or Other Platform

If Netlify continues to have issues, consider deploying to:
- Vercel (better Vite support)
- Cloudflare Pages
- GitHub Pages with GitHub Actions
