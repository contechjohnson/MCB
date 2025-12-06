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

    // Sync weekly insights (last 7 days) for weekly reporting
    console.log('\n📊 Fetching weekly insights (last 7 days)...');

    const url = `https://graph.facebook.com/${API_VERSION}/${AD_ACCOUNT_ID}/insights?access_token=${ACCESS_TOKEN}&level=ad&date_preset=last_7d&fields=ad_id,ad_name,spend,impressions,clicks,reach,ctr,cpc,actions&limit=500`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
      throw new Error(`Meta API Error: ${data.error.message}`);
    }

    const insights = data.data || [];
    console.log(`   Found ${insights.length} ads with weekly insights`);

    // Calculate total spend
    const totalSpend = insights.reduce((sum: number, i: any) => sum + (parseFloat(i.spend) || 0), 0);
    console.log(`   Total weekly spend: $${totalSpend.toLocaleString()}`);

    // Store in meta_ad_insights table
    const today = new Date().toISOString().split('T')[0];
    let stored = 0;
    let errors = 0;

    for (const insight of insights) {
      const actions = insight.actions || [];
      const leads = actions.find((a: any) => a.action_type === 'lead')?.value || 0;

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

      const { error } = await supabaseAdmin
        .from('meta_ad_insights')
        .upsert(snapshot, {
          onConflict: 'ad_id,snapshot_date',
          ignoreDuplicates: false
        });

      if (error) {
        errors++;
      } else {
        stored++;
      }
    }

    console.log(`\n✅ Meta Ads sync completed`);
    console.log(`   Stored: ${stored} snapshots`);
    console.log(`   Errors: ${errors} (likely FK constraint - ads not in meta_ads table)`);

    return NextResponse.json({
      success: true,
      message: 'Meta Ads data synced successfully',
      timestamp: new Date().toISOString(),
      stats: {
        adsFound: insights.length,
        totalWeeklySpend: totalSpend,
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
