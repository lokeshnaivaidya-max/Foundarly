// One-time secure admin setup script using Supabase Admin API
// Usage: node setup-admin-user.js <SUPABASE_SERVICE_ROLE_KEY>
// Or: SUPABASE_SERVICE_ROLE_KEY=<KEY> node setup-admin-user.js

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://rfyxnshvtfswvaogjzwq.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_QPkFtczpj8_WzxPf4ZoENw_ZpnfN9vd';
const SUPABASE_SERVICE_ROLE_KEY = process.argv[2] || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const ADMIN_EMAIL = 'admin@foundarly.com';
const ADMIN_PASSWORD = 'admin1234';

async function main() {
  console.log('====================================================');
  console.log('  Foundarly Admin User Setup (Supabase Admin API)  ');
  console.log('====================================================');
  console.log(`Supabase URL: ${SUPABASE_URL}`);

  if (!SUPABASE_SERVICE_ROLE_KEY) {
    console.error('\n❌ ERROR: Supabase Service Role Key is required.');
    console.error('Please run the script with your Service Role Key:');
    console.error('  node setup-admin-user.js <YOUR_SERVICE_ROLE_KEY>');
    console.error('Or set SUPABASE_SERVICE_ROLE_KEY in your environment.\n');
    process.exit(1);
  }

  // Initialize Supabase Admin Client using Service Role Key
  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
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
      console.log(`\n2. Existing user found (ID: ${existingUser.id}). Updating password and confirming email via auth.admin.updateUserById()...`);
      userId = existingUser.id;

      const { data: updateData, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: ADMIN_PASSWORD,
        email_confirm: true,
        user_metadata: {
          full_name: 'Admin User'
        }
      });

      if (updateError) {
        throw new Error(`Failed to update admin user via auth.admin: ${updateError.message}`);
      }

      console.log('✅ Admin user updated successfully:', updateData.user.email);
    } else {
      console.log(`\n2. User not found. Creating new admin user via auth.admin.createUser()...`);

      const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        email_confirm: true,
        user_metadata: {
          full_name: 'Admin User'
        }
      });

      if (createError) {
        throw new Error(`Failed to create admin user via auth.admin: ${createError.message}`);
      }

      userId = createData.user.id;
      console.log('✅ Admin user created successfully:', createData.user.email, `(ID: ${userId})`);
    }

    console.log(`\n3. Ensuring public.profiles record has role='admin' for user ID: ${userId}...`);
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: userId,
        full_name: 'Admin User',
        role: 'admin',
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' })
      .select();

    if (profileError) {
      throw new Error(`Failed to update public.profiles: ${profileError.message}`);
    }

    console.log('✅ public.profiles updated successfully:', profileData);

    console.log(`\n4. Verifying login via standard client signInWithPassword(${ADMIN_EMAIL}, '${ADMIN_PASSWORD}')...`);
    const standardClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { data: loginData, error: loginError } = await standardClient.auth.signInWithPassword({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    });

    console.log('\n--- Login Verification Result ---');
    if (loginError) {
      console.error('❌ Login verification failed:', {
        status: loginError.status,
        name: loginError.name,
        message: loginError.message
      });
    } else {
      console.log('✅ LOGIN VERIFIED SUCCESSFULLY!');
      console.log('User ID:', loginData.user.id);
      console.log('Email:', loginData.user.email);
      console.log('Confirmed At:', loginData.user.email_confirmed_at);
      console.log('Role in metadata:', loginData.user.role);
    }

  } catch (err) {
    console.error('\n❌ Admin setup script failed:', err.message || err);
    process.exit(1);
  }
}

main();
