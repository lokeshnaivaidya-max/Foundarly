# Database Setup Guide

This folder contains all SQL scripts for setting up the Foundarly platform database.

## 📋 Setup Order

Run these scripts in order for a fresh database setup:

### 1. Core Tables
```sql
-- Run first: Creates all main tables
database/supabase-setup.sql
```

### 2. Content Management
```sql
-- Run second: Creates FAQs, page content, blog tables
database/content-management-setup.sql
```

### 3. Pricing System
```sql
-- Run third: Creates pricing tiers table
database/pricing-setup.sql
```

### 4. Networking Features
```sql
-- Run fourth: Creates channels, groups, showcases tables
database/networking-complete-setup.sql
```

### 5. Site Settings
```sql
-- Run fifth: Creates site settings and default values
database/site-settings-setup.sql
```

### 6. RLS Policies
```sql
-- Run last: Enables Row Level Security policies
database/SIMPLE-RLS-NO-COMPLEXITY.sql
```

## 🔧 Utility Scripts

### Admin Management
- `admin-management.sql` - Functions to manage admin users
  - `make_user_admin(user_email)` - Grant admin role
  - `remove_admin_role(user_email)` - Remove admin role
  - `list_admin_users()` - List all admins
  - `is_user_admin(user_email)` - Check if user is admin

### Diagnostics
- `DIAGNOSE-RLS-ISSUE.sql` - Check RLS status and policies
- `TEST-FAQ-INSERT.sql` - Test FAQ insert permissions

## 🚨 Important Notes

1. **Current RLS Setup**: Using `SIMPLE-RLS-NO-COMPLEXITY.sql` which allows all operations for testing
2. **Session Columns**: The `bookings` table now includes `session_duration` and `session_price` columns
3. **Admin Access**: Admins are identified by `role = 'admin'` in the `profiles` table

## 📁 File Organization

### Main Setup Files
- `supabase-setup.sql` - Core tables (profiles, consultants, bookings, testimonials, blog)
- `content-management-setup.sql` - Content tables (FAQs, page_content, content_sections)
- `pricing-setup.sql` - Pricing tiers
- `networking-complete-setup.sql` - Networking system
- `site-settings-setup.sql` - Site configuration

### RLS Policy Files
- `SIMPLE-RLS-NO-COMPLEXITY.sql` - ✅ Currently active (allows everything)
- `ADMIN-FULL-ACCESS-RLS.sql` - Proper admin-based policies (for production)
- `SECURE-RLS-POLICIES.sql` - Alternative secure policies

### Legacy/Archive Files
- `FIX-FAQ-AND-BOOKING.sql` - Fixed FAQ and booking issues (now integrated)
- `fix-admin-access.sql` - Admin access fixes (now integrated)
- `FIXED-RLS-POLICIES.sql` - Old RLS policies
- `COMPLETE-FIX-ALL-ISSUES.sql` - Comprehensive fix script
- `QUICK-FIX-AFTER-LOGIN.sql` - Login-related fixes

## 🎯 Quick Start

For a completely fresh setup:

```bash
# 1. Clean database (optional - only if starting fresh)
# Drop all tables in Supabase dashboard

# 2. Run setup scripts in order
psql -f database/supabase-setup.sql
psql -f database/content-management-setup.sql
psql -f database/pricing-setup.sql
psql -f database/networking-complete-setup.sql
psql -f database/site-settings-setup.sql
psql -f database/SIMPLE-RLS-NO-COMPLEXITY.sql

# 3. Create your first admin user
psql -f database/admin-management.sql
# Then in psql: SELECT make_user_admin('your-email@example.com');
```

## 🔐 Security

The current setup uses `SIMPLE-RLS-NO-COMPLEXITY.sql` which allows all operations. This is for development/testing only.

For production, switch to `ADMIN-FULL-ACCESS-RLS.sql`:
```sql
-- In Supabase SQL Editor
\i database/ADMIN-FULL-ACCESS-RLS.sql
```

This will:
- Allow public read access to public content
- Restrict write operations to admins only
- Protect user data with proper RLS policies
