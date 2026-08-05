// Setup Consultant Roles - Run this to ensure all consultants have proper access
// Usage: node setup-consultant-roles.js

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://tzihsuzxwziirpkvxysr.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR6aWhzdXp4d3ppaXJwa3Z4eXNyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMTkzNzI2NCwiZXhwIjoyMDQ3NTEzMjY0fQ.Kh8Jk9Lm2Np3Qr4St5Vw6Xy7Za8Bc9De0Fg1Hi2Jk3L'; // Service role key

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupConsultantRoles() {
  console.log('🚀 Setting up consultant roles and access control...');

  try {
    // Read the SQL file
    const sqlContent = fs.readFileSync('./database/consultant-role-setup.sql', 'utf8');
    
    // Split into individual statements (basic splitting)
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--') && !stmt.startsWith('/*'));

    console.log(`📝 Found ${statements.length} SQL statements to execute`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      // Skip comments and empty statements
      if (statement.startsWith('--') || statement.startsWith('/*') || statement.trim().length === 0) {
        continue;
      }

      console.log(`⚡ Executing statement ${i + 1}/${statements.length}`);
      
      try {
        const { error } = await supabase.rpc('exec_sql', { sql_query: statement });
        
        if (error) {
          console.error(`❌ Error in statement ${i + 1}:`, error.message);
          // Continue with other statements
        } else {
          console.log(`✅ Statement ${i + 1} executed successfully`);
        }
      } catch (err) {
        console.error(`❌ Exception in statement ${i + 1}:`, err.message);
      }
    }

    // Verify setup
    console.log('\n🔍 Verifying consultant roles...');
    
    const { data: consultants, error: consultantsError } = await supabase
      .from('consultants')
      .select('id, name, user_id, is_active')
      .eq('is_active', true);

    if (consultantsError) {
      console.error('❌ Error fetching consultants:', consultantsError.message);
      return;
    }

    console.log(`📊 Found ${consultants.length} active consultants`);

    // Check roles for each consultant
    for (const consultant of consultants) {
      if (consultant.user_id) {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', consultant.user_id)
          .single();

        if (profileError) {
          console.log(`⚠️  ${consultant.name}: No profile found`);
        } else {
          const hasCorrectRole = profile.role === 'consultant';
          console.log(`${hasCorrectRole ? '✅' : '❌'} ${consultant.name}: Role = ${profile.role}`);
        }
      } else {
        console.log(`⚠️  ${consultant.name}: No user_id linked`);
      }
    }

    console.log('\n🎉 Consultant role setup completed!');
    console.log('\n📋 Next steps:');
    console.log('1. Test consultant dashboard access');
    console.log('2. Verify consultants can see their bookings');
    console.log('3. Test payout request functionality');

  } catch (error) {
    console.error('❌ Setup failed:', error.message);
  }
}

// Alternative function to create exec_sql if it doesn't exist
async function createExecSqlFunction() {
  const createFunctionSQL = `
    CREATE OR REPLACE FUNCTION exec_sql(sql_query text)
    RETURNS void
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $$
    BEGIN
      EXECUTE sql_query;
    END;
    $$;
  `;

  const { error } = await supabase.rpc('exec', { sql: createFunctionSQL });
  
  if (error) {
    console.log('Note: exec_sql function creation failed, trying direct execution');
  } else {
    console.log('✅ Created exec_sql helper function');
  }
}

// Run setup
setupConsultantRoles().catch(console.error);