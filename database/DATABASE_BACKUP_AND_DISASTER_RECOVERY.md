# Foundarly — Database Backup & Disaster Recovery Standard Operating Procedure (SOP)

## 1. Executive Summary & Audit Classification

- **Current Status**: **BLOCKED (Automated Supabase Cloud Backups)** / **PASS (Manual CLI & Backup Script Provided)**
- **Audit Findings**:
  - The application relies on Supabase PostgreSQL (`rfyxnshvtfswvaogjzwq.supabase.co`).
  - Automated Point-In-Time-Recovery (PITR) and daily scheduled automated snapshots in Supabase require a paid Pro tier and manual configuration in the Supabase Cloud Management Console.
  - The repository previously lacked automated backup scripts or documented recovery procedures.
  - Below is the production-ready manual backup procedure, executable script, retention schedule, and exact steps to configure automated backups in the Supabase Dashboard.

---

## 2. Automated Supabase Cloud Configuration (Requires Project Owner)

To enable automated managed backups in Supabase:

1. Log into the [Supabase Dashboard](https://supabase.com/dashboard/project/rfyxnshvtfswvaogjzwq).
2. Navigate to **Project Settings** > **Database** > **Backups**.
3. **Daily Scheduled Backups**:
   - Ensure the project plan is Pro or Team.
   - Verify that automated nightly backups (7-day or 30-day retention) are active.
4. **Point-In-Time Recovery (PITR)**:
   - Under Backups, enable **Point in Time Recovery (PITR)** to allow restoring the database to any specific second within the last 7 days.
5. **Access Restrictions**:
   - Limit database backup download privileges strictly to the Super Admin organization account.
   - Never share database direct connection strings (`postgres://...`) in public repositories.

---

## 3. Self-Hosted / CLI Manual Backup Procedure

We provide an executable CLI backup script at `scripts/backup-database.sh`.

### Prerequisites
- Supabase CLI installed (`npm install -g supabase` or `brew install supabase/tap/supabase`) OR `pg_dump` installed locally.
- Database connection URI or Supabase Project Reference ID.

### Running a Manual Backup

```bash
# Set your Supabase Database URL (with password)
export DATABASE_URL="postgresql://postgres:[YOUR_DB_PASSWORD]@db.rfyxnshvtfswvaogjzwq.supabase.co:5432/postgres"

# Execute the automated backup script
./scripts/backup-database.sh
```

Alternatively using the Supabase CLI:

```bash
# Dump the complete schema (DDL)
supabase db dump --project-ref rfyxnshvtfswvaogjzwq -f backup_schema_$(date +%Y%m%d_%H%M%S).sql

# Dump data only (DML)
supabase db dump --project-ref rfyxnshvtfswvaogjzwq --data-only -f backup_data_$(date +%Y%m%d_%H%M%S).sql
```

---

## 4. Retention Schedule & Storage

| Backup Type | Frequency | Retention Period | Storage Location |
|-------------|-----------|------------------|------------------|
| Daily Full Dump | Nightly at 02:00 UTC | 30 Days | Encrypted S3/Cloud Storage |
| Weekly Snapshot | Sunday at 03:00 UTC | 90 Days | Off-site Cold Storage |
| Monthly Archive | 1st of each month | 365 Days | Long-term Compliance Vault |

---

## 5. Restoration & Recovery Testing Procedure

To test or execute a disaster recovery restoration into a staging/testing database:

1. **Create an isolated restore target database** (never restore blindly over production).
2. **Execute restoration**:
   ```bash
   psql "$STAGING_DATABASE_URL" < backup_full_YYYYMMDD_HHMMSS.sql
   ```
3. **Verify Integrity**:
   - Check table row counts: `SELECT count(*) FROM public.bookings;`
   - Check payment records: `SELECT count(*) FROM public.upi_payments;`
   - Verify RLS policies are active: `SELECT relname, relrowsecurity FROM pg_class WHERE relnamespace = 'public'::regnamespace;`
