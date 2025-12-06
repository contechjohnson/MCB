/**
 * Test Weekly Report API Endpoint
 *
 * Tests the /api/reports/weekly-data endpoint locally or in production
 *
 * Usage:
 *   node scripts/test-weekly-api.js                  # Test locally (dev server must be running)
 *   node scripts/test-weekly-api.js production       # Test production (Vercel)
 *   node scripts/test-weekly-api.js 2025-11-07       # Test specific week locally
 *   node scripts/test-weekly-api.js production 2025-11-07  # Test specific week in production
 */

require('dotenv').config({ path: '.env.local' });

async function testAPI(url, weekEnding) {
  console.log('\n🧪 Testing Weekly Report API...\n');
  console.log(`URL: ${url}`);
  console.log(`Week Ending: ${weekEnding || 'Auto (last Sunday)'}\n`);

  const queryParams = weekEnding ? `?week_ending=${weekEnding}` : '';
  const fullUrl = `${url}${queryParams}`;

  try {
    const response = await fetch(fullUrl, {
      headers: {
        'Authorization': `Bearer ${process.env.CRON_SECRET}`
      }
    });

    console.log(`Status: ${response.status} ${response.statusText}\n`);

    if (!response.ok) {
      const error = await response.json();
      console.error('❌ Error:', error);
      process.exit(1);
    }

    const data = await response.json();

    // Print summary
    console.log('✅ Success! Response summary:\n');
    console.log('─'.repeat(80));
    console.log(`Week Ending: ${data.week_ending}`);
    console.log(`Date Range: ${data.date_range}`);
    console.log('\n📊 Metrics:');
    console.log(`  Total Contacts: ${data.metrics.total_contacts}`);
    console.log(`  DM Qualified: ${data.metrics.dm_qualified} (${data.metrics.qualify_rate}%)`);
    console.log(`  Attribution Coverage: ${data.metrics.attribution_coverage}%`);
    console.log(`  Scheduled DCs: ${data.metrics.scheduled_dcs}`);
    console.log(`  Arrived DCs: ${data.metrics.arrived_dcs} (${data.metrics.show_rate}% show rate)`);
    console.log(`  Closed: ${data.metrics.closed} (${data.metrics.close_rate}% close rate)`);
    console.log(`  Revenue: $${data.metrics.total_revenue}`);
    console.log(`  Ad Spend: $${data.metrics.total_spend}`);
    console.log(`  ROAS: ${data.metrics.roas}x`);

    console.log('\n🎯 Top Performing Ads:');
    data.top_ads.slice(0, 3).forEach((ad, i) => {
      console.log(`  ${i + 1}. Ad ...${ad.ad_id.slice(-6)} (${ad.ad_name})`);
      console.log(`     ${ad.contacts} contacts, ${ad.qualified} qualified (${ad.qualify_rate}%)`);
      console.log(`     Theme: ${ad.theme}, Spend: $${ad.spend}`);
    });

    console.log('\n💳 Payments:');
    console.log(`  Count: ${data.payments.count}`);
    console.log(`  Stripe: $${data.payments.stripe_revenue}`);
    console.log(`  Denefits: $${data.payments.denefits_revenue}`);
    console.log(`  Total: $${data.payments.total_revenue}`);

    console.log('\n📈 Comparison:');
    if (data.comparison.previous_week_exists) {
      console.log(`  Previous week data found!`);
      console.log(`  Contacts change: ${data.comparison.contacts_change > 0 ? '+' : ''}${data.comparison.contacts_change} (${data.comparison.contacts_change_pct > 0 ? '+' : ''}${data.comparison.contacts_change_pct}%)`);
      console.log(`  Revenue change: $${data.comparison.revenue_change > 0 ? '+' : ''}${data.comparison.revenue_change.toFixed(2)} (${data.comparison.revenue_change_pct > 0 ? '+' : ''}${data.comparison.revenue_change_pct}%)`);
      console.log(`  ROAS change: ${data.comparison.roas_change > 0 ? '+' : ''}${data.comparison.roas_change.toFixed(2)}`);
      if (data.comparison.recommendations_from_last_week.length > 0) {
        console.log(`  Recommendations from last week:`);
        data.comparison.recommendations_from_last_week.forEach((rec, i) => {
          console.log(`    ${i + 1}. ${rec}`);
        });
      }
    } else {
      console.log('  No previous week data (first week or no snapshot saved)');
    }

    console.log('\n─'.repeat(80));
    console.log('\n✅ API is working correctly!\n');

    // Print full JSON for debugging
    console.log('📄 Full JSON Response:\n');
    console.log(JSON.stringify(data, null, 2));

  } catch (error) {
    console.error('\n❌ Error testing API:', error.message);
    console.error('\nDetails:', error);
    process.exit(1);
  }
}

// Parse arguments
const args = process.argv.slice(2);
const isProduction = args.includes('production');
const weekEnding = args.find(arg => arg.match(/^\d{4}-\d{2}-\d{2}$/));

// Determine URL
let baseUrl;
if (isProduction) {
  baseUrl = 'https://mcb-dun.vercel.app/api/reports/weekly-data';
} else {
  baseUrl = 'http://localhost:3000/api/reports/weekly-data';
}

// Check for CRON_SECRET
if (!process.env.CRON_SECRET) {
  console.error('\n❌ Error: CRON_SECRET not found in .env.local\n');
  console.log('Add this to your .env.local file:');
  console.log('CRON_SECRET=your-secret-here\n');
  process.exit(1);
}

// Run test
testAPI(baseUrl, weekEnding);
