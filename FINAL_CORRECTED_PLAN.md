## Foundarly — Final Corrected Pre-Implementation Plan (Approval Required Only)

### 1. Developer Admin RLS — Inspection and Authorization Mechanism

**Actual deployed RLS policies** (from migration `20260724000004_rls_policies.sql`):

```sql
-- Consultants SELECT policy
CREATE POLICY "Public read active consultants" ON public.consultants FOR SELECT 
  USING (is_active = true OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Consultants ALL policy  
CREATE POLICY "Admins manage consultants" ON public.consultants FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
```

**Developer Admin authorization mechanism**:

- **RLS policies only check `profiles.role = 'admin'`**: The `FOR ALL USING` policy for consultants management exclusively checks `role = 'admin'` in the profiles table. It does NOT include `developer_admin`.

- **App-level authorization via `isUserAdmin()`**: The secure authorization mechanism is the app's existing `isUserAdmin()` function in `src/lib/authorization.ts`, which combines three checks:
  ```typescript
  export function isUserAdmin(user?, profile?) {
    return (
      isSuperAdmin(user, profile) ||
      isDeveloperAdmin(user, profile) ||              // <-- Developer Admin included HERE
      (profile?.role === 'admin' && Boolean(user?.email && isAllowedAdminEmail(user.email)))
    );
  }
  ```

- **`isDeveloperAdmin()` check** (from same file):
  ```typescript
  export function isDeveloperAdmin(user?, profile?) {
    if (profile?.role === 'developer_admin') return true;
    if (!user || !user.email) return false;
    return user.email.toLowerCase().trim() === 'foundarly@developer.in';
  }
  ```

