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

// Import report generation functions
const { main: generateReport } = require('@/scripts/generate-weekly-report');
const { generateWeeklyReportEmail } = require('@/lib/email-templates/weekly-report');
const { sendWeeklyReport } = require('@/lib/email-sender');

export async function GET(request: NextRequest) {
  console.log('\n🚀 Cron Job Triggered: Weekly Analytics Report');
  console.log(`   Time: ${new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })}`);

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

    // Check if recipient email is configured
    const recipientEmail = process.env.REPORT_RECIPIENT_EMAIL;
    if (!recipientEmail) {
      console.error('❌ REPORT_RECIPIENT_EMAIL not configured');
      return NextResponse.json(
        { error: 'Recipient email not configured' },
        { status: 500 }
      );
    }

    // Generate report data
    console.log('\n📊 Generating weekly report...');
    const { reportData, weekOverWeek, textReport, dateRange } = await generateReport();

    if (!reportData || !reportData.summary) {
      console.error('❌ Failed to generate report data');
      return NextResponse.json(
        { error: 'Failed to generate report' },
        { status: 500 }
      );
    }

    console.log('✅ Report data generated successfully');

    // Generate HTML email
    console.log('\n📧 Generating HTML email...');
    const htmlEmail = generateWeeklyReportEmail(reportData, weekOverWeek, dateRange);

    if (!htmlEmail) {
      console.error('❌ Failed to generate HTML email');
      return NextResponse.json(
        { error: 'Failed to generate email template' },
        { status: 500 }
      );
    }

    console.log('✅ HTML email generated');

    // Format subject line with date range
    const startDate = new Date(dateRange.start).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
    const endDate = new Date(dateRange.end).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
    const subject = `📊 Weekly Analytics Report - ${startDate} to ${endDate}`;

    // Send email
    console.log('\n📮 Sending email...');
    const emailResult = await sendWeeklyReport({
      to: recipientEmail,
      subject,
      html: htmlEmail
    });

    if (!emailResult.success) {
      console.error('❌ Failed to send email:', emailResult);
      return NextResponse.json(
        { error: 'Failed to send email', details: emailResult },
        { status: 500 }
      );
    }

    console.log('✅ Email sent successfully!');
    console.log(`   Email ID: ${emailResult.emailId}`);

    // Return success response
    return NextResponse.json({
      success: true,
      message: 'Weekly report generated and sent successfully',
      dateRange: {
        start: dateRange.start.toISOString(),
        end: dateRange.end.toISOString()
      },
      summary: {
        contacts: reportData.summary.total_contacts,
        revenue: reportData.summary.total_revenue,
        customers: reportData.summary.total_customers
      },
      emailId: emailResult.emailId,
      recipient: recipientEmail,
      timestamp: new Date().toISOString()
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
