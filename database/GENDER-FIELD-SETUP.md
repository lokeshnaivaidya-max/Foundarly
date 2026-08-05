# Gender Field Setup Guide

This guide explains how to add the gender field to the consultants table for proper avatar display.

## What Changed

The consultant avatars now display gender-appropriate emojis when no profile image is uploaded:
- Male: 👨‍💼 (default)
- Female: 👩‍💼

## Database Migration

Run the following SQL in your Supabase SQL Editor:

```sql
-- Add gender field to consultants table
ALTER TABLE consultants 
ADD COLUMN gender VARCHAR(20) CHECK (gender IN ('male', 'female')) DEFAULT 'male';

-- Add comment to explain the field
COMMENT ON COLUMN consultants.gender IS 'Gender of the consultant for appropriate avatar display';
```

Or simply run the file: `database/add-gender-field.sql`

## Updated Files

1. **Database Types** (`src/lib/database.types.ts`)
   - Added gender field to consultants table type

2. **Admin Consultants** (`src/pages/admin/AdminConsultants.tsx`)
   - Added gender dropdown in the form
   - Updated grid view to show gender-appropriate avatars
   - Added helper function for avatar emoji selection

3. **Consultants Section** (`src/components/home/ConsultantsSection.tsx`)
   - Updated to show gender-appropriate avatars instead of initials

4. **Consultants Page** (`src/pages/Consultants.tsx`)
   - Updated to show gender-appropriate avatars instead of initials

## How to Use

1. Run the database migration SQL
2. Edit existing consultants in the admin panel to set their gender (male or female)
3. New consultants will default to "male" (👨‍💼)
4. The avatar will automatically update based on the selected gender

## Notes

- Existing consultants will default to "male" until updated
- The gender field defaults to "male"
- Profile images always take priority over emoji avatars
