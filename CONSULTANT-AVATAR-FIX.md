# Consultant Avatar Fix - Gender-Based Display

## Problem
Consultant avatars were showing "weird" placeholder content (initials) that didn't reflect the consultant's gender.

## Solution
Added a gender field to consultants and implemented gender-appropriate avatar emojis:

### Avatar Display Logic
- **Male**: 👨‍💼 (Man in business suit) - Default
- **Female**: 👩‍💼 (Woman in business suit)

1. **Database Schema** (`database/add-gender-field.sql`)
   - Added `gender` column with values: 'male', 'female'
   - Default value: 'male'

2. **TypeScript Types** (`src/lib/database.types.ts`)
   - Updated consultant type definitions

3. **Admin Panel** (`src/pages/admin/AdminConsultants.tsx`)
   - Added gender dropdown in consultant form
   - Updated grid view avatars
   - Added helper function for emoji selection

4. **Frontend Display**
   - `src/components/home/ConsultantsSection.tsx` - Home page consultants
   - `src/pages/Consultants.tsx` - Consultants listing page

## Setup Instructions

1. Run the database migration:
   ```bash
   # Execute in Supabase SQL Editor
   database/add-gender-field.sql
   ```

2. Update existing consultants:
   - Go to Admin Panel → Consultants
   - Edit each consultant and select appropriate gender
   - Save changes

3. The avatars will automatically update based on gender selection

## Notes
- Profile images always take priority over emoji avatars
- Existing consultants default to "male" until updated
- The gender field is used purely for avatar display purposes
