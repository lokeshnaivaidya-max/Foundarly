# 🚀 Foundarly - Expert Business Consultation Platform

A modern, secure, and SEO-optimized platform connecting businesses with expert consultants for 1-on-1 video consultations.

---

## ✨ Features

### 🎯 Core Features
- **1-on-1 Video Consultations** - Powered by Agora SDK
- **Secure Payment Processing** - Razorpay integration with signature verification
- **Real-time Booking System** - Instant confirmation and scheduling
- **AI-Powered Chat** - Google Gemini integration for assistance
- **Admin Dashboard** - Complete booking and consultant management
- **Email Notifications** - Automated booking confirmations

### 🔒 Security
- Enterprise-grade input validation and sanitization
- Rate limiting (frontend & backend)
- HMAC SHA256 payment verification
- Row Level Security (RLS) on database
- Security headers (CSP, HSTS, X-Frame-Options)
- Audit logging system

### 🎯 SEO Optimized
- Comprehensive meta tags (Open Graph, Twitter Cards)
- Structured data (Schema.org)
- XML sitemap and robots.txt
- Mobile-optimized and PWA-ready
- Fast loading with Core Web Vitals optimization

---

## 🛠️ Tech Stack

- **Frontend:** React 18, TypeScript, Vite
- **UI:** Tailwind CSS, shadcn/ui, Framer Motion
- **Backend:** Supabase (PostgreSQL, Auth, Edge Functions)
- **Payment:** Razorpay
- **Video:** Agora RTC SDK
- **AI:** Google Gemini
- **Email:** Gmail SMTP (Nodemailer)
- **Deployment:** Vercel/Netlify

---

## 📦 Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn
- Supabase account
- Razorpay account

### Installation

```bash
# Clone repository
git clone <repository-url>
cd foundarly-project

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env
# Edit .env with your keys

# Run development server
npm run dev
```

### Environment Variables

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_RAZORPAY_KEY_ID=your_razorpay_key_id
VITE_AGORA_APP_ID=your_agora_app_id
VITE_AGORA_APP_CERTIFICATE=your_agora_certificate
VITE_GEMINI_API_KEY=your_gemini_api_key
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=officialfoundarly@gmail.com
SMTP_PASS=your_google_app_password
EMAIL_FROM=Foundarly <officialfoundarly@gmail.com>
SITE_URL=http://localhost:3000
```

---

## 📚 Documentation

Complete documentation is available in the [`docs/`](docs/) folder:

### 🚀 Getting Started
- [Production Ready Summary](docs/PRODUCTION-READY-SUMMARY.md) - Complete overview
- [Quick Deploy](docs/QUICK-DEPLOY.md) - Fast deployment guide
- [Deploy Commands](docs/DEPLOY-COMMANDS.md) - All commands reference

### 🔒 Security & Production
- [Production Security](docs/PRODUCTION-SECURITY.md) - Security implementation
- [Production Deployment](docs/PRODUCTION-DEPLOYMENT.md) - Deployment guide

### 💳 Payment Integration
- [Razorpay Complete](docs/RAZORPAY-COMPLETE.md) - Payment setup
- [Razorpay Deployment](docs/RAZORPAY-DEPLOYMENT.md) - Deployment steps

### 🎯 SEO
- [SEO Implementation](docs/SEO-IMPLEMENTATION.md) - Complete SEO guide
- [SEO Quick Start](docs/SEO-QUICK-START.md) - 5-minute setup

### 📖 Feature Guides
- [Consultant System](docs/CONSULTANT-SYSTEM-COMPLETE.md)
- [Meeting System](docs/MEETING-SYSTEM-GUIDE.md)
- [AI Chat](docs/AI-CHAT-IMPLEMENTATION-SUMMARY.md)
- [Admin Guide](docs/ADMIN-GUIDE.md)

**[View All Documentation →](docs/README.md)**

---

## 🚀 Deployment

### Quick Deploy

```bash
# Build for production
npm run build

# Deploy to Vercel
vercel --prod

# Or deploy to Netlify
netlify deploy --prod
```

### Database Setup

```sql
-- Run in Supabase SQL Editor
-- 1. Add Razorpay fields
\i database/add-razorpay-fields.sql

-- 2. Enable security
\i database/enable-rls-security.sql
```

### Edge Functions

```bash
# Deploy payment verification
supabase functions deploy verify-razorpay-payment --no-verify-jwt
```

**[Complete Deployment Guide →](docs/DEPLOY-COMMANDS.md)**

---

## 📊 Project Structure

```
foundarly-project/
├── src/
│   ├── components/       # React components
│   ├── pages/           # Page components
│   ├── services/        # API services
│   ├── contexts/        # React contexts
│   ├── utils/           # Utility functions
│   └── lib/             # Libraries & config
├── database/            # SQL migrations
├── supabase/
│   └── functions/       # Edge functions
├── public/              # Static assets
├── docs/                # Documentation
└── ...config files
```

---

## 🧪 Testing

```bash
# Run tests
npm run test

# Run tests in watch mode
npm run test:watch

# Security audit
npm audit
```

---

## 📈 Performance

- **Lighthouse Score:** 90+ (Performance, Accessibility, Best Practices, SEO)
- **Core Web Vitals:** All green
- **Page Load:** < 3s
- **First Contentful Paint:** < 1.5s

---

## 🔐 Security Features

- ✅ Input validation & sanitization
- ✅ Rate limiting
- ✅ CSRF protection
- ✅ XSS prevention
- ✅ SQL injection prevention (Supabase)
- ✅ Secure payment verification
- ✅ Row Level Security (RLS)
- ✅ Audit logging
- ✅ Security headers

**[Security Documentation →](docs/PRODUCTION-SECURITY.md)**

---

## 🎯 SEO Features

- ✅ Meta tags (title, description, keywords)
- ✅ Open Graph & Twitter Cards
- ✅ Structured data (Schema.org)
- ✅ XML sitemap
- ✅ Robots.txt
- ✅ Canonical URLs
- ✅ Mobile-optimized
- ✅ Fast loading

**[SEO Documentation →](docs/SEO-IMPLEMENTATION.md)**

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📝 License

This project is proprietary and confidential.

---

## 🆘 Support

- **Documentation:** [docs/README.md](docs/README.md)
- **Issues:** Check [troubleshooting guides](docs/)
- **Email:** support@foundarly.com

---

## 🎉 Acknowledgments

- [Supabase](https://supabase.com) - Backend infrastructure
- [Razorpay](https://razorpay.com) - Payment processing
- [Agora](https://www.agora.io) - Video SDK
- [shadcn/ui](https://ui.shadcn.com) - UI components
- [Vercel](https://vercel.com) - Hosting

---

## 📊 Status

- **Version:** 1.0.0
- **Status:** ✅ Production Ready
- **Last Updated:** 2024

---

**Built with ❤️ for connecting businesses with expert consultants**
