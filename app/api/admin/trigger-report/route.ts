/**
 * Manual Trigger Endpoint - Weekly Analytics Report
 *
 * Protected endpoint for manually triggering report generation
 * Useful for testing and ad-hoc reports
 *
 * Usage:
 * - GET /api/admin/trigger-report - Generate and send report
 * - GET /api/admin/trigger-report?preview=true - Preview report only (no email)
 * - GET /api/admin/trigger-report?start=2025-01-01&end=2025-01-07 - Custom date range
 *
 * Security: Requires ADMIN_SECRET environment variable
 */

import { NextRequest, NextResponse } from 'next/server';

// Import report generation functions
const { fetchWeeklyData, calculateWeekOverWeek, generateTextSummary, getDateRange } = require('@/scripts/generate-weekly-report');
const { generateWeeklyReportEmail } = require('@/lib/email-templates/weekly-report');
const { sendWeeklyReport } = require('@/lib/email-sender');

export async function GET(request: NextRequest) {
  console.log('\n🔧 Manual Report Trigger');
  console.log(`   Time: ${new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })}`);

  try {
    // Check authentication
    const authHeader = request.headers.get('authorization');
    const adminSecret = process.env.ADMIN_SECRET;

    if (!adminSecret) {
      return NextResponse.json(
        {
          error: 'Admin endpoint not configured',
          message: 'Set ADMIN_SECRET environment variable to enable this endpoint'
        },
        { status: 500 }
      );
    }

    const expectedAuth = `Bearer ${adminSecret}`;
    if (authHeader !== expectedAuth) {
      console.error('❌ Unauthorized request');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const previewMode = searchParams.get('preview') === 'true';
    const customStart = searchParams.get('start');
    const customEnd = searchParams.get('end');
    const recipientOverride = searchParams.get('to'); // Optional recipient override

    // Determine date range
    let dateRange;
    if (customStart && customEnd) {
      dateRange = {
        start: new Date(customStart),
        end: new Date(customEnd)
      };
      console.log(`\n📅 Using custom date range: ${customStart} to ${customEnd}`);
    } else {
      dateRange = getDateRange();
      console.log('\n📅 Using default date range (last week)');
    }

    console.log(`   Start: ${dateRange.start.toISOString().split('T')[0]}`);
    console.log(`   End: ${dateRange.end.toISOString().split('T')[0]}`);

    // Generate report data
    console.log('\n📊 Fetching weekly data...');
    const reportData = await fetchWeeklyData(dateRange.start, dateRange.end);

    if (!reportData || !reportData.summary) {
      console.error('❌ Failed to fetch report data');
      return NextResponse.json(
        { error: 'Failed to fetch report data' },
        { status: 500 }
      );
    }

    console.log('✅ Data fetched successfully');

    // Calculate week-over-week
    console.log('\n📈 Calculating week-over-week changes...');
    const weekOverWeek = await calculateWeekOverWeek(reportData);
    console.log('✅ Week-over-week calculated');

    // Generate text summary
    const textReport = generateTextSummary(reportData, weekOverWeek);

    // Generate HTML email
    console.log('\n📧 Generating HTML email...');
    const htmlEmail = generateWeeklyReportEmail(reportData, weekOverWeek, dateRange);
    console.log('✅ HTML generated');

    // Preview mode: return HTML without sending
    if (previewMode) {
      console.log('\n👁️  Preview mode - returning HTML (not sending email)');

      return new NextResponse(htmlEmail, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8'
        }
      });
    }

    // Send email
    const recipient = recipientOverride || process.env.REPORT_RECIPIENT_EMAIL;

    if (!recipient) {
      return NextResponse.json(
        {
          error: 'No recipient configured',
          message: 'Set REPORT_RECIPIENT_EMAIL or provide ?to=email@example.com'
        },
        { status: 400 }
      );
    }

    // Format subject line
    const startDate = new Date(dateRange.start).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
    const endDate = new Date(dateRange.end).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
    const subject = `📊 Weekly Analytics Report (Manual) - ${startDate} to ${endDate}`;

    console.log(`\n📮 Sending email to: ${recipient}`);
    const emailResult = await sendWeeklyReport({
      to: recipient,
      subject,
      html: htmlEmail
    });

    if (!emailResult.success) {
      console.error('❌ Failed to send email:', emailResult);
      return NextResponse.json(
        {
          error: 'Failed to send email',
          details: emailResult
        },
        { status: 500 }
      );
    }

    console.log('✅ Email sent successfully!');
    console.log(`   Email ID: ${emailResult.emailId}`);

    // Return success with summary
    return NextResponse.json({
      success: true,
      message: 'Report generated and sent successfully',
      dateRange: {
        start: dateRange.start.toISOString(),
        end: dateRange.end.toISOString()
      },
      summary: {
        total_contacts: reportData.summary.total_contacts,
        total_revenue: reportData.summary.total_revenue,
        total_customers: reportData.summary.total_customers,
        avg_order_value: reportData.summary.avg_order_value
      },
      weekOverWeek: weekOverWeek ? {
        contacts: {
          change: weekOverWeek.contacts.change,
          percentChange: weekOverWeek.contacts.percentChange
        },
        revenue: {
          change: weekOverWeek.revenue.change,
          percentChange: weekOverWeek.revenue.percentChange
        }
      } : null,
      email: {
        id: emailResult.emailId,
        recipient,
        subject
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('\n❌ Error in manual trigger:', error);

    // Return detailed error for debugging
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

// Also support POST method
export async function POST(request: NextRequest) {
  return GET(request);
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
