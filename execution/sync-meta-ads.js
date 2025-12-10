/**
 * Meta Ads Sync Script
 *
 * Fetches all active ads from Meta Ads API and stores performance + creative data
 * Auto-detects emotional transformation themes and symptom focus
 *
 * Based on original Make.com scripts with enhancements:
 * - Fetches ALL active ads with full spend history (not just 7 days)
 * - Auto-detects transformation themes (confusion→clarity, overwhelm→relief, etc.)
 * - Auto-detects symptom focus (diastasis, pelvic floor, low milk supply, etc.)
 * - Stores in Supabase for ROAS analysis
 *
 * Usage:
 *   node scripts/sync-meta-ads.js              # Sync all active ads
 *   node scripts/sync-meta-ads.js --dry-run    # Preview only
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
  ads_inserted: 0,
  ads_updated: 0,
  creatives_fetched: 0,
  creatives_inserted: 0,
  creatives_updated: 0,
  errors: 0
};

/**
 * Detect emotional transformation theme from copy
 */
function detectTransformationTheme(primaryText, headline) {
  const text = `${primaryText || ''} ${headline || ''}`.toLowerCase();

  const themes = {
    'confusion_to_clarity': [
      'confusion', 'confused', 'clarity', 'clear', 'understand',
      'finally understand', 'makes sense', 'figured out', 'answers'
    ],
    'overwhelm_to_relief': [
      'overwhelm', 'overwhelmed', 'relief', 'relieved', 'stress',
      'anxiety', 'calm', 'peace', 'breathe', 'relax', 'easier'
    ],
    'pain_to_comfort': [
      'pain', 'painful', 'hurt', 'ache', 'discomfort',
      'relief', 'comfortable', 'healed', 'better', 'pain-free'
    ],
    'isolation_to_community': [
      'alone', 'isolated', 'lonely', 'community', 'support',
      'not alone', 'together', 'connect', 'belong', 'understand you'
    ],
    'shame_to_confidence': [
      'shame', 'embarrassed', 'ashamed', 'confidence', 'confident',
      'proud', 'empowered', 'strong', 'brave', 'worthy'
    ],
    'doubt_to_trust': [
      'doubt', 'uncertain', 'unsure', 'trust', 'believe',
      'faith', 'confident', 'sure', 'certain', 'proven'
    ],
    'fear_to_hope': [
      'fear', 'scared', 'afraid', 'worried', 'hope', 'hopeful',
      'optimistic', 'better', 'possible', 'can heal'
    ]
  };

  for (const [theme, keywords] of Object.entries(themes)) {
    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        return theme;
      }
    }
  }

  return 'general';
}

/**
 * Detect symptom focus from copy
 */
function detectSymptomFocus(primaryText, headline) {
  const text = `${primaryText || ''} ${headline || ''}`.toLowerCase();
  const symptoms = [];

  const symptomKeywords = {
    'diastasis': ['diastasis', 'ab separation', 'stomach gap', 'core gap', 'separated abs', 'ab split'],
    'pelvic_floor': ['pelvic floor', 'leaking', 'incontinence', 'weak pelvic', 'bladder control', 'prolapse'],
    'low_milk_supply': ['milk supply', 'low supply', 'breastfeeding', 'nursing', 'lactation', 'breast milk'],
    'pain': ['pain', 'painful', 'hurt', 'ache', 'sore', 'discomfort'],
    'weight': ['weight', 'lose weight', 'belly fat', 'postpartum body', 'body image', 'pounds'],
    'energy': ['tired', 'exhausted', 'energy', 'fatigue', 'sleep', 'exhaustion'],
    'back_pain': ['back pain', 'lower back', 'back ache', 'spine'],
    'hip_pain': ['hip pain', 'hips', 'hip ache'],
    'c_section': ['c-section', 'cesarean', 'csection', 'c section']
  };

  for (const [symptom, keywords] of Object.entries(symptomKeywords)) {
    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        symptoms.push(symptom);
        break;
      }
    }
  }

  return symptoms.length > 0 ? symptoms : ['general'];
}

/**
 * Determine copy length
 */
function getCopyLength(text) {
  const length = (text || '').length;
  if (length < 150) return 'short';
  if (length < 400) return 'medium';
  return 'long';
}

