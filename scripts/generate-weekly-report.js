/**
 * Weekly Analytics Report Generator
 *
 * Generates comprehensive weekly performance report for Postpartum Care USA
 * Can be run manually or triggered by cron job
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: '.env.local' });

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

/**
 * Get date range for report
 * Defaults to previous week (Monday-Sunday)
 */
function getDateRange() {
  const now = new Date();
  const args = process.argv.slice(2);

  // Check for custom date range
  if (args.includes('--start') && args.includes('--end')) {
    const startIdx = args.indexOf('--start');
    const endIdx = args.indexOf('--end');
    return {
      start: new Date(args[startIdx + 1]),
      end: new Date(args[endIdx + 1])
    };
  }

  // Default to previous week (Monday-Sunday)
  const today = new Date();
  const dayOfWeek = today.getDay();
  const daysToLastMonday = dayOfWeek === 0 ? 6 : dayOfWeek + 6; // If Sunday, go back 6 days, else go back to last Monday

  const lastMonday = new Date(today);
  lastMonday.setDate(today.getDate() - daysToLastMonday);
  lastMonday.setHours(0, 0, 0, 0);

  const lastSunday = new Date(lastMonday);
  lastSunday.setDate(lastMonday.getDate() + 6);
  lastSunday.setHours(23, 59, 59, 999);

  return {
    start: lastMonday,
    end: lastSunday
  };
}

/**
 * Fetch comprehensive weekly data
 */
async function fetchWeeklyData(startDate, endDate) {
  console.log(`\n📊 Fetching analytics data for ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}...\n`);

  try {
    // Use the RPC function to get all data
    const { data: reportData, error } = await supabaseAdmin
      .rpc('fn_get_weekly_report', {
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString()
      });

    if (error) {
      console.error('Error fetching report data:', error);
      throw error;
    }

    console.log('✅ Data fetched successfully\n');
    return reportData;

  } catch (error) {
    console.error('Failed to fetch weekly data:', error.message);
    throw error;
  }
}

/**
 * Calculate week-over-week changes
 */
async function calculateWeekOverWeek(currentWeekData) {
  console.log('📈 Calculating week-over-week changes...\n');

  try {
    const currentSummary = currentWeekData.summary;

    // Get previous week data
    const { start: currentStart } = getDateRange();
    const prevStart = new Date(currentStart);
    prevStart.setDate(prevStart.getDate() - 7);
    const prevEnd = new Date(prevStart);
    prevEnd.setDate(prevStart.getDate() + 6);

    const { data: prevWeekData, error } = await supabaseAdmin
      .rpc('fn_get_weekly_report', {
        start_date: prevStart.toISOString(),
        end_date: prevEnd.toISOString()
      });

    if (error) {
      console.warn('Could not fetch previous week data:', error.message);
      return null;
    }

    const prevSummary = prevWeekData.summary;

    // Calculate changes
    const changes = {
      contacts: {
        current: currentSummary.total_contacts,
        previous: prevSummary.total_contacts,
        change: currentSummary.total_contacts - prevSummary.total_contacts,
        percentChange: prevSummary.total_contacts > 0
          ? ((currentSummary.total_contacts - prevSummary.total_contacts) / prevSummary.total_contacts * 100).toFixed(1)
          : null
      },
      revenue: {
        current: parseFloat(currentSummary.total_revenue || 0),
        previous: parseFloat(prevSummary.total_revenue || 0),
        change: parseFloat(currentSummary.total_revenue || 0) - parseFloat(prevSummary.total_revenue || 0),
        percentChange: prevSummary.total_revenue > 0
          ? ((currentSummary.total_revenue - prevSummary.total_revenue) / prevSummary.total_revenue * 100).toFixed(1)
          : null
      },
      customers: {
        current: currentSummary.total_customers,
        previous: prevSummary.total_customers,
        change: currentSummary.total_customers - prevSummary.total_customers,
        percentChange: prevSummary.total_customers > 0
          ? ((currentSummary.total_customers - prevSummary.total_customers) / prevSummary.total_customers * 100).toFixed(1)
          : null
      },
      aov: {
        current: parseFloat(currentSummary.avg_order_value || 0),
        previous: parseFloat(prevSummary.avg_order_value || 0),
        change: parseFloat(currentSummary.avg_order_value || 0) - parseFloat(prevSummary.avg_order_value || 0),
        percentChange: prevSummary.avg_order_value > 0
          ? ((currentSummary.avg_order_value - prevSummary.avg_order_value) / prevSummary.avg_order_value * 100).toFixed(1)
          : null
      }
    };

    console.log('✅ Week-over-week analysis complete\n');
    return changes;

  } catch (error) {
    console.error('Error calculating week-over-week:', error.message);
    return null;
  }
}

