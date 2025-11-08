require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function checkAdPerformance() {
  console.log('📊 Checking Ad Performance (Live Data Only)...\n');

  // Get ad performance from live contacts
  const { data: contacts, error } = await supabase
    .from('contacts')
    .select('ad_id, dm_qualified_date, purchase_amount, subscribe_date')
    .not('source', 'like', '%_historical%')
    .not('ad_id', 'is', null);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(`✅ Found ${contacts.length} live contacts with ad_id\n`);

  // Group by ad_id
  const adStats = {};
  contacts.forEach(contact => {
    const adId = contact.ad_id;
    if (!adStats[adId]) {
      adStats[adId] = {
        contacts: 0,
        qualified: 0,
        purchases: 0,
        revenue: 0
      };
    }

    adStats[adId].contacts++;
    if (contact.dm_qualified_date) adStats[adId].qualified++;
    if (contact.purchase_amount) {
      adStats[adId].purchases++;
      adStats[adId].revenue += parseFloat(contact.purchase_amount);
    }
  });

  // Sort by contacts
  const sortedAds = Object.entries(adStats)
    .map(([adId, stats]) => ({
      adId,
      ...stats,
      qualifyRate: stats.contacts > 0 ? (stats.qualified / stats.contacts * 100).toFixed(1) : 0
    }))
    .sort((a, b) => b.contacts - a.contacts);

  console.log('═══════════════════════════════════════════════════════════════\n');
  console.log('TOP PERFORMING ADS (By Volume)\n');

  sortedAds.slice(0, 10).forEach((ad, i) => {
    console.log(`[${i + 1}] Ad ID: ...${ad.adId.slice(-6)}`);
    console.log(`    Contacts: ${ad.contacts} | Qualified: ${ad.qualified} (${ad.qualifyRate}%)`);
    if (ad.purchases > 0) {
      console.log(`    Purchases: ${ad.purchases} | Revenue: $${ad.revenue.toFixed(2)}`);
    }
    console.log('');
  });

  // Check if any of our synced ads match
  console.log('\n═══════════════════════════════════════════════════════════════\n');
  console.log('MATCHING SYNCED ADS WITH CREATIVE DATA:\n');

  const syncedAdIds = [
    '120229674640480652',
    '120226963627550652',
    '120229677355990652',
    '120229677087460652',
    '120229677647240652'
  ];

  const matches = sortedAds.filter(ad => syncedAdIds.includes(ad.adId));

  if (matches.length > 0) {
    console.log(`✅ Found ${matches.length} matches!\n`);
    for (const match of matches) {
      // Get creative data
      const { data: creative } = await supabase
        .from('meta_ad_creatives')
        .select('primary_text, headline, transformation_theme, symptom_focus')
        .eq('ad_id', match.adId)
        .single();

      const { data: ad } = await supabase
        .from('meta_ads')
        .select('ad_name, spend')
        .eq('ad_id', match.adId)
        .single();

      console.log(`🎯 ${ad?.ad_name || 'Unknown Ad'}`);
      console.log(`   Ad ID: ${match.adId}`);
      console.log(`   Performance: ${match.contacts} contacts, ${match.qualified} qualified (${match.qualifyRate}%)`);
      console.log(`   Spend: $${ad?.spend || 0}`);

      if (creative) {
        console.log(`   Theme: ${creative.transformation_theme}`);
        console.log(`   Symptoms: ${creative.symptom_focus?.join(', ') || 'none'}`);
        console.log(`   Headline: "${creative.headline}"`);
        const preview = creative.primary_text?.substring(0, 80) || '';
        console.log(`   Copy: "${preview}..."`);
      }
      console.log('');
    }
  } else {
    console.log('⚠️  None of the top performing ads have creative data synced yet.\n');
    console.log('This is because Meta API rate limit prevented us from syncing all 38 ads.');
    console.log('The 5 synced ads are older (July) and may not be driving current traffic.\n');
  }
}

checkAdPerformance().catch(console.error);
