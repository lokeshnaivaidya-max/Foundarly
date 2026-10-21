# Foundarly - 1-on-1 Business Mentorship & Consulting Platform

Foundarly is a professional consulting platform connecting founders and businesses with verified expert consultants for private, encrypted 1-on-1 video consultations, scheduled follow-ups, and streamlined booking management.

---

## 🛠️ Technology Stack

- **Frontend**: React 19 (`react: ^19.0.1`, `react-dom: ^19.0.1`), TypeScript 7 (`typescript: ^7.0.2`), Vite 8 (`vite: ^8.3.0`), Tailwind CSS v4 (`tailwindcss: ^4.3.3`, `@tailwindcss/vite: ^4.3.3`), Motion (`motion: ^12.23.24`), Lucide React icons (`lucide-react: ^0.546.0`).
- **Backend / Server**: 
  - Express 4 (`server.ts`) with development Vite middleware mounting on port 3000.
  - Serverless API route handlers under `/api/` (Vercel/Node compatible).
- **Database & Authentication**: Supabase (PostgreSQL, Supabase Auth, Row-Level Security, Database Migrations).
- **Video & Real-Time Rooms**: WebRTC and Agora video engine integration (`/meeting/:roomId`) with screen sharing, participant presence tracking, and waiting alerts.
- **Email Infrastructure**: Nodemailer via Titan SMTP (`smtp.titan.email`), with templated transactional emails for booking confirmations, rejections, participant waiting notices, consultant applications, and post-session follow-ups.
- **Payments**: Razorpay and direct UPI verification workflows.
- **Storage & State**: File-backed local persistence (`data/meeting_participants.json`, `data/sent_completion_emails.json`, `data/follow_up_requests.json`) with in-memory caching and client-side `localStorage` isolation.

---

## 🚀 Setup & Installation

### Prerequisites
- Node.js 18+ (tested on Node.js 20+)
- npm or bun

### 1. Clone & Install Dependencies
```bash
git clone <repository-url>
cd foundarly-app
npm install
```

### 2. Configure Environment Variables
Copy the example environment file and configure your keys:
```bash
cp .env.example .env
```

| Variable | Description | Example / Default |
| :--- | :--- | :--- |
| `VITE_SUPABASE_URL` | Supabase Project URL | `https://<project-ref>.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Supabase Anonymous Client Key | `sb_publishable_...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Service Role Secret (server-side only) | `eyJ...` |
| `ADMIN_EMAILS` / `VITE_ADMIN_EMAILS` | Comma-separated admin email allowlist | `admin@foundarly.com` |
| `SMTP_HOST` | Titan SMTP server | `smtp.titan.email` |
| `SMTP_PORT` | SMTP port (587 for STARTTLS, 465 for SSL) | `587` |
| `SMTP_SECURE` | Use SSL directly (`true` for 465, `false` for 587) | `false` |
| `SMTP_USER` | Titan mailbox address | `hello@foundarlybusinessworld.in` |
| `SMTP_PASS` | Titan mailbox password | *(secret)* |
| `FROM_EMAIL` | Sender email address | `hello@foundarlybusinessworld.in` |
| `FROM_NAME` | Sender display name | `Foundarly` |
| `EMAIL_FROM` | Full RFC 5322 From header | `Foundarly <hello@foundarlybusinessworld.in>` |
| `EMAIL_REPLY_TO` | Reply-To address | `hello@foundarlybusinessworld.in` |
| `SITE_URL` / `APP_URL` | Canonical application URL | `https://foundarlybusinessworld.in` |
| `VITE_RAZORPAY_KEY_ID` | Razorpay Key ID for payments | `rzp_test_...` |
| `VITE_AGORA_APP_ID` | Agora App ID for video rooms | *(optional Agora ID)* |
| `VITE_AGORA_APP_CERTIFICATE`| Agora App Certificate | *(optional Agora secret)* |
| `VITE_GEMINI_API_KEY` | Placeholder for Gemini API (not active in UI) | *(optional)* |

