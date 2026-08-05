# ⚠️ CRITICAL: Run Database Migration

## The 406 Errors Mean the UPI Payments Table Doesn't Exist

You're seeing these errors because the `upi_payments` table hasn't been created in your Supabase database yet.

```
Failed to load resource: the server responded with a status of 406
/rest/v1/upi_payments?select=*&booking_id=eq...
```

---

## How to Fix (2 minutes)

### Step 1: Go to Supabase Dashboard
1. Open https://supabase.com/dashboard
2. Select your project: `tzihsuzxwziirpkvxysr`
3. Click **SQL Editor** in the left sidebar

### Step 2: Run the Migration
1. Click **New Query**
2. Copy the ENTIRE contents of `database/create-upi-payments-table.sql`
3. Paste into the SQL editor
4. Click **Run** (or press Ctrl+Enter)

### Step 3: Verify
You should see:
```
✅ UPI Payments table created successfully
✅ RLS policies enabled
✅ Triggers configured
🎉 Ready for UPI payment processing!
```

---

## What This Creates

The migration creates:
- `upi_payments` table with all fields
- Row Level Security (RLS) policies
- Automatic triggers for booking status updates
- Indexes for performance

---

## After Running Migration

1. **Refresh your browser** (Ctrl+R or Cmd+R)
2. **406 errors will disappear**
3. **"Verify Payment" button will work** in admin
4. **Payment system fully functional**

---

## If You Get Errors

### Error: "relation already exists"
**Solution:** Table already exists, you're good! Just refresh browser.

### Error: "permission denied"
**Solution:** Make sure you're logged in as the project owner in Supabase dashboard.

### Error: "syntax error"
**Solution:** Make sure you copied the ENTIRE file contents, including the first line.

---

## Quick Copy-Paste

The file is located at:
```
database/create-upi-payments-table.sql
```

Or run this command in your terminal:
```bash
# Copy file contents to clipboard (Mac)
cat database/create-upi-payments-table.sql | pbcopy

# Copy file contents to clipboard (Windows)
type database\create-upi-payments-table.sql | clip

# Copy file contents to clipboard (Linux)
cat database/create-upi-payments-table.sql | xclip -selection clipboard
```

Then paste in Supabase SQL Editor and click Run.

---

## Status After Migration

✅ UPI payment table exists
✅ Users can submit payments
✅ Admin can verify payments
✅ Automatic booking confirmation
✅ No more 406 errors

---

**This is a ONE-TIME setup. Once done, it never needs to be run again.**
