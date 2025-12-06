#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function analyzeBOFAds() {
  const startStr = '2025-11-07';
  const endStr = '2025-11-14';

  // Get all ads with BOF in name
  const { data: bofAds } = await supabase
    .from('meta_ads')
    .select('ad_id, ad_name, is_active')
    .ilike('ad_name', '%bof%');

  console.log('📊 ANALYSIS: BOF-LABELED ADS vs ACTUAL BOF CONTACTS\n');
  console.log('═'.repeat(70));

  console.log('\n🏷️  ADS WITH "BOF" IN NAME (from meta_ads table):\n');

  let totalBOFLabeledContacts = 0;
  let totalBOFLabeledWithMC = 0;
  let totalBOFLabeledWithoutMC = 0;

  for (const ad of bofAds) {
    const { data: contacts } = await supabase
      .from('contacts')
      .select('mc_id, ghl_id, created_at')
      .eq('ad_id', ad.ad_id)
      .gte('created_at', startStr)
      .lt('created_at', endStr);

    const totalContacts = contacts ? contacts.length : 0;
    const withMC = contacts ? contacts.filter(c => c.mc_id).length : 0;
    const withoutMC = contacts ? contacts.filter(c => !c.mc_id).length : 0;

    totalBOFLabeledContacts += totalContacts;
    totalBOFLabeledWithMC += withMC;
    totalBOFLabeledWithoutMC += withoutMC;

    if (totalContacts > 0) {
      console.log(`${ad.ad_name}`);
      console.log(`  AD_ID: ${ad.ad_id}`);
      console.log(`  Active: ${ad.is_active}`);
      console.log(`  This Week: ${totalContacts} contacts`);
      console.log(`    WITH ManyChat (went to TOF/MOF): ${withMC}`);
      console.log(`    WITHOUT ManyChat (true BOF): ${withoutMC}${withoutMC > 0 ? ' ✅' : ''}`);
      console.log('');
    }
  }

  console.log(`TOTAL from BOF-labeled ads: ${totalBOFLabeledContacts} contacts`);
  console.log(`  With ManyChat: ${totalBOFLabeledWithMC} (went to wrong funnel)`);
  console.log(`  Without ManyChat: ${totalBOFLabeledWithoutMC} (true BOF)\n`);

  console.log('\n═'.repeat(70));
  console.log('\n🔍 MYSTERY AD_IDs (Capturing BOF contacts but NOT in meta_ads):\n');

  const mysteryIds = ['120236928026440652', '120236942069970652', '120236927208710652', '120233842485330652'];

  for (const adId of mysteryIds) {
    const { data: contacts } = await supabase
      .from('contacts')
      .select('first_name, last_name, mc_id, created_at')
      .eq('ad_id', adId)
      .gte('created_at', startStr)
      .lt('created_at', endStr);

    if (contacts && contacts.length > 0) {
      const withoutMC = contacts.filter(c => !c.mc_id).length;
      console.log(`${adId} - ${contacts.length} contacts`);
      console.log(`  WITHOUT mc_id (true BOF): ${withoutMC}`);
      console.log(`  WITH mc_id (went to TOF/MOF): ${contacts.length - withoutMC}`);
      console.log(`  Sample: ${contacts[0].first_name || 'Unknown'} ${contacts[0].last_name || ''}`);
      console.log(`  Created: ${contacts[0].created_at}`);
      console.log('');
    }
  }

  console.log('\n💡 CONCLUSION:\n');
  console.log(`  ${totalBOFLabeledContacts} contacts from BOF-labeled ads (${totalBOFLabeledWithoutMC} true BOF)`);
  console.log('  BUT the 4 mystery ad_ids are NOT in meta_ads table.');
  console.log('  This suggests:');
  console.log('    1. These are NEW ads not yet synced to meta_ads');
  console.log('    2. Meta sync is missing some active ads');
  console.log('    3. Should run: node scripts/sync-meta-ads.js\n');
}

analyzeBOFAds().catch(console.error);
