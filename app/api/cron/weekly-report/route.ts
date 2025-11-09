/**
 * Vercel Cron Job - Weekly Analytics Report
 *
 * Automatically generates and sends weekly analytics report
 * Scheduled to run every Friday at 9:00 AM PST
 *
 * Setup:
 * 1. Add to vercel.json (already configured)
 * 2. Deploy to Vercel
 * 3. Cron job will run automatically
 *
 * Configuration in vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/weekly-report",
 *     "schedule": "0 17 * * 5"  // Every Friday at 5pm UTC (9am PST)
 *   }]
 * }
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  console.log('\n🚀 Cron Job Triggered: Weekly Analytics Report');
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

    // Call the weekly report endpoint with send=true
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000';

    console.log('📊 Generating weekly report...');

    const response = await fetch(`${baseUrl}/api/reports/weekly?send=true`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Report generation failed: ${JSON.stringify(errorData)}`);
    }

    const result = await response.json();

    console.log('✅ Weekly report sent successfully');
    console.log(`   Week Ending: ${result.week_ending}`);

    return NextResponse.json({
      success: true,
      message: 'Weekly report generated and sent',
      timestamp: new Date().toISOString(),
      week_ending: result.week_ending
    });

  } catch (error) {
    console.error('\n❌ Cron job error:', error);

    // Log detailed error for debugging
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
