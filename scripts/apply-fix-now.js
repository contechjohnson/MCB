#!/usr/bin/env node

/**
 * Apply Fix Migration - Deploy 20251210_006_fix_dual_write_types.sql
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function applyFix() {
  console.log('🚀 Deploying type fix migration...\n');

  // Read the migration file
  const migrationPath = path.join(__dirname, '../migrations/20251210_006_fix_dual_write_types.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  console.log('📄 Migration file loaded\n');
  console.log('Executing SQL...\n');

  // Split into individual statements and execute
  const statements = [];

  // First statement: DROP FUNCTION
  statements.push("DROP FUNCTION IF EXISTS update_contact_with_event;");

  // Second statement: CREATE FUNCTION (everything after DROP)
  const createFunctionSQL = sql.substring(sql.indexOf('CREATE OR REPLACE FUNCTION'));
  statements.push(createFunctionSQL);

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i].trim();
    if (!statement) continue;

    console.log(`  ${i + 1}. Executing: ${statement.substring(0, 40)}...`);

    try {
      // Execute using raw SQL via the REST API
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseServiceKey,
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({ query: statement })
      });

      if (!response.ok) {
        // Try alternative: Use Supabase's internal SQL execution
        const { data, error } = await supabase.rpc('exec', { sql: statement });

        if (error) {
          throw new Error(error.message || 'Unknown error');
        }
      }

      console.log(`     ✅ Success\n`);
    } catch (error) {
      console.error(`     ❌ Failed: ${error.message}\n`);
      console.error('Trying alternative method...\n');

      // Last resort: try via direct connection string
      console.error('❌ Unable to execute via API. Please run manually in Supabase SQL Editor.');
      console.error('\nGo to: https://supabase.com/dashboard/project/yjemznrrqukjfzkrptfv/sql/new');
      console.error('\nPaste and run this SQL:\n');
      console.error('---');
      console.error(sql);
      console.error('---\n');
      process.exit(1);
    }
  }

  console.log('✅ Migration applied successfully!\n');

  // Test the function
  console.log('🧪 Testing fixed function...\n');

  const { data: testContact } = await supabase
    .from('contacts')
    .select('id')
    .limit(1)
    .single();

  if (testContact) {
    const { data, error } = await supabase.rpc('update_contact_with_event', {
      p_contact_id: testContact.id,
      p_update_data: { test_field: 'test_value' },
      p_event_type: 'test_event',
      p_source: 'test',
      p_source_event_id: `test_verification_${Date.now()}`
    });

    if (error) {
      console.error('❌ Function test failed:', error.message);
      process.exit(1);
    }

    console.log('✅ Function test passed!');
    console.log('   Result:', data);
  }

  console.log('\n🎉 Webhooks should now be working!\n');
}

applyFix().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