### 3. Development Server
```bash
# Starts Vite development server on port 3000
npm run dev

# Or run full-stack Node server with Express + Vite middleware
npx tsx server.ts
```

### 4. Build for Production
```bash
npm run build
```

---

## 👥 Authentication & Roles

Foundarly defines three distinct user personas with granular access control:

1. **Admin (`role = 'admin'`)**:
   - Verified via `requireAdminAuth` middleware using Supabase Auth JWT, database profile check (`profiles.role = 'admin'`), and verified email allowlist (`ADMIN_EMAILS`).
   - Access to booking administration, consultant application review, manual booking status override, and payout management.

2. **Consultant (`role = 'consultant'`)**:
   - Approved consultants linked via `consultants.user_id` or `consultants.email`.
   - Access to Consultant Dashboard (`/consultant-dashboard`), earnings statistics, session management, and direct 2-party follow-up confirmation.

3. **Client / End User (`role = 'client'`)**:
   - Access to public consultant directory, booking creation, checkout, My Bookings dashboard (`/my-bookings`), video consultations, and post-session follow-up requests.

---

## 🔄 Booking & Meeting Room Flow

1. **Booking & Payment**:
   - User selects an expert consultant, date, and preferred time slot.
   - Payment processed via Razorpay or direct UPI verification.
   - Booking record created in Supabase with status `pending` or `confirmed`.
   - Automated confirmation emails sent to both client and consultant with meeting details.

2. **Canonical Meeting Room Assignment**:
   - Room IDs are canonicalized to `foundarly-{bookingId}` (or the custom `booking.meeting_room_id`).
   - Regardless of whether accessed via raw UUID, slug, or prefixed URL, both client and consultant resolve to the **exact same canonical room ID**.

3. **Meeting Access Control & Join Window**:
   - **Upcoming**: Before the 5-minute pre-call window, access is blocked and a countdown timer is displayed.
   - **Live**: Starting 5 minutes before scheduled start through the scheduled duration, both participants can join the room.
   - **Waiting Notification**: When one participant joins, an automated waiting notice can be sent to notify the other party.

---

## 📹 Join vs Rejoin Behavior

The interface strictly differentiates between participants who have never entered a meeting versus returning participants:

- **First-Time Participant**:
  - If a participant has never joined that specific meeting, the action button strictly displays **"Join Meeting"** or **"Join Call"**.
  - Participants never see "Rejoin Meeting" or "Quick Rejoin" on their first visit.
- **Returning Participant**:
  - Once a participant has joined a meeting (recorded via `meetingParticipantStorage.recordJoin` and client storage `recordParticipantJoinLocal`), returning visits display **"Rejoin Meeting"** or **"Rejoin Call"**.
- **Participant History Isolation**:
  - Join records are isolated per participant ID, email, and role (`client` vs `consultant`). A client joining a meeting does not mark the consultant as having joined, ensuring each participant's button label accurately reflects their individual join history.

---

## ⏱️ 7-Day Post-Session Rejoin Policy

- **7-Day Eligibility Window**:
  - Following the conclusion of a scheduled consultation, both the client and assigned consultant are authorized to re-enter the same meeting room for **7 calendar days** (604,800,000 ms) for follow-up questions and clarifications.
  - Calculated server-side via `calculateRejoinEligibility(booking, referenceDate)`.
- **Follow-Up Clarification Requests**:
  - Within the 7-day window, clients can also submit a structured follow-up request with a proposed date, time, and topic from `MyBookings`.
  - The assigned consultant can directly accept the proposed time, propose an alternative time, or decline from the Consultant Dashboard without requiring administrator intervention.
- **Expiry**:
  - Once the 7-day window expires, session access transitions to `expired` and further room entries are rejected (`REJOIN_EXPIRED`).

---

## 📧 Email Notification System

All transactional emails are sent via Titan SMTP (`smtp.titan.email`) using responsive HTML and plain-text templates:

