require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function checkMetaAds() {
  console.log('📊 Checking Meta Ads data in database...\n');

  // Get all ads with their creative data
  const { data: ads, error } = await supabase
    .from('meta_ads')
    .select(`
      ad_id,
      ad_name,
      spend,
      impressions,
      clicks,
      leads,
      is_active,
      meta_ad_creatives (
        primary_text,
        headline,
        transformation_theme,
        symptom_focus
      )
    `)
    .order('leads', { ascending: false, nullsFirst: false });

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(`✅ Found ${ads.length} ads in database\n`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  ads.forEach((ad, i) => {
    const creative = ad.meta_ad_creatives;
    console.log(`[${i + 1}] ${ad.ad_name}`);
    console.log(`    Ad ID: ${ad.ad_id}`);
    console.log(`    Spend: $${ad.spend || 0} | Leads: ${ad.leads || 0} | Active: ${ad.is_active ? '✅' : '❌'}`);

    if (creative) {
      console.log(`    Theme: ${creative.transformation_theme || 'none'}`);
      console.log(`    Symptoms: ${creative.symptom_focus?.join(', ') || 'none'}`);

      if (creative.headline) {
        console.log(`    Headline: "${creative.headline}"`);
      }

      if (creative.primary_text) {
        const preview = creative.primary_text.substring(0, 100);
        console.log(`    Copy: "${preview}${creative.primary_text.length > 100 ? '...' : ''}"`);
      }
    } else {
      console.log(`    ⚠️  No creative data`);
    }

    console.log('');
  });
}

checkMetaAds().catch(console.error);
