/**
 * Meta Ads Sync v2 - Fetches both 7-day and 28-day spend
 *
 * Stores:
 *   - spend, impressions, clicks, reach, leads (7-day)
 *   - spend_28d, impressions_28d, clicks_28d, reach_28d, leads_28d (28-day)
 *
 * Usage:
 *   node execution/sync-meta-ads-v2.js
 *   node execution/sync-meta-ads-v2.js --dry-run
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const AD_ACCOUNT_ID = process.env.META_AD_ACCOUNT_ID;
const API_VERSION = process.env.META_API_VERSION || 'v20.0';
const DRY_RUN = process.argv.includes('--dry-run');

/**
 * Fetch insights for a specific date preset
 */
async function fetchInsights(datePreset) {
  const url = `https://graph.facebook.com/${API_VERSION}/${AD_ACCOUNT_ID}/insights?` +
    `access_token=${ACCESS_TOKEN}` +
    `&level=ad` +
    `&date_preset=${datePreset}` +
    `&fields=ad_id,ad_name,spend,impressions,clicks,reach,actions` +
    `&limit=500`;

  const response = await fetch(url);
  const data = await response.json();

  if (data.error) {
    throw new Error(`Meta API Error (${datePreset}): ${data.error.message}`);
  }

  const insightsMap = {};
  for (const insight of data.data || []) {
    const actions = insight.actions || [];
    const leads = actions.find(a => a.action_type === 'lead')?.value || 0;

    insightsMap[insight.ad_id] = {
      ad_id: insight.ad_id,
      ad_name: insight.ad_name,
      spend: parseFloat(insight.spend) || 0,
      impressions: parseInt(insight.impressions) || 0,
      clicks: parseInt(insight.clicks) || 0,
      reach: parseInt(insight.reach) || 0,
      leads: parseInt(leads) || 0
    };
  }

  return insightsMap;
}

/**
 * Main sync
 */
async function main() {
  console.log('🚀 Meta Ads Sync v2 (7-day + 28-day)\n');
  console.log(`Mode: ${DRY_RUN ? '🔍 DRY RUN' : '💾 LIVE'}\n`);

  if (!ACCESS_TOKEN || !AD_ACCOUNT_ID) {
    console.error('❌ Missing META_ACCESS_TOKEN or META_AD_ACCOUNT_ID');
    process.exit(1);
  }

  try {
    // Fetch both periods
    console.log('📊 Fetching 7-day insights...');
    const insights7d = await fetchInsights('last_7d');
    console.log(`   Found ${Object.keys(insights7d).length} ads\n`);

    console.log('📊 Fetching 28-day insights...');
    const insights28d = await fetchInsights('last_28d');
    console.log(`   Found ${Object.keys(insights28d).length} ads\n`);

    // Merge into single records
    const allAdIds = new Set([...Object.keys(insights7d), ...Object.keys(insights28d)]);
    const today = new Date().toISOString().split('T')[0];

    let totalSpend7d = 0;
    let totalSpend28d = 0;

    console.log('💾 Storing snapshots...\n');
    for (const adId of allAdIds) {
      const data7d = insights7d[adId] || {};
      const data28d = insights28d[adId] || {};

      const record = {
        ad_id: adId,
        snapshot_date: today,
        // 7-day metrics
        spend: data7d.spend || 0,
        impressions: data7d.impressions || 0,
        clicks: data7d.clicks || 0,
        reach: data7d.reach || 0,
        leads: data7d.leads || 0,
        // 28-day metrics
        spend_28d: data28d.spend || 0,
        impressions_28d: data28d.impressions || 0,
        clicks_28d: data28d.clicks || 0,
        reach_28d: data28d.reach || 0,
        leads_28d: data28d.leads || 0
      };

      totalSpend7d += record.spend;
      totalSpend28d += record.spend_28d;

      if (DRY_RUN) {
        console.log(`  [DRY] ${data7d.ad_name || data28d.ad_name || adId}: $${record.spend.toFixed(2)} (7d) / $${record.spend_28d.toFixed(2)} (28d)`);
      } else {
        const { error } = await supabase
          .from('meta_ad_insights')
          .upsert(record, { onConflict: 'ad_id,snapshot_date' });

        if (error) {
          console.error(`  ✗ Error storing ${adId}:`, error.message);
        } else {
          console.log(`  ✓ ${data7d.ad_name || data28d.ad_name || adId}`);
        }
      }
    }

    console.log('\n' + '═'.repeat(50));
    console.log('📊 Summary\n');
    console.log(`Total 7-day spend:  $${totalSpend7d.toFixed(2)}`);
    console.log(`Total 28-day spend: $${totalSpend28d.toFixed(2)}`);
    console.log(`Ads synced: ${allAdIds.size}`);
    console.log('═'.repeat(50) + '\n');

    if (!DRY_RUN) {
      console.log('✅ Sync complete\n');
    }

  } catch (error) {
    console.error('❌ Sync failed:', error.message);
    process.exit(1);
  }
}

main();