/**
 * MODULE 1: Fetch all active ads with performance data
 * Now fetches BOTH 7-day and 28-day spend for accurate reporting
 */
async function fetchActiveAds() {
  console.log('\n📊 Fetching active ads from Meta Ads API...\n');

  // Step 1: Fetch all ads with status
  const statusUrl = `https://graph.facebook.com/${API_VERSION}/${AD_ACCOUNT_ID}/ads?access_token=${ACCESS_TOKEN}&fields=id,name,adset_id,campaign_id,status,effective_status,created_time,updated_time&limit=500`;

  const statusResponse = await fetch(statusUrl);
  const statusData = await statusResponse.json();

  if (statusData.error) {
    throw new Error(`Meta API Error: ${statusData.error.message}`);
  }

  if (!statusData.data) {
    throw new Error(`No data returned from Meta API`);
  }

  const allAds = statusData.data;
  console.log(`✅ Found ${allAds.length} total ads`);

  // Step 2a: Fetch 7-day performance data
  const insights7dUrl = `https://graph.facebook.com/${API_VERSION}/${AD_ACCOUNT_ID}/insights?access_token=${ACCESS_TOKEN}&level=ad&date_preset=last_7d&fields=ad_id,ad_name,adset_id,campaign_id,date_start,date_stop,spend,impressions,clicks,reach,ctr,cpc,frequency,actions,cost_per_action_type&limit=500`;

  const insights7dResponse = await fetch(insights7dUrl);
  const insights7dData = await insights7dResponse.json();

  if (insights7dData.error) {
    throw new Error(`Meta Insights 7d API Error: ${insights7dData.error.message}`);
  }

  const insights7d = insights7dData.data || [];
  console.log(`✅ Found 7-day insights for ${insights7d.length} ads`);

  // Step 2b: Fetch 28-day performance data
  const insights28dUrl = `https://graph.facebook.com/${API_VERSION}/${AD_ACCOUNT_ID}/insights?access_token=${ACCESS_TOKEN}&level=ad&date_preset=last_28d&fields=ad_id,spend&limit=500`;

  const insights28dResponse = await fetch(insights28dUrl);
  const insights28dData = await insights28dResponse.json();

  if (insights28dData.error) {
    throw new Error(`Meta Insights 28d API Error: ${insights28dData.error.message}`);
  }

  const insights28d = insights28dData.data || [];
  console.log(`✅ Found 28-day insights for ${insights28d.length} ads`);

  // Create 28-day spend map
  const spend28dMap = {};
  insights28d.forEach(insight => {
    spend28dMap[insight.ad_id] = parseFloat(insight.spend) || 0;
  });

  const insights = insights7d;
  console.log(`✅ Combined insights ready`);

  // Step 3: Create insights map
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

  // Step 4: Merge and FILTER TO ACTIVE ONLY
  const activeAds = allAds
    .filter(ad => ad.effective_status === 'ACTIVE')
    .map(ad => {
      const perf = insightsMap[ad.id] || {
        ad_name: ad.name,
        adset_id: ad.adset_id,
        campaign_id: ad.campaign_id,
        date_start: '',
        date_stop: '',
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

      // Get 28-day spend from separate map
      const spend28d = spend28dMap[ad.id] || 0;

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
        last_synced: new Date().toISOString(),

        // Performance metrics (7-day)
        spend: perf.spend,
        spend_28d: spend28d, // 28-day spend
        impressions: perf.impressions,
        clicks: perf.clicks,
        reach: perf.reach,
        ctr: perf.ctr,
        cpc: perf.cpc,
        frequency: perf.frequency,

        // Conversions
        link_clicks: perf.link_clicks,
        landing_page_views: perf.landing_page_views,
        leads: perf.leads,
        pixel_leads: perf.pixel_leads,
        video_views: perf.video_views,
        post_engagements: perf.post_engagements,

        // Costs
        cost_per_lead: perf.cost_per_lead,
        cost_per_landing_page_view: perf.cost_per_landing_page_view
      };
    });

  console.log(`\n✅ Filtered to ${activeAds.length} ACTIVE ads\n`);
  stats.ads_fetched = activeAds.length;

  return activeAds;
}

/**
 * MODULE 2: Fetch creative data for a single ad
 * (Your exact script from Part 2)
 */
