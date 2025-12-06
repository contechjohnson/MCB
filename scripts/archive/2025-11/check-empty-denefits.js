#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

(async () => {
  console.log('🔍 CHECKING RECENT DENEFITS WEBHOOKS');
  console.log('═'.repeat(70));
  console.log();

  // Get last 10 Denefits webhooks
  const { data: recentLogs } = await supabase
    .from('webhook_logs')
    .select('*')
    .eq('source', 'denefits')
    .order('created_at', { ascending: false })
    .limit(10);

  console.log('Last 10 Denefits webhooks:');
  console.log('─'.repeat(70));
  console.log();

  if (!recentLogs || recentLogs.length === 0) {
    console.log('❌ No recent webhooks found');
    return;
  }

  recentLogs.forEach((log, i) => {
    console.log((i + 1) + '. Webhook at:', log.created_at);
    console.log('   Event Type:', log.event_type);
    console.log('   Status:', log.status);
    console.log('   MC_ID:', log.mc_id || 'NULL');
    console.log('   Contact ID:', log.contact_id || 'NULL');

    // Check payload structure
    const payload = log.payload;

    if (!payload) {
      console.log('   ⚠️  EMPTY PAYLOAD!');
    } else if (Array.isArray(payload)) {
      console.log('   Payload: Array with', payload.length, 'items');
      if (payload.length > 0) {
        const firstItem = payload[0];
        console.log('   First Item Keys:', Object.keys(firstItem).join(', '));
        if (firstItem.data) {
          console.log('   Has data.contract:', !!firstItem.data.contract);
          if (firstItem.data.contract) {
            console.log('   Contract Code:', firstItem.data.contract.contract_code || 'NULL');
            console.log('   Customer Email:', firstItem.data.contract.customer_email || 'NULL');
          }
        }
      } else {
        console.log('   ⚠️  EMPTY ARRAY!');
      }
    } else {
      console.log('   Payload: Object');
      console.log('   Keys:', Object.keys(payload).join(', '));
    }

    if (log.error_message) {
      console.log('   ❌ Error:', log.error_message);
    }

    console.log();
  });

  // Compare: webhooks before vs after our changes
  console.log('═'.repeat(70));
  console.log('TIMELINE COMPARISON:');
  console.log('═'.repeat(70));

  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

  const { data: veryRecentLogs } = await supabase
    .from('webhook_logs')
    .select('*')
    .eq('source', 'denefits')
    .gte('created_at', oneHourAgo.toISOString())
    .order('created_at', { ascending: false });

  console.log('Webhooks in last hour:', veryRecentLogs?.length || 0);

  if (veryRecentLogs && veryRecentLogs.length > 0) {
    const emptyPayloads = veryRecentLogs.filter(l => !l.payload || (Array.isArray(l.payload) && l.payload.length === 0));
    console.log('Empty payloads:', emptyPayloads.length);

    if (emptyPayloads.length > 0) {
      console.log();
      console.log('🚨 FOUND EMPTY PAYLOADS:');
      emptyPayloads.forEach(log => {
        console.log('  -', log.created_at);
        console.log('    Payload:', JSON.stringify(log.payload));
      });
    }
  }

  // Check Make.com specifically
  console.log();
  console.log('═'.repeat(70));
  console.log('POSSIBLE CAUSE:');
  console.log('═'.repeat(70));
  console.log('If webhooks are coming through Make.com:');
  console.log('  1. Check Make.com execution history');
  console.log('  2. Verify HTTP module body is set to {{1}} not {{1.payload}}');
  console.log('  3. Body type should be Application/JSON');
  console.log();
  console.log('If webhooks are direct from Denefits:');
  console.log('  1. Check Denefits webhook configuration');
  console.log('  2. Verify endpoint URL is correct');
  console.log('  3. Check Denefits is actually sending data');
})();
