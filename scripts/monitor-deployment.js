#!/usr/bin/env node

/**
 * Monitor Deployment
 *
 * Checks if new webhook code is deployed by:
 * 1. Pinging webhook endpoint health checks
 * 2. Monitoring for new webhook events in funnel_events
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const WEBHOOK_BASE = 'https://mcb-dun.vercel.app/api/webhooks/ppcu';

async function checkDeployment() {
  console.log('🔍 Checking deployment status...\n');

  // 1. Check if webhooks are responding
  console.log('📡 Pinging webhook endpoints:');
  const endpoints = ['manychat', 'ghl', 'stripe', 'denefits', 'perspective'];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`${WEBHOOK_BASE}/${endpoint}`);
      const data = await response.json();
      console.log(`   ✅ ${endpoint}: ${data.status} (${data.message || ''})`);
    } catch (error) {
      console.log(`   ❌ ${endpoint}: ${error.message}`);
    }
  }
  console.log('');

  // 2. Check for NEW webhook events (created in last 5 minutes)
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  const { data: recentWebhookEvents, error } = await supabase
    .from('funnel_events')
    .select('event_type, source, created_at')
    .eq('created_by', 'webhook')
    .gte('created_at', fiveMinutesAgo)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Error checking events:', error.message);
    return;
  }

  if (!recentWebhookEvents || recentWebhookEvents.length === 0) {
    console.log('⏳ No webhook events created yet');
    console.log('   Deployment may still be in progress, or no user activity yet\n');
    console.log('💡 Check again in a few minutes, or wait for next user interaction\n');
  } else {
    console.log(`✅ DEPLOYMENT SUCCESSFUL! Found ${recentWebhookEvents.length} webhook events:\n`);
    recentWebhookEvents.forEach((e, i) => {
      const time = new Date(e.created_at).toLocaleTimeString();
      console.log(`   ${i + 1}. [${time}] ${e.source} - ${e.event_type}`);
    });
    console.log('\n🎉 Webhooks are now creating events in real-time!\n');
  }

  // 3. Show recent webhook activity
  const { data: recentWebhooks, error: webhookError } = await supabase
    .from('webhook_logs')
    .select('source, event_type, status, created_at')
    .gte('created_at', fiveMinutesAgo)
    .order('created_at', { ascending: false })
    .limit(10);

  if (!webhookError && recentWebhooks && recentWebhooks.length > 0) {
    console.log(`📬 Recent webhook activity (last 5 min): ${recentWebhooks.length} calls`);
    const processed = recentWebhooks.filter(w => w.status === 'processed').length;
    console.log(`   ${processed} processed successfully\n`);
  }
}

checkDeployment().catch(error => {
  console.error('❌ Monitor failed:', error);
  process.exit(1);
});
