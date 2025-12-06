const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function checkWebhookLogs() {
  console.log('🔍 Checking webhook_logs for Sophie payment...\n');

  // Check for the specific session ID
  const sessionId = 'cs_live_a1SC0bWy0gwaeG2HUe01W3RoMDk32wPlcYgZVfb13mulvUoEJh2D1ozEib';

  const { data: allLogs, error: allLogsError } = await supabase
    .from('webhook_logs')
    .select('*')
    .eq('source', 'stripe')
    .order('created_at', { ascending: false })
    .limit(500);

  if (allLogsError) {
    console.error('❌ Error:', allLogsError);
    return;
  }

  console.log(`Total Stripe logs found: ${allLogs ? allLogs.length : 0}\n`);

  const matchingLog = allLogs && allLogs.find(log => {
    try {
      const body = typeof log.body === 'string' ? JSON.parse(log.body) : log.body;
      return body && body.data && body.data.object && body.data.object.id === sessionId;
    } catch (e) {
      return false;
    }
  });

  if (matchingLog) {
    console.log('✅ FOUND webhook log for this payment!\n');
    console.log(`Event Type: ${matchingLog.event_type}`);
    console.log(`Status: ${matchingLog.status}`);
    console.log(`Error Message: ${matchingLog.error_message || 'none'}`);
    console.log(`Created: ${matchingLog.created_at}\n`);
    
    // Parse the body to see what email it had
    try {
      const body = typeof matchingLog.body === 'string' ? JSON.parse(matchingLog.body) : matchingLog.body;
      const email = body.data.object.customer_details.email;
      console.log(`Email in webhook: ${email}`);
    } catch (e) {
      console.log('Could not extract email from body');
    }
  } else {
    console.log('❌ NO webhook log found for this session ID');
    console.log('This means:');
    console.log('  - Webhook was NOT logged (failed before logging step)');
    console.log('  - OR webhook never reached our endpoint');
  }
}

checkWebhookLogs().catch(console.error);
