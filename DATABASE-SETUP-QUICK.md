# Quick Database Setup Guide

## Issue Fixed ✅
AdminPayouts showing "Failed to load resource: 400" error because database tables don't exist yet.

## ✅ Solution Applied
- Added graceful error handling for missing database tables
- AdminPayouts now shows helpful setup message instead of errors
- ConsultantDashboard works with default values when tables are missing

## 🚀 Quick Setup (Required)

### Step 1: Run Consultant Earnings Migration
Copy and paste this SQL into your Supabase SQL Editor:

```sql
-- Copy the entire content of database/consultant-earnings-system.sql
-- This creates the payout_requests and consultant_earnings tables
```

### Step 2: Run Consultant Role Migration  
Copy and paste this SQL into your Supabase SQL Editor:

```sql
-- Copy the entire content of database/consultant-role-setup.sql
-- This creates the role management system and triggers
```

### Step 3: Verify Setup
1. Go to `/admin/payouts` - should show "No payout requests" instead of error
2. Go to `/consultant-dashboard` - should load with default stats
3. Check Supabase dashboard to see new tables created

## 📋 Files to Run (In Order)

1. **`database/consultant-earnings-system.sql`** - Creates payout and earnings tables
2. **`database/consultant-role-setup.sql`** - Creates role management system

## 🎯 Expected Result

After running the migrations:
- ✅ AdminPayouts page loads without errors
- ✅ ConsultantDashboard shows proper stats
- ✅ Payout request system works
- ✅ Role assignment works automatically

## 🔧 Current Status

**Before Migration:**
- ❌ AdminPayouts: 400 error
- ⚠️ ConsultantDashboard: Limited functionality

**After Migration:**
- ✅ AdminPayouts: Works with empty state
- ✅ ConsultantDashboard: Full functionality
- ✅ Payout system: Ready for use
- ✅ Role management: Automatic assignment

## 📞 Quick Test

1. **Run the SQL migrations**
2. **Refresh the admin payouts page** - error should be gone
3. **Test consultant dashboard** - should show stats
4. **Link a consultant to user account** via admin interface

The database setup is now ready! 🎉