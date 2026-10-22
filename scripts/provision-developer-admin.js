#!/usr/bin/env node
/**
 * Secure Developer Admin Account Provisioning Script
 * 
 * Usage:
 *   node scripts/provision-developer-admin.js <SUPABASE_SERVICE_ROLE_KEY> [PASSWORD]
 * Or via environment variables:
 *   SUPABASE_SERVICE_ROLE_KEY=<KEY> DEV_ADMIN_PASSWORD=<PASSWORD> node scripts/provision-developer-admin.js
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://rfyxnshvtfswvaogjzwq.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_QPkFtczpj8_WzxPf4ZoENw_ZpnfN9vd';
const SUPABASE_SERVICE_ROLE_KEY = process.argv[2] || process.env.SUPABASE_SERVICE_ROLE_KEY;

const DEV_EMAIL = (process.env.DEV_ADMIN_EMAIL || 'foundarly@developer.in').trim().toLowerCase();
const DEV_PASSWORD = process.argv[3] || process.env.DEV_ADMIN_PASSWORD;

if (!DEV_PASSWORD) {
  console.error('\n❌ ERROR: DEV_ADMIN_PASSWORD must be explicitly provided.');
  console.error('Usage:');
  console.error('  DEV_ADMIN_PASSWORD="<STRONG_PASSWORD_MIN_12_CHARS>" node scripts/provision-developer-admin.js <SERVICE_ROLE_KEY>\n');
  process.exit(1);
}

async function main() {
  console.log('====================================================');
  console.log('  Foundarly Developer Admin Account Provisioning   ');
  console.log('====================================================');
  console.log(`Supabase Project URL: ${SUPABASE_URL}`);
  console.log(`Target Developer Account: ${DEV_EMAIL}`);

  if (!SUPABASE_SERVICE_ROLE_KEY) {
    console.error('\n❌ ERROR: Supabase Service Role Key is required to provision admin auth accounts.');
    console.error('\nUsage:');
    console.error('  node scripts/provision-developer-admin.js <SUPABASE_SERVICE_ROLE_KEY> [PASSWORD]');
    console.error('Or set SUPABASE_SERVICE_ROLE_KEY in your environment.\n');
    console.error('Alternatively, run the SQL script in Supabase SQL Editor:');
    console.error('  database/05_PROVISION_DEVELOPER_ADMIN.sql\n');
    process.exit(1);
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    console.log(`\n1. Checking if user exists (${DEV_EMAIL})...`);
    const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) {
      throw new Error(`Failed to list users: ${listError.message}`);
    }

    const existingUser = listData?.users?.find(
      (u) => u.email?.toLowerCase() === DEV_EMAIL.toLowerCase()
    );

    let userId = null;

    if (existingUser) {
      console.log(`2. Existing account found (ID: ${existingUser.id}). Updating password and metadata...`);
      userId = existingUser.id;
      const { data: updateData, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: DEV_PASSWORD,
        email_confirm: true,
        user_metadata: {
          full_name: 'Developer Admin',
          must_change_password: true,
        },
      });

      if (updateError) {
        throw new Error(`Failed to update user via auth.admin: ${updateError.message}`);
      }
      console.log('✅ Updated auth user successfully:', updateData.user.email);
    } else {
      console.log(`2. User not found. Creating new auth user via auth.admin.createUser()...`);
      const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: DEV_EMAIL,
        password: DEV_PASSWORD,
        email_confirm: true,
        user_metadata: {
          full_name: 'Developer Admin',
          must_change_password: true,
        },
      });

      if (createError) {
        throw new Error(`Failed to create user via auth.admin: ${createError.message}`);
      }
      userId = createData.user.id;
      console.log('✅ Created auth user successfully (ID: ' + userId + ')');
    }

    console.log(`\n3. Ensuring public.profiles role is strictly set to 'developer_admin'...`);
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: userId,
        full_name: 'Developer Admin',
        role: 'developer_admin',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' })
      .select();

    if (profileError) {
      throw new Error(`Failed to update public.profiles: ${profileError.message}`);
    }
    console.log('✅ public.profiles updated successfully with role developer_admin:', profileData);

    console.log(`\n4. Verifying authentication via standard signInWithPassword()...`);
    const standardClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: loginData, error: loginError } = await standardClient.auth.signInWithPassword({
      email: DEV_EMAIL,
      password: DEV_PASSWORD,
    });

    if (loginError) {
      console.warn('⚠️ Standard login verification warning:', loginError.message);
    } else {
      console.log('✅ Authentication test verified successfully!');
      console.log('   User ID:', loginData.user.id);
      console.log('   Email:', loginData.user.email);
      console.log('   Must Change Password:', loginData.user.user_metadata?.must_change_password);
    }

    console.log('\n====================================================');
    console.log('🎉 Developer Admin Account Provisioning Completed!');
    console.log('   Email: ' + DEV_EMAIL);
    console.log('   Role: developer_admin (Technical Scope Only)');
    console.log('   First Login Action: Change initial password');
    console.log('====================================================\n');
  } catch (err) {
    console.error('\n❌ Provisioning failed:', err.message || err);
    process.exit(1);
  }
}

main();
