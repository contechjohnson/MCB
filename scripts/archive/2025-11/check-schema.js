const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function checkSchema() {
  console.log('🔍 Checking database schema...\n');

  // List all tables
  const { data: tables, error: tableError } = await supabase
    .from('information_schema.tables')
    .select('table_name')
    .eq('table_schema', 'public');

  if (tableError) {
    console.error('❌ Error listing tables:', tableError);
  } else {
    console.log('📋 Available tables:');
    tables?.forEach(t => console.log(`   - ${t.table_name}`));
  }

  // Try to get contacts columns
  console.log('\n📋 Contacts table columns:');
  const { data: contactCols, error: contactColError } = await supabase
    .from('information_schema.columns')
    .select('column_name, data_type')
    .eq('table_schema', 'public')
    .eq('table_name', 'contacts');

  if (contactColError) {
    console.error('❌ Error:', contactColError);
  } else {
    contactCols?.forEach(c => console.log(`   - ${c.column_name} (${c.data_type})`));
  }

  // Try to get payments columns
  console.log('\n📋 Payments table columns:');
  const { data: paymentCols, error: paymentColError } = await supabase
    .from('information_schema.columns')
    .select('column_name, data_type')
    .eq('table_schema', 'public')
    .eq('table_name', 'payments');

  if (paymentColError) {
    console.error('❌ Error:', paymentColError);
  } else if (paymentCols && paymentCols.length > 0) {
    paymentCols?.forEach(c => console.log(`   - ${c.column_name} (${c.data_type})`));
  } else {
    console.log('   ⚠️  Table might not exist or has no columns');
  }
}

checkSchema().catch(console.error);
