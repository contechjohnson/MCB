// Run migration directly against Supabase
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

async function runMigration() {
  try {
    console.log('Reading migration file...');
    const migrationPath = path.join(__dirname, 'supabase/migrations/20250105000003_fresh_contacts_table_with_new_columns.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('Executing migration...');

    // Split the SQL into individual statements (rough split by semicolon at end of lines)
    const statements = sql
      .split(/;\s*$/gm)
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.startsWith('--')) continue; // Skip comments

      console.log(`\nExecuting statement ${i + 1}/${statements.length}...`);
      console.log(`Preview: ${statement.substring(0, 60)}...`);

      const { data, error } = await supabase.rpc('exec_sql', {
        sql_query: statement + ';'
      });

      if (error) {
        // Try direct execution if rpc fails
        console.log('Trying direct execution...');
        const { error: directError } = await supabase
          .from('_sql')
          .insert({ query: statement });

        if (directError) {
          console.error('Error:', error);
          console.error('Statement:', statement);
          throw error;
        }
      }
    }

    console.log('\n✅ Migration completed successfully!');

    // Verify the table exists and has the new columns
    console.log('\nVerifying table structure...');
    const { data: tableInfo, error: verifyError } = await supabase
      .from('contacts')
      .select('*')
      .limit(0);

    if (verifyError) {
      console.error('Verification error:', verifyError);
    } else {
      console.log('✅ Table exists and is accessible');
    }

    // Check column count via raw SQL query
    const { data: columns } = await supabase
      .rpc('exec_sql', {
        sql_query: `
          SELECT column_name, data_type
          FROM information_schema.columns
          WHERE table_name = 'contacts'
          ORDER BY ordinal_position;
        `
      });

    if (columns) {
      console.log(`\nTable has ${columns.length} columns (should include subscribed, ig_last_interaction, ig_id)`);
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
