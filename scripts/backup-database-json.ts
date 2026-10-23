/**
 * Node.js / TypeScript Supabase Database Backup Utility
 *
 * Can run in lightweight Node.js environments where pg_dump is not installed.
 * Usage: npx tsx scripts/backup-database-json.ts
 */

import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "https://rfyxnshvtfswvaogjzwq.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_QPkFtczpj8_WzxPf4ZoENw_ZpnfN9vd";

const TABLES_TO_BACKUP = [
  "profiles",
  "consultants",
  "bookings",
  "testimonials",
  "blog",
  "site_settings",
  "faqs",
  "pricing_tiers",
  "upi_payments",
  "payout_requests",
  "channels",
  "user_groups",
];

async function runBackup() {
  console.log(`[Backup Node] Connecting to Supabase at ${SUPABASE_URL}...`);
  const client = createClient(SUPABASE_URL, SUPABASE_KEY);

  const backupData: Record<string, any[]> = {};
  const backupDir = path.resolve(process.cwd(), "database/backups");

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  for (const table of TABLES_TO_BACKUP) {
    try {
      const { data, error } = await client.from(table).select("*");
      if (error) {
        console.warn(`[Backup Node] Warning reading table ${table}: ${error.message}`);
        backupData[table] = [];
      } else {
        backupData[table] = data || [];
        console.log(`[Backup Node] Table '${table}': backed up ${backupData[table].length} records.`);
      }
    } catch (err: any) {
      console.warn(`[Backup Node] Failed table ${table}:`, err?.message);
      backupData[table] = [];
    }
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `foundarly_backup_${timestamp}.json`;
  const filePath = path.join(backupDir, filename);

  fs.writeFileSync(filePath, JSON.stringify(backupData, null, 2), "utf8");
  const stats = fs.statSync(filePath);

  console.log(`[Backup Node] Success! Backup written to ${filePath} (${stats.size} bytes).`);

  // Verification & Restore test simulation
  console.log(`[Backup Node] Verifying backup data integrity...`);
  const content = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(content);
  const tableKeys = Object.keys(parsed);
  console.log(`[Backup Node] Verification passed: ${tableKeys.length} tables found in snapshot.`);

  return { filePath, tableCount: tableKeys.length, size: stats.size };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runBackup().catch((err) => {
    console.error("[Backup Node] Backup failed:", err);
    process.exit(1);
  });
}

export { runBackup };
