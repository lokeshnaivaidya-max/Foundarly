# Consultant Application System - Visual Flow

## User Journey

```
┌─────────────────────────────────────────────────────────────┐
│                    FOUNDARLY HOMEPAGE                        │
│                                                             │
│  Header: [Home] [Experts] [Pricing] [Become a Consultant]  │
│                                          ↑                  │
│                                          │                  │
│                                    Click Here               │
└──────────────────────────────────────────────────────────────┘
                                          │
                                          ↓
┌─────────────────────────────────────────────────────────────┐
│              APPLY AS CONSULTANT PAGE                       │
│                                                             │
│  📋 Personal Information                                    │
│     • Name *                                                │
│     • Age *                                                 │
│     • Gender * (Male/Female)                                │
│     • Location *                                            │
│                                                             │
│  💼 Professional Information                                │
│     • Qualification *                                       │
│     • Current Job *                                         │
│     • Experience & Expertise *                              │
│                                                             │
│  📞 Contact Information                                     │
│     • Email *                                               │
│     • Phone *                                               │
│     • WhatsApp *                                            │
│     • LinkedIn (optional)                                   │
│                                                             │
│  [Submit Application]                                       │
└─────────────────────────────────────────────────────────────┘
                                          │
                                          ↓
┌─────────────────────────────────────────────────────────────┐
│              SUCCESS CONFIRMATION                           │
│                                                             │
│                      ✅                                      │
│           Application Submitted!                            │
│                                                             │
│  Thank you for applying. We'll review your application      │
│  and contact you within 3-5 business days.                  │
│                                                             │
│  [Back to Home]                                             │
└─────────────────────────────────────────────────────────────┘
```

## Admin Review Process

```
┌─────────────────────────────────────────────────────────────┐
│                    ADMIN PANEL                              │
│                                                             │
│  Sidebar:                                                   │
│  • Dashboard                                                │
│  • Manage Consultants                                       │
│  • Consultant Applications  ← Click Here                    │
│  • Manage Bookings                                          │
│  • ...                                                      │
└─────────────────────────────────────────────────────────────┘
                                          │
                                          ↓
┌─────────────────────────────────────────────────────────────┐
│         CONSULTANT APPLICATIONS DASHBOARD                   │
│                                                             │
│  Filters: [All (15)] [Pending (8)] [Approved (5)] [Rejected (2)]
│                                                             │
│  Search: [🔍 Search by name or email...]                    │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ Name      │ Email        │ Location │ Status  │ Actions││
│  ├───────────────────────────────────────────────────────┤ │
│  │ John Doe  │ john@ex.com  │ NY, USA  │ 🟡 Pending │[View]││
│  │ 30 yrs, male                                           ││
│  ├───────────────────────────────────────────────────────┤ │
│  │ Jane Smith│ jane@ex.com  │ LA, USA  │ 🟢 Approved│[View]││
│  │ 28 yrs, female                                         ││
│  └───────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                                          │
                                    Click [View]
                                          ↓
┌─────────────────────────────────────────────────────────────┐
│              APPLICATION REVIEW DIALOG                      │
│                                                             │
│  📋 Personal Information                                    │
│     Name: John Doe                                          │
│     Age: 30 years                                           │
│     Gender: Male                                            │
│     Location: New York, USA                                 │
│                                                             │
│  💼 Professional Information                                │
│     Qualification: MBA in Business Administration           │
│     Current Job: Senior Consultant at ABC Corp             │
│     Experience: 8 years in business consulting...          │
│                                                             │
│  📞 Contact Information                                     │
│     Email: john@example.com                                 │
│     Phone: +1 234 567 8900                                  │
│     WhatsApp: +1 234 567 8900                               │
│     LinkedIn: linkedin.com/in/johndoe                       │
│                                                             │
│  📝 Admin Notes:                                            │
│  [Text area for internal notes...]                         │
│                                                             │
│  Current Status: 🟡 Pending                                 │
│                                                             │
│  [Close] [❌ Reject] [✅ Approve & Create Consultant]       │
└─────────────────────────────────────────────────────────────┘
```

## Approval Flow

