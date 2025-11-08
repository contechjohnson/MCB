/**
 * Vercel Cron Job - Meta Ads Daily Sync
 *
 * Automatically syncs Meta Ads performance data daily
 * Scheduled to run every day at 6:00 AM UTC (10pm PST / 11pm PDT)
 *
 * This ensures we have fresh ad performance data for weekly reports
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

// Import enhanced sync function
const { main: syncMetaAds } = require('@/scripts/sync-meta-ads-enhanced');

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
    if (!process.env.META_ACCESS_TOKEN || !process.env.META_AD_ACCOUNT_ID) {
      console.error('❌ Meta API credentials not configured');
      return NextResponse.json(
        { error: 'Meta API credentials missing' },
        { status: 500 }
      );
    }

    // Run sync
    console.log('\n📊 Syncing Meta Ads data...');
    await syncMetaAds();

    console.log('\n✅ Meta Ads sync completed successfully');

    return NextResponse.json({
      success: true,
      message: 'Meta Ads data synced successfully',
      timestamp: new Date().toISOString()
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
