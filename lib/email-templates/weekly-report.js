/**
 * HTML Email Template for Weekly Analytics Report
 *
 * Features:
 * - Responsive design for mobile/desktop
 * - Embedded charts via QuickChart.io (no API key needed)
 * - Color-coded metrics (green=up, red=down, yellow=flat)
 * - Data tables with proper formatting
 * - Executive summary with key highlights
 */

/**
 * Generate QuickChart.io URL for line chart
 */
function generateLineChartURL(data, title, labels) {
  const chartConfig = {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: title,
        data: data,
        borderColor: 'rgb(79, 70, 229)',
        backgroundColor: 'rgba(79, 70, 229, 0.1)',
        tension: 0.4,
        fill: true
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          display: false
        },
        title: {
          display: true,
          text: title,
          font: {
            size: 16,
            weight: 'bold'
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true
        }
      }
    }
  };

  const encoded = encodeURIComponent(JSON.stringify(chartConfig));
  return `https://quickchart.io/chart?c=${encoded}&width=600&height=300`;
}

/**
 * Generate QuickChart.io URL for funnel chart
 */
function generateFunnelChartURL(stages, values) {
  const chartConfig = {
    type: 'bar',
    data: {
      labels: stages,
      datasets: [{
        label: 'Contacts',
        data: values,
        backgroundColor: [
          'rgba(79, 70, 229, 0.8)',
          'rgba(99, 102, 241, 0.8)',
          'rgba(129, 140, 248, 0.8)',
          'rgba(165, 180, 252, 0.8)',
          'rgba(199, 210, 254, 0.8)',
          'rgba(34, 197, 94, 0.8)'
        ]
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      plugins: {
        legend: {
          display: false
        },
        title: {
          display: true,
          text: 'Conversion Funnel',
          font: {
            size: 16,
            weight: 'bold'
          }
        }
      },
      scales: {
        x: {
          beginAtZero: true
        }
      }
    }
  };

  const encoded = encodeURIComponent(JSON.stringify(chartConfig));
  return `https://quickchart.io/chart?c=${encoded}&width=600&height=300`;
}

/**
 * Format currency
 */
function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
  }).format(amount || 0);
}

/**
 * Format percentage
 */
function formatPercentage(value) {
  return `${(value || 0).toFixed(1)}%`;
}

/**
 * Get arrow and color for change
 */
function getChangeIndicator(change, percentChange) {
  if (!percentChange || percentChange === 0) {
    return { arrow: '→', color: '#eab308', text: 'flat' }; // yellow
  }
  if (percentChange > 0) {
    return { arrow: '↑', color: '#22c55e', text: 'up' }; // green
  }
  return { arrow: '↓', color: '#ef4444', text: 'down' }; // red
}

/**
 * Main email template generator
 */
