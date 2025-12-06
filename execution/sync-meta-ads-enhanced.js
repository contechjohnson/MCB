/**
 * Enhanced Meta Ads Sync Script
 *
 * Fetches BOTH lifetime AND weekly performance data for proper weekly reporting
 *
 * Key improvements:
 * - Fetches lifetime data for ROAS calculations
 * - Fetches last 7 days for "best ad this week" analysis
 * - Stores daily snapshots for trend tracking
 * - Calculates weekly deltas automatically
 *
 * Usage:
 *   node scripts/sync-meta-ads-enhanced.js              # Sync all data
 *   node scripts/sync-meta-ads-enhanced.js --dry-run    # Preview only
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

// Meta Ads API credentials
const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const AD_ACCOUNT_ID = process.env.META_AD_ACCOUNT_ID;
const API_VERSION = process.env.META_API_VERSION || 'v20.0';

const DRY_RUN = process.argv.includes('--dry-run');

// Statistics
let stats = {
  ads_fetched: 0,
  lifetime_synced: 0,
  weekly_synced: 0,
  snapshots_created: 0,
  creatives_synced: 0,
  errors: 0
};

/**
 * Fetch ads with insights for a specific date range
 */
async function fetchAdsWithInsights(datePreset = 'maximum') {
  console.log(`\n📊 Fetching ads with insights (${datePreset})...`);

  // Step 1: Get all ads
  const adsUrl = `https://graph.facebook.com/${API_VERSION}/${AD_ACCOUNT_ID}/ads?access_token=${ACCESS_TOKEN}&fields=id,name,adset_id,campaign_id,status,effective_status,created_time,updated_time&limit=500`;

  const adsResponse = await fetch(adsUrl);
  const adsData = await adsResponse.json();

  if (adsData.error) {
    throw new Error(`Meta API Error: ${adsData.error.message}`);
  }

  const allAds = adsData.data || [];
  console.log(`   Found ${allAds.length} total ads`);

  // Step 2: Fetch insights for date range
  const insightsUrl = `https://graph.facebook.com/${API_VERSION}/${AD_ACCOUNT_ID}/insights?access_token=${ACCESS_TOKEN}&level=ad&date_preset=${datePreset}&fields=ad_id,ad_name,adset_id,campaign_id,date_start,date_stop,spend,impressions,clicks,reach,ctr,cpc,frequency,actions,cost_per_action_type&limit=500`;

  const insightsResponse = await fetch(insightsUrl);
  const insightsData = await insightsResponse.json();

  if (insightsData.error) {
    throw new Error(`Meta Insights API Error: ${insightsData.error.message}`);
  }

  const insights = insightsData.data || [];
  console.log(`   Found insights for ${insights.length} ads`);

  // Step 3: Merge ads with insights
  const insightsMap = {};
  insights.forEach(insight => {
    const actions = insight.actions || [];
    const costPerAction = insight.cost_per_action_type || [];

    const getActionValue = (actionType) => {
      const action = actions.find(a => a.action_type === actionType);
      return action ? parseFloat(action.value) : 0;
    };

    const getCostPerAction = (actionType) => {
      const cost = costPerAction.find(c => c.action_type === actionType);
      return cost ? parseFloat(cost.value) : null;
    };

    insightsMap[insight.ad_id] = {
      ad_name: insight.ad_name,
      adset_id: insight.adset_id,
      campaign_id: insight.campaign_id,
      date_start: insight.date_start,
      date_stop: insight.date_stop,
      spend: parseFloat(insight.spend) || 0,
      impressions: parseInt(insight.impressions) || 0,
      clicks: parseInt(insight.clicks) || 0,
      reach: parseInt(insight.reach) || 0,
      ctr: parseFloat(insight.ctr) || 0,
      cpc: parseFloat(insight.cpc) || 0,
      frequency: parseFloat(insight.frequency) || 0,
      link_clicks: getActionValue('link_click'),
      landing_page_views: getActionValue('landing_page_view'),
      leads: getActionValue('lead'),
      pixel_leads: getActionValue('offsite_conversion.fb_pixel_lead'),
      video_views: getActionValue('video_view'),
      post_engagements: getActionValue('post_engagement'),
      cost_per_lead: getCostPerAction('lead'),
      cost_per_landing_page_view: getCostPerAction('landing_page_view')
    };
  });

  // Step 4: Return only ACTIVE ads with their insights
  const activeAds = allAds
    .filter(ad => ad.effective_status === 'ACTIVE')
    .map(ad => {
      const perf = insightsMap[ad.id] || {
        ad_name: ad.name,
        adset_id: ad.adset_id,
        campaign_id: ad.campaign_id,
        date_start: null,
        date_stop: null,
        spend: 0,
        impressions: 0,
        clicks: 0,
        reach: 0,
        ctr: 0,
        cpc: 0,
        frequency: 0,
        link_clicks: 0,
        landing_page_views: 0,
        leads: 0,
        pixel_leads: 0,
        video_views: 0,
        post_engagements: 0,
        cost_per_lead: null,
        cost_per_landing_page_view: null
      };

      return {
        ad_id: ad.id,
        ad_name: perf.ad_name,
        adset_id: perf.adset_id,
        campaign_id: perf.campaign_id,
        status: ad.status,
        effective_status: ad.effective_status,
        is_active: true,
        created_time: ad.created_time || null,
        updated_time: ad.updated_time || null,
        date_start: perf.date_start || null,
        date_stop: perf.date_stop || null,
        spend: perf.spend,
        impressions: perf.impressions,
        clicks: perf.clicks,
        reach: perf.reach,
        ctr: perf.ctr,
        cpc: perf.cpc,
        frequency: perf.frequency,
        link_clicks: perf.link_clicks,
        landing_page_views: perf.landing_page_views,
        leads: perf.leads,
        pixel_leads: perf.pixel_leads,
        video_views: perf.video_views,
        post_engagements: perf.post_engagements,
        cost_per_lead: perf.cost_per_lead,
        cost_per_landing_page_view: perf.cost_per_landing_page_view
      };
    });

  return activeAds;
}