/**
 * Generate text summary
 */
function generateTextSummary(reportData, weekOverWeek) {
  const { summary, data_quality, weekly_performance } = reportData;

  let report = '';
  report += '═'.repeat(80) + '\n';
  report += '📊 WEEKLY ANALYTICS REPORT - POSTPARTUM CARE USA\n';
  report += '═'.repeat(80) + '\n\n';

  // Executive Summary
  report += '🎯 EXECUTIVE SUMMARY\n';
  report += '─'.repeat(80) + '\n';
  report += `Total Contacts: ${summary.total_contacts}`;
  if (weekOverWeek) {
    const arrow = weekOverWeek.contacts.change >= 0 ? '↑' : '↓';
    report += ` ${arrow} ${Math.abs(weekOverWeek.contacts.change)} (${weekOverWeek.contacts.percentChange}% vs last week)`;
  }
  report += '\n';

  report += `Total Revenue: $${parseFloat(summary.total_revenue || 0).toLocaleString('en-US', {minimumFractionDigits: 2})}`;
  if (weekOverWeek) {
    const arrow = weekOverWeek.revenue.change >= 0 ? '↑' : '↓';
    report += ` ${arrow} $${Math.abs(weekOverWeek.revenue.change).toLocaleString('en-US', {minimumFractionDigits: 2})} (${weekOverWeek.revenue.percentChange}% vs last week)`;
  }
  report += '\n';

  report += `Total Customers: ${summary.total_customers}`;
  if (weekOverWeek) {
    const arrow = weekOverWeek.customers.change >= 0 ? '↑' : '↓';
    report += ` ${arrow} ${Math.abs(weekOverWeek.customers.change)} (${weekOverWeek.customers.percentChange}% vs last week)`;
  }
  report += '\n';

  report += `Average Order Value: $${parseFloat(summary.avg_order_value || 0).toLocaleString('en-US', {minimumFractionDigits: 2})}`;
  if (weekOverWeek) {
    const arrow = weekOverWeek.aov.change >= 0 ? '↑' : '↓';
    report += ` ${arrow} $${Math.abs(weekOverWeek.aov.change).toLocaleString('en-US', {minimumFractionDigits: 2})} (${weekOverWeek.aov.percentChange}% vs last week)`;
  }
  report += '\n\n';

  // Funnel Performance
  if (reportData.funnel_metrics && reportData.funnel_metrics.length > 0) {
    report += '🔄 FUNNEL PERFORMANCE\n';
    report += '─'.repeat(80) + '\n';

    const overallFunnel = reportData.funnel_metrics.find(f => !f.chatbot_ab) || reportData.funnel_metrics[0];
    if (overallFunnel) {
      report += `Entered Funnel: ${overallFunnel.entered_funnel}\n`;
      report += `→ Qualified: ${overallFunnel.qualified} (${overallFunnel.qualify_rate}%)\n`;
      report += `→ Form Submitted: ${overallFunnel.form_submitted} (${overallFunnel.form_submit_rate}% of clicked)\n`;
      report += `→ Meeting Booked: ${overallFunnel.meeting_booked} (${overallFunnel.booking_rate}% of forms)\n`;
      report += `→ Meeting Held: ${overallFunnel.meeting_held} (${overallFunnel.show_rate}% show rate)\n`;
      report += `→ Purchased: ${overallFunnel.purchased} (${overallFunnel.close_rate}% close rate)\n`;
      report += `Overall Conversion: ${overallFunnel.overall_conversion}%\n\n`;
    }
  }

  // Revenue Breakdown
  if (reportData.revenue_breakdown && reportData.revenue_breakdown.length > 0) {
    report += '💰 REVENUE BREAKDOWN\n';
    report += '─'.repeat(80) + '\n';
    const rev = reportData.revenue_breakdown[0];
    report += `Stripe: ${rev.stripe_payments || 0} payments, $${parseFloat(rev.stripe_revenue || 0).toLocaleString('en-US', {minimumFractionDigits: 2})}\n`;
    report += `Denefits: ${rev.denefits_payments || 0} payments, $${parseFloat(rev.denefits_revenue || 0).toLocaleString('en-US', {minimumFractionDigits: 2})}\n`;
    report += `Buy-in-Full: ${rev.buy_in_full_count || 0} (${parseFloat(rev.buy_in_full_revenue || 0).toLocaleString('en-US', {minimumFractionDigits: 2})})\n`;
    report += `BNPL: ${rev.bnpl_count || 0} ($${parseFloat(rev.bnpl_revenue || 0).toLocaleString('en-US', {minimumFractionDigits: 2})})\n`;
    report += `Orphan Payments: ${rev.orphan_payments || 0} (${rev.orphan_rate || 0}%)\n\n`;
  }

  // Data Quality
  if (data_quality) {
    report += '📈 DATA QUALITY\n';
    report += '─'.repeat(80) + '\n';
    report += `Total Contacts: ${data_quality.total_contacts}\n`;
    report += `Historical: ${data_quality.historical_contacts} (${data_quality.historical_pct}%)\n`;
    report += `Live: ${data_quality.live_contacts}\n`;
    report += `MC→GHL Linkage: ${data_quality.mc_to_ghl_linkage_rate}%\n`;
    report += `Has MC_ID: ${data_quality.mc_id_pct}%\n`;
    report += `Has GHL_ID: ${data_quality.ghl_id_pct}%\n`;
    report += `Has AD_ID: ${data_quality.ad_id_pct}%\n`;
    report += `Symptom Data: ${data_quality.symptom_data_pct}%\n\n`;
  }

  report += '═'.repeat(80) + '\n';
  report += 'Report generated: ' + new Date().toISOString() + '\n';
  report += '═'.repeat(80) + '\n';

  return report;
}

