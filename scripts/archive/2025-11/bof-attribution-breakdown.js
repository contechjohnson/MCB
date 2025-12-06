#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function bofAttributionBreakdown() {
  const startStr = '2025-11-07';
  const endStr = '2025-11-14';

  console.log('📊 BOF vs TOF/MOF ATTRIBUTION BREAKDOWN\n');
  console.log(`Week of ${startStr} to ${endStr}\n`);
  console.log('═'.repeat(70));

  const { data: contacts } = await supabase
    .from('contacts')
    .select('*')
    .gte('created_at', startStr)
    .lt('created_at', endStr)
    .neq('source', 'instagram_historical');

  console.log(`\nTotal Contacts: ${contacts.length}\n`);

  // Split into BOF (no mc_id) vs TOF/MOF (has mc_id)
  const bofContacts = contacts.filter(c => !c.mc_id);
  const tofMofContacts = contacts.filter(c => c.mc_id);

  console.log('🎯 FUNNEL SPLIT:\n');
  console.log(`TOF/MOF (ManyChat Flow): ${tofMofContacts.length} (${((tofMofContacts.length / contacts.length) * 100).toFixed(1)}%)`);
  console.log(`BOF (Direct to Form):    ${bofContacts.length} (${((bofContacts.length / contacts.length) * 100).toFixed(1)}%)\n`);

  console.log('═'.repeat(70));
  console.log('\n📈 TOF/MOF (MANYCHAT FLOW) - 721 contacts:\n');

  const tofInstagram = tofMofContacts.filter(c => c.source === 'instagram');
  const tofWebsite = tofMofContacts.filter(c => c.source === 'website');

  console.log(`Instagram: ${tofInstagram.length}`);
  console.log(`  With AD_ID: ${tofInstagram.filter(c => c.ad_id).length} (${((tofInstagram.filter(c => c.ad_id).length / tofInstagram.length) * 100).toFixed(1)}%)`);
  console.log(`  Without AD_ID: ${tofInstagram.filter(c => !c.ad_id).length} (${((tofInstagram.filter(c => !c.ad_id).length / tofInstagram.length) * 100).toFixed(1)}%) ⚠️\n`);

  console.log(`Website: ${tofWebsite.length}`);
  console.log(`  (Expected to have no AD_ID)\n`);

  console.log('═'.repeat(70));
  console.log('\n📊 BOF (DIRECT TO FORM) - 80 contacts:\n');

  const bofInstagram = bofContacts.filter(c => c.source === 'instagram');
  const bofWebsite = bofContacts.filter(c => c.source === 'website');

  console.log(`Instagram: ${bofInstagram.length} (should be from BOF ads)`);
  console.log(`  With AD_ID: ${bofInstagram.filter(c => c.ad_id).length} (${((bofInstagram.filter(c => c.ad_id).length / bofInstagram.length) * 100).toFixed(1)}%)`);
  console.log(`  Without AD_ID: ${bofInstagram.filter(c => !c.ad_id).length} (${((bofInstagram.filter(c => !c.ad_id).length / bofInstagram.length) * 100).toFixed(1)}%) ⚠️\n`);

  // Show which ad_ids are on BOF contacts
  const bofAdIds = bofInstagram.filter(c => c.ad_id).map(c => c.ad_id);
  if (bofAdIds.length > 0) {
    console.log('BOF Instagram contacts WITH ad_id:');
    const uniqueAdIds = [...new Set(bofAdIds)];
    for (const adId of uniqueAdIds) {
      const count = bofAdIds.filter(id => id === adId).length;
      // Get ad name
      const { data: ad } = await supabase
        .from('meta_ads')
        .select('ad_name')
        .eq('ad_id', adId)
        .single();
      console.log(`  ${adId}: ${count} contacts`);
      if (ad) console.log(`    "${ad.ad_name}"`);
    }
    console.log('');
  }

  console.log(`Website: ${bofWebsite.length} (organic/direct traffic)`);
  console.log(`  (Expected to have no AD_ID)\n`);

  console.log('═'.repeat(70));
  console.log('\n💡 SUMMARY:\n');
  console.log('✅ BOF funnel IS working (80 contacts bypassed ManyChat)');
  console.log(`⚠️  BUT attribution is broken on BOTH funnels:\n`);
  console.log(`   TOF/MOF: ${tofInstagram.filter(c => !c.ad_id).length} out of ${tofInstagram.length} Instagram contacts missing ad_id (${((tofInstagram.filter(c => !c.ad_id).length / tofInstagram.length) * 100).toFixed(1)}%)`);
  console.log(`   BOF:     ${bofInstagram.filter(c => !c.ad_id).length} out of ${bofInstagram.length} Instagram contacts missing ad_id (${((bofInstagram.filter(c => !c.ad_id).length / bofInstagram.length) * 100).toFixed(1)}%)\n`);

  console.log('🔍 POSSIBLE CAUSES:\n');
  console.log('   1. Meta-ManyChat attribution breaking (for TOF/MOF)');
  console.log('   2. BOF link not capturing ad_id in URL parameters');
  console.log('   3. Organic Instagram DMs (people finding you without ads)');
  console.log('   4. Meta permissions updates breaking attribution\n');
}

bofAttributionBreakdown().catch(console.error);
