// Apply fresh schema directly to Supabase
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function applySchema() {
  console.log('🔄 Applying fresh contacts table schema...\n');

  try {
    // Read the migration file
    const sql = fs.readFileSync(
      './supabase/migrations/20250105000003_fresh_contacts_table_with_new_columns.sql',
      'utf8'
    );

    console.log('Executing SQL via Supabase...');
    console.log('(This will drop and recreate the contacts table)\n');

    // We need to execute this via the Supabase SQL editor or direct connection
    // The JS client doesn't support executing raw DDL directly

    console.log('⚠️  Cannot execute DDL via JS client.');
    console.log('\nPlease execute the migration manually:');
    console.log('1. Go to: https://supabase.com/dashboard/project/jllwlymufzzflhkxuhlg/editor');
    console.log('2. Open a new SQL query');
    console.log('3. Paste the contents of:');
    console.log('   supabase/migrations/20250105000003_fresh_contacts_table_with_new_columns.sql');
    console.log('4. Click "Run"\n');

    console.log('Alternatively, showing SQL preview (first 1000 chars):');
    console.log('─'.repeat(80));
    console.log(sql.substring(0, 1000));
    console.log('...');
    console.log('─'.repeat(80));

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

applySchema();