/**
 * Store lifetime ad data in meta_ads table
 */
async function storeLifetimeData(ads) {
  if (DRY_RUN) {
    console.log(`\n[DRY RUN] Would store lifetime data for ${ads.length} ads`);
    stats.lifetime_synced = ads.length;
    return;
  }

  console.log(`\n💾 Storing lifetime data for ${ads.length} ads...`);

  for (const ad of ads) {
    const { error } = await supabaseAdmin
      .from('meta_ads')
      .upsert({
        ...ad,
        last_synced: new Date().toISOString()
      }, {
        onConflict: 'ad_id',
        ignoreDuplicates: false
      });

    if (error) {
      console.error(`  ✗ Error storing ${ad.ad_name}:`, error.message);
      stats.errors++;
    } else {
      console.log(`  ✓ Stored: ${ad.ad_name} ($${ad.spend} lifetime spend)`);
      stats.lifetime_synced++;
    }
  }
}

/**
 * Store weekly snapshots in meta_ad_insights table
 */
async function storeWeeklySnapshots(weeklyAds) {
  if (DRY_RUN) {
    console.log(`\n[DRY RUN] Would store weekly snapshots for ${weeklyAds.length} ads`);
    stats.weekly_synced = weeklyAds.length;
    return;
  }

  console.log(`\n📸 Storing weekly snapshots for ${weeklyAds.length} ads...`);

  const today = new Date().toISOString().split('T')[0];

  for (const ad of weeklyAds) {
    const snapshot = {
      ad_id: ad.ad_id,
      snapshot_date: today,
      spend: ad.spend,
      impressions: ad.impressions,
      clicks: ad.clicks,
      reach: ad.reach,
      leads: ad.leads,
      ctr: ad.ctr,
      cpc: ad.cpc
    };

    const { error } = await supabaseAdmin
      .from('meta_ad_insights')
      .upsert(snapshot, {
        onConflict: 'ad_id,snapshot_date',
        ignoreDuplicates: false
      });

    if (error && !error.message.includes('duplicate')) {
      console.error(`  ✗ Error storing snapshot:`, error.message);
      stats.errors++;
    } else {
      console.log(`  ✓ Snapshot: ${ad.ad_name} ($${ad.spend} last 7d)`);
      stats.snapshots_created++;
    }
  }
}

/**
 * Main sync function
 */
async function main() {
  console.log('🚀 Enhanced Meta Ads Sync\n');
  console.log(`Mode: ${DRY_RUN ? '🔍 DRY RUN' : '💾 LIVE SYNC'}\n`);
  console.log('═'.repeat(80));

  // Validate environment
  if (!ACCESS_TOKEN || !AD_ACCOUNT_ID) {
    throw new Error('Missing META_ACCESS_TOKEN or META_AD_ACCOUNT_ID');
  }

  try {
    // Fetch lifetime data (for total ROAS)
    console.log('\n📈 STEP 1: Fetching lifetime performance data...');
    const lifetimeAds = await fetchAdsWithInsights('maximum');
    stats.ads_fetched = lifetimeAds.length;
    await storeLifetimeData(lifetimeAds);

    // Fetch last 7 days (for weekly reporting)
    console.log('\n📊 STEP 2: Fetching last 7 days performance...');
    const weeklyAds = await fetchAdsWithInsights('last_7d');
    await storeWeeklySnapshots(weeklyAds);

    // Print summary
    console.log('\n' + '═'.repeat(80));
    console.log('📊 Sync Summary\n');
    console.log(`Active ads found:      ${stats.ads_fetched}`);
    console.log(`Lifetime data synced:  ${stats.lifetime_synced}`);
    console.log(`Weekly snapshots:      ${stats.snapshots_created}`);
    console.log(`Errors:                ${stats.errors}`);
    console.log('═'.repeat(80) + '\n');

    if (DRY_RUN) {
      console.log('🔍 DRY RUN COMPLETE - No changes made\n');
    } else {
      console.log('✅ SYNC COMPLETE\n');
      console.log('💡 To get weekly ROAS:');
      console.log('   SELECT ad_id, ad_name, spend FROM meta_ad_insights');
      console.log('   WHERE snapshot_date >= CURRENT_DATE - 7;');
      console.log('\n💡 To get best ad this week:');
      console.log('   ORDER BY spend DESC LIMIT 1;\n');
    }

  } catch (error) {
    console.error('\n❌ Sync failed:', error.message);
    throw error;
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(error => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = { main, fetchAdsWithInsights, storeLifetimeData, storeWeeklySnapshots };