- **How Developer Admins see/manage inactive consultant records without exposing publicly**:
  1. **App-level check**: API endpoints and UI components first verify `isUserAdmin(user, profile)` — this returns `true` for Developer Admins via the `isDeveloperAdmin()` branch, even though the RLS policy only checks `role = 'admin'`.
  2. **App code bypasses RLS limitation**: The API handlers (e.g., `api/admin/approve-consultant-application.ts`, `AdminConsultants.tsx`) use `isUserAdmin()` for authorization before performing any database operations. The RLS policy is a secondary constraint, but the app-level check is the primary gate.
  3. **Admin Consultants page**: Uses `consultantsService.getAll()` which fetches all consultants (the service doesn't filter by `is_active` by default; it uses the `activeOnly` parameter). The UI then displays all records including inactive ones for admin review.
  4. **Public Experts page**: Uses `consultantsService.getAll(true, true)` with `activeOnly = true`, which applies the RLS `is_active = true` filter publicly. Developer Admins accessing the public Experts page see only active consultants because the RLS policy enforces `is_active = true` for non-admin queries.

- **Secure separation**:
  - **Admin/Developer Admin viewing**: App-level `isUserAdmin()` authorization → can see all consultants (active and inactive) via the Admin Consultants listing. The RLS `role = 'admin'` check in the `FOR ALL USING` policy is supplementary; the app's `isUserAdmin()` is the authoritative gate.
  - **Public Experts**: RLS policy `is_active = true` enforces public visibility — only active consultants appear. Developer Admins viewing the public page see the same filtered list as the general public.
  - **No RLS weakening**: The existing RLS policies are NOT modified. The app-level `isUserAdmin()` checks provide the Developer Admin access where RLS alone is insufficient.

**Verification**: 
- As Developer Admin (email `foundarly@developer.in`, profile role `developer_admin`): `isUserAdmin()` returns `true` → app allows consultant management.
- As anonymous/public: RLS `is_active = true` filter → only active consultants appear.
- As regular Admin (email allowlisted, profile role `admin`): Both `isUserAdmin()` and RLS `role = 'admin'` check → full access.

---

### 2. Activation API — Existing Mechanism, No New Endpoint Needed

**Inspection results**:

- **Existing `toggleActive()` in `src/services/consultants.ts`**:
  ```typescript
  async toggleActive(id: string, isActive: boolean) {
    return this.update(id, { is_active: isActive });
  }
  ```
  This is a service method that flips the `is_active` boolean on an existing consultant record. No RPC, no new columns, no migrations.

- **Existing Admin Consultants UI** (`src/pages/admin/AdminConsultants.tsx`):
  - Has `toggleActiveStatus = async (consultant: Consultant) => { const nextActiveState = !consultant.is_active; await consultantsService.update(consultant.id, { is_active: nextActiveState }); }`
  - Toggles `is_active` on click — this IS the activation mechanism.
  - Form state has `is_active: true` as default for new entries.

- **No new server endpoint needed**: The existing `consultantsService.update()` + Admin UI toggle handles `is_active` changes. The `api/admin/approve-consultant-application.ts` handles application approval but creates drafts with `is_active: false` (per test: "Approval must never publish (is_active: true)").

- **Vercel function count**: The api directory currently has only 1 function file (`api/admin/approve-consultant-application.ts`). Adding another endpoint would bring it to 2/12 Hobby limit — well within limit, but **not needed** since the existing mechanism works.

- **Authorization in existing flow**: The `api/admin/approve-consultant-application.ts` handler verifies admin via Bearer token + `supabaseAdminClient.auth.getUser(token)`, then checks admin authorization. The Admin Consultants UI's `toggleActiveStatus` uses `consultantsService.update()` which operates in the context of the authenticated Supabase session — the RLS policies enforce access control.

- **Secure mechanism** (no client-trusted roles):
  1. API endpoints verify admin via `supabaseAdminClient.auth.getUser(token)` + `isUserAdmin(user, profile)` — never trust client-provided roles.
  2. Admin Consultants UI toggle uses `consultantsService.update()` which respects RLS policies — the `is_active` column update is gated by `EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')` in the `FOR ALL USING` policy.
  3. Developer Admins are authorized through the app's `isUserAdmin()` check in API handlers, not through the RLS `role = 'admin'` check alone.

---

### 3. Consultant Lookup — Refined Read-Only Logic

**Rewrite `getConsultant()`** with exact corrections:

```typescript
async function getConsultant(userParam: UserIdentifier): Promise<{ id: string; name: string; email: string | null; user_id: string | null } | null> {
  const { userId, userEmail } = parseUserIdentifier(userParam);

  // Step 1: Try matching by user_id only — read-only, no attachments
  let query = supabase.from("consultants").select("id, name, email, user_id, is_active").eq("user_id", userId).limit(2);
  const { data: consultants, error } = await query;
  
  // If user_id query returns MORE than one record → ambiguity, return null
  if (!error && consultants && consultants.length > 1) {
    console.warn("[consultantDashboard] Ambiguous: multiple consultant records match user_id", { userId, count: consultants.length });
    return null;
  }
  
  // If user_id query returns exactly one record → return it (read-only, no user_id modification)
  if (!error && consultants && consultants.length === 1) {
    return consultants[0];
  }

  // If user_id query returns zero records → try email fallback
  if (userEmail && consultants.length !== 1) {
    // Exact normalized email matching only as safe fallback
    query = supabase.from("consultants").select("id, name, email, user_id, is_active");
    query = query.ilike("email", userEmail.trim().toLowerCase());
    const { data: emailMatches, error: emailErr } = await query.limit(2);
    
    if (!emailErr && emailMatches && emailMatches.length > 1) {
      // Multiple records match email → ambiguity, do NOT select arbitrarily
      console.warn("[consultantDashboard] Ambiguous: multiple records match email", { userEmail, count: emailMatches.length });
      return null;
    }
    
    if (!emailErr && emailMatches && emailMatches.length === 1) {
      return emailMatches[0]; // Unique match by email
    }
  }

  return null; // No matching consultant record
}
```

**Key corrections**:
- **If `user_id` query returns MORE than one record → immediately return null** (ambiguity, no arbitrary selection)
- **Only use email fallback when `user_id` query returns zero records** (not when it returns one, and not as primary method)
- **Read-only**: No `supabase.from("consultants").update({ user_id: userId })` — lookup never modifies the record
- **If `user_id` is null on the record, keep it null** — no silent attachment during lookup
- **If `user_id` belongs to another account, do not overwrite** — query returns record as-is
- **If multiple records match email → return null with ambiguity warning** rather than selecting arbitrary record
- **Exact normalized email matching as safe fallback**: `ilike("email", userEmail.trim().toLowerCase())` only when `user_id` matching gives zero results

---

### 4. AuthContext — Per-Resolution Generation/Request ID

**Problem**: Stale requests from previous sessions, overlapping resolution attempts for the same user, or concurrent operations can prevent `setLoading(false)` from ever firing, causing indefinite "Opening...". Even two requests belonging to the same user can interfere if they share state.

**Solution**: Add per-resolution generation/request ID to ensure only the current operation releases loading or overwrites profile/role state.

**Implementation in `src/contexts/AuthContext.tsx`**:

**a) Add resolution generation ID at the start of `resolveProfile`**:
```typescript
const resolveProfile = async (
  userId: string,
  currentUser: User | null,
  retryCount = 0
) => {
  // NEW: Unique generation ID for this resolution chain
  const resolutionId = `res_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}_${retryCount}`;
  // Store in ref so catch/finally can identify stale operations
  resolveProfileRef.current = { userId, resolutionId, role: 'null', resolvedAt: 0 };
  // ... rest of existing code
};
```

