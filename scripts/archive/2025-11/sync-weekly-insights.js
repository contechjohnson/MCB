#!/usr/bin/env node

/**
 * Sync Weekly Meta Ads Insights
 *
 * Fetches last 7 days of ad performance from Meta API
 * and stores in meta_ad_insights table for weekly reporting
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const AD_ACCOUNT_ID = process.env.META_AD_ACCOUNT_ID;
const API_VERSION = process.env.META_API_VERSION || 'v20.0';

async function syncWeeklyInsights() {
  console.log('=== SYNCING WEEKLY META ADS DATA ===\n');

  // Fetch last 7 days insights
  const url = `https://graph.facebook.com/${API_VERSION}/${AD_ACCOUNT_ID}/insights?access_token=${ACCESS_TOKEN}&level=ad&date_preset=last_7d&fields=ad_id,ad_name,spend,impressions,clicks,reach,ctr,cpc,actions&limit=500`;

  const response = await fetch(url);
  const data = await response.json();

  if (data.error) {
    console.error('Error:', data.error.message);
    return;
  }

  const insights = data.data || [];
  console.log('Found', insights.length, 'ads with insights for last 7 days');

  // Calculate total spend
  const totalSpend = insights.reduce((sum, i) => sum + (parseFloat(i.spend) || 0), 0);
  console.log('Total weekly spend: $' + totalSpend.toLocaleString());

  // Store in meta_ad_insights table
  const today = new Date().toISOString().split('T')[0];
  let stored = 0;
  let errors = 0;

  for (const insight of insights) {
    // Extract leads from actions
    const actions = insight.actions || [];
    const leads = actions.find(a => a.action_type === 'lead')?.value || 0;

    const snapshot = {
      ad_id: insight.ad_id,
      snapshot_date: today,
      spend: parseFloat(insight.spend) || 0,
      impressions: parseInt(insight.impressions) || 0,
      clicks: parseInt(insight.clicks) || 0,
      reach: parseInt(insight.reach) || 0,
      leads: parseInt(leads),
      ctr: parseFloat(insight.ctr) || 0,
      cpc: parseFloat(insight.cpc) || 0
    };

    const { error } = await supabase
      .from('meta_ad_insights')
      .upsert(snapshot, {
        onConflict: 'ad_id,snapshot_date',
        ignoreDuplicates: false
      });

    if (error) {
      errors++;
      if (errors === 1) console.error('  First error:', error.message);
    } else {
      stored++;
    }
  }

  console.log('\nStored', stored, 'weekly snapshots');
  if (errors > 0) console.log('Errors:', errors);

  // Verify
  const { data: verify, count } = await supabase
    .from('meta_ad_insights')
    .select('*', { count: 'exact' })
    .eq('snapshot_date', today);

  const verifySpend = verify.reduce((sum, i) => sum + (parseFloat(i.spend) || 0), 0);
  console.log('\nVerification:');
  console.log('  Rows for today:', count);
  console.log('  Total spend: $' + verifySpend.toLocaleString());

  // Show top spenders
  const sorted = verify.sort((a, b) => b.spend - a.spend);
  console.log('\nTop 5 ads by spend (last 7 days):');
  sorted.slice(0, 5).forEach((ad, i) => {
    console.log(`  ${i + 1}. ${ad.ad_id}: $${ad.spend.toFixed(2)}`);
  });
}

syncWeeklyInsights().catch(console.error);
