# 🚀 SQL FILES EXECUTION ORDER

## ⚠️ IMPORTANT: Run in EXACT order!

Open Supabase SQL Editor and run these files one by one:

---

## 📋 STEP-BY-STEP EXECUTION

### 1️⃣ **supabase-setup.sql**
**What it does:**
- Creates core tables (profiles, consultants, bookings, testimonials, blog)
- Creates content_sections and site_settings tables
- Creates storage buckets
- Adds seed data (4 consultants, 3 testimonials)
- Creates auth trigger for new users

**Time:** ~30 seconds

---

### 2️⃣ **content-management-setup.sql**
**What it does:**
- Creates FAQs table
- Creates page_content table
- Adds 6 default FAQs
- Adds About page content

**Time:** ~10 seconds

---

### 3️⃣ **pricing-setup.sql**
**What it does:**
- Creates pricing_tiers table
- Adds 3 default pricing plans (30min, 60min, chat)

**Time:** ~10 seconds

---

### 4️⃣ **networking-complete-setup.sql**
**What it does:**
- Creates 9 networking tables (channels, messages, groups, showcases, reports)
- Creates indexes for performance
- Adds 16 default channels
- Creates triggers for member counts

**Time:** ~45 seconds

---

### 5️⃣ **FIXED-RLS-POLICIES.sql** ⭐ CRITICAL!
**What it does:**
- Enables RLS on ALL tables
- Creates ALL security policies
- Fixes anonymous access for public content
- Sets up storage bucket permissions

**Time:** ~30 seconds

**THIS IS THE MOST IMPORTANT FILE!**

---

### 6️⃣ **fix-admin-access.sql**
**What it does:**
- Makes your user an admin

**Before running:**
1. Sign up in your app first
2. Edit the file
3. Replace `'starkcloudie@gmail.com'` with YOUR email
4. Then run it

**Time:** ~5 seconds

---

## ✅ VERIFICATION

After running all files, test in SQL Editor:

```sql
-- Should return 4
SELECT COUNT(*) FROM consultants WHERE is_active = true;

-- Should return 3
SELECT COUNT(*) FROM testimonials WHERE status = 'published';

-- Should return 6
SELECT COUNT(*) FROM faqs;

-- Should return 3
SELECT COUNT(*) FROM pricing_tiers WHERE is_active = true;

-- Should return 16
SELECT COUNT(*) FROM channels WHERE is_active = true;

-- Should show your email as admin
SELECT u.email, p.role 
FROM profiles p 
JOIN auth.users u ON u.id = p.id 
WHERE p.role = 'admin';
```

---

## 🎯 QUICK SUMMARY

```
1. supabase-setup.sql              → Core tables + seed data
2. content-management-setup.sql    → FAQs + page content
3. pricing-setup.sql               → Pricing tiers
4. networking-complete-setup.sql   → Networking system
5. FIXED-RLS-POLICIES.sql          → Security policies ⭐
6. fix-admin-access.sql            → Make yourself admin
```

**Total time:** ~2-3 minutes

---

## ⚠️ TROUBLESHOOTING

### Issue: Data shows BEFORE login but NOT AFTER login

This is an RLS policy problem! Run this:

```
QUICK-FIX-AFTER-LOGIN.sql
```

Or diagnose first:

```
DIAGNOSE-RLS-ISSUE.sql
```

**Why this happens:**
- Policies using `USING (condition OR EXISTS(...))` fail for authenticated users
- The OR condition short-circuits for anonymous users (works)
- But for authenticated users, it tries to evaluate EXISTS() which may fail

**The fix:**
- Use TWO separate policies instead of one with OR
- Policy 1: `USING (is_active = true)` - works for everyone
- Policy 2: `USING (EXISTS(...)) TO authenticated` - only for admins

---

These files have been removed or are outdated:
- ❌ row-level-security-policies.sql (old, had bugs)
- ❌ fix-rls-policies.sql (incomplete)
- ❌ networking-rls-fix.sql (partial fix only)
- ❌ storage-buckets-setup.sql (now in FIXED-RLS-POLICIES.sql)
- ❌ fix-admin-role-update.sql (duplicate)

---

## 🔄 IF RE-SETTING DATABASE

If you need to clean and start over:

```sql
-- Run this FIRST to clean everything
DROP TABLE IF EXISTS reports CASCADE;
DROP TABLE IF EXISTS message_reactions CASCADE;
DROP TABLE IF EXISTS startup_showcases CASCADE;
DROP TABLE IF EXISTS group_posts CASCADE;
DROP TABLE IF EXISTS group_members CASCADE;
DROP TABLE IF EXISTS user_groups CASCADE;
DROP TABLE IF EXISTS channel_messages CASCADE;
DROP TABLE IF EXISTS channel_members CASCADE;
DROP TABLE IF EXISTS channels CASCADE;
DROP TABLE IF EXISTS pricing_tiers CASCADE;
DROP TABLE IF EXISTS page_content CASCADE;
DROP TABLE IF EXISTS faqs CASCADE;
DROP TABLE IF EXISTS site_settings CASCADE;
DROP TABLE IF EXISTS content_sections CASCADE;
DROP TABLE IF EXISTS blog CASCADE;
DROP TABLE IF EXISTS testimonials CASCADE;
DROP TABLE IF EXISTS bookings CASCADE;
DROP TABLE IF EXISTS consultants CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- Drop storage
DELETE FROM storage.objects WHERE bucket_id IN (
  'consultant-images', 'testimonial-images', 'blog-images', 'site-assets'
);
DELETE FROM storage.buckets WHERE id IN (
  'consultant-images', 'testimonial-images', 'blog-images', 'site-assets'
);

-- Drop triggers
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
```

Then run steps 1-6 above.

---

## 🎉 SUCCESS INDICATORS

After setup, your app should show:
- ✅ 4 consultants on home page
- ✅ 3 testimonials on home page
- ✅ 3 pricing tiers on pricing page
- ✅ 6 FAQs on FAQs page
- ✅ About page with content
- ✅ 16 channels in network section
- ✅ Admin panel accessible (after login)
- ✅ No permission errors in console

---

**Created:** 2024
**Status:** Production Ready ✅
