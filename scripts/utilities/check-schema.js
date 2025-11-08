// Quick script to check actual Supabase schema
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Parse .env.local manually
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
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

async function checkSchema() {
  console.log('🔍 Checking contacts table schema...\n');

  // Method 1: Count rows first
  const { count } = await supabase
    .from('contacts')
    .select('*', { count: 'exact', head: true });

  console.log(`📊 Total rows in contacts table: ${count || 0}\n`);

  // Method 1: Try to select all columns from a single row
  console.log('Method 1: Querying a single row to see all columns');
  const { data: sampleData, error: sampleError } = await supabase
    .from('contacts')
    .select('*')
    .limit(1);

  if (sampleError) {
    console.error('Error fetching sample data:', sampleError);
  } else if (sampleData && sampleData.length > 0) {
    console.log('✅ Available columns:');
    Object.keys(sampleData[0]).forEach(col => {
      console.log(`  - ${col}`);
    });
    console.log('\n📋 Sample row data:');
    console.log(JSON.stringify(sampleData[0], null, 2));
  } else {
    console.log('⚠️  No data in contacts table yet');
    console.log('Creating a test insert to discover schema...\n');

    // Insert and immediately delete to discover schema
    const testContact = {
      mc_id: 'schema_test_' + Date.now(),
      email: 'test@schemacheck.com'
    };

    const { data: insertData, error: insertError } = await supabase
      .from('contacts')
      .insert(testContact)
      .select()
      .single();

    if (insertError) {
      console.error('❌ Error inserting test record:', insertError.message);
    } else if (insertData) {
      console.log('✅ Available columns (from test insert):');
      Object.keys(insertData).forEach(col => {
        console.log(`  - ${col}`);
      });

      // Clean up
      await supabase
        .from('contacts')
        .delete()
        .eq('mc_id', testContact.mc_id);

      console.log('\n🧹 Test record cleaned up');
    }
  }

  // Method 2: Query information_schema
  console.log('\n\nMethod 2: Querying information_schema');
  const { data: schemaData, error: schemaError } = await supabase
    .rpc('exec_sql', {
      query: `
        SELECT
          column_name,
          data_type,
          is_nullable,
          column_default
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'contacts'
        ORDER BY ordinal_position;
      `
    });

  if (schemaError) {
    console.log('ℹ️  RPC not available, that\'s OK. Using sample data above.');
  } else {
    console.log('✅ Schema from information_schema:');
    console.log(schemaData);
  }

  // Method 3: Check for specific columns we're looking for
  console.log('\n\nMethod 3: Testing specific columns');
  const columnsToCheck = ['MC_ID', 'mc_id', 'subscribed', 'ig_last_interaction', 'ig_id'];

  for (const col of columnsToCheck) {
    const { data, error } = await supabase
      .from('contacts')
      .select(col)
      .limit(1);

    if (error) {
      console.log(`❌ Column '${col}' - NOT FOUND (${error.message})`);
    } else {
      console.log(`✅ Column '${col}' - EXISTS`);
    }
  }
}

checkSchema().catch(console.error);
