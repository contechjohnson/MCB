#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function investigateBOF() {
  console.log('🔍 INVESTIGATING BOTTOM OF FUNNEL SETUP\n');

  const startStr = '2025-11-07';
  const endStr = '2025-11-14';

  // Get all contacts this week
  const { data: contacts } = await supabase
    .from('contacts')
    .select('*')
    .gte('created_at', startStr)
    .lt('created_at', endStr)
    .neq('source', 'instagram_historical');

  console.log(`Total Contacts This Week: ${contacts.length}\n`);

  // Check for BOF indicators
  console.log('📊 LOOKING FOR BOF CONTACTS:\n');

  // BOF contacts should have:
  // - NO mc_id (they skip the chatbot)
  // - ghl_id (they go direct to GHL form)
  // - form_submit_date but NO dm_qualified_date

  const possibleBOF = contacts.filter(c =>
    !c.mc_id && // No ManyChat
    c.ghl_id    // Has GHL (went to form)
  );

  console.log(`Contacts with NO mc_id but WITH ghl_id (BOF candidates): ${possibleBOF.length}\n`);

  if (possibleBOF.length > 0) {
    console.log('Sample BOF candidates:');
    possibleBOF.slice(0, 10).forEach(c => {
      console.log(`  - ${c.first_name || 'Unknown'} ${c.last_name || ''}`);
      console.log(`    GHL_ID: ${c.ghl_id}`);
      console.log(`    Source: ${c.source}`);
      console.log(`    AD_ID: ${c.ad_id || 'NONE'}`);
      console.log(`    Form Submit: ${c.form_submit_date || 'No'}`);
      console.log(`    DM Qualified: ${c.dm_qualified_date || 'No'}`);
      console.log('');
    });
  } else {
    console.log('❌ NO BOF contacts found (no contacts with ghl_id but no mc_id)\n');
    console.log('This suggests either:');
    console.log('  1. BOF ads are not running');
    console.log('  2. BOF ads are going to the main funnel (which has ManyChat)');
    console.log('  3. BOF link is not set up correctly\n');
  }

  // Check ManyChat contacts without ad_id
  console.log('━'.repeat(70));
  console.log('\n🔴 ManyChat Contacts WITHOUT AD_ID (Attribution Failures):\n');

  const mcNoAdId = contacts.filter(c => c.mc_id && !c.ad_id);
  console.log(`Total: ${mcNoAdId.length}\n`);

  // Break down by trigger word
  const byTrigger = {};
  mcNoAdId.forEach(c => {
    const trigger = c.trigger_word || 'none';
    byTrigger[trigger] = (byTrigger[trigger] || 0) + 1;
  });

  console.log('Breakdown by Trigger Word:');
  Object.entries(byTrigger).sort((a, b) => b[1] - a[1]).forEach(([trigger, count]) => {
    console.log(`  ${trigger}: ${count}`);
  });

  // Check if any have form submissions (went further in funnel)
  const mcNoAdIdWithForm = mcNoAdId.filter(c => c.form_submit_date);
  console.log(`\n${mcNoAdIdWithForm.length} of these submitted forms (${((mcNoAdIdWithForm.length / mcNoAdId.length) * 100).toFixed(1)}%)`);

  const mcNoAdIdPurchased = mcNoAdId.filter(c => c.purchase_date);
  console.log(`${mcNoAdIdPurchased.length} of these PURCHASED (${((mcNoAdIdPurchased.length / mcNoAdId.length) * 100).toFixed(1)}%)\n`);

  // Check GHL data for any BOF indicators
  console.log('━'.repeat(70));
  console.log('\n📋 CHECKING GHL WEBHOOK LOGS FOR BOF ACTIVITY:\n');

  const { data: ghlLogs } = await supabase
    .from('webhook_logs')
    .select('*')
    .eq('source', 'ghl')
    .gte('created_at', startStr)
    .lt('created_at', endStr)
    .order('created_at', { ascending: false })
    .limit(100);

  // Look for contacts in GHL logs that don't have mc_id
  if (ghlLogs) {
    const ghlContactsNoMc = ghlLogs.filter(log => {
      const payload = log.payload;
      // Check if payload has email but no MC_ID indicator
      return payload && payload.email && !payload.MC_ID && !payload.customData?.MC_ID;
    });

    console.log(`GHL events without MC_ID: ${ghlContactsNoMc.length} out of ${ghlLogs.length} total GHL events`);

    if (ghlContactsNoMc.length > 0) {
      console.log('\nSample GHL events without MC_ID (possible BOF):');
      ghlContactsNoMc.slice(0, 5).forEach(log => {
        const payload = log.payload;
        console.log(`  - ${payload.name || 'Unknown'} | ${payload.email}`);
        console.log(`    Event: ${log.event_type}`);
        console.log(`    Date: ${log.created_at}`);
        console.log('');
      });
    }
  }

  // Summary
  console.log('━'.repeat(70));
  console.log('\n📝 SUMMARY:\n');
  console.log('BOF Funnel Status:');
  console.log(`  ❌ BOF contacts in database: ${possibleBOF.length}`);
  console.log(`  ${possibleBOF.length === 0 ? '⚠️  BOF ads may be going to main funnel or not running' : '✅ BOF funnel appears to be working'}\n`);

  console.log('Attribution Issues:');
  console.log(`  🔴 ManyChat contacts without ad_id: ${mcNoAdId.length} (${((mcNoAdId.length / contacts.length) * 100).toFixed(1)}%)`);
  console.log(`  💡 These are attribution failures, NOT BOF contacts`);
  console.log(`  💡 They talked to chatbot (have mc_id) but ad_id wasn't captured\n`);
}

investigateBOF().catch(console.error);
