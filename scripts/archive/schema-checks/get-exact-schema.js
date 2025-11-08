// Get exact schema from deployed database
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

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

async function getExactSchema() {
  console.log('🔍 Getting exact schema from Supabase...\n');

  // Insert a minimal test record to discover all columns
  const testId = 'schema_test_' + Date.now();

  const { data, error } = await supabase
    .from('contacts')
    .insert({
      mc_id: testId,
      first_name: 'Test'
    })
    .select()
    .single();

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log('✅ EXACT COLUMNS IN DEPLOYED DATABASE:\n');
  const columns = Object.keys(data).sort();
  columns.forEach(col => {
    const value = data[col];
    const type = value === null ? 'null' : typeof value;
    console.log(`  ${col.padEnd(30)} (${type})`);
  });

  // Clean up
  await supabase.from('contacts').delete().eq('mc_id', testId);

  console.log('\n\n📋 COLUMNS AS ARRAY (for easy copy-paste):');
  console.log(JSON.stringify(columns, null, 2));

  console.log('\n\n🆚 COMPARING TO SCHEMA_V2.1.SQL:');
  const schemaColumns = [
    'id', 'MC_ID', 'GHL_ID', 'AD_ID', 'stripe_customer_id',
    'first_name', 'last_name', 'email_primary', 'email_booking', 'email_payment',
    'phone', 'IG', 'FB', 'stage', 'chatbot_AB', 'MISC_AB', 'trigger_word',
    'Q1_question', 'Q2_question', 'objections',
    'subscribe_date', 'followed_date', 'DM_qualified_date', 'link_send_date', 'link_click_date',
    'form_submit_date', 'meeting_book_date', 'meeting_held_date',
    'checkout_started', 'purchase_date', 'purchase_amount',
    'feedback_sent_date', 'feedback_received_date', 'feedback_text',
    'lead_summary', 'thread_ID', 'created_at', 'updated_at'
  ];

  const missing = schemaColumns.filter(c => !columns.includes(c) && !columns.includes(c.toLowerCase()));
  const extra = columns.filter(c => !schemaColumns.includes(c) && !schemaColumns.map(s => s.toLowerCase()).includes(c));

  if (missing.length > 0) {
    console.log('\n❌ Columns in schema_v2.1.sql but NOT in database:');
    missing.forEach(c => console.log(`  - ${c}`));
  }

  if (extra.length > 0) {
    console.log('\n✨ Extra columns in database (not in schema_v2.1.sql):');
    extra.forEach(c => console.log(`  - ${c}`));
  }
}

getExactSchema();
