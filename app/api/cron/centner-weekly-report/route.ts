/**
 * Vercel Cron Job - Centner Wellness Weekly Report
 *
 * Simple weekly report:
 * - Content Reach (Instagram impressions + reach)
 * - ManyChat Leads
 * - Calls Held
 * - Purchases
 * - Total Revenue
 *
 * Schedule: Every Thursday at 5 PM EST (10 PM UTC)
 * Cron: 0 22 * * 4
 */

import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

export async function GET(request: Request) {
  try {
    console.log('🚀 Centner Wellness Weekly Report Cron');

    const url = new URL(request.url);
    const testMode = url.searchParams.get('test') === 'true';

    console.log(`Running report in ${testMode ? 'TEST' : 'PRODUCTION'} mode`);

    // Execute the report script
    const { stdout, stderr } = await execPromise('node execution/centner-weekly-report.js', {
      cwd: process.cwd(),
      env: {
        ...process.env,
        NODE_ENV: 'production'
      }
    });

    console.log('Centner report stdout:', stdout);
    if (stderr) console.error('Centner report stderr:', stderr);

    return NextResponse.json({
      success: true,
      message: 'Centner weekly report sent',
      output: stdout
    });

  } catch (error) {
    console.error('Centner report error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
