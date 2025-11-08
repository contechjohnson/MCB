const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

(async () => {
  console.log('Checking actual database schema...\n');

  // Query information_schema to get actual column names
  const { data, error } = await supabase
    .from('information_schema.columns')
    .select('column_name')
    .eq('table_name', 'contacts')
    .eq('table_schema', 'public')
    .order('ordinal_position');

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Actual columns in contacts table:');
    data.forEach(col => console.log('  -', col.column_name));
  }

  // Also check if the functions exist
  console.log('\nChecking functions...');

  const { data: funcData, error: funcError } = await supabase.rpc('find_contact_smart', {
    search_ghl_id: null,
    search_mc_id: null,
    search_email: null,
    search_phone: null
  });

  if (funcError) {
    console.log('find_contact_smart:', funcError.message);
  } else {
    console.log('find_contact_smart: EXISTS ✓');
  }
})();
