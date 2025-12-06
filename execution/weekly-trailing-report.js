/**
 * Weekly Trailing 4-Week Report (SIMPLE)
 *
 * Shows what HAPPENED each week:
 * - New leads that came in
 * - Meetings that were held
 * - Purchases that closed
 * - Revenue received
 *
 * No cohort analysis. Just activity.
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const resend = new Resend(process.env.RESEND_API_KEY);

const COLORS = {
  primary: '#2563eb',
  success: '#059669',
  muted: '#6b7280'
};

function formatShortDate(dateStr) {
  const date = new Date(dateStr);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[date.getMonth()]} ${date.getDate()}`;
}

function getTrailing4Weeks() {
  const weeks = [];
  const today = new Date();

  for (let i = 0; i < 4; i++) {
    const weekEnd = new Date(today);
    weekEnd.setDate(today.getDate() - (i * 7));
    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekEnd.getDate() - 6);

    weeks.push({
      label: `${formatShortDate(weekStart.toISOString().split('T')[0])}-${weekEnd.getDate()}`,
      start: weekStart.toISOString().split('T')[0],
      end: weekEnd.toISOString().split('T')[0],
      is_current: i === 0
    });
  }

  return weeks.reverse();
}

// SIMPLE: What happened this week?
async function fetchWeekActivity(startDate, endDate) {
  // New leads (subscribe_date in range)
  const { data: newLeads } = await supabase
    .from('contacts')
    .select('id')
    .neq('source', 'instagram_historical')
    .gte('subscribe_date', startDate)
    .lte('subscribe_date', endDate + 'T23:59:59');

  // Meetings held this week (appointment_held_date in range)
  const { data: meetingsHeld } = await supabase
    .from('contacts')
    .select('id')
    .neq('source', 'instagram_historical')
    .gte('appointment_held_date', startDate)
    .lte('appointment_held_date', endDate + 'T23:59:59');

  // Purchases this week (purchase_date in range)
  const { data: purchases } = await supabase
    .from('contacts')
    .select('id')
    .neq('source', 'instagram_historical')
    .gte('purchase_date', startDate)
    .lte('purchase_date', endDate + 'T23:59:59');

  // Revenue this week (payment_date in range)
  const { data: payments } = await supabase
    .from('payments')
    .select('amount')
    .gte('payment_date', startDate)
    .lte('payment_date', endDate + 'T23:59:59');

  const revenue = payments?.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0) || 0;

  return {
    leads: newLeads?.length || 0,
    meetings_held: meetingsHeld?.length || 0,
    purchased: purchases?.length || 0,
    revenue: revenue,
    payment_count: payments?.length || 0
  };
}

function generateRevenueChartUrl(weeks, weekData) {
  const chartConfig = {
    type: 'bar',
    data: {
      labels: weeks.map(w => w.label),
      datasets: [{
        label: 'Revenue',
        data: weekData.map(d => Math.round(d.revenue)),
        backgroundColor: weeks.map(w => w.is_current ? COLORS.primary : '#93c5fd')
      }]
    },
    options: {
      plugins: {
        title: { display: true, text: 'Weekly Revenue', font: { size: 14, weight: 'bold' } },
        legend: { display: false },
        datalabels: { display: true, anchor: 'end', align: 'end', formatter: (v) => '$' + v.toLocaleString() }
      },
      scales: {
        y: { beginAtZero: true },
        x: { grid: { display: false } }
      }
    }
  };

  return `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(chartConfig))}&w=550&h=220&bkg=white`;
}

async function main() {
  console.log('📊 Weekly Report (Simple Activity-Based)\n');
  console.log('═'.repeat(60) + '\n');

  const weeks = getTrailing4Weeks();
  console.log('Weeks:');
  weeks.forEach(w => console.log(`  ${w.label} (${w.start} to ${w.end})${w.is_current ? ' ← THIS WEEK' : ''}`));
  console.log();

  console.log('Fetching activity data...');
  const weekData = [];
  for (const week of weeks) {
    const data = await fetchWeekActivity(week.start, week.end);
    weekData.push(data);
    console.log(`  ${week.label}: ${data.leads} leads, ${data.meetings_held} meetings, ${data.purchased} purchased, $${data.revenue.toLocaleString()}`);
  }
  console.log();

  // Totals
  const totalLeads = weekData.reduce((s, d) => s + d.leads, 0);
  const totalMeetings = weekData.reduce((s, d) => s + d.meetings_held, 0);
  const totalPurchased = weekData.reduce((s, d) => s + d.purchased, 0);
  const totalRevenue = weekData.reduce((s, d) => s + d.revenue, 0);

  const thisWeek = weekData[3];
  const lastWeek = weekData[2];

  console.log('Generating chart...');
  const revenueChartUrl = generateRevenueChartUrl(weeks, weekData);

  console.log('Sending email...');

  const { data, error } = await resend.emails.send({
    from: 'Clara Analytics <onboarding@resend.dev>',
    to: ['connor@columnline.com'],
    subject: `PPCU Weekly Report: ${weeks[3].label}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"></head>
      <body style="margin: 0; padding: 0; background: #f9fafb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; padding: 16px;">

          <!-- Header -->
          <div style="background: #1f2937; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 20px;">PPCU Weekly Report</h1>
            <p style="color: #9ca3af; margin: 4px 0 0 0; font-size: 13px;">Week of ${weeks[3].label}</p>
          </div>

          <!-- This Week Highlight -->
          <div style="background: #eff6ff; padding: 16px; border-left: 4px solid ${COLORS.primary};">
            <p style="margin: 0 0 12px 0; font-weight: 600; color: #1e40af;">This Week</p>
            <table style="width: 100%; font-size: 15px;">
              <tr>
                <td style="padding: 4px 0;"><strong>${thisWeek.leads}</strong> new leads</td>
                <td style="padding: 4px 0;"><strong>${thisWeek.meetings_held}</strong> meetings held</td>
              </tr>
              <tr>
                <td style="padding: 4px 0;"><strong>${thisWeek.purchased}</strong> purchased</td>
                <td style="padding: 4px 0; color: ${COLORS.success}; font-weight: 600;"><strong>$${thisWeek.revenue.toLocaleString()}</strong> revenue</td>
              </tr>
            </table>
            <p style="margin: 12px 0 0 0; font-size: 12px; color: #6b7280;">
              vs last week: ${thisWeek.leads > lastWeek.leads ? '↑' : '↓'} ${Math.abs(thisWeek.leads - lastWeek.leads)} leads |
              ${thisWeek.purchased > lastWeek.purchased ? '↑' : '↓'} ${Math.abs(thisWeek.purchased - lastWeek.purchased)} purchases |
              ${thisWeek.revenue > lastWeek.revenue ? '↑' : '↓'} $${Math.abs(thisWeek.revenue - lastWeek.revenue).toLocaleString()}
            </p>
          </div>

          <!-- Revenue Chart -->
          <div style="background: white; padding: 16px;">
            <img src="${revenueChartUrl}" alt="Revenue Trend" style="width: 100%; height: auto;" />
          </div>

          <!-- Week by Week Table -->
          <div style="background: white; padding: 16px; border-top: 1px solid #e5e7eb;">
            <p style="margin: 0 0 8px 0; font-weight: 600; color: #1f2937; font-size: 14px;">Week-by-Week Activity</p>
            <table style="width: 100%; font-size: 12px; border-collapse: collapse;">
              <tr style="background: #f3f4f6;">
                <th style="padding: 8px 4px; text-align: left;">Week</th>
                <th style="padding: 8px 4px; text-align: right;">Leads</th>
                <th style="padding: 8px 4px; text-align: right;">Meetings</th>
                <th style="padding: 8px 4px; text-align: right;">Purchased</th>
                <th style="padding: 8px 4px; text-align: right;">Revenue</th>
              </tr>
              ${weeks.map((w, i) => `
              <tr style="border-bottom: 1px solid #e5e7eb; ${w.is_current ? 'background: #eff6ff;' : ''}">
                <td style="padding: 8px 4px;">${w.label}${w.is_current ? ' ⬅' : ''}</td>
                <td style="padding: 8px 4px; text-align: right;">${weekData[i].leads}</td>
                <td style="padding: 8px 4px; text-align: right;">${weekData[i].meetings_held}</td>
                <td style="padding: 8px 4px; text-align: right;">${weekData[i].purchased}</td>
                <td style="padding: 8px 4px; text-align: right; font-weight: 600;">$${weekData[i].revenue.toLocaleString()}</td>
              </tr>
              `).join('')}
              <tr style="background: #f9fafb; font-weight: 600;">
                <td style="padding: 8px 4px;">4-Week Total</td>
                <td style="padding: 8px 4px; text-align: right;">${totalLeads}</td>
                <td style="padding: 8px 4px; text-align: right;">${totalMeetings}</td>
                <td style="padding: 8px 4px; text-align: right;">${totalPurchased}</td>
                <td style="padding: 8px 4px; text-align: right;">$${totalRevenue.toLocaleString()}</td>
              </tr>
            </table>
          </div>

          <!-- Footer -->
          <div style="text-align: center; padding: 12px; background: #1f2937; border-radius: 0 0 8px 8px;">
            <span style="color: #6b7280; font-size: 11px;">Clara Analytics • ${new Date().toISOString().split('T')[0]}</span>
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
  console.log('📧 Report sent to connor@columnline.com');
  console.log('═'.repeat(60) + '\n');
}

main().catch(console.error);
