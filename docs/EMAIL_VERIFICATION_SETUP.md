# Foundarly — Supabase Email Verification Configuration Guide

## 1. Executive Summary & Audit Classification

- **Current Status**: **BLOCKED (Requires External Supabase Dashboard Toggle)** / **PASS (Client-Side Verification Flow Implemented)**
- **Audit Findings**:
  - The client application has been enhanced to inspect `data.session` upon signup. When email confirmation is required by Supabase, the user is presented with a dedicated "Verification Email Sent" banner instructing them to check their inbox, preventing premature navigation to protected routes.
  - The Forgot Password / Password Reset flow utilizes Supabase Auth recovery emails and redirects users securely to `/reset-password`.
  - Whether email confirmation is strictly enforced for new accounts depends on the external Supabase project settings. The platform owner must configure the following setting in the Supabase Dashboard.

---

## 2. Required Supabase Dashboard Settings

To verify and enforce email confirmation:

1. Open the [Supabase Dashboard](https://supabase.com/dashboard/project/rfyxnshvtfswvaogjzwq).
2. Go to **Authentication** > **Providers** > **Email**.
3. Locate the **"Confirm email"** toggle:
   - **Enabled (Recommended for Production)**: Users must verify their email before a session is issued. Unconfirmed users will receive error message `Email not confirmed` if attempting to sign in before clicking the link.
   - **Disabled**: Users receive an active session immediately upon signup without clicking an email link.
4. **Email Templates**:
   - In **Authentication** > **Email Templates** > **Confirm signup**:
     - Verify the Confirmation URL matches your live domain: `{{ .SiteURL }}/login`
   - In **Authentication** > **Email Templates** > **Reset Password**:
     - Verify the Reset URL matches: `{{ .SiteURL }}/reset-password`
5. **SMTP Configuration**:
   - In **Project Settings** > **Authentication** > **SMTP Settings**:
     - By default, Supabase provides an internal testing mailer with rate limits (3-4 emails/hour).
     - For production reliability, configure custom SMTP (e.g., Titan Email `smtp.titan.email`, Port 587, User `hello@foundarlybusinessworld.in`).

---

## 3. Application Verification Matrix

| Flow | Client-Side Implementation | External Requirement | Status |
|------|---------------------------|----------------------|--------|
| Signup with Email Confirmation | Shows verification screen; prevents unauthenticated access | Supabase Dashboard "Confirm email" ON | BLOCKED (pending dashboard toggle) |
| Password Recovery Email | Dispatches reset email, enforces minimum password, invalid session guard | Supabase SMTP or custom mailer | PASS |
| Transactional Booking Emails | Titan SMTP Nodemailer API (`/api/send-booking-email`) | Valid `SMTP_PASS` in environment | PASS |
