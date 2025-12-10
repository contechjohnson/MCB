#!/usr/bin/env node

/**
 * Check for webhook errors after deployment
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkErrors() {
  console.log('🔍 Checking recent webhooks for errors...\n');

  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

  const { data: recentLogs, error } = await supabase
    .from('webhook_logs')
    .select('*')
    .gte('created_at', tenMinutesAgo)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }

  if (!recentLogs || recentLogs.length === 0) {
    console.log('📭 No webhook calls in last 10 minutes\n');
    return;
  }

  console.log(`📬 Found ${recentLogs.length} webhook calls:\n`);

  const byStatus = {};
  recentLogs.forEach(log => {
    byStatus[log.status] = (byStatus[log.status] || 0) + 1;
  });

  console.log('Status breakdown:');
  Object.entries(byStatus).forEach(([status, count]) => {
    const emoji = status === 'processed' ? '✅' : status === 'error' ? '❌' : '⚠️';
    console.log(`   ${emoji} ${status}: ${count}`);
  });
  console.log('');

  // Show any errors
  const errors = recentLogs.filter(log => log.status === 'error');
  if (errors.length > 0) {
    console.log(`❌ Found ${errors.length} errors:\n`);
    errors.forEach((log, i) => {
      const time = new Date(log.created_at).toLocaleTimeString();
      console.log(`${i + 1}. [${time}] ${log.source} - ${log.event_type}`);
      if (log.error_message) {
        console.log(`   Error: ${log.error_message}`);
      }
    });
    console.log('');
  }

  // Show last 5 logs with details
  console.log('📋 Last 5 webhook calls (detailed):\n');
  recentLogs.slice(0, 5).forEach((log, i) => {
    const time = new Date(log.created_at).toLocaleTimeString();
    const emoji = log.status === 'processed' ? '✅' : log.status === 'error' ? '❌' : '⚠️';
    console.log(`${i + 1}. ${emoji} [${time}] ${log.source} - ${log.event_type}`);
    console.log(`   Status: ${log.status}`);
    if (log.contact_id) {
      console.log(`   Contact: ${log.contact_id.substring(0, 8)}...`);
    }
    if (log.error_message) {
      console.log(`   Error: ${log.error_message}`);
    }
    console.log('');
  });
}

checkErrors().catch(error => {
  console.error('❌ Check failed:', error);
  process.exit(1);
});