async function fetchCreativeData(adId) {
  try {
    // Step 1: Get creative ID
    const adUrl = `https://graph.facebook.com/${API_VERSION}/${adId}?access_token=${ACCESS_TOKEN}&fields=creative{id}`;
    const adResponse = await fetch(adUrl);
    const adData = await adResponse.json();

    if (adData.error) {
      console.error(`  ⚠️  Error fetching creative for ${adId}:`, adData.error.message);
      return null;
    }

    if (!adData.creative?.id) {
      console.log(`  ⚠️  No creative found for ${adId}`);
      return null;
    }

    const creativeId = adData.creative.id;

    // Step 2: Get creative details
    const creativeUrl = `https://graph.facebook.com/${API_VERSION}/${creativeId}?access_token=${ACCESS_TOKEN}&fields=id,name,title,body,thumbnail_url,video_id,object_story_spec,effective_object_story_id,asset_feed_spec`;
    const creativeResponse = await fetch(creativeUrl);
    const creative = await creativeResponse.json();

    if (creative.error) {
      console.error(`  ⚠️  Error fetching creative details:`, creative.error.message);
      return null;
    }

    // Step 3: Get preview URL
    const previewUrl = `https://graph.facebook.com/${API_VERSION}/${adId}/previews?access_token=${ACCESS_TOKEN}&ad_format=DESKTOP_FEED_STANDARD`;
    const previewResponse = await fetch(previewUrl);
    const previewData = await previewResponse.json();

    const previewIframe = previewData.data?.[0]?.body || '';
    const previewUrlMatch = previewIframe.match(/src="([^"]+)"/);
    const extractedPreviewUrl = previewUrlMatch ? previewUrlMatch[1] : '';

    // Extract primary text and headline
    const story = creative.object_story_spec?.link_data || creative.object_story_spec?.video_data || {};
    const primaryText = story.message || creative.body || '';
    const headline = story.name || creative.title || creative.name || '';

    // Extract alternative copy
    const alternativeCopy = [];
    if (creative.asset_feed_spec?.bodies) {
      creative.asset_feed_spec.bodies.forEach(b => {
        if (b.text && b.text !== primaryText) {
          alternativeCopy.push(b.text);
        }
      });
    }

    // Get video/image info
    const videoId = creative.video_id || story.video_id || '';
    const thumbnailUrl = creative.thumbnail_url || story.picture || '';
    const postId = creative.effective_object_story_id || '';

    // Auto-detect intelligence
    const transformationTheme = detectTransformationTheme(primaryText, headline);
    const symptomFocus = detectSymptomFocus(primaryText, headline);
    const copyLength = getCopyLength(primaryText);
    const mediaType = videoId ? 'video' : 'image';

    return {
      ad_id: adId,
      primary_text: primaryText,
      headline: headline,
      alternative_copy: alternativeCopy.join(' ||| '),
      video_id: videoId,
      thumbnail_url: thumbnailUrl,
      preview_url: extractedPreviewUrl,
      post_id: postId,
      transformation_theme: transformationTheme,
      symptom_focus: symptomFocus,
      copy_length: copyLength,
      media_type: mediaType
    };

  } catch (error) {
    console.error(`  ✗ Error fetching creative for ${adId}:`, error.message);
    stats.errors++;
    return null;
  }
}

/**
 * Store ad in database (upsert)
 */
async function storeAd(adData) {
  if (DRY_RUN) {
    console.log(`  [DRY RUN] Would upsert ad: ${adData.ad_name}`);
    stats.ads_inserted++;
    return;
  }

  const PPCU_TENANT_ID = '2cb58664-a84a-4d74-844a-4ccd49fcef5a'; // TODO: Make this dynamic for multi-tenant

  const { error } = await supabaseAdmin
    .from('meta_ads')
    .upsert({
      ...adData,
      tenant_id: PPCU_TENANT_ID
    }, {
      onConflict: 'ad_id',
      ignoreDuplicates: false
    });

  if (error) {
    console.error(`  ✗ Error storing ad ${adData.ad_id}:`, error.message);
    stats.errors++;
  } else {
    console.log(`  ✓ Stored ad: ${adData.ad_name}`);
    stats.ads_inserted++;
  }
}

/**
 * Store creative data in database (upsert)
 */
