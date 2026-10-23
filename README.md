# Foundarly - 1-on-1 Business Mentorship & Consulting Platform

Foundarly is a professional consulting platform connecting founders and businesses with verified expert consultants for private, encrypted 1-on-1 video consultations, scheduled follow-ups, and streamlined booking management.

---

## 📑 Table of Contents

1. [Technology Stack](#-technology-stack)
2. [Prerequisites & Quick Start](#-prerequisites--quick-start)
3. [Environment Variables & Secrets Configuration](#-environment-variables--secrets-configuration)
   - [Environment Variables Reference Table](#environment-variables-reference-table)
   - [Local Development Setup](#local-development-setup)
   - [Production Deployment Setup](#production-deployment-setup)
   - [Security & Secrets Policy](#security--secrets-policy)
4. [Development & Build Scripts](#-development--build-scripts)
5. [Authentication & Role-Based Access Control (RBAC)](#-authentication--role-based-access-control-rbac)
6. [Booking & Meeting Room Architecture](#-booking--meeting-room-architecture)
7. [7-Day Post-Session Rejoin Policy](#-7-day-post-session-rejoin-policy)
8. [Email Notification System](#-email-notification-system)
9. [In-App Support Chatbot & Knowledge Engine](#-in-app-support-chatbot--knowledge-engine)
10. [API Endpoints Reference](#-api-endpoints-reference)
11. [Testing & Quality Assurance](#-testing--quality-assurance)
12. [Troubleshooting & FAQs](#-troubleshooting--faqs)

---

## 🛠️ Technology Stack

- **Frontend**:
  - React 18 (`react: ^18.3.1`, `react-dom: ^18.3.1`)
  - TypeScript 5 (`typescript: ^5.8.3`)
  - Vite 5 (`vite: ^5.4.19`, `@vitejs/plugin-react-swc: ^3.7.2`)
  - Tailwind CSS v3 (`tailwindcss: ^3.4.17`, `tailwindcss-animate: ^1.0.7`)
  - Radix UI primitives & Lucide React icons (`lucide-react: ^0.462.0`)
  - Framer Motion & Motion (`motion: ^14.5.0`, `framer-motion: ^12.34.3`)
  - React Router DOM v6 (`react-router-dom: ^6.30.1`)
- **Backend / Server**:
  - Full-stack Node.js server with Express 5 (`server.ts`, `express: ^5.2.1`)
  - Vite middleware mounted during development (`npm run dev` running `tsx server.ts`)
  - Production bundled via esbuild (`npm run build` producing `dist/server.cjs`)
  - Serverless API route handlers under `/api/` (Vercel & Node compatible)
- **Database & Authentication**:
  - Supabase PostgreSQL with Row-Level Security (RLS) policies
  - Supabase Auth (JWT session management and role verification)
  - Database schema migrations under `database/` and `supabase/`
- **Video & Real-Time Rooms**:
  - Agora RTC SDK (`agora-rtc-sdk-ng: ^4.24.3`) with server-side token generation (`agora-access-token: ^2.0.4`)
  - Built-in WebRTC fallback engine (`src/services/webrtcService.ts`)
  - Screen sharing, participant presence tracking, and waiting alert notifications
- **Email Infrastructure**:
  - Nodemailer (`nodemailer: ^9.0.5`) with Titan SMTP (`smtp.titan.email`)
  - Responsive HTML and plain-text transactional email templates
  - Idempotent deduplication tracking (`data/sent_completion_emails.json`)
- **Payments**:
  - Razorpay checkout integration (`VITE_RAZORPAY_KEY_ID`)
  - Direct UPI payment verification workflow (`/upi-payment`, `/admin/upi-verification`)

---

## 🏁 Prerequisites & Quick Start

### Prerequisites
- **Node.js**: v18.x or v20.x+ (tested on Node.js 20+)
- **Package Manager**: `npm` (v9+) or `bun`
- **Git**

### Quick Start
```bash
# 1. Clone the repository
git clone https://github.com/lokeshnaivaidya-max/Foundarly.git
cd Foundarly

# 2. Install dependencies
npm install

# 3. Create your local environment file
cp .env.example .env

# 4. Fill in your credentials in .env (see table below)

# 5. Start the full-stack development server
npm run dev
```

The application will be accessible at: `http://localhost:3000`

---

## 🔐 Environment Variables & Secrets Configuration

### Environment Variables Reference Table

The table below documents every environment variable utilized by Foundarly. Variables prefixed with `VITE_` are bundled by Vite and exposed to the browser client; variables without `VITE_` are strictly private server-side secrets.

| Variable Name | Purpose & Usage | Classification | Scope | Example Placeholder |
| :--- | :--- | :--- | :--- | :--- |
| **`VITE_SUPABASE_URL`** | Supabase Project URL used for database and authentication requests | **Required** | Client & Server | `https://your-project-id.supabase.co` |
| **`VITE_SUPABASE_ANON_KEY`** | Supabase Anonymous Client Public Key (protected by RLS) | **Required** | Client & Server | `eyJhbGciOi...` or `sb_publishable_...` |
| **`SUPABASE_SERVICE_ROLE_KEY`** | Privileged Supabase service-role secret for admin backend operations | **Required** *(Server)* | **Server-Only Secret** | `your_supabase_service_role_secret_here` |
| **`ADMIN_EMAILS`** | Comma-separated allowlist of verified Super Administrator email addresses | **Required** *(Admin)* | **Server-Only Secret** | `admin@foundarly.com,owner@foundarly.com` |
| **`VITE_ADMIN_EMAILS`** | Client-side mirror of admin email allowlist for navigation hints | Optional | Client Public | `admin@foundarly.com` |
| **`SMTP_HOST`** | SMTP server hostname for transactional email delivery (Titan Mail) | **Required** *(Email)* | **Server-Only Secret** | `smtp.titan.email` |
| **`SMTP_PORT`** | SMTP port (`587` for STARTTLS / `465` for SSL) | **Required** *(Email)* | **Server-Only Secret** | `587` |
| **`SMTP_SECURE`** | Connection security (`false` for port 587 STARTTLS, `true` for 465) | Optional | Server-Only | `false` |
| **`SMTP_USER`** | Primary SMTP account username (mailbox address) | **Required** *(Email)* | **Server-Only Secret** | `hello@foundarlybusinessworld.in` |
| **`SMTP_PASS`** | Primary SMTP account password | **Required** *(Email)* | **Server-Only Secret** | `your_smtp_app_password_here` |
| **`FROM_EMAIL`** | Sender email address for outgoing messages | Optional | Server-Only | `hello@foundarlybusinessworld.in` |
| **`FROM_NAME`** | Sender display name for email recipients | Optional | Server-Only | `Foundarly` |
| **`EMAIL_FROM`** | Full RFC 5322 formatted sender string | Optional | Server-Only | `Foundarly <hello@foundarlybusinessworld.in>` |
| **`EMAIL_REPLY_TO`** | Reply-To address for client responses | Optional | Server-Only | `hello@foundarlybusinessworld.in` |
| **`SITE_URL`** | Canonical application URL for links in email notifications | **Required** | Server-Only | `https://www.foundarlybusinessworld.in` |
| **`APP_URL`** | Alternative alias for application base URL | Optional | Server-Only | `https://www.foundarlybusinessworld.in` |
| **`VITE_SITE_URL`** | Client-side canonical base URL | Optional | Client Public | `https://www.foundarlybusinessworld.in` |
| **`VITE_AGORA_APP_ID`** | Agora Project App ID for video room connection | Optional *(Video)* | Client & Server | `your_agora_app_id_here` |
| **`AGORA_APP_CERTIFICATE`** | Agora App Certificate for signing secure RTC tokens on the backend | Optional *(Video)* | **Server-Only Secret** | `your_agora_app_certificate_here` |
| **`VITE_RAZORPAY_KEY_ID`** | Razorpay public Key ID for checkout popup | Optional *(Pay)* | Client Public | `rzp_test_your_key_id_here` |
| **`GEMINI_API_KEY`** | Google Gemini API key for server diagnostics / AI capabilities | Optional *(AI)* | **Server-Only Secret** | `your_gemini_api_key_here` |
| **`PORT`** | HTTP server listening port (defaults to `3000`) | Optional | Server-Only | `3000` |
| **`HOST`** | HTTP server network interface bind address (defaults to `0.0.0.0`) | Optional | Server-Only | `0.0.0.0` |
| **`NODE_ENV`** | Node.js execution environment (`development` or `production`) | Optional | Server-Only | `development` |

---

### Local Development Setup

1. **Copy the Template**:
   ```bash
   cp .env.example .env
   ```

2. **Configure Provider Credentials**:
   - **Supabase**: Obtain your project URL and publishable `anon` key from your Supabase Dashboard under `Settings > API`.
   - **Supabase Service Role Key**: Obtain the `service_role` secret key from the same dashboard. Paste it only into `SUPABASE_SERVICE_ROLE_KEY` in `.env`.
   - **Admin Allowlist**: Add your administrative email address to `ADMIN_EMAILS` (and `VITE_ADMIN_EMAILS` if you want immediate client menu indicators).
   - **Titan SMTP**: Set `SMTP_HOST=smtp.titan.email`, `SMTP_PORT=587`, `SMTP_SECURE=false`, `SMTP_USER=hello@foundarlybusinessworld.in`, and your mailbox password in `SMTP_PASS`.
   - **Agora (Optional)**: If using authenticated video rooms, add your App ID to `VITE_AGORA_APP_ID` and your App Certificate to `AGORA_APP_CERTIFICATE`.
   - **Site URL**: For local development, set `SITE_URL=http://localhost:3000` and `APP_URL=http://localhost:3000`.

3. **Verify Git Protection**:
   Ensure `.env` is ignored by Git before making any commits:
   ```bash
   git status --ignored
   # .env must appear under Ignored files, never under Changes to be committed
   ```

---

### Production Deployment Setup

When deploying to production hosting platforms (e.g. Vercel, Netlify, Render, Railway, AWS, GCP Cloud Run):

1. **Configure Environment Settings via Provider UI**:
   - Do **NOT** upload a `.env` file to your server or push it to Git.
   - Go to your hosting provider's dashboard:
     - **Vercel**: Project Settings > Environment Variables
     - **Netlify**: Site configuration > Environment variables
     - **Render / Railway**: Service Dashboard > Environment
     - **Cloud Run / Docker**: Environment variable injection or Google Cloud Secret Manager
2. **Add Required Variables**:
   Configure all production variables from the table above:
   - `VITE_SUPABASE_URL` (e.g. `https://rfyxnshvtfswvaogjzwq.supabase.co`)
   - `VITE_SUPABASE_ANON_KEY` (public publishable key)
   - `SUPABASE_SERVICE_ROLE_KEY` (private service role secret)
   - `ADMIN_EMAILS` (comma-separated verified admins)
   - `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`
   - `SITE_URL` & `APP_URL` (`https://www.foundarlybusinessworld.in`)
   - `VITE_AGORA_APP_ID` & `AGORA_APP_CERTIFICATE` (if Agora video is enabled)
3. **Trigger Redeployment**:
   - Environment variables injected at build time (`VITE_*`) require a rebuild.
   - Always trigger a new deployment or click **Redeploy** after saving environment variables.
4. **Maintenance & .env.example Sync**:
   - Whenever a new configuration variable is introduced, add a commented placeholder entry to `.env.example`.

---

### Security & Secrets Policy

1. **Privileged Keys Must Remain Server-Side**:
   - `SUPABASE_SERVICE_ROLE_KEY`, `SMTP_PASS`, `AGORA_APP_CERTIFICATE`, and `ADMIN_PASSWORD` must **NEVER** be prefixed with `VITE_` or imported into files inside `src/`.
   - Vite bundles all `VITE_*` variables directly into public JavaScript chunks readable by anyone inspecting network traffic or page source.
2. **Client-Side Key Distinctions & RLS**:
   - `VITE_SUPABASE_ANON_KEY` is a public anonymous token designed for browser usage.
   - Public access is safely governed by PostgreSQL Row-Level Security (RLS) policies defined in the database.
   - Always verify RLS is enabled on all tables in Supabase (`profiles`, `bookings`, `consultants`, `reviews`, `upi_payments`, `payout_requests`).
3. **Audit Finding & Remediation (Agora App Certificate)**:
   - *Audit Finding*: Earlier versions of `src/services/agoraToken.ts` contained a client-side reference to `VITE_AGORA_APP_CERTIFICATE` and a fallback certificate.
   - *Remediation*: The client service was updated to strictly request ephemeral tokens from the backend endpoint `/api/agora/token`. The private certificate secret is now read exclusively server-side via `process.env.AGORA_APP_CERTIFICATE`.
4. **Never Commit Secrets**:
   - Never commit `.env`, `.env.local`, production secrets, UPI PINs, admin passwords, or real credentials to GitHub.
   - `.gitignore` is configured to ignore all `.env` variants (`.env`, `.env.*`, `.env*.local`) while explicitly preserving `.env.example`.

---

## 📜 Development & Build Scripts

All commands are defined in `package.json`:

```bash
# Start full-stack local server (Express + Vite middleware on port 3000)
npm run dev

# Run the complete automated test suite (11 test suites covering workflows)
npm test

# Run tests in watch mode
npm run test:watch

# Run ESLint validation
npm run lint

# Build production bundle (Vite static assets + esbuild server bundle)
npm run build

# Start the compiled production server
npm start

# Preview the Vite static production build locally
npm run preview
```

---

## 👥 Authentication & Role-Based Access Control (RBAC)

Foundarly implements a hierarchical role-based access system with strict permission boundaries:

```
┌────────────────────────────────────────────────────────┐
│                   Super Admin                          │
│  - Complete executive authority & admin management     │
│  - Financial controls, payout approvals & settings     │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│                 Developer Admin                        │
│  - Operational admin functions & developer logs        │
│  - Cannot manage administrators or self-promote        │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│                    Consultant                          │
│  - Availability management, bookings, earnings         │
│  - 7-day post-meeting follow-up direct confirmation    │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│                   Client / User                        │
│  - Public consultant discovery, booking & checkout     │
│  - Video room access & 7-day follow-up requests        │
└────────────────────────────────────────────────────────┘
```

### Route Protection Architecture
- Route access is governed by `ProtectedRoute.tsx` (`requireAdmin`, `requireSuperAdmin`, and `allowedRoles`).
- The router correctly imports and instantiates `useNavigate` from `react-router-dom` to handle authorized transitions, fallback redirects, and permission denial displays without runtime crashes.

---

## 🔄 Booking & Meeting Room Architecture

1. **Booking & Checkout**:
   - Client selects an approved expert consultant, session duration (30 or 60 min), and time slot.
   - Payment processed via direct UPI screenshot upload (`/upi-payment`) or Razorpay checkout.
   - Automated booking record created with canonical ID.
2. **Canonical Room ID Resolution**:
   - Room IDs are canonicalized to `foundarly-{bookingId}`.
   - Both client and consultant resolve to the exact same canonical room ID regardless of query parameters.
3. **Meeting Access Control & Join Window**:
   - **Upcoming**: Before the 5-minute pre-call window, room entry is locked with a real-time countdown timer.
   - **Live**: 5 minutes before scheduled start through scheduled duration, participants can enter the call.
   - **Join vs Rejoin**: The UI tracks individual join history per participant. First-time participants see **"Join Meeting"**; returning participants see **"Rejoin Meeting"**.

---

## ⏱️ 7-Day Post-Session Rejoin Policy

- **7-Day Eligibility Window**:
  - Following consultation completion, both client and consultant are authorized to re-enter the meeting room for **7 calendar days** (604,800,000 ms) for follow-up questions.
  - Calculated server-side via `calculateRejoinEligibility(booking, referenceDate)`.
- **Follow-Up Clarification Workflow**:
  - Within the 7-day window, clients can submit a structured follow-up request from `MyBookings`.
  - The assigned consultant can accept the proposed time, suggest an alternate time, or decline from the Consultant Dashboard.
- **Expiry**:
  - After 7 days, session access transitions to `expired` and room entry is rejected.

---

## 📧 Email Notification System

All transactional emails are sent via Titan SMTP (`smtp.titan.email`) using responsive HTML and plain-text templates:

1. **Booking Confirmation**: Dispatched to client and consultant upon booking confirmation (`/api/send-booking-email` with `type: 'confirmed'`).
2. **Booking Rejection / Cancellation**: Dispatched to client if a booking cannot be confirmed (`type: 'rejected'`).
3. **Participant Waiting Notice**: Dispatched when one party is waiting in the meeting room (`/api/meeting/notify-waiting`). Throttled by a 5-minute cooldown to prevent spam.
4. **Post-Session Completion Email (`type: 'completed'`)**:
   - Dispatched immediately after a genuine meeting completion is recorded.
   - Explains the **7-day follow-up clarification policy** with exact expiration dates and links.
   - **Idempotent Delivery**: Tracked via `completionEmailStorage` (`data/sent_completion_emails.json`) to prevent duplicate deliveries.

---

## 💬 In-App Support Chatbot & Knowledge Engine

Foundarly features an embedded, responsive support chatbot (`src/components/AIChatWidget.tsx`):
- **Curated Knowledge Engine**: Backed by `src/services/chatbotKnowledge.ts` covering platform FAQs, booking steps, payment methods, refund policies, consultant onboarding, and 7-day rejoin rules.
- **Privacy & Reliability**: Operates client-side with zero external API latency or risk of exposing backend API keys to browser sessions.
- **Quick Prompts & Navigation**: Supports direct action suggestions linking clients and consultants to relevant sections (e.g. `/consultants`, `/my-bookings`, `/apply-consultant`).

---

## 🔌 API Endpoints Reference

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Service status, database connectivity, and SMTP configuration diagnostic | No |
| `POST` | `/api/agora/token` | Generates secure signed Agora RTC token using server-side App Certificate | Yes |
| `POST` | `/api/meeting/validate-access` | Validates session authorization, 7-day eligibility, and participant history | Yes |
| `GET` | `/api/meeting/:roomId/access` | GET alias for meeting room access validation | Yes |
| `POST` | `/api/meeting/record-join` | Records participant entry into a meeting session | Yes |
| `POST` | `/api/meeting/notify-waiting` | Dispatches waiting alert email to absent participant (5-min cooldown) | Yes |
| `POST` | `/api/send-booking-email` | Handles confirmation, rejection, and post-session completion emails | Yes |
| `POST` | `/api/send-application-email`| Dispatches consultant application approval/rejection notifications | Admin |
| `POST` | `/api/verify-smtp` | Verifies Titan SMTP transporter credentials and connection | Admin |
| `POST` | `/api/send-test-email` | Sends diagnostic test email to verify mailbox delivery | Admin |
| `POST` | `/api/follow-ups/request` | Submits client 7-day follow-up consultation request | Client |
| `POST` | `/api/follow-ups/respond` | Consultant accepts, reschedules, or declines follow-up request | Consultant |

---

## 🧪 Testing & Quality Assurance

Automated tests verify all mission-critical workflows:

```bash
npm test
```

### Test Suites Covered
- `navigation-and-currency-transfer.test.ts`: Routing links, tab state preservation, regression tests ensuring `useNavigate` is cleanly imported in `ProtectedRoute.tsx` and all routing files, currency formatting.
- `role-hierarchy.test.ts`: 13-test role hierarchy matrix (Super Admin, Developer Admin, Consultant, Client, RLS query permissions, payout controls).
- `meeting-rejoin-and-email.test.ts`: 7-day rejoin calculation, join vs rejoin labels, canonical room IDs, idempotent completion emails.
- `review-and-followup-fixes.test.ts`: Review submission flow, moderation, follow-up request lifecycle, timing validation.
- `reschedule-workflow.test.ts`: Client reschedule requests, consultant approval/rejection, duplicate prevention.
- `consultant-availability-pricing.test.ts` & `consultant-self-availability.test.ts`: Slot calculation, pricing rules, availability storage.
- `knowledge-chatbot.test.ts`: Knowledge retrieval, prompt sanitization, secret redaction protection.
- `navbar-viewport-overflow.test.ts`: Responsive viewport navigation safety.

---

## ❓ Troubleshooting & FAQs

### 1. "useNavigate is not defined" when accessing `/admin`
- **Cause**: `src/components/ProtectedRoute.tsx` previously referenced `useNavigate()` without including it in the `react-router-dom` import statement.
- **Resolution**: Fixed in `src/components/ProtectedRoute.tsx` with regression test coverage in `test/navigation-and-currency-transfer.test.ts`.

### 2. Emails are not sending (`ECONNREFUSED` or `Invalid login`)
- **Check**: Verify `SMTP_USER` and `SMTP_PASS` in your hosting environment variables or `.env`.
- **Titan Mail**: Ensure `SMTP_HOST=smtp.titan.email`, `SMTP_PORT=587`, and `SMTP_SECURE=false`.
- **Diagnostic**: Call `/api/health` or use the Admin Developer Portal (`/admin/developer`) to test SMTP connectivity.

### 3. Agora Video Room: "Invalid Token" or Token Generation Failure
- **Check**: Verify `AGORA_APP_CERTIFICATE` is configured in your server environment variables.
- **Note**: The client requests tokens from `/api/agora/token`. Ensure the server process has access to `AGORA_APP_ID` and `AGORA_APP_CERTIFICATE`.

### 4. Admin Dashboard Access Denied
- **Check**: Verify the authenticated user's email address is included in `ADMIN_EMAILS` (comma-separated).
- **Database**: Ensure the user's record in `profiles` has `role = 'super_admin'`, `'developer_admin'`, or `'admin'`.
