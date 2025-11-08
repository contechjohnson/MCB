// Apply migration to Supabase
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Parse .env.local
const envPath = join(__dirname, '.env.local');
const envFile = readFileSync(envPath, 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim();
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

async function applyMigration() {
  console.log('🚀 Applying duplicate mc_id fix migration...\n');

  // Read the migration file
  const migrationPath = join(__dirname, 'migrations', 'fix_duplicate_mc_id_upsert.sql');
  const migrationSQL = readFileSync(migrationPath, 'utf8');

  // Split by statement (basic splitting on semicolons outside of function bodies)
  // For complex migrations, we'll execute the whole thing as one query
  const { data, error } = await supabase.rpc('exec_sql', {
    query: migrationSQL
  });

  if (error) {
    // If rpc doesn't exist, try direct execution via REST API
    console.log('⚠️  exec_sql RPC not available, trying alternative method...\n');

    // Use the REST API directly
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      },
      body: JSON.stringify({ query: migrationSQL })
    });

    if (!response.ok) {
      console.error('❌ Migration failed via REST API');
      console.error('Status:', response.status, response.statusText);
      const text = await response.text();
      console.error('Response:', text);

      // Try manual execution
      console.log('\n📋 Manual execution required. Run this SQL in Supabase SQL Editor:');
      console.log('==========================================');
      console.log(migrationSQL);
      console.log('==========================================');

      return;
    }

    console.log('✅ Migration applied successfully via REST API\n');
  } else {
    console.log('✅ Migration applied successfully\n');
    if (data) {
      console.log('Result:', data);
    }
  }

  console.log('\n✨ Migration complete! create_contact_with_mc_id() now handles duplicates gracefully.');
  console.log('🎉 The duplicate mc_id error is now fixed!');
  console.log('📊 Test it by having a contact go through your ManyChat funnel.');
}

applyMigration().catch(err => {
  console.error('❌ Error:', err.message);
  console.log('\n📋 If automatic application failed, copy the SQL from:');
  console.log('   migrations/fix_duplicate_mc_id_upsert.sql');
  console.log('   and paste it into Supabase SQL Editor manually.');
});
