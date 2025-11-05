#!/usr/bin/env node
/**
 * Automated Historical Data Report Generator
 *
 * Runs all key SQL views, formats results, and generates an AI-powered
 * markdown report with insights and actionable recommendations.
 *
 * Usage:
 *   node scripts/generate-historical-report.js
 *   node scripts/generate-historical-report.js --email your@email.com
 *   node scripts/generate-historical-report.js --save-only (don't display, just save)
 *
 * Output:
 *   - Saves report to historical_data/reports/report_YYYY-MM-DD.md
 *   - Optionally emails report (if --email provided and email configured)
 *
 * Environment Variables Required:
 *   NEXT_PUBLIC_SUPABASE_URL - Your Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY - Your Supabase service role key
 *   ANTHROPIC_API_KEY - Your Claude API key (for AI insights)
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

// Check for required environment variables
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('ERROR: Missing Supabase credentials.');
  console.error('Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are in .env.local');
  process.exit(1);
}

if (!ANTHROPIC_API_KEY) {
  console.error('ERROR: ANTHROPIC_API_KEY not found in .env.local');
  console.error('This script requires Claude API access for AI-generated insights.');
  process.exit(1);
}

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// =============================================================================
// DATA COLLECTION
// =============================================================================

/**
 * Run all key views and collect results
 */
async function collectData() {
  console.log('📊 Collecting data from Supabase...\n');

  const queries = {
    funnel: 'v_funnel_summary',
    attribution: 'v_revenue_attribution',
    conversionOverTime: 'v_conversion_over_time',
    timeToPurchase: 'v_time_to_purchase_summary',
    paidVsOrganic: 'v_paid_vs_organic',
    triggerWords: 'v_top_trigger_words',
    paymentBreakdown: 'v_payment_breakdown',
    dataQuality: 'v_data_quality_report'
  };

  const results = {};

  for (const [key, viewName] of Object.entries(queries)) {
    try {
      console.log(`  Fetching ${viewName}...`);
      const { data, error } = await supabase.from(viewName).select('*');

      if (error) {
        console.error(`    ❌ Error: ${error.message}`);
        results[key] = { error: error.message };
      } else {
        console.log(`    ✓ Got ${data.length} rows`);
        results[key] = data;
      }
    } catch (err) {
      console.error(`    ❌ Error: ${err.message}`);
      results[key] = { error: err.message };
    }
  }

  console.log('\n✅ Data collection complete\n');
  return results;
}

// =============================================================================
// REPORT FORMATTING
// =============================================================================

/**
 * Format a single table for markdown
 */
function formatMarkdownTable(data, maxRows = 10) {
  if (!data || data.length === 0) {
    return '_No data available_';
  }

  // Handle error case
  if (data.error) {
    return `_Error: ${data.error}_`;
  }

  const columns = Object.keys(data[0]);

  // Build header
  const header = `| ${columns.join(' | ')} |`;
  const separator = `| ${columns.map(() => '---').join(' | ')} |`;

  // Build rows (limit to maxRows)
  const rows = data.slice(0, maxRows).map(row =>
    `| ${columns.map(col => {
      const val = row[col];
      // Format numbers nicely
      if (typeof val === 'number') {
        if (col.includes('rate') || col.includes('pct')) {
          return `${val.toFixed(1)}%`;
        }
        if (col.includes('revenue') || col.includes('amount') || col.includes('value')) {
          return `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        }
        return val.toLocaleString();
      }
      return val || '-';
    }).join(' | ')} |`
  ).join('\n');

  let table = [header, separator, rows].join('\n');

  if (data.length > maxRows) {
    table += `\n\n_Showing ${maxRows} of ${data.length} total rows_`;
  }

  return table;
}

/**
 * Build the markdown report
 */
function buildMarkdownReport(data, insights) {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  let report = `# Historical Data Analysis Report\n\n`;
  report += `**Generated:** ${dateStr}\n\n`;
  report += `---\n\n`;

  // Executive Summary (AI-generated)
  report += `## 📈 Executive Summary\n\n`;
  report += insights.summary || '_AI insights not available_';
  report += `\n\n---\n\n`;

  // Funnel Overview
  report += `## 🎯 Funnel Performance\n\n`;
  report += formatMarkdownTable(data.funnel);
  report += `\n\n`;
  if (insights.funnel) {
    report += `**Insights:** ${insights.funnel}\n\n`;
  }
  report += `---\n\n`;

  // Paid vs Organic
  report += `## 💰 Paid vs Organic Performance\n\n`;
  report += formatMarkdownTable(data.paidVsOrganic);
  report += `\n\n`;
  if (insights.paidVsOrganic) {
    report += `**Insights:** ${insights.paidVsOrganic}\n\n`;
  }
  report += `---\n\n`;

  // Top Trigger Words
  report += `## 🔑 Top Performing Trigger Words\n\n`;
  report += formatMarkdownTable(data.triggerWords);
  report += `\n\n`;
  if (insights.triggerWords) {
    report += `**Insights:** ${insights.triggerWords}\n\n`;
  }
  report += `---\n\n`;

  // Conversion Over Time
  report += `## 📅 Conversion Trends Over Time\n\n`;
  report += formatMarkdownTable(data.conversionOverTime);
  report += `\n\n`;
  if (insights.conversionOverTime) {
    report += `**Insights:** ${insights.conversionOverTime}\n\n`;
  }
  report += `---\n\n`;

  // Time to Purchase
  report += `## ⏱️ Time to Purchase Analysis\n\n`;
  report += formatMarkdownTable(data.timeToPurchase);
  report += `\n\n`;
  if (insights.timeToPurchase) {
    report += `**Insights:** ${insights.timeToPurchase}\n\n`;
  }
  report += `---\n\n`;

  // Payment Breakdown
  report += `## 💳 Payment Method Breakdown\n\n`;
  report += formatMarkdownTable(data.paymentBreakdown);
  report += `\n\n`;
  report += `---\n\n`;

  // Data Quality
  report += `## 🔍 Data Quality Report\n\n`;
  report += formatMarkdownTable(data.dataQuality);
  report += `\n\n`;
  report += `---\n\n`;

  // Recommendations (AI-generated)
  report += `## 🎯 Recommended Actions\n\n`;
  report += insights.recommendations || '_AI recommendations not available_';
  report += `\n\n`;

  // Footer
  report += `---\n\n`;
  report += `_Report generated by MCB Historical Data Analysis System_\n`;

  return report;
}