```
Admin Clicks "Approve & Create Consultant"
                    ↓
┌─────────────────────────────────────────────────────────────┐
│              AUTOMATIC PROCESS                              │
│                                                             │
│  1. Create Consultant Profile                               │
│     ✓ Name: John Doe                                        │
│     ✓ Title: Senior Consultant at ABC Corp                 │
│     ✓ Bio: 8 years in business consulting...               │
│     ✓ Gender: Male (for avatar 👨‍💼)                         │
│     ✓ Pricing: $100 (30min), $180 (60min)                  │
│     ✓ Status: Active                                        │
│     ✓ Image: null (default avatar)                         │
│                                                             │
│  2. Update Application                                      │
│     ✓ Status: Approved                                      │
│     ✓ Admin Notes: Saved                                    │
│     ✓ Updated At: Current timestamp                         │
│                                                             │
│  3. Show Success Message                                    │
│     "John Doe has been added as a consultant"              │
└─────────────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────┐
│              CONSULTANT CREATED                             │
│                                                             │
│  Admin can now:                                             │
│  • Go to "Manage Consultants"                               │
│  • Find John Doe in the list                                │
│  • Click "Edit" to:                                         │
│    - Add expertise tags                                     │
│    - Adjust pricing                                         │
│    - Upload profile photo                                   │
│    - Refine bio                                             │
│                                                             │
│  Consultant appears on public site:                         │
│  • Consultants page                                         │
│  • Home page (if featured)                                  │
│  • Available for booking                                    │
└─────────────────────────────────────────────────────────────┘
```

## Status Flow Diagram

```
                    Application Submitted
                            │
                            ↓
                    ┌───────────────┐
                    │   🟡 PENDING  │
                    └───────────────┘
                            │
                ┌───────────┴───────────┐
                │                       │
                ↓                       ↓
        ┌───────────────┐      ┌───────────────┐
        │  ✅ APPROVED  │      │  ❌ REJECTED  │
        └───────────────┘      └───────────────┘
                │                       │
                ↓                       │
        Consultant Created              │
        (Active on site)                │
                                        ↓
                                Application Archived
                                (Kept for records)
```

## Button Locations

### Header (Desktop)
```
┌─────────────────────────────────────────────────────────────┐
│ [Logo] [Home] [Experts] [Pricing] [About] [Blog] [FAQs]    │
│                                                             │
│         [Become a Consultant] [Book a Session]              │
│              ↑ Yellow border                                │
└─────────────────────────────────────────────────────────────┘
```

### Header (Mobile)
```
┌─────────────────────────────────────────────────────────────┐
│ [Logo]                                            [☰ Menu]  │
└─────────────────────────────────────────────────────────────┘
                    ↓ Click Menu
┌─────────────────────────────────────────────────────────────┐
│  • Home                                                     │
│  • Experts                                                  │
│  • Pricing                                                  │
│  • About                                                    │
│  • Blog                                                     │
│  • FAQs                                                     │
│  ─────────────────────────────────────────────────────     │
│  [Become a Consultant]  ← Full width button                │
│  [Book a Session]                                           │
└─────────────────────────────────────────────────────────────┘
```

### Admin Sidebar
```
┌─────────────────────────────────────┐
│  ADMIN PANEL                        │
│  • Dashboard                        │
│  • Content Control                  │
│  • Manage Consultants               │
│  • Consultant Applications  ← NEW   │
│  • Manage Bookings                  │
│  • Testimonials                     │
│  • Blog                             │
│  • FAQs                             │
│  • Pricing                          │
│  • Users                            │
│  • Settings                         │
│                                     │
│  NETWORKING CONTROL                 │
│  • Channels                         │
│  • Groups                           │
│  • Messages                         │
│  • Showcases                        │
│  • Reports                          │
└─────────────────────────────────────┘
```

## Color Coding

- 🟡 **Pending**: Yellow badge - Awaiting admin review
- 🟢 **Approved**: Green badge - Consultant created
- 🔴 **Rejected**: Red badge - Application declined

## Key Features

✅ **User-Friendly Form**: Clean, organized, mobile-responsive  
✅ **Admin Dashboard**: Filter, search, and manage applications  
✅ **One-Click Approval**: Automatically creates consultant  
✅ **Gender-Based Avatars**: Male/Female default avatars  
✅ **Status Tracking**: Pending → Approved/Rejected  
✅ **Admin Notes**: Internal comments for tracking  
✅ **Secure**: RLS policies protect data  

---

**Quick Access**:
- User Form: `/apply-consultant`
- Admin Panel: `/admin/consultant-applications`
