require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

/**
 * Save weekly snapshot to database
 * This preserves context for next week's report
 */
async function saveWeeklySnapshot(weekEnding, data, recommendations) {
  console.log(`\n📸 Saving weekly snapshot for ${weekEnding}...\n`);

  const snapshot = {
    week_ending: weekEnding,
    total_contacts: data.contacts || 0,
    total_qualified: data.qualified || 0,
    qualify_rate: data.qualifyRate || 0,
    total_bookings: data.bookings || 0,
    total_shows: data.shows || 0,
    total_purchases: data.purchases || 0,
    total_revenue: data.revenue || 0,
    total_spend: data.spend || 0,
    roas: data.roas || 0,

    // Top performers
    top_ad_by_volume: data.topAdByVolume || null,
    top_ad_by_quality: data.topAdByQuality || null,
    top_ad_by_roas: data.topAdByRoas || null,

    // Recommendations
    recommendations_given: recommendations || [],

    // Key insights
    insights: data.insights || '',

    report_sent_at: new Date()
  };

  const { data: result, error } = await supabase
    .from('weekly_snapshots')
    .upsert(snapshot, { onConflict: 'week_ending' });

  if (error) {
    console.error('❌ Error saving snapshot:', error);
    throw error;
  }

  console.log('✅ Weekly snapshot saved');
  console.log('');
  console.log('Summary:');
  console.log(`  Contacts: ${snapshot.total_contacts}`);
  console.log(`  Qualified: ${snapshot.total_qualified} (${snapshot.qualify_rate}%)`);
  console.log(`  Revenue: $${snapshot.total_revenue}`);
  console.log(`  Spend: $${snapshot.total_spend}`);
  console.log(`  ROAS: ${snapshot.roas}x`);
  console.log('');
  console.log('Recommendations given:');
  snapshot.recommendations_given.forEach((rec, i) => {
    console.log(`  ${i + 1}. ${rec}`);
  });
  console.log('');
}

/**
 * Save A/B test to database
 */
async function saveAbTest(test) {
  console.log(`\n🧪 Saving A/B test: ${test.name}...\n`);

  const { data: result, error } = await supabase
    .from('ab_tests')
    .insert({
      test_name: test.name,
      hypothesis: test.hypothesis,
      variant_a_description: test.variantA.description,
      variant_a_ad_ids: test.variantA.adIds || [],
      variant_b_description: test.variantB.description,
      variant_b_ad_ids: test.variantB.adIds || [],
      metric_tracked: test.metric,
      target_sample_size: test.sampleSize,
      started_at: test.startDate,
      ended_at: test.endDate || null,
      status: test.status || 'planning'
    });

  if (error) {
    console.error('❌ Error saving A/B test:', error);
    throw error;
  }

  console.log('✅ A/B test saved');
  console.log(`  Status: ${test.status}`);
  console.log(`  Metric: ${test.metric}`);
  console.log('');
}

/**
 * Update A/B test with results
 */
async function updateAbTestResults(testId, results) {
  console.log(`\n📊 Updating A/B test #${testId} with results...\n`);

  const { data: result, error } = await supabase
    .from('ab_tests')
    .update({
      status: 'complete',
      ended_at: new Date(),
      variant_a_result: results.variantA.result,
      variant_b_result: results.variantB.result,
      winner: results.winner,
      confidence_level: results.confidence,
      result_summary: results.summary,
      updated_at: new Date()
    })
    .eq('test_id', testId);

  if (error) {
    console.error('❌ Error updating test:', error);
    throw error;
  }

  console.log('✅ A/B test updated');
  console.log(`  Winner: ${results.winner}`);
  console.log(`  Confidence: ${results.confidence}%`);
  console.log('');
}

/**
 * Save ad performance weekly
 */
async function saveAdPerformanceWeekly(weekEnding, adPerformance) {
  console.log(`\n💾 Saving ad performance for ${weekEnding}...\n`);

  const records = adPerformance.map(ad => ({
    week_ending: weekEnding,
    ad_id: ad.adId,
    ad_name: ad.adName,
    contacts: ad.contacts || 0,
    qualified: ad.qualified || 0,
    qualify_rate: ad.qualifyRate || 0,
    bookings: ad.bookings || 0,
    shows: ad.shows || 0,
    purchases: ad.purchases || 0,
    revenue: ad.revenue || 0,
    spend: ad.spend || 0,
    roas: ad.roas || 0,
    cost_per_lead: ad.costPerLead || 0,
    cost_per_customer: ad.costPerCustomer || 0,
    transformation_theme: ad.theme || null,
    symptom_focus: ad.symptoms || [],
    is_new_this_week: ad.isNew || false,
    was_scaled_this_week: ad.wasScaled || false,
    was_paused_this_week: ad.wasPaused || false
  }));

  const { data: result, error } = await supabase
    .from('ad_performance_weekly')
    .upsert(records, { onConflict: 'week_ending,ad_id' });

  if (error) {
    console.error('❌ Error saving ad performance:', error);
    throw error;
  }

  console.log(`✅ Saved ${records.length} ad performance records`);
  console.log('');
}

// Example usage
if (require.main === module) {
  // Example: Save this week's snapshot
  const exampleSnapshot = {
    contacts: 188,
    qualified: 106,
    qualifyRate: 56.4,
    bookings: 0,
    shows: 0,
    purchases: 0,
    revenue: 8543,
    spend: 13055.21,
    roas: 0.65,
    topAdByVolume: '120236476054200652',
    topAdByQuality: '120236476054200652',
    topAdByRoas: null,
    insights: '"Overwhelm to Relief" theme (84.6% qualify) outperforms "Confusion to Clarity" (60%). Top ad validates doctor dismissal.'
  };

  const exampleRecommendations = [
    'Scale Ad ...200652 (84.6% qualify rate, "Overwhelm to Relief" theme)',
    'Test more "Overwhelm to Relief" messaging (validation > education)',
    'Create 3-5 new ads with "Your doctor says it\'s normal... but it\'s NOT" hook',
    'Monitor conversion timeline (expect 28 days from subscribe to purchase)'
  ];

  saveWeeklySnapshot('2025-11-07', exampleSnapshot, exampleRecommendations)
    .then(() => console.log('Done!'))
    .catch(console.error);
}

module.exports = {
  saveWeeklySnapshot,
  saveAbTest,
  updateAbTestResults,
  saveAdPerformanceWeekly
};