// =============================================================================
// AI INSIGHTS GENERATION
// =============================================================================

/**
 * Generate AI insights for all sections
 */
async function generateInsights(data) {
  console.log('🤖 Generating AI insights...\n');

  const prompt = `
You are analyzing historical marketing funnel data for a healthcare/wellness business.

DATA SUMMARY:

Funnel Performance:
${JSON.stringify(data.funnel, null, 2)}

Paid vs Organic:
${JSON.stringify(data.paidVsOrganic, null, 2)}

Top Trigger Words:
${JSON.stringify(data.triggerWords, null, 2)}

Conversion Over Time:
${JSON.stringify(data.conversionOverTime, null, 2)}

Time to Purchase:
${JSON.stringify(data.timeToPurchase, null, 2)}

Please provide:

1. EXECUTIVE SUMMARY (2-3 paragraphs): Overall health of the funnel, key wins, major concerns
2. FUNNEL INSIGHTS (2-3 sentences): What stands out about conversion at each stage? Where are the drop-offs?
3. PAID VS ORGANIC INSIGHTS (2-3 sentences): Which performs better? Why might that be?
4. TRIGGER WORD INSIGHTS (2-3 sentences): Which keywords drive the best results? Any patterns?
5. CONVERSION OVER TIME INSIGHTS (2-3 sentences): Are conversions improving or declining? Seasonal patterns?
6. TIME TO PURCHASE INSIGHTS (2-3 sentences): How long does the sales cycle take? Faster than expected?
7. RECOMMENDED ACTIONS (4-6 bullet points): Specific, actionable steps to improve the funnel based on this data

Format your response as JSON:
{
  "summary": "executive summary here",
  "funnel": "funnel insights here",
  "paidVsOrganic": "paid vs organic insights here",
  "triggerWords": "trigger word insights here",
  "conversionOverTime": "conversion over time insights here",
  "timeToPurchase": "time to purchase insights here",
  "recommendations": "- action 1\\n- action 2\\n- action 3\\n- action 4"
}
  `.trim();

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2048,
        messages: [{
          role: 'user',
          content: prompt
        }]
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`  ❌ Claude API error: ${error}`);
      return {};
    }

    const result = await response.json();
    const insightsText = result.content[0].text;

    // Try to parse as JSON
    try {
      const insights = JSON.parse(insightsText);
      console.log('  ✓ AI insights generated\n');
      return insights;
    } catch (parseError) {
      // If not valid JSON, return as plain text
      console.log('  ⚠️  AI insights generated (but not in JSON format)\n');
      return { summary: insightsText };
    }

  } catch (error) {
    console.error(`  ❌ Error generating insights: ${error.message}\n`);
    return {};
  }
}

// =============================================================================
// REPORT SAVING
// =============================================================================

/**
 * Save report to file
 */
function saveReport(report) {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
  const reportDir = path.join(__dirname, '..', 'historical_data', 'reports');
  const reportPath = path.join(reportDir, `report_${dateStr}.md`);

  // Create directory if it doesn't exist
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  // Save report
  fs.writeFileSync(reportPath, report, 'utf8');

  return reportPath;
}

// =============================================================================
// MAIN FUNCTION
// =============================================================================

async function main() {
  const args = process.argv.slice(2);
  const saveOnly = args.includes('--save-only');

  console.log('\n' + '='.repeat(60));
  console.log('HISTORICAL DATA REPORT GENERATOR');
  console.log('='.repeat(60) + '\n');

  // Step 1: Collect data
  const data = await collectData();

  // Step 2: Generate insights
  const insights = await generateInsights(data);

  // Step 3: Build report
  console.log('📝 Building report...\n');
  const report = buildMarkdownReport(data, insights);

  // Step 4: Save report
  const reportPath = saveReport(report);
  console.log(`✅ Report saved to: ${reportPath}\n`);

  // Step 5: Display report (unless --save-only)
  if (!saveOnly) {
    console.log('='.repeat(60));
    console.log('REPORT PREVIEW');
    console.log('='.repeat(60) + '\n');
    console.log(report);
  }

  console.log('='.repeat(60));
  console.log('✅ REPORT GENERATION COMPLETE');
  console.log('='.repeat(60) + '\n');
}

// Run main function
main().catch(error => {
  console.error(`\n❌ Fatal error: ${error.message}`);
  process.exit(1);
});