async function storeCreative(creativeData) {
  if (DRY_RUN) {
    console.log(`  [DRY RUN] Would upsert creative for ${creativeData.ad_id}`);
    stats.creatives_inserted++;
    return;
  }

  const { error } = await supabaseAdmin
    .from('meta_ad_creatives')
    .upsert(creativeData, {
      onConflict: 'ad_id',
      ignoreDuplicates: false
    });

  if (error) {
    console.error(`  ✗ Error storing creative ${creativeData.ad_id}:`, error.message);
    stats.errors++;
  } else {
    console.log(`  ✓ Stored creative: ${creativeData.transformation_theme} | ${creativeData.symptom_focus.join(', ')}`);
    stats.creatives_inserted++;
  }
}

/**
 * Create daily snapshot with both 7-day and 28-day spend
 */
async function createSnapshot(adData) {
  if (DRY_RUN) return;

  const PPCU_TENANT_ID = '2cb58664-a84a-4d74-844a-4ccd49fcef5a'; // TODO: Make this dynamic for multi-tenant

  const snapshot = {
    tenant_id: PPCU_TENANT_ID,
    ad_id: adData.ad_id,
    snapshot_date: new Date().toISOString().split('T')[0],
    spend: adData.spend,  // 7-day spend
    spend_28d: adData.spend_28d || null,  // 28-day spend
    impressions: adData.impressions,
    clicks: adData.clicks,
    reach: adData.reach,
    leads: adData.leads,
    ctr: adData.ctr,
    cpc: adData.cpc
  };

  const { error } = await supabaseAdmin
    .from('meta_ad_insights')
    .upsert(snapshot, {
      onConflict: 'ad_id,snapshot_date',
      ignoreDuplicates: true
    });

  if (error && !error.message.includes('duplicate')) {
    console.error(`  ⚠️  Error creating snapshot:`, error.message);
  }
}

/**
 * Main sync function
 */
async function main() {
  console.log('🚀 Meta Ads Sync\n');
  console.log(`Mode: ${DRY_RUN ? '🔍 DRY RUN (no changes will be made)' : '💾 LIVE SYNC'}\n`);
  console.log('═'.repeat(80) + '\n');

  // Validate environment
  if (!ACCESS_TOKEN || !AD_ACCOUNT_ID) {
    console.error('❌ Missing Meta Ads API credentials');
    console.error('   Required environment variables:');
    console.error('   - META_ACCESS_TOKEN');
    console.error('   - META_AD_ACCOUNT_ID');
    console.error('   - META_API_VERSION (optional, defaults to v20.0)\n');
    process.exit(1);
  }

  try {
    // Fetch all active ads
    const activeAds = await fetchActiveAds();

    if (activeAds.length === 0) {
      console.log('⚠️  No active ads found. Exiting.\n');
      return;
    }

    // Process each ad
    console.log('📦 Processing ads...\n');
    for (let i = 0; i < activeAds.length; i++) {
      const ad = activeAds[i];
      console.log(`\n[${i + 1}/${activeAds.length}] Processing ad: ${ad.ad_name}`);

      // Store ad performance data
      await storeAd(ad);

      // Fetch and store creative data
      const creative = await fetchCreativeData(ad.ad_id);
      if (creative) {
        stats.creatives_fetched++;
        await storeCreative(creative);
      }

      // Create daily snapshot
      await createSnapshot(ad);

      // Rate limit: wait 200ms between requests
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // Print summary
    console.log('\n' + '═'.repeat(80));
    console.log('📊 Sync Summary\n');
    console.log(`Ads fetched:         ${stats.ads_fetched}`);
    console.log(`Ads stored:          ${stats.ads_inserted}`);
    console.log(`Creatives fetched:   ${stats.creatives_fetched}`);
    console.log(`Creatives stored:    ${stats.creatives_inserted}`);
    console.log(`Errors:              ${stats.errors}`);
    console.log('═'.repeat(80) + '\n');

    if (DRY_RUN) {
      console.log('🔍 DRY RUN COMPLETE - No changes were made to the database\n');
    } else {
      console.log('✅ SYNC COMPLETE\n');
      console.log('To view results:');
      console.log('  SELECT * FROM v_ad_roas_by_theme;');
      console.log('  SELECT * FROM v_symptom_ad_performance;');
      console.log('  SELECT * FROM v_top_performing_ads;\n');
    }

  } catch (error) {
    console.error('\n❌ Sync failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main, fetchActiveAds, fetchCreativeData };
