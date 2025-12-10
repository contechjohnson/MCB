#!/usr/bin/env node

/**
 * Debug Webhook Events
 *
 * Deep dive into funnel_events to understand what's happening
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function debugEvents() {
  console.log('🔍 Deep dive into funnel_events...\n');

  // 1. Check all distinct created_by values
  const { data: createdByValues, error: createdByError } = await supabase
    .from('funnel_events')
    .select('created_by');

  if (createdByError) {
    console.error('❌ Error:', createdByError.message);
    process.exit(1);
  }

  const createdByStats = {};
  createdByValues?.forEach(row => {
    createdByStats[row.created_by] = (createdByStats[row.created_by] || 0) + 1;
  });

  console.log('📊 Events by created_by:');
  Object.entries(createdByStats).forEach(([type, count]) => {
    console.log(`   ${type}: ${count}`);
  });
  console.log('');

  // 2. Get absolute latest events (regardless of created_by)
  const { data: latestEvents, error: latestError } = await supabase
    .from('funnel_events')
    .select('event_type, source, created_by, created_at')
    .order('created_at', { ascending: false })
    .limit(10);

  if (latestError) {
    console.error('❌ Error:', latestError.message);
    process.exit(1);
  }

  console.log('📋 Last 10 events in funnel_events (all types):');
  latestEvents?.forEach((e, i) => {
    const time = new Date(e.created_at).toLocaleString();
    console.log(`${i + 1}. [${e.created_by}] ${e.source} - ${e.event_type} @ ${time}`);
  });
  console.log('');

  // 3. Events created in last hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: lastHour, error: lastHourError } = await supabase
    .from('funnel_events')
    .select('event_type, source, created_by, created_at')
    .gte('created_at', oneHourAgo)
    .order('created_at', { ascending: false });

  if (!lastHourError && lastHour) {
    console.log(`⏰ Events created in last hour: ${lastHour.length}`);
    if (lastHour.length > 0) {
      console.log('   Breakdown:');
      const hourlyStats = {};
      lastHour.forEach(e => {
        const key = `${e.created_by}_${e.source}`;
        hourlyStats[key] = (hourlyStats[key] || 0) + 1;
      });
      Object.entries(hourlyStats).forEach(([key, count]) => {
        console.log(`   - ${key}: ${count}`);
      });
    }
    console.log('');
  }

  // 4. Check if source_event_id is being set
  const { data: withSourceId, error: sourceIdError } = await supabase
    .from('funnel_events')
    .select('source, source_event_id, created_at')
    .not('source_event_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(5);

  if (!sourceIdError && withSourceId && withSourceId.length > 0) {
    console.log('✅ Found events with source_event_id (idempotency working):');
    withSourceId.forEach((e, i) => {
      console.log(`   ${i + 1}. ${e.source}: ${e.source_event_id.substring(0, 30)}...`);
    });
    console.log('');
  } else {
    console.log('⚠️  No events found with source_event_id\n');
  }
}

debugEvents().catch(error => {
  console.error('❌ Debug failed:', error);
  process.exit(1);
});
