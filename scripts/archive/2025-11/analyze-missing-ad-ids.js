#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function analyzeAdIds() {
  const startStr = '2025-11-07';
  const endStr = '2025-11-14';

  console.log('🔍 ANALYZING MISSING AD_IDs\n');
  console.log(`Date Range: ${startStr} to ${endStr}\n`);

  // Get contacts created this week
  const { data: contacts } = await supabase
    .from('contacts')
    .select('*')
    .gte('created_at', startStr)
    .lt('created_at', endStr)
    .neq('source', 'instagram_historical');

  console.log(`Total Contacts This Week: ${contacts.length}\n`);

  // Breakdown by source
  const bySources = {};
  contacts.forEach(c => {
    const source = c.source || 'unknown';
    if (!bySources[source]) {
      bySources[source] = { total: 0, withAdId: 0, withoutAdId: 0 };
    }
    bySources[source].total++;
    if (c.ad_id) {
      bySources[source].withAdId++;
    } else {
      bySources[source].withoutAdId++;
    }
  });

  console.log('📊 CONTACTS BY SOURCE:\n');
  Object.entries(bySources).forEach(([source, stats]) => {
    const pctWithout = ((stats.withoutAdId / stats.total) * 100).toFixed(1);
    console.log(`${source}:`);
    console.log(`  Total: ${stats.total}`);
    console.log(`  With AD_ID: ${stats.withAdId} (${((stats.withAdId / stats.total) * 100).toFixed(1)}%)`);
    console.log(`  Without AD_ID: ${stats.withoutAdId} (${pctWithout}%) ${stats.withoutAdId > stats.total * 0.3 ? '⚠️' : ''}\n`);
  });

  // Check for contacts with mc_id but no ad_id (ManyChat contacts who should have ad_id)
  const mcContactsNoAdId = contacts.filter(c => c.mc_id && !c.ad_id);
  console.log(`\n🔴 ManyChat Contacts WITHOUT AD_ID: ${mcContactsNoAdId.length}`);
  console.log('   (These SHOULD have ad_id if coming from paid ads)\n');

  // Sample a few
  if (mcContactsNoAdId.length > 0) {
    console.log('Sample ManyChat contacts missing AD_ID:');
    mcContactsNoAdId.slice(0, 10).forEach(c => {
      console.log(`  - ${c.first_name || 'Unknown'} ${c.last_name || ''} | MC_ID: ${c.mc_id} | Source: ${c.source} | Trigger: ${c.trigger_word || 'none'} | Created: ${c.created_at}`);
    });
  }

  // Check website contacts (expected to have no ad_id)
  const websiteContacts = contacts.filter(c => c.source === 'website');
  console.log(`\n✅ Website Contacts (Expected to have no AD_ID): ${websiteContacts.length}`);

  // Total attribution rate
  const totalWithAdId = contacts.filter(c => c.ad_id).length;
  const totalWithoutAdId = contacts.filter(c => !c.ad_id).length;
  const attributionRate = ((totalWithAdId / contacts.length) * 100).toFixed(1);

  console.log(`\n📈 OVERALL ATTRIBUTION:`);
  console.log(`  With AD_ID: ${totalWithAdId} (${attributionRate}%)`);
  console.log(`  Without AD_ID: ${totalWithoutAdId} (${(100 - attributionRate).toFixed(1)}%)`);
}

analyzeAdIds().catch(console.error);
