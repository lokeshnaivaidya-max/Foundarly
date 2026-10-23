<div align="center">

# Foundarly

**1-on-1 Business Mentorship & Expert Consulting Platform**

Connect founders, entrepreneurs, and teams with verified industry experts for private video consultations, structured 7-day post-meeting follow-ups, and streamlined scheduling.

[![Tests Passing](https://img.shields.io/badge/tests-114%20passed-success?style=flat-square)](./test)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.3-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-5.4-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-3.4-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Express](https://img.shields.io/badge/Express-5.2-000000?style=flat-square&logo=express&logoColor=white)](https://expressjs.com/)
[![Supabase](https://img.shields.io/badge/Supabase-Auth%20%26%20RLS-3ECF8E?style=flat-square&logo=supabase&logoColor=white)](https://supabase.com/)

[Live Platform](https://www.foundarlybusinessworld.in) • [Explore Experts](https://www.foundarlybusinessworld.in/consultants) • [Admin Portal](https://www.foundarlybusinessworld.in/admin)

</div>

---

## 📋 Table of Contents

- [About Foundarly](#-about-foundarly)
- [Key Features](#-key-features)
  - [Client / Founder Experience](#client--founder-experience)
  - [Consultant Experience](#consultant-experience)
  - [Administrative Operations](#administrative-operations)
- [Technology Stack](#-technology-stack)
- [Platform Preview](#-platform-preview)
- [Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation & Quick Start](#installation--quick-start)
- [Environment Variables Configuration](#-environment-variables-configuration)
  - [Security Notice](#-security-notice)
  - [Supabase Client Configuration](#1-supabase-client-configuration)
  - [Server-Only Supabase Credentials](#2-server-only-supabase-credentials)
  - [Administrator Authorization](#3-administrator-authorization)
  - [Email Infrastructure (Titan SMTP)](#4-email-infrastructure-titan-smtp)
  - [Agora Video Engine](#5-agora-video-engine)
  - [Site URL & Runtime Settings](#6-site-url--runtime-settings)
  - [Optional Integrations](#7-optional-integrations)
  - [Local vs. Production Setup](#local-vs-production-setup)
- [Development Commands](#-development-commands)
- [Architecture & Project Structure](#-architecture--project-structure)
- [Security & Access Control](#-security--access-control)
- [Testing & Quality Assurance](#-testing--quality-assurance)
- [Deployment Guide](#-deployment-guide)
- [Troubleshooting](#-troubleshooting)
- [License & Contributions](#-license--contributions)

---

## 💡 About Foundarly

Foundarly is an end-to-end consulting ecosystem designed to make high-impact business advice accessible, structured, and accountable. Rather than one-off, transactional calls, Foundarly bridges founders with seasoned advisors across Strategy, Fundraising, Go-To-Market, Product, and Finance with an integrated **7-day post-meeting clarification window**.

- **Founders & Leaders**: Discover verified domain mentors, schedule synchronized time slots, pay seamlessly via direct UPI or cards, and consult via encrypted video rooms.
- **Consultants**: Define availability windows, publish hourly and 30-minute rates, review booking requests, confirm follow-ups, and manage payouts.
- **Platform Operators**: Verify payments, approve consultant credentials, review customer feedback, and audit platform health with comprehensive role hierarchy.

---

## ✨ Key Features

### Client / Founder Experience
- **Verified Expert Directory**: Browse mentors filtered by domain, rate, ratings, and language.
- **Interactive Booking**: Real-time slot picker with timezone synchronization and duration selection (30 or 60 min).
- **Flexible Payments**: Seamless checkout supporting direct manual UPI payment (instant QR code and transaction screenshot upload) and Razorpay.
- **Private Video Rooms**: Canonical room URL (`/meeting/:roomId`) with WebRTC and Agora engines, screen sharing, and participant waiting notifications.
- **7-Day Rejoin Policy**: Re-enter the same meeting room for 7 calendar days post-call for quick clarifications.
- **Structured Follow-Up Requests**: Submit formal follow-up timing proposals from the `MyBookings` portal.
- **In-App Support Chatbot**: Instant answers to platform queries via an embedded client-side knowledge assistant.

### Consultant Experience
- **Consultant Dashboard**: Unified view of upcoming consultations, completed sessions, and client details (`/consultant/dashboard`).
- **Availability & Pricing Control**: Configure active days, daily slot limits, and custom pricing tiers.
- **Direct Follow-Up Management**: Accept, reschedule, or decline client 7-day follow-up requests without administrator intervention.
- **Earnings & Payout Tracking**: Transparent breakdown of completed consultation revenues and payout statuses.

### Administrative Operations
- **Role Hierarchy**: Strict separation between **Super Administrators** (financial payouts, administrator provisioning, settings) and **Developer Admins** (operational triage, logs, health checks).
- **UPI Payment Verification Portal**: Dedicated queue (`/admin/upi-verification`) to inspect payment screenshots, match transaction references (UTR), and approve bookings.
- **Consultant Vetting**: Application review workflow to approve, request revisions, or reject prospective mentors.
- **Developer & Health Suite**: Live diagnostics for SMTP connectivity, database health, sanitized server logs, and error tracing.

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend Framework** | React 18.3, TypeScript 5.8, Vite 5.4 |
| **Routing & UI** | React Router DOM 6.30, Tailwind CSS 3.4, Radix UI Primitives, Lucide Icons |
| **Animations** | Framer Motion 12.34, Motion 14.5 |
| **Full-Stack Server** | Node.js 20+, Express 5.2, Vite Dev Middleware, esbuild CJS production bundler |
| **Database & Auth** | Supabase (PostgreSQL, Supabase Auth JWT, Row-Level Security) |
| **Video & RTC** | Agora RTC SDK (`agora-rtc-sdk-ng`), server-side token builder (`agora-access-token`), WebRTC fallback |
| **Email Delivery** | Nodemailer 9.0 with Titan SMTP (`smtp.titan.email`), idempotent file logging |
| **Payments** | Manual UPI workflow with client-side QR generation, Razorpay checkout modal |
| **Testing** | Node.js native test runner (`tsx --test`), 114 automated test suites |

---

## 🖼️ Platform Preview

<div align="center">
  <img src="public/og-image.jpg" alt="Foundarly Platform Preview" width="800" style="border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);" />
</div>

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v18.18+ or v20.x LTS (recommended)
- **Package Manager**: `npm` (v9+) or `bun`
- **Supabase Account**: An active Supabase project with PostgreSQL and Auth enabled

### Installation & Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/lokeshnaivaidya-max/Foundarly.git
cd Foundarly

# 2. Install dependencies
npm install

# 3. Create your local environment file
cp .env.example .env

# 4. Fill in your credentials in .env (refer to section below)

# 5. Start the full-stack development server (Express + Vite on port 3000)
npm run dev
```

Visit `http://localhost:3000` in your browser.

---

## 🔐 Environment Variables Configuration

### ⚠️ Security Notice

> **Critical Warning**: Never commit real secrets. Store privileged credentials only in server-side environment variables or your hosting provider's secret manager.
> - **Client-Side Variables (`VITE_*`)**: Are bundled into client JavaScript and exposed publicly in the browser. Never put service-role keys, SMTP passwords, or private certificates into `VITE_*` variables.
> - **Server-Side Variables**: Are accessible only to Node.js backend processes (`server.ts`, `/api/*`) and are never sent to the browser.
> - **Public Anon Keys**: The Supabase anon key is safe for browser usage **only when protected by Row-Level Security (RLS) policies**.

---

### 1. Supabase Client Configuration
Used by browser code to query PostgreSQL via Supabase Auth and RLS.

| Variable | Purpose | Status | Scope | Safe Placeholder |
| :--- | :--- | :--- | :--- | :--- |
| `VITE_SUPABASE_URL` | Supabase project URL | **Required** | Public Client | `https://your-project.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Public client anon key | **Required** | Public Client | `your_supabase_anon_key_here` |

---

### 2. Server-Only Supabase Credentials
Used exclusively by backend endpoints (`/api/*`, `server.ts`) for administrative workflows.

| Variable | Purpose | Status | Scope | Safe Placeholder |
| :--- | :--- | :--- | :--- | :--- |
| `SUPABASE_SERVICE_ROLE_KEY` | Privileged key bypassing RLS | **Required** *(Server)* | **Server Secret** | `your_service_role_key_here` |

---

### 3. Administrator Authorization
Configures admin allowlists and setup credentials.

| Variable | Purpose | Status | Scope | Safe Placeholder |
| :--- | :--- | :--- | :--- | :--- |
| `ADMIN_EMAILS` | Comma-separated Super Admin emails | **Required** | **Server Secret** | `admin@foundarly.com,owner@foundarly.com` |
| `VITE_ADMIN_EMAILS` | Client mirror for UI navigation hints | Optional | Public Client | `admin@foundarly.com` |
| `ADMIN_PASSWORD` | Password for `setup-admin-user.js` | Optional | CLI/Setup | `your_secure_password_min_12_chars` |
| `DEV_ADMIN_PASSWORD` | Password for developer admin provisioning | Optional | CLI/Setup | `your_dev_password_min_12_chars` |

---

### 4. Email Infrastructure (Titan SMTP)
Used by Nodemailer on the server to dispatch transactional emails.

| Variable | Purpose | Status | Scope | Safe Placeholder |
| :--- | :--- | :--- | :--- | :--- |
| `SMTP_HOST` | SMTP server host | **Required** | **Server Secret** | `smtp.titan.email` |
| `SMTP_PORT` | SMTP connection port | **Required** | **Server Secret** | `587` |
| `SMTP_SECURE` | Connection encryption (`false` for 587) | Optional | Server-Side | `false` |
| `SMTP_USER` | Mailbox email account | **Required** | **Server Secret** | `hello@foundarlybusinessworld.in` |
| `SMTP_PASS` | Mailbox password | **Required** | **Server Secret** | `your_smtp_app_password_here` |
| `FROM_EMAIL` | Outgoing sender email address | Optional | Server-Side | `hello@foundarlybusinessworld.in` |
| `FROM_NAME` | Outgoing sender display name | Optional | Server-Side | `Foundarly` |
| `EMAIL_FROM` | Full RFC 5322 formatted sender | Optional | Server-Side | `Foundarly <hello@foundarlybusinessworld.in>` |
| `EMAIL_REPLY_TO` | Reply-To mailbox address | Optional | Server-Side | `hello@foundarlybusinessworld.in` |

---

### 5. Agora Video Engine
Generates signed ephemeral RTC tokens for video rooms via `/api/agora/token`.

| Variable | Purpose | Status | Scope | Safe Placeholder |
| :--- | :--- | :--- | :--- | :--- |
| `VITE_AGORA_APP_ID` | Agora App ID for client SDK | Optional | Public Client | `your_agora_app_id_here` |
| `AGORA_APP_ID` | Agora App ID for backend token generator | Optional | Server-Side | `your_agora_app_id_here` |
| `AGORA_APP_CERTIFICATE` | Private signing certificate | Optional | **Server Secret** | `your_agora_certificate_here` |

---

### 6. Site URL & Runtime Settings
Defines application base URLs used in email links and meeting redirects.

| Variable | Purpose | Status | Scope | Safe Placeholder |
| :--- | :--- | :--- | :--- | :--- |
| `SITE_URL` | Canonical site URL for email links | **Required** | Server-Side | `https://www.foundarlybusinessworld.in` |
| `APP_URL` | Application base URL alias | Optional | Server-Side | `https://www.foundarlybusinessworld.in` |
| `PORT` | Local HTTP server port (default: 3000) | Optional | Server-Side | `3000` |
| `HOST` | Local HTTP host bind address | Optional | Server-Side | `0.0.0.0` |
| `NODE_ENV` | Environment mode | Optional | Server-Side | `development` or `production` |

---

### 7. Optional Integrations

| Variable | Purpose | Status | Scope | Safe Placeholder |
| :--- | :--- | :--- | :--- | :--- |
| `VITE_RAZORPAY_KEY_ID` | Public Key ID for Razorpay modal | Optional | Public Client | `rzp_test_your_key_id_here` |
| `GEMINI_API_KEY` | Server-side Gemini API key for diagnostics | Optional | **Server Secret** | `your_gemini_api_key_here` |

---

### Local vs. Production Setup

<details>
<summary><b>Local Development Setup Guide</b></summary>

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Populate `.env` with your Supabase local or cloud credentials.
3. For local email testing, configure your Titan SMTP account or use a local SMTP test tool.
4. Set `SITE_URL=http://localhost:3000` and `APP_URL=http://localhost:3000`.
5. Verify `.env` is ignored by Git:
   ```bash
   git status --ignored
   ```
</details>

<details>
<summary><b>Production Deployment Configuration Guide</b></summary>

1. Open your hosting provider dashboard (Vercel, Netlify, Render, Railway, or Cloud Run).
2. Navigate to **Environment Variables** / **Secrets**.
3. Add the server-side secrets:
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ADMIN_EMAILS`
   - `SMTP_USER` & `SMTP_PASS`
   - `AGORA_APP_CERTIFICATE` (if using Agora token signing)
   - `SITE_URL=https://www.foundarlybusinessworld.in`
4. Add client build variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_AGORA_APP_ID`
   - `VITE_RAZORPAY_KEY_ID`
5. **Always trigger a new deployment** after updating environment variables so Vite bundles the client settings and Node loads server secrets.
</details>

---

## 💻 Development Commands

All scripts are configured in `package.json`:

```bash
# Start full-stack development server with Vite middleware on port 3000
npm run dev

# Run all 11 automated test suites (114 tests)
npm test

# Run tests in watch mode
npm run test:watch

# Run ESLint across code files
npm run lint

# Build production bundle (Vite frontend bundle + esbuild server bundle)
npm run build

# Start the compiled production server
npm start

# Preview production build assets locally
npm run preview
```

---

## 🏛️ Architecture & Project Structure

Foundarly follows a clear separation of concerns across client, full-stack server routes, and database migrations:

```
Foundarly/
├── api/                       # Serverless API endpoints (Vercel/Node compatible)
│   ├── agora/token.ts         # Secure Agora RTC token endpoint
│   ├── meeting/               # Meeting validation, join recording, waiting alerts
│   ├── send-booking-email.ts  # Transactional booking notifications
│   └── health.ts              # Service health and SMTP diagnostic endpoint
├── database/                  # SQL migration files and role setup scripts
├── public/                    # Static assets, branding logos, open-graph graphics
├── scripts/                   # CLI maintenance scripts (admin provisioning)
├── src/
│   ├── components/            # Reusable UI components (modals, forms, navigation)
│   │   ├── admin/             # Admin sidebar, layout, and overview panels
│   │   ├── kokonutui/         # Profile dropdown, theme switches, currency stepper
│   │   └── ui/                # Accessible Radix UI primitives
│   ├── contexts/              # React Context providers (Auth, Theme, RolePreview)
│   ├── lib/                   # Supabase client, authorization matrix, utilities
│   ├── pages/                 # Top-level application route views
│   │   ├── admin/             # Administrator management, verification, settings
│   │   ├── Booking.tsx        # Slot selection and consultation scheduling
│   │   ├── Meeting.tsx        # Video room consultation interface
│   │   ├── MyBookings.tsx     # Client consultation hub & 7-day follow-up
│   │   └── UPIPayment.tsx     # Manual UPI QR code & proof upload workflow
│   ├── server/                # Server-side mailer and local fallback storage
│   ├── services/              # API clients (meetings, bookings, UPI, chatbot)
│   └── utils/                 # Time slots, meeting rejoin logic, security helpers
├── test/                      # Node.js automated test suites
├── server.ts                  # Production full-stack Express server
└── vite.config.ts             # Vite configuration and plugin setup
```

---

## 🛡️ Security & Access Control

### 1. Multi-Tier Role Hierarchy
Foundarly enforces a strict 4-tier permission model audited via `src/lib/authorization.ts`:
- **Super Administrator**: Complete administrative authority, financial payout approvals, admin user provisioning, and platform settings.
- **Developer Administrator**: Operational admin dashboard access, developer diagnostics, and sanitized server logs. Strictly prevented from promoting accounts or managing admins.
- **Consultant**: Profile, availability, and session management. Direct approval/rejection of client 7-day follow-up requests.
- **Client / End User**: Consultation bookings, payment submissions, video room entry, and review submissions.

### 2. Route Protection & Navigation Safety
- Routes are protected via `<ProtectedRoute />` checking both Supabase Auth session state and database profile roles.
- `ProtectedRoute` imports and utilizes `useNavigate` from `react-router-dom` to cleanly navigate unauthorized users or display role-restricted access notices.

### 3. Payment Verification Security
- Manual UPI payments require client UTR/Reference ID and screenshot proof.
- Payment records enter a `pending` state until an administrator verifies the receipt against bank records in the Admin Verification portal.
- Bookings remain unconfirmed until payment verification is approved, preventing unauthorized meeting room access.

### 4. Meeting Access Isolation
- Access to video rooms is locked until 5 minutes before scheduled session time.
- Both participants resolve to the exact same canonical room ID (`foundarly-{bookingId}`).
- After the session completes, room re-entry is permitted for exactly **7 calendar days** (604,800,000 ms) before transitioning to `expired`.

---

## 🧪 Testing & Quality Assurance

Automated tests cover all core business logic, role boundaries, and routing imports:

```bash
npm test
```

### Verified Test Suites (114 passing tests)
1. **`navigation-and-currency-transfer.test.ts`**: Verifies routing paths, tab preservation, currency formatting, and includes regression checks ensuring `useNavigate` is cleanly imported across all routing components.
2. **`role-hierarchy.test.ts`**: Validates the 13-point permission matrix across Super Admin, Developer Admin, Consultant, and Client roles.
3. **`meeting-rejoin-and-email.test.ts`**: Checks 7-day rejoin eligibility calculation, "Join" vs "Rejoin" button labels, canonical room IDs, and idempotent completion emails.
4. **`review-and-followup-fixes.test.ts`**: Ensures clients cannot publish reviews without moderation, validates 7-day follow-up request lifecycles, and prevents duplicate submissions.
5. **`reschedule-workflow.test.ts`**: Verifies client reschedule requests and consultant approval workflows.
6. **`consultant-availability-pricing.test.ts`**: Tests slot calculations and pricing rules.
7. **`knowledge-chatbot.test.ts`**: Tests curated knowledge retrieval, query normalization, and redacts sensitive environment keys.
8. **`navbar-viewport-overflow.test.ts`**: Guarantees responsive layout integrity without horizontal page overflow.

---

## 🌐 Deployment Guide

### Recommended Platforms

#### 1. Vercel / Netlify
1. Connect the GitHub repository to your Vercel or Netlify project.
2. Set build command: `npm run build`.
3. Set output directory: `dist`.
4. Configure all environment variables in project settings (see [Production Setup](#local-vs-production-setup)).

#### 2. Self-Hosted Node.js / Docker
```bash
# 1. Install production dependencies
npm ci

# 2. Compile frontend and backend bundles
npm run build

# 3. Launch production server
NODE_ENV=production npm start
```

The production server starts on `http://0.0.0.0:3000` (or the port defined by `PORT`).

---

## 🔍 Troubleshooting

<details>
<summary><b>1. Error: "useNavigate is not defined" on /admin</b></summary>

- **Cause**: Occurred when `ProtectedRoute.tsx` used `useNavigate()` without importing it from `react-router-dom`.
- **Resolution**: Fully resolved in `src/components/ProtectedRoute.tsx` with automated regression tests in `test/navigation-and-currency-transfer.test.ts`.
</details>

<details>
<summary><b>2. Titan SMTP Connection Issues (ECONNREFUSED or Auth Failed)</b></summary>

- **Resolution**: Verify that `SMTP_HOST=smtp.titan.email`, `SMTP_PORT=587`, and `SMTP_SECURE=false`. Test SMTP connectivity using `/api/health` or via the Developer Portal at `/admin/developer`.
</details>

<details>
<summary><b>3. Agora Video Room: Token Generation Fails</b></summary>

- **Resolution**: Ensure `AGORA_APP_CERTIFICATE` and `AGORA_APP_ID` are configured as server environment variables. The server endpoint `/api/agora/token` signs tokens using `agora-access-token`.
</details>

<details>
<summary><b>4. Access Denied on Admin Portal</b></summary>

- **Resolution**: Confirm that your account email is listed in `ADMIN_EMAILS` (comma-separated in your server environment variables) and your user profile in Supabase has `role = 'super_admin'`, `'developer_admin'`, or `'admin'`.
</details>

---

## 📄 License & Contributions

- **Repository**: [https://github.com/lokeshnaivaidya-max/Foundarly](https://github.com/lokeshnaivaidya-max/Foundarly)
- **Author**: Lokesh Naivaidya (`lokesh.naivaidya@gmail.com`)
- **Contribution Policy**: Pull requests are welcome. Please ensure `npm test` and `npm run build` pass before submitting PRs.
