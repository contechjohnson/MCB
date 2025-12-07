/**
 * Vercel Cron Job - Meta Ads Daily Sync
 *
 * Automatically syncs Meta Ads performance data daily
 * Scheduled to run every day at 6:00 AM UTC (10pm PST / 11pm PDT)
 *
 * This ensures we have fresh ad performance data for weekly reports
 *
 * Syncs TWO things:
 * 1. Lifetime ad data to meta_ads table (via sync-meta-ads.js)
 * 2. Weekly insights to meta_ad_insights table (via sync-weekly-insights.js)
 *
 * Configuration in vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/sync-meta-ads",
 *     "schedule": "0 6 * * *"  // Daily at 6am UTC
 *   }]
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const AD_ACCOUNT_ID = process.env.META_AD_ACCOUNT_ID;
const API_VERSION = process.env.META_API_VERSION || 'v20.0';

export async function GET(request: NextRequest) {
  console.log('\n🚀 Cron Job Triggered: Meta Ads Daily Sync');
  console.log(`   Time: ${new Date().toISOString()}`);

  try {
    // Verify cron secret (prevents unauthorized access)
    const authHeader = request.headers.get('authorization');
    const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;

    if (authHeader !== expectedAuth) {
      console.error('❌ Unauthorized cron request');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check Meta API credentials
    if (!ACCESS_TOKEN || !AD_ACCOUNT_ID) {
      console.error('❌ Meta API credentials not configured');
      return NextResponse.json(
        { error: 'Meta API credentials missing' },
        { status: 500 }
      );
    }

    // Fetch both 7-day and 28-day insights
    console.log('\n📊 Fetching 7-day insights...');
    const url7d = `https://graph.facebook.com/${API_VERSION}/${AD_ACCOUNT_ID}/insights?access_token=${ACCESS_TOKEN}&level=ad&date_preset=last_7d&fields=ad_id,ad_name,spend,impressions,clicks,reach,actions&limit=500`;
    const response7d = await fetch(url7d);
    const data7d = await response7d.json();
    if (data7d.error) throw new Error(`Meta API Error (7d): ${data7d.error.message}`);
    const insights7d = data7d.data || [];
    console.log(`   Found ${insights7d.length} ads`);

    console.log('\n📊 Fetching 28-day insights...');
    const url28d = `https://graph.facebook.com/${API_VERSION}/${AD_ACCOUNT_ID}/insights?access_token=${ACCESS_TOKEN}&level=ad&date_preset=last_28d&fields=ad_id,ad_name,spend,impressions,clicks,reach,actions&limit=500`;
    const response28d = await fetch(url28d);
    const data28d = await response28d.json();
    if (data28d.error) throw new Error(`Meta API Error (28d): ${data28d.error.message}`);
    const insights28d = data28d.data || [];
    console.log(`   Found ${insights28d.length} ads`);

    // Build maps
    const map7d: Record<string, any> = {};
    for (const i of insights7d) {
      const leads = i.actions?.find((a: any) => a.action_type === 'lead')?.value || 0;
      map7d[i.ad_id] = { spend: parseFloat(i.spend) || 0, impressions: parseInt(i.impressions) || 0, clicks: parseInt(i.clicks) || 0, reach: parseInt(i.reach) || 0, leads: parseInt(leads) };
    }
    const map28d: Record<string, any> = {};
    for (const i of insights28d) {
      const leads = i.actions?.find((a: any) => a.action_type === 'lead')?.value || 0;
      map28d[i.ad_id] = { spend: parseFloat(i.spend) || 0, impressions: parseInt(i.impressions) || 0, clicks: parseInt(i.clicks) || 0, reach: parseInt(i.reach) || 0, leads: parseInt(leads) };
    }

    // Merge and store
    const allAdIds = new Set([...Object.keys(map7d), ...Object.keys(map28d)]);
    const today = new Date().toISOString().split('T')[0];
    let stored = 0;
    let errors = 0;
    let totalSpend7d = 0;
    let totalSpend28d = 0;

    for (const adId of allAdIds) {
      const d7 = map7d[adId] || { spend: 0, impressions: 0, clicks: 0, reach: 0, leads: 0 };
      const d28 = map28d[adId] || { spend: 0, impressions: 0, clicks: 0, reach: 0, leads: 0 };
      totalSpend7d += d7.spend;
      totalSpend28d += d28.spend;

      const snapshot = {
        ad_id: adId,
        snapshot_date: today,
        spend: d7.spend,
        impressions: d7.impressions,
        clicks: d7.clicks,
        reach: d7.reach,
        leads: d7.leads,
        spend_28d: d28.spend,
        impressions_28d: d28.impressions,
        clicks_28d: d28.clicks,
        reach_28d: d28.reach,
        leads_28d: d28.leads
      };

      const { error } = await supabaseAdmin
        .from('meta_ad_insights')
        .upsert(snapshot, { onConflict: 'ad_id,snapshot_date', ignoreDuplicates: false });

      if (error) errors++;
      else stored++;
    }

    console.log(`\n✅ Meta Ads sync completed`);
    console.log(`   7-day spend: $${totalSpend7d.toLocaleString()}`);
    console.log(`   28-day spend: $${totalSpend28d.toLocaleString()}`);
    console.log(`   Stored: ${stored}, Errors: ${errors}`);

    return NextResponse.json({
      success: true,
      message: 'Meta Ads data synced (7d + 28d)',
      timestamp: new Date().toISOString(),
      stats: {
        adsFound: allAdIds.size,
        spend7d: totalSpend7d,
        spend28d: totalSpend28d,
        snapshotsStored: stored,
        errors: errors
      }
    });

  } catch (error) {
    console.error('\n❌ Cron job error:', error);

    if (error instanceof Error) {
      console.error('Error details:', {
        message: error.message,
        stack: error.stack
      });
    }

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Disable body parsing (cron requests have no body)
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
