// One-time secure admin setup script using Supabase Admin API
// Usage: SUPABASE_SERVICE_ROLE_KEY=<KEY> ADMIN_PASSWORD=<SECURE_PASSWORD> node setup-admin-user.js
// Or: node setup-admin-user.js <SERVICE_ROLE_KEY> <SECURE_PASSWORD> [--force-reset-password]

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://rfyxnshvtfswvaogjzwq.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_QPkFtczpj8_WzxPf4ZoENw_ZpnfN9vd';
const SUPABASE_SERVICE_ROLE_KEY = process.argv[2] || process.env.SUPABASE_SERVICE_ROLE_KEY;

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@foundarly.com').trim().toLowerCase();
const ADMIN_PASSWORD = process.argv[3] || process.env.ADMIN_PASSWORD;
const FORCE_RESET = process.argv.includes('--force-reset-password');

async function main() {
  console.log('====================================================');
  console.log('  Foundarly Admin User Setup (Supabase Admin API)  ');
  console.log('====================================================');
  console.log(`Supabase URL: ${SUPABASE_URL}`);
  console.log(`Target Admin Email: ${ADMIN_EMAIL}`);

  if (!SUPABASE_SERVICE_ROLE_KEY) {
    console.error('\n❌ ERROR: Supabase Service Role Key is required.');
    console.error('Please run the script with your Service Role Key:');
    console.error('  SUPABASE_SERVICE_ROLE_KEY=<KEY> ADMIN_PASSWORD=<SECURE_PASS> node setup-admin-user.js\n');
    process.exit(1);
  }

  if (!ADMIN_PASSWORD) {
    console.error('\n❌ ERROR: Secure ADMIN_PASSWORD must be explicitly provided.');
    console.error('Do not use predictable default passwords in production.');
    console.error('Usage:');
    console.error('  ADMIN_PASSWORD="<STRONG_PASSWORD_MIN_12_CHARS>" node setup-admin-user.js <SERVICE_ROLE_KEY>\n');
    process.exit(1);
  }

  if (ADMIN_PASSWORD.length < 12) {
    console.error('\n❌ ERROR: Password is too short. Minimum 12 characters required for administrator accounts.\n');
    process.exit(1);
  }

  // Initialize Supabase Admin Client using Service Role Key
  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    console.log(`\n1. Searching for existing user: ${ADMIN_EMAIL}...`);
    const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers();

    if (listError) {
      throw new Error(`Failed to list users: ${listError.message}`);
    }

    const existingUser = listData?.users?.find(u => u.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase());

    let userId = null;

    if (existingUser) {
      userId = existingUser.id;
      console.log(`\n2. Existing user found (ID: ${userId}).`);

      if (FORCE_RESET) {
        console.log('Flag --force-reset-password supplied. Updating password...');
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
          password: ADMIN_PASSWORD,
          email_confirm: true,
          user_metadata: {
            full_name: 'Super Admin',
          },
        });

        if (updateError) {
          throw new Error(`Failed to update admin password: ${updateError.message}`);
        }
        console.log('✅ Admin password updated successfully.');
      } else {
        console.log('ℹ️ User already exists. Existing credentials preserved (use --force-reset-password to overwrite).');
      }
    } else {
      console.log(`\n2. User not found. Creating new admin user via auth.admin.createUser()...`);

      const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        email_confirm: true,
        user_metadata: {
          full_name: 'Super Admin',
        },
      });

      if (createError) {
        throw new Error(`Failed to create admin user via auth.admin: ${createError.message}`);
      }

      userId = createData.user.id;
      console.log('✅ Admin user created successfully (ID:', userId, ')');
    }

    console.log(`\n3. Ensuring public.profiles record has role='super_admin' / 'admin' for user ID: ${userId}...`);
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: userId,
        full_name: 'Super Admin',
        role: 'super_admin',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });

    if (profileError) {
      throw new Error(`Failed to update public.profiles: ${profileError.message}`);
    }

    console.log('✅ public.profiles updated successfully with role=super_admin.');

    console.log('\n4. Verifying account credentials...');
    const standardClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: loginData, error: loginError } = await standardClient.auth.signInWithPassword({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });

    if (loginError) {
      console.warn('⚠️ Verification check warning (credentials may have been preserved from earlier):', loginError.message);
    } else {
      console.log('✅ LOGIN VERIFIED SUCCESSFULLY for user ID:', loginData.user.id);
    }

    console.log('\n====================================================');
    console.log('🎉 Admin setup completed securely without printing secret credentials.');
    console.log('====================================================\n');
  } catch (err) {
    console.error('\n❌ Admin setup script failed:', err.message || err);
    process.exit(1);
  }
}

main();
