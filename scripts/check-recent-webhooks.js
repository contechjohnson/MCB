#!/usr/bin/env node

/**
 * Check Recent Webhooks
 *
 * Shows recent webhook calls from webhook_logs to see if
 * any webhooks have fired since the dual-write fix.
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkRecentWebhooks() {
  console.log('🔍 Checking recent webhook activity...\n');

  // Get webhooks from last 6 hours
  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();

  const { data: recentWebhooks, error } = await supabase
    .from('webhook_logs')
    .select('source, event_type, status, created_at, contact_id')
    .gte('created_at', sixHoursAgo)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('❌ Error querying webhook_logs:', error.message);
    process.exit(1);
  }

  if (!recentWebhooks || recentWebhooks.length === 0) {
    console.log('📭 No webhooks received in the last 6 hours');
    console.log('   This means no user interactions have occurred since the fix\n');
    return;
  }

  console.log(`📬 Found ${recentWebhooks.length} webhook calls in last 6 hours:\n`);

  // Group by source and status
  const stats = {};
  recentWebhooks.forEach(wh => {
    const key = `${wh.source}_${wh.status}`;
    stats[key] = (stats[key] || 0) + 1;
  });

  console.log('📊 Breakdown by source and status:');
  Object.entries(stats).forEach(([key, count]) => {
    const [source, status] = key.split('_');
    const statusEmoji = status === 'processed' ? '✅' : status === 'error' ? '❌' : '⚠️';
    console.log(`   ${statusEmoji} ${source} (${status}): ${count}`);
  });
  console.log('');

  // Show last 10
  console.log('📋 Last 10 webhook calls:');
  recentWebhooks.slice(0, 10).forEach((wh, i) => {
    const time = new Date(wh.created_at).toLocaleTimeString();
    const statusEmoji = wh.status === 'processed' ? '✅' : wh.status === 'error' ? '❌' : '⚠️';
    const contactInfo = wh.contact_id ? ` (contact: ${wh.contact_id.substring(0, 8)}...)` : '';
    console.log(`${i + 1}. ${statusEmoji} [${time}] ${wh.source} - ${wh.event_type}${contactInfo}`);
  });
  console.log('');

  // Check if any were processed successfully
  const successfulWebhooks = recentWebhooks.filter(wh => wh.status === 'processed');
  if (successfulWebhooks.length > 0) {
    console.log(`✅ ${successfulWebhooks.length} webhooks processed successfully`);
    console.log('   These should have created events in funnel_events table');
    console.log('   Run verify-webhook-events.js to confirm\n');
  }
}

checkRecentWebhooks().catch(error => {
  console.error('❌ Check failed:', error);
  process.exit(1);
});
