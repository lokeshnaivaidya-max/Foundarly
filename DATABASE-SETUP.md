# Foundarly Database Setup

Complete guide for setting up the Foundarly platform database.

## 📁 File Organization

All database files are now in the `database/` folder:
- Setup scripts (run in order)
- RLS policy files
- Admin management utilities
- Diagnostic tools

## 🚀 Quick Setup (Fresh Database)

Run these scripts in your Supabase SQL Editor in this exact order:

```sql
-- 1. Core tables (profiles, consultants, bookings, testimonials, blog)
\i database/supabase-setup.sql

-- 2. Content management (FAQs, page content, sections)
\i database/content-management-setup.sql

-- 3. Pricing system
\i database/pricing-setup.sql

-- 4. Networking features (channels, groups, showcases)
\i database/networking-complete-setup.sql

-- 5. Site settings
\i database/site-settings-setup.sql

-- 6. RLS policies (allows everything for testing)
\i database/SIMPLE-RLS-NO-COMPLEXITY.sql

-- 7. Admin management functions
\i database/admin-management.sql
```

## 👤 Create Your First Admin

After running the setup scripts:

```sql
-- Make yourself an admin
SELECT make_user_admin('your-email@example.com');

-- Verify you're an admin
SELECT * FROM list_admin_users();
```

## 🔐 Security Notes

### Current Setup (Development)
- Using `SIMPLE-RLS-NO-COMPLEXITY.sql` - allows all operations
- Good for testing and development
- **NOT suitable for production**

### Production Setup
When ready for production, switch to proper RLS:

```sql
\i database/ADMIN-FULL-ACCESS-RLS.sql
```

This provides:
- Public read access to public content
- Admin-only write access
- User-specific data protection

## 📋 What's Included

### Tables Created
- `profiles` - User profiles with role management
- `consultants` - Expert consultants
- `bookings` - Consultation bookings (with session_duration & session_price)
- `testimonials` - Client testimonials
- `blog` - Blog posts
- `faqs` - Frequently asked questions
- `page_content` - Dynamic page content
- `content_sections` - Page sections
- `pricing_tiers` - Pricing plans
- `site_settings` - Site configuration
- `channels` - Networking channels
- `channel_members` - Channel memberships
- `channel_messages` - Channel messages
- `user_groups` - User groups
- `group_members` - Group memberships
- `group_posts` - Group posts
- `startup_showcases` - Startup showcases
- `message_reactions` - Message reactions
- `reports` - Content reports

### Admin Functions
- `make_user_admin(email)` - Grant admin role
- `remove_admin_role(email)` - Remove admin role
- `list_admin_users()` - List all admins
- `is_user_admin(email)` - Check admin status
- `is_admin()` - Helper for RLS policies

## 🔧 Troubleshooting

### Data not showing after login?
Run the diagnostic script:
```sql
\i database/DIAGNOSE-RLS-ISSUE.sql
```

### Can't add FAQs as admin?
1. Verify you're an admin: `SELECT is_user_admin('your-email@example.com');`
2. Check RLS policies are applied: `\i database/DIAGNOSE-RLS-ISSUE.sql`
3. Test FAQ insert: `\i database/TEST-FAQ-INSERT.sql`

### Booking creation fails?
The `bookings` table now includes `session_duration` and `session_price` columns. If you have an old database, run:
```sql
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS session_duration INTEGER;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS session_price NUMERIC(10, 2);
```

## 📚 Additional Documentation

See `database/README.md` for:
- Detailed file descriptions
- Utility scripts
- Legacy/archive files
- Advanced configuration

## ✅ Verification

After setup, verify everything works:

```sql
-- Check table counts
SELECT 
  (SELECT COUNT(*) FROM profiles) as profiles,
  (SELECT COUNT(*) FROM consultants) as consultants,
  (SELECT COUNT(*) FROM faqs) as faqs,
  (SELECT COUNT(*) FROM pricing_tiers) as pricing_tiers;

-- Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND rowsecurity = true;

-- List admins
SELECT * FROM list_admin_users();
```

## 🎯 Next Steps

1. ✅ Database setup complete
2. Add seed data (consultants, FAQs, pricing)
3. Configure site settings in admin panel
4. Test booking flow
5. Test admin features
6. Switch to production RLS when ready

---

**Need Help?** Check `database/README.md` for detailed documentation.
