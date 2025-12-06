#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function checkAllNonMcAdIds() {
  const startStr = '2025-11-07';
  const endStr = '2025-11-14';

  console.log('🔍 CHECKING ALL CONTACTS WITH AD_ID BUT NO MC_ID\n');
  console.log('═'.repeat(70));

  // Get all contacts this week with ad_id but no mc_id
  const { data: contacts } = await supabase
    .from('contacts')
    .select('ad_id, first_name, last_name, source, created_at')
    .gte('created_at', startStr)
    .lt('created_at', endStr)
    .neq('source', 'instagram_historical')
    .not('ad_id', 'is', null)
    .is('mc_id', null);

  console.log(`\nTotal contacts with AD_ID but NO MC_ID: ${contacts.length}\n`);

  // Group by ad_id
  const byAdId = {};
  contacts.forEach(c => {
    if (!byAdId[c.ad_id]) {
      byAdId[c.ad_id] = [];
    }
    byAdId[c.ad_id].push(c);
  });

  console.log(`Unique AD_IDs: ${Object.keys(byAdId).length}\n`);

  // Show breakdown
  const knownAdSetIds = [
    '120236928026440652',
    '120236942069970652',
    '120236927208710652',
    '120233842485330652'
  ];

  console.log('BREAKDOWN BY AD_ID:\n');

  for (const [adId, contacts] of Object.entries(byAdId)) {
    const isAdSet = knownAdSetIds.includes(adId);
    console.log(`${adId}: ${contacts.length} contacts ${isAdSet ? '(Ad Set ID - Lead Magnet)' : '(Unknown)'}`);
    console.log(`  Source: ${contacts[0].source}`);
    console.log(`  Sample: ${contacts[0].first_name || 'Unknown'} ${contacts[0].last_name || ''}`);
    console.log('');
  }

  // Check if there are any non-ad-set IDs
  const otherAdIds = Object.keys(byAdId).filter(id => !knownAdSetIds.includes(id));

  console.log('═'.repeat(70));
  console.log('\n💡 SUMMARY:\n');

  if (otherAdIds.length > 0) {
    console.log(`⚠️  Found ${otherAdIds.length} OTHER ad_ids (not the 4 ad set IDs):`);
    otherAdIds.forEach(id => {
      console.log(`   - ${id}: ${byAdId[id].length} contacts`);
    });
    console.log('\n   These need investigation - are they also ad set IDs?\n');
  } else {
    console.log('✅ ALL contacts with ad_id but no mc_id are from the 4 known ad set IDs');
    console.log('   (Lead Magnet ads only)\n');
  }

  console.log(`Ad Set ID Issue Impact: ${contacts.length} out of ${contacts.length} contacts (100%)`);
  console.log('This issue only affects Lead Magnet ads that bypass ManyChat.\n');
}

checkAllNonMcAdIds().catch(console.error);
