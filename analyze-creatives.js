const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function analyzeCreatives() {
  // Get all ad creatives with their performance data
  const { data: creatives, error } = await supabase
    .from('meta_ad_creatives')
    .select(`
      ad_id,
      primary_text,
      headline,
      transformation_theme,
      symptom_focus,
      copy_length,
      media_type
    `);

  if (error) {
    console.log('Error:', error);
    return;
  }

  // Get performance data from meta_ads
  const { data: ads, error: adsError } = await supabase
    .from('meta_ads')
    .select('ad_id, ad_name, spend, clicks, impressions, ctr, leads, cost_per_lead')
    .eq('is_active', true)
    .order('spend', { ascending: false });

  if (adsError) {
    console.log('Error:', adsError);
    return;
  }

  console.log('\n=== TOP PERFORMING ADS BY SPEND ===\n');
  ads.slice(0, 10).forEach((ad, i) => {
    const creative = creatives.find(c => c.ad_id === ad.ad_id);
    console.log(`${i+1}. ${ad.ad_name}`);
    console.log(`   Spend: $${ad.spend} | CTR: ${ad.ctr}% | Leads: ${ad.leads} | CPL: $${ad.cost_per_lead || 'N/A'}`);
    if (creative) {
      console.log(`   Theme: ${creative.transformation_theme || 'None'}`);
      console.log(`   Symptoms: ${creative.symptom_focus ? creative.symptom_focus.join(', ') : 'None'}`);
      console.log(`   Media: ${creative.media_type}`);
      console.log(`   Copy Length: ${creative.copy_length}`);
      console.log(`   Headline: ${creative.headline ? creative.headline.substring(0, 60) + '...' : 'None'}`);
    }
    console.log('');
  });

  // Analyze by transformation theme
  console.log('\n=== PERFORMANCE BY TRANSFORMATION THEME ===\n');
  const themePerformance = {};

  ads.forEach(ad => {
    const creative = creatives.find(c => c.ad_id === ad.ad_id);
    if (creative && creative.transformation_theme) {
      const theme = creative.transformation_theme;
      if (!themePerformance[theme]) {
        themePerformance[theme] = { spend: 0, clicks: 0, impressions: 0, leads: 0, count: 0 };
      }
      themePerformance[theme].spend += parseFloat(ad.spend) || 0;
      themePerformance[theme].clicks += ad.clicks || 0;
      themePerformance[theme].impressions += ad.impressions || 0;
      themePerformance[theme].leads += ad.leads || 0;
      themePerformance[theme].count += 1;
    }
  });

  Object.entries(themePerformance)
    .sort((a, b) => b[1].spend - a[1].spend)
    .forEach(([theme, stats]) => {
      const avgCTR = stats.impressions > 0 ? ((stats.clicks / stats.impressions) * 100).toFixed(2) : 0;
      console.log(`${theme}:`);
      console.log(`  Total Spend: $${stats.spend.toFixed(2)} (${stats.count} ads)`);
      console.log(`  Avg CTR: ${avgCTR}%`);
      console.log(`  Total Leads: ${stats.leads}`);
      console.log('');
    });

  // Analyze by symptom focus
  console.log('\n=== TOP SYMPTOM FOCUSES ===\n');
  const symptomCounts = {};

  creatives.forEach(creative => {
    if (creative.symptom_focus) {
      creative.symptom_focus.forEach(symptom => {
        symptomCounts[symptom] = (symptomCounts[symptom] || 0) + 1;
      });
    }
  });

  Object.entries(symptomCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([symptom, count]) => {
      console.log(`  ${symptom}: ${count} ads`);
    });
}

analyzeCreatives().catch(console.error);