1. **Booking Confirmation**: Dispatched to client and consultant upon booking confirmation (`/api/send-booking-email` with `type: 'confirmed'`).
2. **Booking Rejection / Cancellation**: Dispatched to client if a booking cannot be confirmed (`type: 'rejected'`).
3. **Participant Waiting Notice**: Dispatched when one party is waiting in the meeting room (`/api/meeting/notify-waiting`). Throttled by a 5-minute cooldown to prevent spam.
4. **Post-Session Completion Email (`type: 'completed'`)**:
   - Dispatched immediately after a genuine meeting completion is recorded.
   - Expresses gratitude for attending the consultation.
   - Explains the **7-day follow-up clarification policy** and how to access the room.
   - Includes accurate expiry information (`rejoinExpiryFormatted` date and time) and direct links.
   - **Deduplication & Safety**: Idempotency is enforced by `completionEmailStorage` (`data/sent_completion_emails.json`) to prevent duplicate deliveries. The email is never triggered simply by viewing or closing the meeting page.

---

## 🔌 API Endpoints Summary

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Service status and SMTP configuration check |
| `POST` | `/api/meeting/validate-access` | Validates session authorization, 7-day eligibility, and participant join history |
| `GET` | `/api/meeting/:roomId/access` | GET alias for meeting room validation |
| `POST` | `/api/meeting/record-join` | Records participant entry into a meeting session |
| `POST` | `/api/meeting/notify-waiting` | Dispatches email alert to absent participant with cooldown protection |
| `POST` | `/api/send-booking-email` | Handles confirmation, rejection, and post-session completion emails |
| `POST` | `/api/send-application-email`| Dispatches consultant application approval/rejection notifications |
| `POST` | `/api/verify-smtp` | Verifies Titan SMTP transporter credentials |
| `POST` | `/api/send-test-email` | Sends diagnostic test email to verify mailbox delivery |
| `POST` | `/api/follow-ups/request` | Submits client 7-day follow-up request |
| `POST` | `/api/follow-ups/respond` | Consultant accepts, proposes alternative, or declines follow-up |

---

## 🤖 AI Assistant Investigation Findings

- **Status**: **Not implemented** in the active codebase.
- **Details**:
  - Older markdown documentation files (`AI-CHAT-SETUP.md`, `AI-IMPLEMENTATION-SUMMARY.md`, etc.) describe an earlier design for an AI chatbot widget using Gemini.
  - The `@google/genai` package is present in `package.json` dependencies and `VITE_GEMINI_API_KEY` is present in `.env.example`.
  - **No actual code implementation exists**: there are no AI chat components (e.g., `AIChatWidget.tsx`), no AI chat service files (`gemini.ts`), and no active AI routes in `server.ts` or `src/App.tsx`.
  - Per instructions, the AI assistant was investigated only and has not been modified or implemented.

---

## 🧪 Testing

Automated tests verify the 7-day session lifecycle, join vs rejoin behavior, canonical room ID resolution, and post-session email deduplication:

```bash
# Run unit and integration tests
npm test

# Build production bundle
npm run build
```

### Test Coverage
- `calculateRejoinEligibility`: Live, upcoming, 7-day rejoin eligible, and expired states.
- `getMeetingActionLabel`: "Join Meeting" for first-time participants vs "Rejoin Meeting" for returning participants.
- `meetingParticipantStorage`: Independent history tracking preventing cross-role false positives.
- `getCanonicalRoomId`: Uniform room ID resolution across client and consultant.
- `generateSessionCompletedEmailHTML` & `generateSessionCompletedEmailText`: Accurate 7-day policy, expiration dates, and access instructions.
- `completionEmailStorage`: Idempotency and duplicate suppression.

---

## 🌐 Deployment

### Vercel / Netlify
1. Connect repository to Vercel or Netlify.
2. Configure environment variables in the project dashboard (including `SMTP_PASS`, `SUPABASE_SERVICE_ROLE_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
3. Build command: `npm run build`
4. Output directory: `dist`

### Self-Hosted / Node.js
```bash
# Install dependencies
npm ci

# Build frontend static bundle
npm run build

# Start production server
NODE_ENV=production node server.ts
```
