const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

(async () => {
  console.log('Checking actual database schema via raw SQL...\n');

  // Use rpc to execute raw SQL
  const { data, error } = await supabase.rpc('exec_sql', {
    query: `
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'contacts'
        AND table_schema = 'public'
      ORDER BY ordinal_position;
    `
  });

  if (error) {
    console.log('exec_sql function does not exist, trying direct query...');

    // Try a simpler approach - just select from contacts with no rows
    const { data: contactData, error: contactError } = await supabase
      .from('contacts')
      .select('*')
      .limit(0);

    if (contactError) {
      console.error('Error:', contactError);
    } else {
      console.log('Cannot determine columns this way.');
      console.log('\nLet me try to insert a test contact to see what fails...');

      // Try inserting with a made-up GHL_ID to see the error
      const { error: insertError } = await supabase
        .from('contacts')
        .insert({
          GHL_ID: 'test_duplicate_check_12345',
          email_primary: 'test@example.com'
        });

      if (insertError) {
        console.log('Insert error:', insertError.message);
        console.log('Error details:', insertError.details);
      } else {
        console.log('Insert succeeded - deleting test record...');
        await supabase.from('contacts').delete().eq('GHL_ID', 'test_duplicate_check_12345');
      }
    }
  } else {
    console.log('Columns:');
    console.log(data);
  }
})();
