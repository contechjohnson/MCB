// Debug: See what's actually in webhook_logs
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load .env.local manually
const envPath = path.join(__dirname, '..', '.env.local');
const envFile = fs.readFileSync(envPath, 'utf8');
const envVars = {};
envFile.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length > 0) {
    envVars[key.trim()] = valueParts.join('=').trim();
  }
});

const supabaseAdmin = createClient(
  envVars.NEXT_PUBLIC_SUPABASE_URL,
  envVars.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function debugWebhookLogs() {
  console.log('🔍 Checking all Stripe webhook logs...\n');

  const { data: logs, error } = await supabaseAdmin
    .from('webhook_logs')
    .select('*')
    .eq('source', 'stripe')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log(`Found ${logs.length} Stripe webhook logs:\n`);

  logs.forEach((log, index) => {
    console.log(`--- Log ${index + 1} ---`);
    console.log('Event ID:', log.event_id);
    console.log('Event Type:', log.event_type);
    console.log('Created At:', log.created_at);
    console.log('Success:', log.success);

    if (log.raw_payload) {
      const payload = log.raw_payload;

      // Try to extract email from various locations
      let email = null;
      if (payload.data?.object?.customer_details?.email) {
        email = payload.data.object.customer_details.email;
      } else if (payload.data?.object?.customer_email) {
        email = payload.data.object.customer_email;
      } else if (payload.data?.object?.receipt_email) {
        email = payload.data.object.receipt_email;
      }

      console.log('Email found:', email || 'NONE');

      // Show the event type and object type
      if (payload.type) {
        console.log('Payload type:', payload.type);
      }
      if (payload.data?.object?.object) {
        console.log('Object type:', payload.data.object.object);
      }

      // For checkout sessions, show more details
      if (payload.data?.object?.object === 'checkout.session') {
        const session = payload.data.object;
        console.log('Session ID:', session.id);
        console.log('Amount Total:', session.amount_total);
        console.log('Payment Status:', session.payment_status);
        console.log('Customer:', session.customer);
      }
    }

    console.log('');
  });
}

debugWebhookLogs().catch(console.error);
