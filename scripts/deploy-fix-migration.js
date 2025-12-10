#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function deployFix() {
  console.log('🚀 Deploying fix migration...\n');

  const migrationSQL = fs.readFileSync('migrations/20251210_006_fix_dual_write_types.sql', 'utf8');

  const { data, error } = await supabase.rpc('exec_sql', {
    sql: migrationSQL
  });

  if (error) {
    // Try direct execution via POST
    console.log('⚠️  RPC failed, trying direct execution...\n');

    // Read migration file
    const sql = fs.readFileSync('migrations/20251210_006_fix_dual_write_types.sql', 'utf8');

    // Split into statements (DROP and CREATE)
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const statement of statements) {
      console.log(`Executing: ${statement.substring(0, 50)}...\n`);

      const { error: execError } = await supabase.rpc('exec', {
        query: statement + ';'
      });

      if (execError) {
        console.error('❌ Error executing statement:', execError);
        console.error('Statement:', statement);
        process.exit(1);
      }
    }

    console.log('✅ Migration deployed successfully!\n');
  } else {
    console.log('✅ Migration deployed successfully!\n');
  }

  // Test the function
  console.log('🧪 Testing update_contact_with_event function...\n');

  const { data: testContact } = await supabase
    .from('contacts')
    .select('id, tenant_id')
    .limit(1)
    .single();

  if (testContact) {
    const { data: result, error: rpcError } = await supabase.rpc('update_contact_with_event', {
      p_contact_id: testContact.id,
      p_update_data: { test_field: 'test_value' },
      p_event_type: 'test_event',
      p_source: 'test',
      p_source_event_id: `test_${Date.now()}`
    });

    if (rpcError) {
      console.log('❌ Function still has errors:', rpcError.message);
      process.exit(1);
    } else {
      console.log('✅ Function working correctly!');
      console.log('   Result:', result);
    }
  }

  console.log('\n🎉 Fix deployed and verified!\n');
}

deployFix().catch(error => {
  console.error('❌ Deployment failed:', error);
  process.exit(1);
});
