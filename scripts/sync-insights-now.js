require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const AD_ACCOUNT_ID = process.env.META_AD_ACCOUNT_ID;
const API_VERSION = 'v20.0';

async function syncInsights() {
  console.log('📊 Fetching weekly insights (last 7 days)...');

  const url = `https://graph.facebook.com/${API_VERSION}/${AD_ACCOUNT_ID}/insights?access_token=${ACCESS_TOKEN}&level=ad&date_preset=last_7d&fields=ad_id,ad_name,spend,impressions,clicks,reach,ctr,cpc,actions&limit=500`;

  const response = await fetch(url);
  const data = await response.json();

  if (data.error) {
    console.error('Meta API Error:', data.error.message);
    return;
  }

  const insights = data.data || [];
  console.log('Found', insights.length, 'ads with weekly insights');

  const totalSpend = insights.reduce((sum, i) => sum + (parseFloat(i.spend) || 0), 0);
  console.log('Total weekly spend: $' + totalSpend.toFixed(2));

  // Store in meta_ad_insights
  const today = new Date().toISOString().split('T')[0];
  let stored = 0;

  for (const insight of insights) {
    const actions = insight.actions || [];
    const leads = actions.find(a => a.action_type === 'lead')?.value || 0;

    const { error } = await supabase
      .from('meta_ad_insights')
      .upsert({
        ad_id: insight.ad_id,
        snapshot_date: today,
        spend: parseFloat(insight.spend) || 0,
        impressions: parseInt(insight.impressions) || 0,
        clicks: parseInt(insight.clicks) || 0,
        reach: parseInt(insight.reach) || 0,
        leads: parseInt(leads),
        ctr: parseFloat(insight.ctr) || 0,
        cpc: parseFloat(insight.cpc) || 0
      }, { onConflict: 'ad_id,snapshot_date' });

    if (!error) stored++;
  }

  console.log('✅ Stored', stored, 'insight snapshots for', today);
}

syncInsights();