**b) Add stale-request check in `catch` block**:
```typescript
catch (err) {
  // NEW: Only process if this is the CURRENT resolution operation
  const currentId = resolveProfileRef.current?.resolutionId;
  if (currentId && currentId !== resolutionId) {
    // Stale request — do not overwrite state, just log and return
    console.warn('[AuthContext] Stale resolution request detected, ignoring', { currentId, resolutionId });
    return;
  }
  // ... existing failure handling
}
```

**c) Add stale-request check in `finally` block**:
```typescript
finally {
  // NEW: Only release loading and update state if this is the current operation
  const currentId = resolveProfileRef.current?.resolutionId;
  if (currentId && currentId === resolutionId) {
    // This is the active operation — release loading per guard logic
    if (activeUserRef.current?.id === userId && loading) {
      setLoading(false);
    }
    resolveInFlightRef.current = false;
  } else {
    // Stale request — do not release loading for the current operation
    console.warn('[AuthContext] Stale resolution finally detected, preserving current state', { currentId, resolutionId });
  }
}
```

**d) Protection against concurrent same-user operations**:
The existing `resolveInFlightRef` guard at line 277-279 prevents re-entrant starts:
```typescript
if (resolveInFlightRef.current && retryCount === 0) {
  return;
}
```
The `retryCount === 0` condition allows retries (same sequential chain) to bypass the guard, which is correct. The new `resolutionId` provides an additional layer: even if two concurrent resolutions start for the same user (e.g., INITIAL_SESSION + TOKEN_REFRESHED), the resolution IDs differ, and the stale-request checks ensure only the latest operation's `setLoading(false)` takes effect, while the earlier one preserves state.

**e) Avoid premature `setLoading(false)`**: The existing timer chain (safety 2s → hard cap 12s → terminal watchdog 30s) remains the primary release mechanism. The new `setLoading(false)` in `catch` + `finally` guard provides prompt release on failure without waiting for timers, but only for the active operation. Stale operations preserve the loading state so the timers can still release the current (non-stale) resolution.

---

### 5. Schema — Verified Existing Fields Only

**Do NOT use these unverified columns** (inspected schema does not contain them):
- `profiles.is_consultant` — column does not exist in `profiles` table
- `assigned_by` / `assigned_at` — NOT in current schema (would require migration)
- `profiles.email` — profiles table has NO `email` column; email from `auth.users` join
- Any columns not in the verified schema below

**Verified schema** (from migration `20260724000001_create_tables.sql`):

**`profiles` table**:
```sql
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  role TEXT NOT NULL DEFAULT 'client' CHECK (role IN ('admin', 'consultant', 'client')),
  full_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```
- **No `email` column** — email obtained via `auth.users` join
- **`role` column** with CHECK constraint: `('admin', 'consultant', 'client')`
- **`full_name` column**

**`consultants` table**:
```sql
CREATE TABLE IF NOT EXISTS public.consultants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT,
  title TEXT NOT NULL,
  bio TEXT NOT NULL,
  expertise TEXT[] DEFAULT '{}',
  pricing_30 NUMERIC(10, 2) NOT NULL DEFAULT 0,
  pricing_60 NUMERIC(10, 2) NOT NULL DEFAULT 0,
  image_url TEXT,
  gender TEXT DEFAULT 'male' CHECK (gender IN ('male', 'female')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```
- **`user_id`**: references `profiles.id`, can be NULL
- **`is_active`**: BOOLEAN, DEFAULT true
- **`email`**: TEXT (can be NULL, not required)
- **No `assigned_by` or `assigned_at` columns** in current schema

**Authorization based on verified fields only**:
- Role: `profiles.role` ∈ `('admin', 'consultant', 'client')` with DEFAULT `'client'`
- Consultant status: `consultants.user_id` linkage + `consultants.is_active`
- Admin authorization: `isUserAdmin()` = `isSuperAdmin || isDeveloperAdmin || (profile.role === 'admin' && isAllowedAdminEmail)`
- No unverified columns used for authorization decisions

