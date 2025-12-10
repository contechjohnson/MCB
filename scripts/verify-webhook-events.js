#!/usr/bin/env node

/**
 * Verify Webhook Events Script
 *
 * Checks that webhooks are creating events in funnel_events table
 * after the dual-write migration.
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function verifyWebhookEvents() {
  console.log('🔍 Checking for webhook-created events...\n');

  // Get total event counts
  const { data: totalCounts, error: totalError } = await supabase
    .from('funnel_events')
    .select('created_by', { count: 'exact', head: true });

  if (totalError) {
    console.error('❌ Error querying total events:', totalError.message);
    process.exit(1);
  }

  console.log(`📊 Total events in funnel_events: ${totalCounts || 0}\n`);

  // Get migration vs webhook counts
  const { data: bySource, error: sourceError } = await supabase
    .from('funnel_events')
    .select('created_by')
    .in('created_by', ['migration', 'webhook']);

  if (sourceError) {
    console.error('❌ Error querying by source:', sourceError.message);
    process.exit(1);
  }

  const migrationCount = bySource?.filter(e => e.created_by === 'migration').length || 0;
  const webhookCount = bySource?.filter(e => e.created_by === 'webhook').length || 0;

  console.log(`📦 Migration events: ${migrationCount}`);
  console.log(`🔗 Webhook events: ${webhookCount}\n`);

  if (webhookCount === 0) {
    console.log('⚠️  No webhook events found yet - this is expected if no webhooks have fired since deployment');
    console.log('   Events will appear as users interact with the system\n');
  } else {
    console.log('✅ Webhook events are being created!\n');
  }

  // Get recent webhook events by source
  const { data: recentEvents, error: recentError } = await supabase
    .from('funnel_events')
    .select('event_type, source, event_timestamp, created_at')
    .eq('created_by', 'webhook')
    .order('created_at', { ascending: false })
    .limit(20);

  if (recentError) {
    console.error('❌ Error querying recent events:', recentError.message);
    process.exit(1);
  }

  if (recentEvents && recentEvents.length > 0) {
    console.log(`📋 Last ${recentEvents.length} webhook events:\n`);

    recentEvents.forEach((event, i) => {
      const timestamp = new Date(event.created_at).toLocaleString();
      console.log(`${i + 1}. [${event.source}] ${event.event_type} - ${timestamp}`);
    });
    console.log('');

    // Group by source
    const bySourceMap = {};
    recentEvents.forEach(e => {
      bySourceMap[e.source] = (bySourceMap[e.source] || 0) + 1;
    });

    console.log('📊 Recent events by source:');
    Object.entries(bySourceMap).forEach(([source, count]) => {
      console.log(`   ${source}: ${count} events`);
    });
    console.log('');
  }

  // Check events in last 24 hours
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: last24h, error: last24hError } = await supabase
    .from('funnel_events')
    .select('id', { count: 'exact', head: true })
    .eq('created_by', 'webhook')
    .gte('created_at', oneDayAgo);

  if (!last24hError && last24h) {
    console.log(`⏰ Webhook events in last 24 hours: ${last24h || 0}\n`);
  }

  console.log('✅ Verification complete!');
}

verifyWebhookEvents().catch(error => {
  console.error('❌ Verification failed:', error);
  process.exit(1);
});
