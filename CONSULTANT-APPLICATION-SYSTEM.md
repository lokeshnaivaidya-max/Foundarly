# Consultant Application System - Complete Guide

## Overview
A complete system for users to apply to become consultants on the Foundarly platform, with admin review and approval workflow.

## Features Implemented

### 1. Public Application Form (`/apply-consultant`)
- **Location**: Accessible from header "Become a Consultant" button
- **Form Fields**:
  - Name (required)
  - Age (required, 18-100)
  - Gender (Male/Female) - used for default avatar
  - Qualification (required)
  - Current Job (required)
  - Location (required)
  - Experience & Expertise (textarea, required)
  - Email (required)
  - Phone (required)
  - WhatsApp (required)
  - LinkedIn Profile (optional)

- **Features**:
  - Clean, professional form design
  - Validation for all required fields
  - Success confirmation page after submission
  - Mobile-responsive layout
  - Matches Foundarly theme

### 2. Admin Review Panel (`/admin/consultant-applications`)
- **Access**: Admin panel sidebar → "Consultant Applications"
- **Features**:
  - View all applications with status filtering
  - Status badges: Pending (yellow), Approved (green), Rejected (red)
  - Search by name or email
  - Filter by status: All, Pending, Approved, Rejected
  - Status counts in filter buttons

### 3. Application Review Dialog
- **View Details**: Click "View" button on any application
- **Information Displayed**:
  - Personal: Name, Age, Gender, Location
  - Professional: Qualification, Current Job, Experience
  - Contact: Email, Phone, WhatsApp, LinkedIn
  - Admin Notes field for internal comments
  - Current status badge

### 4. Approval Workflow
**When Admin Clicks "Approve & Create Consultant"**:
1. Creates new consultant in consultants table
2. Auto-fills consultant data from application:
   - Name → Consultant name
   - Current Job → Consultant title
   - Experience → Consultant bio
   - Gender → Consultant gender (for avatar)
3. Sets default pricing (30min: $100, 60min: $180)
4. Marks consultant as active
5. Updates application status to "approved"
6. Saves admin notes

**Admin can then**:
- Edit consultant in "Manage Consultants" to:
  - Add expertise areas
  - Adjust pricing
  - Upload profile image
  - Modify bio and details

### 5. Rejection Workflow
- Admin can reject applications with notes
- Application status changes to "rejected"
- Application remains in system for record-keeping

## Database Schema

### consultant_applications Table
```sql
- id (UUID, primary key)
- name (VARCHAR, required)
- age (INTEGER, required)
- gender (VARCHAR: 'male' | 'female')
- qualification (TEXT, required)
- current_job (VARCHAR, required)
- location (VARCHAR, required)
- experience (TEXT, required)
- email (VARCHAR, required)
- phone (VARCHAR, required)
- whatsapp (VARCHAR, required)
- linkedin_url (TEXT, optional)
- status (VARCHAR: 'pending' | 'approved' | 'rejected')
- admin_notes (TEXT, optional)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

## Files Created/Modified

### New Files
1. `database/consultant-applications-setup.sql` - Database schema
2. `src/services/consultantApplications.ts` - API service
3. `src/pages/ApplyConsultant.tsx` - Public application form
4. `src/pages/admin/AdminConsultantApplications.tsx` - Admin panel
5. `CONSULTANT-APPLICATION-SYSTEM.md` - This documentation

### Modified Files
1. `src/lib/database.types.ts` - Added consultant_applications type
2. `src/App.tsx` - Added routes
3. `src/components/Header.tsx` - Added "Become a Consultant" button
4. `src/components/admin/AdminSidebar.tsx` - Added menu item

## Setup Instructions

### 1. Run Database Migration
Execute in Supabase SQL Editor:
```bash
database/consultant-applications-setup.sql
```

This creates:
- consultant_applications table
- Indexes for performance
- RLS policies (anyone can apply, admins can manage)

### 2. Restart Development Server
```bash
npm run dev
```

### 3. Test the System

**As a User**:
1. Click "Become a Consultant" in header
2. Fill out application form
3. Submit and see confirmation

**As an Admin**:
1. Login as admin
2. Go to Admin Panel → Consultant Applications
3. View pending applications
4. Click "View" on an application
5. Review details
6. Click "Approve & Create Consultant" or "Reject"

## User Flow

```
User Applies
    ↓
