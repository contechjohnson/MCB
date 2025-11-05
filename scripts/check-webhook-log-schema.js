// Check the actual structure of webhook_logs
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

async function checkSchema() {
  console.log('🔍 Checking webhook_logs structure...\n');

  const { data: logs, error } = await supabaseAdmin
    .from('webhook_logs')
    .select('*')
    .eq('event_type', 'checkout.session.completed')
    .limit(1);

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  if (logs.length === 0) {
    console.log('❌ No checkout.session.completed events found');
    return;
  }

  const log = logs[0];
  console.log('📋 Webhook Log Columns:');
  console.log(Object.keys(log).join(', '));
  console.log('\n');

  console.log('📄 Full Log Entry:');
  console.log(JSON.stringify(log, null, 2));
}

checkSchema().catch(console.error);