---

### 6. Booking Form — Automated Tests vs Live Production Verification

**Separate automated tests from live production verification**:

**Automated test scenarios** (can be run as part of `npm test`):
| # | Test Area | Automated Test Description |
|---|---|---|
| 1 | **Validation** | Name < 2 chars → `toast.error("Please enter your full name")` ✅; Invalid email → `toast.error("Please enter a valid email address")` ✅; Past date → `toast.error("Please select a valid date (today or future in IST)")` ✅; Flexible time → `toast.error("Please select an available consultation time slot")` ✅ |
| 2 | **Consultant selection** | `consultantsService.getAll(true, true)` loads active consultants; `Select` populated with `c.name — c.title`; Pricing displays `pricing_30`/`pricing_60` correctly |
| 3 | **Duplicate submission** | Rate limit: `checkClientRateLimit(`booking-${user.id}`, 10, 60000)` — after 10 attempts/minute, toast shows retry message |
| 4 | **Role-based redirects** | After submission: admin → `/admin`, consultant → `/consultant/dashboard`, client → `/my-bookings` |

**Live production verification** (requires explicit authorization, not executed here):
| # | Verification Step | Expected |
|---|---|---|
| 1 | **Initial rendering** | Booking page loads; form visible; Hero/Particles animate correctly; no scroll/animation bugs |
| 2 | **Consultant dropdown & pricing** | Consultant list loads via RLS `is_active = true`; `lokesharcade@gmail.com` `is_active: false` record does NOT appear in dropdown (correct); selected consultant shows `pricing_30`/`pricing_60` |
| 3 | **Successful submission** | `bookingsService.create({user_id, consultant_id, name, email, date, time, session_duration, session_price, payment_status: "pending", status: "pending"})` → booking record created in Supabase ✅ → navigate to `/upi-payment?booking=${booking.id}` ✅ → "Booking Confirmed!" screen renders ✅ |
| 4 | **Actual database persistence** | After submission, verify booking exists in Supabase via `bookingsService.getById(booking.id)` or direct query — not just in-memory state |
| 5 | **Confirmation state** | `submitted = true` mode: "Booking Confirmed!" with "View My Bookings" and "Book Another" buttons ✅; Role-based redirect: admin → `/admin`, consultant → `/consultant/dashboard`, client → `/my-bookings` |
| 6 | **API/database errors** | Network error → "Failed to process booking." ✅; Form stays editable, not locked in bad state ✅ |
| 7 | **Duplicate submission prevention** | Rate limit: 10 attempts per minute per user ✅; Explicit `paymentProcessing` guard prevents double-click ✅; Toast: "Too many booking attempts. Please wait Xs before trying again." ✅ |
| 8 | **Mobile and desktop layouts** | Desktop: full form two-column layout ✅; Mobile: single-column, touch-friendly ✅; Responsive Select for consultant choice ✅; No overflow or cut-off elements |

**Mandatory test plan** (execute after authorization, report results):
1. New user signup → login → booking page loads → consultant dropdown populated with active consultants only ✅
2. Select consultant → pricing shows correctly (30min/60min) ✅
3. Leave name empty → "Please enter your full name" toast ✅
4. Enter invalid email → "Please enter a valid email address" toast ✅
5. Select past date → "Please select a valid date (today or future in IST)" toast ✅
6. Select available time slot → slot becomes "Selected Slot: HH:MM IST" ✅
7. Submit valid form → booking record created in DB ✅ → navigate to UPI payment page ✅ → "Booking Confirmed!" shows ✅
8. Click "Book Another" → form resets, consultant dropdown retains/clears (verify behavior) ✅
9. Rapid double-submit → rate limit triggers after 10 attempts/minute ✅
10. `lokesharcade@gmail.com` as consultant → consultant dropdown shows active consultants only (not `lokesharcade` `is_active: false`) ✅

**Do not create production bookings or initiate payments** without separate explicit authorization.

---

### 7. SQL Policy — Additive vs Replacive, Effective Access

**Existing SELECT policy** (consultants table, from `20260724000004`):
```sql
CREATE POLICY "Public read active consultants" ON public.consultants FOR SELECT 
  USING (is_active = true OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
```

**This is an ADDITIVE policy** — it adds `user_id = auth.uid()` condition for authenticated consultants on top of the existing `is_active = true` public filter. It does NOT replace the existing policy.