Application Saved (status: pending)
    ↓
Admin Reviews in Panel
    ↓
    ├─→ Approve → Creates Consultant → Status: approved
    └─→ Reject → Status: rejected
```

## Admin Workflow

### Reviewing Applications
1. Navigate to "Consultant Applications" in admin sidebar
2. See list of all applications with status
3. Use filters to view: All, Pending, Approved, or Rejected
4. Search by name or email

### Approving an Application
1. Click "View" on pending application
2. Review all details carefully
3. Add admin notes (optional)
4. Click "Approve & Create Consultant"
5. System automatically:
   - Creates consultant profile
   - Sets gender for avatar
   - Applies default pricing
   - Marks as active
6. Admin can then edit consultant to:
   - Add expertise tags
   - Adjust pricing
   - Upload profile photo
   - Refine bio

### Rejecting an Application
1. Click "View" on application
2. Add rejection reason in admin notes
3. Click "Reject"
4. Application marked as rejected

## Default Avatar System

When a consultant is created from an application:
- **Gender field** is automatically transferred
- **Male** → Shows 👨‍💼 avatar (if no image)
- **Female** → Shows 👩‍💼 avatar (if no image)
- Admin can upload custom image later

## Security & Permissions

### RLS Policies
- **Insert**: Anyone can submit application (public)
- **Select**: Only admins can view applications
- **Update**: Only admins can update status/notes
- **Delete**: Only admins can delete applications

### Data Validation
- Age: 18-100 years
- Email: Valid email format
- Phone/WhatsApp: Required
- All text fields: Sanitized

## UI/UX Features

### Application Form
- Clean, step-by-step layout
- Grouped sections (Personal, Professional, Contact)
- Clear field labels and placeholders
- Required field indicators
- Success confirmation page
- Mobile-responsive

### Admin Panel
- Status color coding (yellow/green/red)
- Quick filters and search
- Detailed view dialog
- One-click approve/reject
- Admin notes for tracking

## Integration with Existing System

### Consultants Table
- Gender field already added (from previous update)
- Default male/female avatars working
- Seamless integration with approval process

### Admin Panel
- New menu item in sidebar
- Consistent design with other admin pages
- Uses existing UI components

## Testing Checklist

- [ ] User can access application form from header
- [ ] Form validation works correctly
- [ ] Application submits successfully
- [ ] Success page displays after submission
- [ ] Admin can view all applications
- [ ] Status filters work correctly
- [ ] Search functionality works
- [ ] View dialog shows all details
- [ ] Approve creates consultant correctly
- [ ] Gender transfers to consultant
- [ ] Default pricing applies
- [ ] Reject updates status
- [ ] Admin notes save correctly
- [ ] Delete removes application

## Future Enhancements

### Potential Features
- [ ] Email notifications to applicants
- [ ] Application status tracking for users
- [ ] Resume/CV upload
- [ ] Video introduction upload
- [ ] Multi-step application form
- [ ] Application analytics dashboard
- [ ] Bulk approve/reject
- [ ] Application templates
- [ ] Interview scheduling
- [ ] Applicant portal to check status

## Troubleshooting

### Application not submitting
- Check console for errors
- Verify all required fields filled
- Check database connection

### Admin can't see applications
- Verify admin role in profiles table
- Check RLS policies are enabled
- Verify user is authenticated

### Consultant not created on approval
- Check consultants table exists
- Verify admin has permissions
- Check console for errors

## Support

For issues or questions:
1. Check console for error messages
2. Verify database setup completed
3. Ensure user has admin role
4. Review RLS policies in Supabase

---

**Status**: ✅ Complete and Ready  
**Version**: 1.0.0  
**Date**: 2026-03-15
