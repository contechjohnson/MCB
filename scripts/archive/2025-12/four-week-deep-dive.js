/**
 * Monthly Deep Dive Report (4 Weeks)
 *
 * Comprehensive monthly analysis sent on the first of each month:
 * - Week-over-week funnel progression
 * - Revenue and spend trends
 * - Key conversion rates (Lead→Qualified, Form→Held, Close Rate)
 * - Cost per lead and cost per acquisition
 * - QuickChart.io charts for email visualization
 *
 * Schedule: Monthly (1st of month) via Vercel cron
 * Usage: node execution/four-week-deep-dive.js
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const resend = new Resend(process.env.RESEND_API_KEY);

// Format date as "Nov 8" or "Dec 6"
function formatShortDate(dateStr) {
  const date = new Date(dateStr);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[date.getMonth()]} ${date.getDate()}`;
}

// Get the last N weeks, skipping the very first week (launch week)
// Returns weeks with date-based labels like "Nov 8-15"
function getLastNWeeks(numWeeks = 5) {
  const weeks = [];
  const today = new Date();

  // Start from 1 to skip the oldest week (launch week)
  // So if numWeeks=5, we fetch 5 weeks but skip index 0, giving us 4 good weeks + current
  for (let i = 0; i < numWeeks; i++) {
    const weekEnd = new Date(today);
    weekEnd.setDate(today.getDate() - (i * 7));
    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekEnd.getDate() - 6); // 6 days before end = 7 day span

    // Use date range as label: "Nov 8-15"
    const startLabel = formatShortDate(weekStart.toISOString().split('T')[0]);
    const endLabel = formatShortDate(weekEnd.toISOString().split('T')[0]);

    weeks.push({
      week_num: numWeeks - i,
      week_label: `${startLabel}-${endLabel.split(' ')[1]}`, // "Nov 8-15" format
      start: weekStart.toISOString().split('T')[0],
      end: weekEnd.toISOString().split('T')[0]
    });
  }

  return weeks.reverse(); // Oldest first
}

// Fetch data for a single week
async function fetchWeekData(startDate, endDate) {
  // Contacts for the week (based on subscribe_date)
  const { data: contacts } = await supabase
    .from('contacts')
    .select('*')
    .neq('source', 'instagram_historical')
    .neq('source', 'instagram_lm')
    .gte('subscribe_date', startDate)
    .lte('subscribe_date', endDate);

  // Payments for the week (based on payment_date)
  const { data: payments } = await supabase
    .from('payments')
    .select('*')
    .gte('payment_date', startDate)
    .lte('payment_date', endDate + 'T23:59:59');

  // Ad insights - get latest snapshot
  const { data: adInsights } = await supabase
    .from('meta_ad_insights')
    .select('*')
    .order('snapshot_date', { ascending: false })
    .limit(100);

  // Funnel metrics from contacts
  const totalContacts = contacts?.length || 0;
  const dmQualified = contacts?.filter(c => c.dm_qualified_date).length || 0;
  const linkSent = contacts?.filter(c => c.link_send_date).length || 0;
  const linkClicked = contacts?.filter(c => c.link_click_date).length || 0;
  const formSubmitted = contacts?.filter(c => c.form_submit_date).length || 0;
  const meetingsBooked = contacts?.filter(c => c.appointment_date).length || 0;
  const meetingsHeld = contacts?.filter(c => c.appointment_held_date).length || 0;
  const packageSent = contacts?.filter(c => c.package_sent_date).length || 0;

  // PURCHASES - cohort based (contacts created this week who eventually purchased)
  // This keeps funnel metrics consistent (all based on when contact entered)
  const purchased = contacts?.filter(c => c.purchase_date).length || 0;

  // Revenue from payments (activity-based - money received this week)
  const totalRevenue = payments?.reduce((sum, p) => sum + parseFloat(p.amount || '0'), 0) || 0;
  const paymentCount = payments?.length || 0;

  // Also track unique payers this week (for reference, not for funnel)
  const uniquePayersThisWeek = [...new Set((payments || []).map(p => p.customer_email?.toLowerCase()).filter(Boolean))].length;

  // Ad spend
  const totalSpend = adInsights?.reduce((sum, i) => sum + parseFloat(i.spend || '0'), 0) || 0;

  // Attributed spend
  const contactAdIds = [...new Set((contacts || []).filter(c => c.ad_id).map(c => c.ad_id))];
  const attributedSpend = adInsights
    ?.filter(i => contactAdIds.includes(i.ad_id))
    .reduce((sum, i) => sum + parseFloat(i.spend || '0'), 0) || 0;

  // ROAS
  const totalRoas = totalSpend > 0 ? (totalRevenue / totalSpend) : 0;
  const attributedRoas = attributedSpend > 0 ? (totalRevenue / attributedSpend) : 0;

  // Attribution coverage
  const withAdId = contacts?.filter(c => c.ad_id).length || 0;
  const attributionCoverage = totalContacts > 0 ? (withAdId / totalContacts * 100) : 0;

  return {
    funnel: {
      new_leads: totalContacts,
      dm_qualified: dmQualified,
      link_sent: linkSent,
      link_clicked: linkClicked,
      form_submitted: formSubmitted,
      meeting_booked: meetingsBooked,
      meeting_held: meetingsHeld,
      package_sent: packageSent,
      purchased: purchased
    },
    revenue: {
      total: totalRevenue,
      payment_count: paymentCount
    },
    ads: {
      total_spend: totalSpend,
      attributed_spend: attributedSpend,
      total_roas: totalRoas,
      attributed_roas: attributedRoas,
      attribution_coverage: attributionCoverage
    }
  };
}

// Modern color palette (clean, not AI-gradient)
const COLORS = {
  primary: '#2563eb',      // Blue
  secondary: '#0891b2',    // Cyan
  success: '#059669',      // Green
  warning: '#d97706',      // Amber
  danger: '#dc2626',       // Red
  neutral: '#6b7280'       // Gray
};

// Generate chart URL using QuickChart.io (renders as actual image in email)
function generateBarChartUrl(data, title) {
  const chartConfig = {
    type: 'bar',
    data: {
      labels: data.map(d => d.label),
      datasets: [{
        label: title,
        data: data.map(d => d.value),
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
        borderWidth: 0,
        borderRadius: 4
      }]
    },
    options: {
      plugins: {
        title: { display: true, text: title, font: { size: 14, weight: 'bold' } },
        legend: { display: false }
      },
      scales: {
        y: { beginAtZero: true, grid: { color: '#e5e7eb' } },
        x: { grid: { display: false } }
      }
    }
  };

  const encoded = encodeURIComponent(JSON.stringify(chartConfig));
  return `https://quickchart.io/chart?c=${encoded}&w=550&h=250&bkg=white`;
}

// Generate line chart URL using QuickChart.io
function generateLineChartUrl(weeks, stages, title) {
  const lineColors = [
    COLORS.primary,    // Blue
    COLORS.secondary,  // Cyan
    COLORS.success,    // Green
    COLORS.warning     // Amber
  ];

  const chartConfig = {
    type: 'line',
    data: {
      labels: weeks.map(w => w.week_label),
      datasets: stages.map((stage, i) => ({
        label: stage.name,
        data: stage.values,
        borderColor: lineColors[i % lineColors.length],
        backgroundColor: 'transparent',
        fill: false,
        tension: 0.3,
        pointRadius: 4,
        pointBackgroundColor: lineColors[i % lineColors.length]
      }))
    },
    options: {
      plugins: {
        title: { display: true, text: title, font: { size: 14, weight: 'bold' } },
        legend: { position: 'bottom' }
      },
      scales: {
        y: { beginAtZero: true, grid: { color: '#e5e7eb' } },
        x: { grid: { display: false } }
      }
    }
  };

  const encoded = encodeURIComponent(JSON.stringify(chartConfig));
  return `https://quickchart.io/chart?c=${encoded}&w=600&h=300&bkg=white`;
}

// Generate funnel chart - horizontal bar showing COUNTS at each stage
// This shows the funnel narrowing: 100 leads → 42 qualified → 39 clicked → etc.
function generateFunnelChartUrl(funnelData, title) {
  const stages = [
    { name: 'Leads', count: funnelData.new_leads },
    { name: 'Qualified', count: funnelData.dm_qualified },
    { name: 'Link Clicked', count: funnelData.link_clicked },
    { name: 'Form Submitted', count: funnelData.form_submitted },
    { name: 'Meeting Booked', count: funnelData.meeting_booked },
    { name: 'Meeting Held', count: funnelData.meeting_held },
    { name: 'Purchased', count: funnelData.purchased }
  ];

  // Gradient from blue (top of funnel) to green (purchased)
  const funnelColors = [
    '#3b82f6', // Blue - Leads
    '#2563eb', // Blue - Qualified
    '#0891b2', // Cyan - Link Clicked
    '#0d9488', // Teal - Form Submitted
    '#059669', // Green - Meeting Booked
    '#047857', // Green - Meeting Held
    '#065f46'  // Dark Green - Purchased
  ];

  const chartConfig = {
    type: 'horizontalBar',
    data: {
      labels: stages.map(s => s.name),
      datasets: [{
        data: stages.map(s => s.count),
        backgroundColor: funnelColors,
        borderWidth: 0
      }]
    },
    options: {
      plugins: {
        title: { display: true, text: title, font: { size: 14, weight: 'bold' } },
        legend: { display: false },
        datalabels: {
          display: true,
          anchor: 'end',
          align: 'end',
          font: { weight: 'bold', size: 12 },
          color: '#374151'
        }
      },
      scales: {
        x: {
          beginAtZero: true,
          grid: { color: '#e5e7eb' }
        },
        y: { grid: { display: false } }
      }
    }
  };

  const encoded = encodeURIComponent(JSON.stringify(chartConfig));
  return `https://quickchart.io/chart?c=${encoded}&w=550&h=280&bkg=white`;
}

// Calculate week-over-week change
function calcChange(current, previous) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous * 100);
}

// Generate the analysis report
function generateReport(weeks, weekData) {
  let report = '';

  // Executive Summary
  const firstWeek = weekData[0];
  const lastWeek = weekData[weekData.length - 1];

  const leadsTrend = calcChange(lastWeek.funnel.new_leads, firstWeek.funnel.new_leads);
  const revenueTrend = calcChange(lastWeek.revenue.total, firstWeek.revenue.total);
  const spendTrend = calcChange(lastWeek.ads.total_spend, firstWeek.ads.total_spend);

  report += `# Performance Deep Dive\n\n`;
  report += `**Period:** ${weeks[0].start} to ${weeks[weeks.length - 1].end}\n\n`;

  report += `## Summary\n\n`;
  report += `Trends over ${weeks.length} weeks:\n`;
  report += `- **New Leads:** ${leadsTrend >= 0 ? '📈' : '📉'} ${leadsTrend >= 0 ? '+' : ''}${leadsTrend.toFixed(1)}% (${firstWeek.funnel.new_leads} → ${lastWeek.funnel.new_leads})\n`;
  report += `- **Revenue:** ${revenueTrend >= 0 ? '📈' : '📉'} ${revenueTrend >= 0 ? '+' : ''}${revenueTrend.toFixed(1)}% ($${firstWeek.revenue.total.toLocaleString()} → $${lastWeek.revenue.total.toLocaleString()})\n`;
  report += `- **Ad Spend:** ${spendTrend >= 0 ? '📈' : '📉'} ${spendTrend >= 0 ? '+' : ''}${spendTrend.toFixed(1)}% ($${firstWeek.ads.total_spend.toLocaleString()} → $${lastWeek.ads.total_spend.toLocaleString()})\n\n`;

  // Weekly breakdown
  report += `## Week-by-Week Breakdown\n\n`;

  weeks.forEach((week, i) => {
    const data = weekData[i];
    const prevData = i > 0 ? weekData[i - 1] : null;

    report += `### ${week.week_label} (${week.start} to ${week.end})\n\n`;

    // Funnel
    report += `**Funnel:**\n`;
    report += `- New Leads: **${data.funnel.new_leads}**${prevData ? ` (${calcChange(data.funnel.new_leads, prevData.funnel.new_leads) >= 0 ? '+' : ''}${calcChange(data.funnel.new_leads, prevData.funnel.new_leads).toFixed(0)}% WoW)` : ''}\n`;
    report += `- DM Qualified: **${data.funnel.dm_qualified}** (${data.funnel.new_leads > 0 ? (data.funnel.dm_qualified / data.funnel.new_leads * 100).toFixed(0) : 0}%)\n`;
    report += `- Meetings Held: **${data.funnel.meeting_held}**\n`;
    report += `- Purchased: **${data.funnel.purchased}**\n\n`;

    // Revenue & Spend
    report += `**Revenue & Spend:**\n`;
    report += `- Revenue: **$${data.revenue.total.toLocaleString()}** (${data.revenue.payment_count} payments)\n`;
    report += `- Total Spend: **$${data.ads.total_spend.toLocaleString()}**\n`;
    report += `- Attributed Spend: **$${data.ads.attributed_spend.toLocaleString()}**\n`;
    report += `- Total ROAS: **${data.ads.total_roas.toFixed(2)}x**\n`;
    report += `- Attributed ROAS: **${data.ads.attributed_roas.toFixed(2)}x**\n`;
    report += `- Attribution Coverage: **${data.ads.attribution_coverage.toFixed(0)}%**\n\n`;
  });

  // Funnel conversion analysis
  report += `## Funnel Conversion Trends\n\n`;

  const conversionStages = [
    { name: 'Lead → DM Qualified', calc: (d) => d.funnel.new_leads > 0 ? (d.funnel.dm_qualified / d.funnel.new_leads * 100) : 0 },
    { name: 'DM Qualified → Link Clicked', calc: (d) => d.funnel.dm_qualified > 0 ? (d.funnel.link_clicked / d.funnel.dm_qualified * 100) : 0 },
    { name: 'Link Clicked → Form Submitted', calc: (d) => d.funnel.link_clicked > 0 ? (d.funnel.form_submitted / d.funnel.link_clicked * 100) : 0 },
    { name: 'Form → Meeting Booked', calc: (d) => d.funnel.form_submitted > 0 ? (d.funnel.meeting_booked / d.funnel.form_submitted * 100) : 0 },
    { name: 'Meeting Booked → Held', calc: (d) => d.funnel.meeting_booked > 0 ? (d.funnel.meeting_held / d.funnel.meeting_booked * 100) : 0 },
    { name: 'Meeting Held → Purchased', calc: (d) => d.funnel.meeting_held > 0 ? (d.funnel.purchased / d.funnel.meeting_held * 100) : 0 }
  ];

  conversionStages.forEach(stage => {
    const rates = weekData.map(d => stage.calc(d));
    const avg = rates.reduce((a, b) => a + b, 0) / rates.length;
    const trend = calcChange(rates[rates.length - 1], rates[0]);

    report += `- **${stage.name}:** Avg ${avg.toFixed(0)}% (${trend >= 0 ? '📈' : '📉'} ${trend >= 0 ? '+' : ''}${trend.toFixed(0)}% over 5 weeks)\n`;
  });

  report += `\n## Key Insights\n\n`;

  // Generate insights based on data
  const totalRevenue = weekData.reduce((sum, d) => sum + d.revenue.total, 0);
  const totalSpend = weekData.reduce((sum, d) => sum + d.ads.total_spend, 0);
  const totalLeads = weekData.reduce((sum, d) => sum + d.funnel.new_leads, 0);
  const totalPurchases = weekData.reduce((sum, d) => sum + d.funnel.purchased, 0);

  report += `1. **4-Week Totals:** ${totalLeads} leads → ${totalPurchases} purchases ($${totalRevenue.toLocaleString()} revenue)\n`;
  report += `2. **Overall ROAS:** ${(totalRevenue / totalSpend).toFixed(2)}x across $${totalSpend.toLocaleString()} ad spend\n`;
  report += `3. **Cost Per Lead:** $${(totalSpend / totalLeads).toFixed(2)}\n`;
  report += `4. **Cost Per Acquisition:** $${totalPurchases > 0 ? (totalSpend / totalPurchases).toFixed(2) : 'N/A'}\n`;
  report += `5. **Average Order Value:** $${totalPurchases > 0 ? (totalRevenue / totalPurchases).toFixed(2) : 'N/A'}\n\n`;

  return report;
}

// Main function
async function main() {
  console.log('📊 Deep Dive Analysis\n');
  console.log('═'.repeat(60) + '\n');

  // Get last 4 weeks for monthly report
  const weeks = getLastNWeeks(4);

  console.log('Monthly Deep Dive - Last 4 Weeks:');
  weeks.forEach(w => console.log(`  ${w.week_label}: ${w.start} to ${w.end}`));
  console.log();

  // Fetch data for each week
  console.log('Fetching data...');
  const weekData = [];
  for (const week of weeks) {
    console.log(`  Fetching ${week.week_label}...`);
    const data = await fetchWeekData(week.start, week.end);
    weekData.push(data);
  }
  console.log('✅ Data fetched\n');

  // Generate chart URLs (QuickChart.io - will render as images in email)
  console.log('Generating charts...');

  // Revenue chart
  const revenueChartUrl = generateBarChartUrl(
    weeks.map((w, i) => ({ label: w.week_label, value: Math.round(weekData[i].revenue.total) })),
    'Weekly Revenue ($)'
  );

  // Leads chart
  const leadsChartUrl = generateBarChartUrl(
    weeks.map((w, i) => ({ label: w.week_label, value: weekData[i].funnel.new_leads })),
    'Weekly New Leads'
  );

  // Funnel chart - aggregate across all weeks to show total counts
  // This shows the funnel narrowing: Leads → Qualified → Clicked → etc.
  const aggregateFunnel = {
    new_leads: weekData.reduce((s, d) => s + d.funnel.new_leads, 0),
    dm_qualified: weekData.reduce((s, d) => s + d.funnel.dm_qualified, 0),
    link_clicked: weekData.reduce((s, d) => s + d.funnel.link_clicked, 0),
    form_submitted: weekData.reduce((s, d) => s + d.funnel.form_submitted, 0),
    meeting_booked: weekData.reduce((s, d) => s + d.funnel.meeting_booked, 0),
    meeting_held: weekData.reduce((s, d) => s + d.funnel.meeting_held, 0),
    purchased: weekData.reduce((s, d) => s + d.funnel.purchased, 0)
  };
  const funnelChartUrl = generateFunnelChartUrl(aggregateFunnel, `Funnel (${weeks.length} Weeks Combined)`);

  console.log('✅ Charts generated\n');

  // Generate report text
  const reportText = generateReport(weeks, weekData);
  console.log('✅ Report generated\n');

  // Convert to HTML
  const htmlContent = reportText
    .replace(/^# (.*?)$/gm, '<h1 style="color: #1f2937; margin-top: 24px; font-size: 24px; border-bottom: 3px solid #667eea; padding-bottom: 8px;">$1</h1>')
    .replace(/^## (.*?)$/gm, '<h2 style="color: #374151; margin-top: 28px; margin-bottom: 16px; font-size: 20px; font-weight: 600;">$1</h2>')
    .replace(/^### (.*?)$/gm, '<h3 style="color: #4b5563; margin-top: 20px; margin-bottom: 12px; font-size: 16px; font-weight: 600; background: #f3f4f6; padding: 8px 12px; border-radius: 6px;">$1</h3>')
    .replace(/\*\*(.*?)\*\*/g, '<strong style="color: #1f2937;">$1</strong>')
    .replace(/^- (.*?)$/gm, '<li style="margin: 6px 0;">$1</li>')
    .replace(/(<li[^>]*>.*?<\/li>\s*)+/gs, '<ul style="margin: 12px 0; padding-left: 24px;">$&</ul>')
    .replace(/\n\n/g, '</p><p style="margin: 14px 0; line-height: 1.7;">')
    .replace(/\n/g, '<br>');

  // Send email
  console.log('Sending email via Resend...');

  const { data, error } = await resend.emails.send({
    from: 'Clara Analytics <onboarding@resend.dev>',
    to: ['connor@columnline.com'],
    subject: `PPCU Monthly Report: ${weeks[0].week_label} to ${weeks[weeks.length - 1].week_label}`,
    text: reportText,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; background-color: #f9fafb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; padding: 16px;">

          <!-- Header -->
          <div style="background: #1f2937; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 20px; font-weight: 600;">PPCU Monthly Report</h1>
            <p style="color: #9ca3af; margin: 6px 0 0 0; font-size: 13px;">${weeks[0].week_label} to ${weeks[weeks.length - 1].week_label}</p>
          </div>

          <!-- Charts -->
          <div style="background: white; padding: 20px;">
            <img src="${revenueChartUrl}" alt="Revenue" style="width: 100%; height: auto; margin-bottom: 16px;" />
            <img src="${leadsChartUrl}" alt="Leads" style="width: 100%; height: auto; margin-bottom: 16px;" />
            <img src="${funnelChartUrl}" alt="Funnel" style="width: 100%; height: auto;" />
          </div>

          <!-- Narrative & Key Conversion Rates -->
          <div style="background: #f9fafb; padding: 16px; border-left: 3px solid #2563eb;">
            <p style="margin: 0 0 12px 0; font-weight: 600; color: #1f2937; font-size: 15px;">Monthly Summary</p>
            <p style="margin: 0 0 16px 0; font-size: 13px; color: #4b5563; line-height: 1.6;">
              Over ${weeks.length} weeks: <strong>${aggregateFunnel.new_leads.toLocaleString()}</strong> leads entered the funnel →
              <strong>${aggregateFunnel.dm_qualified.toLocaleString()}</strong> qualified →
              <strong>${aggregateFunnel.meeting_held}</strong> meetings held →
              <strong>${aggregateFunnel.purchased}</strong> purchased.
            </p>

            <p style="margin: 0 0 8px 0; font-weight: 600; color: #1f2937; font-size: 14px;">Key Conversion Rates</p>
            <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
              <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 6px 0; color: #6b7280;">Lead → Qualified</td>
                <td style="padding: 6px 0; text-align: right; font-weight: 600;">${Math.round(aggregateFunnel.dm_qualified/aggregateFunnel.new_leads*100)}%</td>
              </tr>
              <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 6px 0; color: #6b7280;">Link Click → Form Submit</td>
                <td style="padding: 6px 0; text-align: right; font-weight: 600;">${aggregateFunnel.link_clicked > 0 ? Math.round(aggregateFunnel.form_submitted/aggregateFunnel.link_clicked*100) : 0}%</td>
              </tr>
              <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 6px 0; color: #6b7280;">Form Submit → Meeting Held</td>
                <td style="padding: 6px 0; text-align: right; font-weight: 600;">${aggregateFunnel.form_submitted > 0 ? Math.round(aggregateFunnel.meeting_held/aggregateFunnel.form_submitted*100) : 0}%</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #6b7280;"><strong>Close Rate</strong> (Meeting Held → Purchased)</td>
                <td style="padding: 6px 0; text-align: right; font-weight: 700; color: #059669;">${aggregateFunnel.meeting_held > 0 ? Math.round(aggregateFunnel.purchased/aggregateFunnel.meeting_held*100) : 0}%</td>
              </tr>
            </table>
          </div>

          <!-- Week-by-Week Breakdown -->
          <div style="background: white; padding: 16px; border-top: 1px solid #e5e7eb;">
            <p style="margin: 0 0 12px 0; font-weight: 600; color: #1f2937; font-size: 14px;">Week-by-Week</p>
            <table style="width: 100%; font-size: 12px; border-collapse: collapse;">
              <tr style="background: #f3f4f6;">
                <th style="padding: 8px 4px; text-align: left; font-weight: 600;">Week</th>
                <th style="padding: 8px 4px; text-align: right; font-weight: 600;">Leads</th>
                <th style="padding: 8px 4px; text-align: right; font-weight: 600;">Qual</th>
                <th style="padding: 8px 4px; text-align: right; font-weight: 600;">Held</th>
                <th style="padding: 8px 4px; text-align: right; font-weight: 600;">Purch</th>
                <th style="padding: 8px 4px; text-align: right; font-weight: 600;">Revenue</th>
              </tr>
              ${weeks.map((w, i) => `
              <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 6px 4px; color: #374151;">${w.week_label}</td>
                <td style="padding: 6px 4px; text-align: right;">${weekData[i].funnel.new_leads}</td>
                <td style="padding: 6px 4px; text-align: right;">${weekData[i].funnel.dm_qualified}</td>
                <td style="padding: 6px 4px; text-align: right;">${weekData[i].funnel.meeting_held}</td>
                <td style="padding: 6px 4px; text-align: right;">${weekData[i].funnel.purchased}</td>
                <td style="padding: 6px 4px; text-align: right; font-weight: 600;">$${weekData[i].revenue.total.toLocaleString()}</td>
              </tr>
              `).join('')}
            </table>
          </div>

          <!-- Key Metrics Summary -->
          <div style="background: #f3f4f6; padding: 16px;">
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
              <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 8px 0; color: #6b7280;">Total Revenue (${weeks.length} weeks)</td>
                <td style="padding: 8px 0; text-align: right; font-weight: 600;">$${weekData.reduce((s, d) => s + d.revenue.total, 0).toLocaleString()}</td>
              </tr>
              <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 8px 0; color: #6b7280;">Total Ad Spend</td>
                <td style="padding: 8px 0; text-align: right; font-weight: 600;">$${weekData.reduce((s, d) => s + d.ads.total_spend, 0).toLocaleString()}</td>
              </tr>
              <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 8px 0; color: #6b7280;">Cost Per Lead</td>
                <td style="padding: 8px 0; text-align: right; font-weight: 600;">$${(weekData.reduce((s, d) => s + d.ads.total_spend, 0) / aggregateFunnel.new_leads).toFixed(2)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">Cost Per Acquisition</td>
                <td style="padding: 8px 0; text-align: right; font-weight: 600;">$${aggregateFunnel.purchased > 0 ? (weekData.reduce((s, d) => s + d.ads.total_spend, 0) / aggregateFunnel.purchased).toFixed(2) : 'N/A'}</td>
              </tr>
            </table>
          </div>

          <!-- Footer -->
          <div style="text-align: center; padding: 12px; color: #9ca3af; font-size: 11px; border-radius: 0 0 8px 8px; background: #1f2937;">
            <span style="color: #6b7280;">Clara Analytics • ${new Date().toISOString().split('T')[0]}</span>
          </div>

        </div>
      </body>
      </html>
    `
  });

  if (error) {
    console.error('❌ Email error:', error);
    process.exit(1);
  }

  console.log('✅ Email sent! ID:', data?.id);
  console.log('\n' + '═'.repeat(60));
  console.log('📧 Deep dive analysis sent to connor@columnline.com');
  console.log('═'.repeat(60) + '\n');
}

main().catch(console.error);