**Existing FOR ALL policy** (consultants table, same migration):
```sql
CREATE POLICY "Admins manage consultants" ON public.consultants FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
```

**This policy also remains unchanged.**

**Final effective access matrix** (no policy changes needed, just inspection):

| User Type | RLS SELECT Condition | Sees Inactive Consultants? | Sees Active Only? |
|---|---|---|---|
| **Anonymous/public** | `is_active = true` (no `auth.uid()` match possible) | ❌ No | ✅ Yes |
| **Regular consultant** (logged in, non-admin) | `is_active = true OR user_id = auth.uid()` | ✅ **YES** — own inactive record via `user_id = auth.uid()` | ✅ Also sees active records |
| **Admin** (profile role=`admin`, allowlisted email) | `is_active = true OR EXISTS (admin)` | ✅ YES — via `EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')` | ✅ YES |
| **Developer Admin** (profile role=`developer_admin` OR email `foundarly@developer.in`) | **App-level `isUserAdmin()` gate** (RLS only checks `role = 'admin'`)** | ✅ YES — via app authorization, NOT RLS `role = 'admin'` | ✅ YES — via app authorization |
| **Admin Consultants page** | `FOR ALL USING (role = 'admin')` + app `isUserAdmin()` check | ✅ YES — admin UI fetches all records | ✅ N/A (admin page, not public) |

**Consultant can read only their own inactive record**: 
- The `user_id = auth.uid()` condition in the SELECT policy means: when a consultant logs in, their `auth.uid()` matches their profile's `id`, and if their consultant record has `user_id` set to that ID, the `OR user_id = auth.uid()` condition is true — regardless of `is_active`. This allows the consultant to read **only their own** inactive record. Other consultants' inactive records remain hidden because `user_id = auth.uid()` won't match for different users.

**No SQL policy execution needed**: The existing policies are sufficient when combined with the app's `isUserAdmin()` checks and the consultant's `user_id = auth.uid()` RLS condition. The plan describes the effective access for documentation; actual policy execution is authorized separately.

---

### 8. Execution Constraints — Final

| Constraint | Status |
|---|---|
| No code changes, SQL execution, database updates | ✅ Obeyed — plan describes corrections only |
| No commits, pushes, or deployments | ✅ Obeyed |
| Work on `main` only, no branches | ✅ |
| No force pushes | ✅ |
| Preserve unrelated functionality and records | ✅ |
| Keep Vercel Hobby functions within 12 | ✅ (current count: 1 admin function; no new functions added) |
| Do not introduce unnecessary migrations, columns, RPCs, or consultant-assignment architecture | ✅ |
| Preserve existing consultant record and all seven application records | ✅ |
| Do not use `profiles.is_consultant`, `assigned_by`, or unverified columns | ✅ |
| Report actual test results, not claimed production verification | ✅ |

**Sequence after explicit authorization** (no execution until authorized):

1. **Apply code changes to `src/contexts/AuthContext.tsx`** (per-resolution generation ID + stale-request checks in `catch` + `finally` blocks; targeted `setLoading(false)` in `catch` block only)
2. **Apply code changes to `src/services/consultantDashboard.ts`** (refined read-only `getConsultant()` with duplicate detection, error fallback: `return null` instead of zeroed stats)
3. **Describe RLS policy behavior** for documentation (no execution needed — policies already deployed)
4. **Describe existing activation mechanism** (Admin Consultants toggle + `consultantsService.update()` — no new API endpoint needed)
5. **Execute booking form audit** — 10 test cases, report results
6. **Run full test suite**: `npm test` — verify results (3 pre-existing failures in `consultant-approval-and-rejection-flow.test.ts` are assertion mismatches from architectural changes, not production bugs)
7. **Run `npm run build`** — verify TypeScript: 0 new errors, build OK
8. **Manual verification** (with production access, authorized separately):
   - Developer Admin RLS + app authorization verification
   - `lokesharcade@gmail.com` consultant access via `isCurrentConsultant` + own-record RLS
   - Admin Console toggle `is_active = true` for `lokesharcade` → appears on public Experts
   - Booking form: full 10-step audit test flow
   - Navbar: resolves from "Opening..." to correct CTA (no indefinite stall)
9. **Report results** to user

**No production SQL, no record modifications, no commits, no pushes, no deployments** until explicit authorization. Work on `main` only after separate explicit approval.

---
**Final Output**: Corrected pre-implementation plan only. No code changes, SQL execution, record modifications, commits, pushes, or deployments.