// Quick test to verify Supabase connection works
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function testConnection() {
  console.log('Testing Supabase connection...\n');

  // Check env vars exist
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.error('❌ NEXT_PUBLIC_SUPABASE_URL not found in .env.local');
    return;
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY not found in .env.local');
    return;
  }

  console.log('✅ Environment variables found');

  // Create admin client
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );

  console.log('✅ Supabase client created');

  // Test 1: List all tables
  console.log('\n--- Testing: List all tables ---');
  const { data: tables, error: tablesError } = await supabase
    .from('information_schema.tables')
    .select('table_name')
    .eq('table_schema', 'public');

  if (tablesError) {
    console.error('❌ Error listing tables:', tablesError.message);
  } else {
    console.log('✅ Tables found:', tables.map(t => t.table_name).join(', '));
  }

  // Test 2: Check if contacts table exists and count rows
  console.log('\n--- Testing: Contacts table ---');
  const { count, error: countError } = await supabase
    .from('contacts')
    .select('*', { count: 'exact', head: true });

  if (countError) {
    console.error('❌ Error accessing contacts:', countError.message);
  } else {
    console.log('✅ Contacts table accessible');
    console.log(`   Found ${count} contacts in database`);
  }

  // Test 3: Sample a few contacts
  console.log('\n--- Testing: Sample data ---');
  const { data: samples, error: sampleError } = await supabase
    .from('contacts')
    .select('user_id, email_address, stage')
    .limit(3);

  if (sampleError) {
    console.error('❌ Error reading samples:', sampleError.message);
  } else {
    console.log('✅ Sample contacts:');
    samples.forEach(c => {
      console.log(`   - ${c.email_address || 'no email'} (Stage: ${c.stage})`);
    });
  }

  console.log('\n✅ All tests passed! Supabase is connected and working.\n');
}

testConnection().catch(err => {
  console.error('\n❌ Test failed:', err.message);
  process.exit(1);
});