/**
 * Main execution
 */
async function main() {
  console.log('\n🚀 Weekly Analytics Report Generator\n');
  console.log('═'.repeat(80) + '\n');

  try {
    // Get date range
    const { start, end } = getDateRange();
    console.log(`📅 Report Period: ${start.toISOString().split('T')[0]} to ${end.toISOString().split('T')[0]}\n`);

    // Fetch data
    const reportData = await fetchWeeklyData(start, end);

    // Calculate week-over-week
    const weekOverWeek = await calculateWeekOverWeek(reportData);

    // Generate text report
    const textReport = generateTextSummary(reportData, weekOverWeek);
    console.log(textReport);

    // Save to file (optional)
    if (process.argv.includes('--save')) {
      const filename = `weekly-report-${start.toISOString().split('T')[0]}.txt`;
      const filepath = path.join(__dirname, '../reports', filename);

      // Create reports directory if it doesn't exist
      const reportsDir = path.join(__dirname, '../reports');
      if (!fs.existsSync(reportsDir)) {
        fs.mkdirSync(reportsDir, { recursive: true });
      }

      fs.writeFileSync(filepath, textReport);
      console.log(`\n💾 Report saved to: ${filepath}\n`);
    }

    // Return data for email generation (when called from API)
    return {
      reportData,
      weekOverWeek,
      textReport,
      dateRange: { start, end }
    };

  } catch (error) {
    console.error('\n❌ Error generating report:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main().then(() => {
    console.log('\n✅ Report generation complete!\n');
    process.exit(0);
  }).catch(error => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
}

// Export for use in API routes
module.exports = { main, fetchWeeklyData, calculateWeekOverWeek, generateTextSummary, getDateRange };
