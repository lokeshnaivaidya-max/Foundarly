# 🚀 QUICK SETUP REFERENCE

## The Problem
Your RLS policies are blocking anonymous users from viewing public content.

## The Solution
Run SQL files in this EXACT order:

---

## ✅ EXECUTION ORDER

### 1️⃣ Core Setup
```
File: supabase-setup.sql
Creates: Profiles, Consultants, Bookings, Testimonials, Blog, Storage
Time: ~30 seconds
```

### 2️⃣ Content Management
```
File: content-management-setup.sql
Creates: FAQs, Page Content
Time: ~10 seconds
```

### 3️⃣ Pricing System
```
File: pricing-setup.sql
Creates: Pricing Tiers
Time: ~10 seconds
```

### 4️⃣ Networking System
```
File: networking-complete-setup.sql
Creates: Channels, Groups, Messages, Showcases
Time: ~45 seconds
```

### 5️⃣ FIX RLS POLICIES ⭐ CRITICAL
```
File: FIXED-RLS-POLICIES.sql
Fixes: All permission issues
Time: ~30 seconds
THIS IS THE MOST IMPORTANT STEP!
```

### 6️⃣ Create Admin User
```
File: fix-admin-access.sql
Action: Edit file, replace email with yours, run
Time: ~5 seconds
```

---

## 🎯 One-Line Summary

**The issue:** RLS policies use `auth.uid() IN (SELECT...)` which fails for anonymous users.

**The fix:** Use `EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()...)` instead.

---

## 🔍 Quick Test

After setup, run this in SQL Editor:

```sql
-- Should return 4 consultants
SELECT COUNT(*) FROM consultants WHERE is_active = true;

-- Should return 3 testimonials  
SELECT COUNT(*) FROM testimonials WHERE status = 'published';

-- Should return 6 FAQs
SELECT COUNT(*) FROM faqs;

-- Should return 3 pricing tiers
SELECT COUNT(*) FROM pricing_tiers WHERE is_active = true;

-- Should return 16 channels
SELECT COUNT(*) FROM channels WHERE is_active = true;
```

All queries should return numbers, not errors!

---

## ⚠️ If Content Still Not Showing

1. Did you run `FIXED-RLS-POLICIES.sql`? (Step 5)
2. Check browser console for errors
3. Verify `.env` has correct Supabase credentials
4. Clear browser cache
5. Try incognito mode

---

## 📋 Files You Need

**Must Run (in order):**
1. ✅ supabase-setup.sql
2. ✅ content-management-setup.sql
3. ✅ pricing-setup.sql
4. ✅ networking-complete-setup.sql
5. ✅ FIXED-RLS-POLICIES.sql ⭐
6. ✅ fix-admin-access.sql

**Don't Run (old/broken):**
- ❌ row-level-security-policies.sql (old, has bugs)
- ❌ fix-rls-policies.sql (incomplete)
- ❌ networking-rls-fix.sql (only partial fix)

---

## 🎉 Success = 

- Home page shows consultants ✅
- Home page shows testimonials ✅
- Pricing page works ✅
- FAQs page works ✅
- Network page shows channels ✅
- Admin panel accessible ✅

---

**Total Setup Time:** ~2-3 minutes
**Difficulty:** Copy-paste into SQL Editor
**Result:** Fully working app with all content visible
