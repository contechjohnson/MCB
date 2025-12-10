#!/usr/bin/env node

/**
 * Diagnose exactly why webhooks are failing
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function diagnose() {
  console.log('🔍 Diagnosing webhook failure...\n');

  // 1. Check if the RPC function exists
  const { data: functions, error: fnError } = await supabase.rpc('pg_get_functiondef', {
    funcid: 'update_contact_with_event'
  }).single();

  console.log('1. Checking if update_contact_with_event function exists:');
  if (fnError) {
    console.log('   ❌ Function not found or error:', fnError.message);
  } else {
    console.log('   ✅ Function exists');
  }
  console.log('');

  // 2. Get the most recent webhook log with full details
  const { data: latestLog, error: logError } = await supabase
    .from('webhook_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!logError && latestLog) {
    console.log('2. Latest webhook log details:');
    console.log(`   Source: ${latestLog.source}`);
    console.log(`   Event Type: ${latestLog.event_type}`);
    console.log(`   Status: ${latestLog.status}`);
    console.log(`   Created: ${new Date(latestLog.created_at).toLocaleString()}`);
    if (latestLog.error_message) {
      console.log(`   ❌ Error: ${latestLog.error_message}`);
    }
    if (latestLog.contact_id) {
      console.log(`   Contact ID: ${latestLog.contact_id}`);
    }
    console.log('');
  }

  // 3. Try calling the function directly to test it
  console.log('3. Testing update_contact_with_event function directly:');

  // Get a test contact
  const { data: testContact } = await supabase
    .from('contacts')
    .select('id, tenant_id')
    .limit(1)
    .single();

  if (testContact) {
    console.log(`   Using test contact: ${testContact.id.substring(0, 8)}...`);

    const { data: result, error: rpcError } = await supabase.rpc('update_contact_with_event', {
      p_contact_id: testContact.id,
      p_update_data: { test_field: 'test_value' },
      p_event_type: 'test_event',
      p_source: 'test',
      p_source_event_id: `test_${Date.now()}`
    });

    if (rpcError) {
      console.log('   ❌ RPC call failed:', rpcError.message);
      console.log('   Details:', JSON.stringify(rpcError, null, 2));
    } else {
      console.log('   ✅ RPC call succeeded');
      console.log('   Result:', result);
    }
  } else {
    console.log('   ⚠️  No test contact available');
  }
  console.log('');

  // 4. Check recent webhook_logs for any with error_message
  const { data: errorLogs } = await supabase
    .from('webhook_logs')
    .select('source, event_type, error_message, created_at')
    .not('error_message', 'is', null)
    .order('created_at', { ascending: false })
    .limit(5);

  if (errorLogs && errorLogs.length > 0) {
    console.log('4. Recent webhook errors:');
    errorLogs.forEach((log, i) => {
      console.log(`   ${i + 1}. [${log.source}] ${log.event_type}:`);
      console.log(`      ${log.error_message}`);
    });
  } else {
    console.log('4. No explicit error messages in webhook_logs');
  }
}

diagnose().catch(error => {
  console.error('❌ Diagnosis failed:', error);
  process.exit(1);
});
