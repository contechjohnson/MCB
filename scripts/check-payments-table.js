const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function checkPayments() {
  console.log('🔍 Checking for payments table...\n');

  // Try to query payments table
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .limit(1);

  if (error) {
    console.error('❌ Payments table error:', error);
    console.log('\n💡 Table may not exist. Checking webhook_logs instead...\n');

    // Try webhook_logs
    const { data: logs, error: logError } = await supabase
      .from('webhook_logs')
      .select('*')
      .limit(1);

    if (logError) {
      console.error('❌ Webhook_logs error:', logError);
    } else {
      console.log('✅ Found webhook_logs table');
      if (logs && logs.length > 0) {
        console.log('\n📋 Column structure:');
        Object.keys(logs[0]).forEach(key => {
          console.log(`   - ${key}`);
        });
      }
    }
  } else {
    console.log('✅ Found payments table');
    if (data && data.length > 0) {
      console.log('\n📋 Column structure:');
      Object.keys(data[0]).forEach(key => {
        console.log(`   - ${key}`);
      });
      console.log('\n📊 Sample payment:');
      console.log(JSON.stringify(data[0], null, 2));
    } else {
      console.log('⚠️  Payments table is empty');
    }
  }
}

checkPayments().catch(console.error);
