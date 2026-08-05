# ⚡ Quick Reference Card

Essential commands and links for daily development.

---

## 🚀 Development

```bash
# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run tests
npm run test
```

---

## 📚 Documentation

- **[Complete Docs](docs/README.md)** - All documentation
- **[Production Guide](docs/PRODUCTION-READY-SUMMARY.md)** - Production checklist
- **[Deploy Commands](docs/DEPLOY-COMMANDS.md)** - All deployment commands
- **[Security Guide](docs/PRODUCTION-SECURITY.md)** - Security features
- **[SEO Guide](docs/SEO-IMPLEMENTATION.md)** - SEO optimization

---

## 🔑 Environment Variables

```env
VITE_SUPABASE_URL=https://tzihsuzxwziirpkvxysr.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_c4jK0TXwjmReU0t0iCEHCw_bKDdjXxZ
VITE_RAZORPAY_KEY_ID=rzp_test_Sc4KU (test) / rzp_live_XXX (prod)
VITE_AGORA_APP_ID=aa0d1c4df33a4cddafaadf3c326d83d8
VITE_GEMINI_API_KEY=AIzaSyBPYPKT2FhbVBnqvrS_v3VX6ioYLHcX57g
VITE_SITE_URL=http://localhost:5173 (dev) / https://yourdomain.com (prod)
```

---

## 🗄️ Database

```bash
# Run in Supabase SQL Editor:
# 1. database/add-razorpay-fields.sql
# 2. database/enable-rls-security.sql
```

---

## ⚡ Edge Functions

```bash
# Deploy payment verification
supabase functions deploy verify-razorpay-payment --no-verify-jwt

# Set environment variable in Supabase Dashboard:
# RAZORPAY_KEY_SECRET = UsfLc2JkfeA7H8Qb6zkACQW4 (test)
```

---

## 🌐 Deployment

### Vercel
```bash
vercel --prod
```

### Netlify
```bash
netlify deploy --prod
```

---

## 🔍 Testing

```bash
# Security audit
npm audit

# Test payment flow
# Use card: 4111 1111 1111 1111, CVV: 123, Expiry: 12/25

# Check security headers
curl -I https://yourdomain.com | grep -i security

# Lighthouse audit
# Chrome DevTools → Lighthouse → Run audit
```

---

## 📊 Monitoring

- **Supabase Dashboard:** https://app.supabase.com
- **Razorpay Dashboard:** https://dashboard.razorpay.com
- **Google Search Console:** https://search.google.com/search-console
- **Google Analytics:** https://analytics.google.com

---

## 🆘 Quick Fixes

### Payment not working?
1. Check Razorpay keys in `.env`
2. Verify Edge Function is deployed
3. Check `RAZORPAY_KEY_SECRET` in Supabase

### Database errors?
1. Run RLS migration: `database/enable-rls-security.sql`
2. Check Supabase connection
3. Verify user permissions

### SEO not working?
1. Update domain in `index.html`
2. Submit sitemap to Google Search Console
3. Check `public/sitemap.xml` and `robots.txt`

---

## 📞 Support Links

- [Full Documentation](docs/README.md)
- [Troubleshooting](docs/DEPLOY-FIX.md)
- [Security Guide](docs/PRODUCTION-SECURITY.md)
- [Deploy Guide](docs/DEPLOY-COMMANDS.md)

---

**Bookmark this page for quick access! 🔖**