function generateWeeklyReportEmail(reportData, weekOverWeek, dateRange) {
  const { summary, funnel_metrics, revenue_breakdown, timing_analysis, attribution_summary, data_quality } = reportData;

  // Format date range
  const startDate = new Date(dateRange.start).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const endDate = new Date(dateRange.end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  // Get change indicators
  const contactsChange = weekOverWeek ? getChangeIndicator(weekOverWeek.contacts.change, weekOverWeek.contacts.percentChange) : null;
  const revenueChange = weekOverWeek ? getChangeIndicator(weekOverWeek.revenue.change, weekOverWeek.revenue.percentChange) : null;
  const customersChange = weekOverWeek ? getChangeIndicator(weekOverWeek.customers.change, weekOverWeek.customers.percentChange) : null;
  const aovChange = weekOverWeek ? getChangeIndicator(weekOverWeek.aov.change, weekOverWeek.aov.percentChange) : null;

  // Prepare funnel data
  const funnelData = funnel_metrics && funnel_metrics.length > 0 ? funnel_metrics[0] : null;
  const funnelChartURL = funnelData ? generateFunnelChartURL(
    ['Entered', 'Qualified', 'Form Submit', 'Booked', 'Held', 'Purchased'],
    [
      funnelData.entered_funnel,
      funnelData.qualified,
      funnelData.form_submitted,
      funnelData.meeting_booked,
      funnelData.meeting_held,
      funnelData.purchased
    ]
  ) : null;

  // Prepare revenue breakdown data
  const revBreakdown = revenue_breakdown && revenue_breakdown.length > 0 ? revenue_breakdown[0] : null;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Weekly Analytics Report - Postpartum Care USA</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.6;
      color: #1f2937;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f9fafb;
    }
    .container {
      background-color: #ffffff;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      padding: 40px;
    }
    .header {
      text-align: center;
      border-bottom: 3px solid #4f46e5;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .header h1 {
      margin: 0;
      color: #4f46e5;
      font-size: 28px;
    }
    .header p {
      margin: 10px 0 0;
      color: #6b7280;
      font-size: 16px;
    }
    .summary-boxes {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 20px;
      margin-bottom: 40px;
    }
    .summary-box {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 20px;
      border-radius: 8px;
      text-align: center;
    }
    .summary-box.revenue {
      background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
    }
    .summary-box.customers {
      background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
    }
    .summary-box.aov {
      background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
    }
    .summary-box h3 {
      margin: 0 0 10px;
      font-size: 14px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      opacity: 0.9;
    }
    .summary-box .value {
      font-size: 32px;
      font-weight: bold;
      margin: 10px 0;
    }
    .summary-box .change {
      font-size: 14px;
      margin-top: 10px;
      opacity: 0.9;
    }
    .section {
      margin-bottom: 40px;
    }
    .section h2 {
      color: #1f2937;
      font-size: 22px;
      margin-bottom: 15px;
      border-bottom: 2px solid #e5e7eb;
      padding-bottom: 8px;
    }
    .chart-container {
      text-align: center;
      margin: 20px 0;
    }
    .chart-container img {
      max-width: 100%;
      height: auto;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
    .data-table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    .data-table th {
      background-color: #f3f4f6;
      color: #374151;
      font-weight: 600;
      text-align: left;
      padding: 12px;
      border-bottom: 2px solid #e5e7eb;
    }
    .data-table td {
      padding: 12px;
      border-bottom: 1px solid #e5e7eb;
    }
    .data-table tr:last-child td {
      border-bottom: none;
    }
    .data-table tr:hover {
      background-color: #f9fafb;
    }
    .metric-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 0;
      border-bottom: 1px solid #e5e7eb;
    }
    .metric-row:last-child {
      border-bottom: none;
    }
    .metric-label {
      font-weight: 600;
      color: #374151;
    }
    .metric-value {
      font-size: 18px;
      font-weight: bold;
      color: #4f46e5;
    }
    .highlight-box {
      background-color: #eff6ff;
      border-left: 4px solid #3b82f6;
      padding: 15px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .highlight-box ul {
      margin: 10px 0 0;
      padding-left: 20px;
    }
    .highlight-box li {
      margin: 5px 0;
    }
    .footer {
      text-align: center;
      padding-top: 30px;
      margin-top: 40px;
      border-top: 2px solid #e5e7eb;
      color: #6b7280;
      font-size: 14px;
    }
    .badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
    }
    .badge.success {
      background-color: #dcfce7;
      color: #166534;
    }
    .badge.warning {
      background-color: #fef3c7;
      color: #92400e;
    }
    .badge.info {
      background-color: #dbeafe;
      color: #1e40af;
    }
    @media (max-width: 640px) {
      .container {
        padding: 20px;
      }
      .summary-boxes {
        grid-template-columns: 1fr;
      }
      .summary-box .value {
        font-size: 24px;
      }
      .data-table {
        font-size: 14px;
      }
      .data-table th,
      .data-table td {
        padding: 8px;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <h1>📊 Weekly Analytics Report</h1>
      <p><strong>Postpartum Care USA</strong></p>
      <p>${startDate} - ${endDate}</p>
    </div>

    <!-- Executive Summary Boxes -->
    <div class="summary-boxes">
      <div class="summary-box">
        <h3>Total Contacts</h3>
        <div class="value">${summary.total_contacts || 0}</div>
        ${weekOverWeek ? `
          <div class="change" style="color: ${contactsChange.color}">
            ${contactsChange.arrow} ${Math.abs(weekOverWeek.contacts.change)} (${Math.abs(weekOverWeek.contacts.percentChange)}%) vs last week
          </div>
        ` : ''}
      </div>

      <div class="summary-box revenue">
        <h3>Total Revenue</h3>
        <div class="value">${formatCurrency(summary.total_revenue)}</div>
        ${weekOverWeek ? `
          <div class="change" style="color: ${revenueChange.color}">
            ${revenueChange.arrow} ${formatCurrency(Math.abs(weekOverWeek.revenue.change))} (${Math.abs(weekOverWeek.revenue.percentChange)}%) vs last week
          </div>
        ` : ''}
      </div>

      <div class="summary-box customers">
        <h3>New Customers</h3>
        <div class="value">${summary.total_customers || 0}</div>
        ${weekOverWeek ? `
          <div class="change" style="color: ${customersChange.color}">
            ${customersChange.arrow} ${Math.abs(weekOverWeek.customers.change)} (${Math.abs(weekOverWeek.customers.percentChange)}%) vs last week
          </div>
        ` : ''}
      </div>

      <div class="summary-box aov">
        <h3>Avg Order Value</h3>
        <div class="value">${formatCurrency(summary.avg_order_value)}</div>
        ${weekOverWeek ? `
          <div class="change" style="color: ${aovChange.color}">
            ${aovChange.arrow} ${formatCurrency(Math.abs(weekOverWeek.aov.change))} (${Math.abs(weekOverWeek.aov.percentChange)}%) vs last week
          </div>
        ` : ''}
      </div>
    </div>

    <!-- Key Highlights -->
    <div class="highlight-box">
      <strong>📌 Key Highlights This Week:</strong>
      <ul>
        ${summary.total_contacts > 0 ? `<li><strong>${summary.total_contacts}</strong> total contacts entered the funnel</li>` : ''}
        ${summary.total_customers > 0 ? `<li><strong>${summary.total_customers}</strong> customers completed purchases</li>` : ''}
        ${summary.total_revenue > 0 ? `<li>Generated <strong>${formatCurrency(summary.total_revenue)}</strong> in revenue</li>` : ''}
        ${funnelData ? `<li>Overall conversion rate: <strong>${funnelData.overall_conversion}%</strong></li>` : ''}
        ${weekOverWeek && Math.abs(weekOverWeek.revenue.percentChange) > 10 ? `<li>Revenue ${weekOverWeek.revenue.change > 0 ? 'increased' : 'decreased'} by <strong>${Math.abs(weekOverWeek.revenue.percentChange)}%</strong> compared to last week</li>` : ''}
      </ul>
    </div>

    <!-- Funnel Performance -->
    ${funnelData ? `
    <div class="section">
      <h2>🔄 Funnel Performance</h2>

      <div class="chart-container">
        <img src="${funnelChartURL}" alt="Conversion Funnel" />
      </div>

      <table class="data-table">
        <thead>
          <tr>
            <th>Stage</th>
            <th>Count</th>
            <th>Conversion Rate</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Entered Funnel</strong></td>
            <td>${funnelData.entered_funnel}</td>
            <td>-</td>
          </tr>
          <tr>
            <td>→ Qualified</td>
            <td>${funnelData.qualified}</td>
            <td><span class="badge info">${funnelData.qualify_rate}%</span></td>
          </tr>
          <tr>
            <td>→ Form Submitted</td>
            <td>${funnelData.form_submitted}</td>
            <td><span class="badge info">${funnelData.form_submit_rate}%</span></td>
          </tr>
          <tr>
            <td>→ Meeting Booked</td>
            <td>${funnelData.meeting_booked}</td>
            <td><span class="badge info">${funnelData.booking_rate}%</span></td>
          </tr>
          <tr>
            <td>→ Meeting Held</td>
            <td>${funnelData.meeting_held}</td>
            <td><span class="badge warning">${funnelData.show_rate}% show rate</span></td>
          </tr>
          <tr>
            <td>→ Purchased</td>
            <td>${funnelData.purchased}</td>
            <td><span class="badge success">${funnelData.close_rate}% close rate</span></td>
          </tr>
          <tr style="background-color: #f3f4f6; font-weight: bold;">
            <td><strong>Overall Conversion</strong></td>
            <td>${funnelData.purchased}</td>
            <td><span class="badge success">${funnelData.overall_conversion}%</span></td>
          </tr>
        </tbody>
      </table>
    </div>
    ` : ''}

    <!-- Revenue Breakdown -->
    ${revBreakdown ? `
    <div class="section">
      <h2>💰 Revenue Breakdown</h2>

      <div class="metric-row">
        <span class="metric-label">Stripe Payments</span>
        <span class="metric-value">${revBreakdown.stripe_payments || 0} × ${formatCurrency(parseFloat(revBreakdown.stripe_revenue || 0))}</span>
      </div>

      <div class="metric-row">
        <span class="metric-label">Denefits Payments (BNPL)</span>
        <span class="metric-value">${revBreakdown.denefits_payments || 0} × ${formatCurrency(parseFloat(revBreakdown.denefits_revenue || 0))}</span>
      </div>

      <div class="metric-row" style="margin-top: 20px; padding-top: 20px; border-top: 2px solid #e5e7eb;">
        <span class="metric-label">Buy-in-Full</span>
        <span class="metric-value">${revBreakdown.buy_in_full_count || 0} × ${formatCurrency(parseFloat(revBreakdown.buy_in_full_revenue || 0))}</span>
      </div>

      <div class="metric-row">
        <span class="metric-label">BNPL (Financing)</span>
        <span class="metric-value">${revBreakdown.bnpl_count || 0} × ${formatCurrency(parseFloat(revBreakdown.bnpl_revenue || 0))}</span>
      </div>

      ${revBreakdown.orphan_payments > 0 ? `
      <div class="highlight-box" style="background-color: #fef3c7; border-left-color: #f59e0b; margin-top: 20px;">
        <strong>⚠️ Data Quality Note:</strong> ${revBreakdown.orphan_payments} orphan payments (${revBreakdown.orphan_rate}%) - payments not linked to contacts
      </div>
      ` : ''}
    </div>
    ` : ''}

    <!-- Attribution Summary -->
    ${attribution_summary && attribution_summary.length > 0 ? `
    <div class="section">
      <h2>📈 Top Performing Sources</h2>

      <table class="data-table">
        <thead>
          <tr>
            <th>Source</th>
            <th>Contacts</th>
            <th>Customers</th>
            <th>Revenue</th>
            <th>Conv Rate</th>
          </tr>
        </thead>
        <tbody>
          ${attribution_summary.slice(0, 10).map(attr => `
            <tr>
              <td><strong>${attr.source || 'Unknown'}</strong></td>
              <td>${attr.total_contacts}</td>
              <td>${attr.total_customers}</td>
              <td>${formatCurrency(parseFloat(attr.total_revenue || 0))}</td>
              <td><span class="badge info">${attr.conversion_rate}%</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    ` : ''}

    <!-- Data Quality -->
    ${data_quality ? `
    <div class="section">
      <h2>📊 Data Quality Dashboard</h2>

      <div class="metric-row">
        <span class="metric-label">Total Contacts in Database</span>
        <span class="metric-value">${data_quality.total_contacts}</span>
      </div>

      <div class="metric-row">
        <span class="metric-label">Historical (Pre-Webhook)</span>
        <span class="metric-value">${data_quality.historical_contacts} (${data_quality.historical_pct}%)</span>
      </div>

      <div class="metric-row">
        <span class="metric-label">Live (Post-Webhook)</span>
        <span class="metric-value">${data_quality.live_contacts}</span>
      </div>

      <div class="metric-row" style="margin-top: 20px; padding-top: 20px; border-top: 2px solid #e5e7eb;">
        <span class="metric-label">ManyChat → GHL Linkage</span>
        <span class="metric-value">
          <span class="badge ${parseFloat(data_quality.mc_to_ghl_linkage_rate) > 50 ? 'success' : 'warning'}">
            ${data_quality.mc_to_ghl_linkage_rate}%
          </span>
        </span>
      </div>

      <div class="metric-row">
        <span class="metric-label">Contacts with ManyChat ID</span>
        <span class="metric-value">${data_quality.mc_id_pct}%</span>
      </div>

      <div class="metric-row">
        <span class="metric-label">Contacts with GHL ID</span>
        <span class="metric-value">${data_quality.ghl_id_pct}%</span>
      </div>

      <div class="metric-row">
        <span class="metric-label">Contacts with Ad ID</span>
        <span class="metric-value">${data_quality.ad_id_pct}%</span>
      </div>

      <div class="metric-row">
        <span class="metric-label">Symptom Data Captured</span>
        <span class="metric-value">${data_quality.symptom_data_pct}%</span>
      </div>
    </div>
    ` : ''}

    <!-- Footer -->
    <div class="footer">
      <p><strong>Postpartum Care USA Analytics System</strong></p>
      <p>Report generated automatically on ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} at ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</p>
      <p style="margin-top: 10px; font-size: 12px; color: #9ca3af;">
        Questions about this report? Contact your analytics team.
      </p>
    </div>
  </div>
</body>
</html>
  `;
}

module.exports = { generateWeeklyReportEmail, formatCurrency, formatPercentage };
