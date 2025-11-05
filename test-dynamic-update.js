// Test the dynamic update function
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
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

async function testDynamicUpdate() {
  console.log('🧪 Testing dynamic update function...\n');

  // Step 1: Check if function exists
  console.log('Step 1: Checking if update_contact_dynamic function exists...');
  const { data: funcCheck, error: funcError } = await supabase
    .rpc('update_contact_dynamic', {
      contact_id: '00000000-0000-0000-0000-000000000000',
      update_data: {}
    });

  if (funcError) {
    if (funcError.message.includes('Could not find the function')) {
      console.log('❌ Function does not exist yet. Applying migration...\n');
      console.log('📋 Please run this SQL in Supabase SQL Editor:\n');
      console.log('='.repeat(60));
      console.log(readFileSync(join(__dirname, 'migration_update_contact_dynamic.sql'), 'utf8'));
      console.log('='.repeat(60));
      console.log('\nThen run this script again to test.');
      return;
    } else if (!funcError.message.includes('violates foreign key constraint')) {
      console.error('❌ Error checking function:', funcError.message);
      return;
    }
  }

  console.log('✅ Function exists!\n');

  // Step 2: Create a test contact
  console.log('Step 2: Creating test contact...');
  const testMcId = 'test_dynamic_' + Date.now();
  const { data: newContact, error: insertError } = await supabase
    .from('contacts')
    .insert({
      mc_id: testMcId,
      email_primary: 'test@dynamic.com',
      stage: 'new_lead'
    })
    .select()
    .single();

  if (insertError) {
    console.error('❌ Error creating test contact:', insertError.message);
    return;
  }

  console.log('✅ Created contact:', newContact.id);
  console.log('   Initial data:', JSON.stringify({
    first_name: newContact.first_name,
    last_name: newContact.last_name,
    email_primary: newContact.email_primary,
    stage: newContact.stage
  }, null, 2));

  // Step 3: Test update with dynamic function
  console.log('\nStep 3: Testing dynamic update...');
  const updateData = {
    first_name: 'Dynamic',
    last_name: 'Test',
    phone: '+1-555-1234',
    ig: '@dynamictest',
    chatbot_ab: 'variant_a',
    stage: 'dm_qualified',
    dm_qualified_date: new Date().toISOString()
  };

  const { error: updateError } = await supabase
    .rpc('update_contact_dynamic', {
      contact_id: newContact.id,
      update_data: updateData
    });

  if (updateError) {
    console.error('❌ Error updating contact:', updateError.message);
  } else {
    console.log('✅ Update successful!');
  }

  // Step 4: Verify the update
  console.log('\nStep 4: Verifying update...');
  const { data: updatedContact, error: fetchError } = await supabase
    .from('contacts')
    .select('*')
    .eq('id', newContact.id)
    .single();

  if (fetchError) {
    console.error('❌ Error fetching updated contact:', fetchError.message);
  } else {
    console.log('✅ Updated contact data:');
    console.log(JSON.stringify({
      first_name: updatedContact.first_name,
      last_name: updatedContact.last_name,
      email_primary: updatedContact.email_primary,
      phone: updatedContact.phone,
      ig: updatedContact.ig,
      chatbot_ab: updatedContact.chatbot_ab,
      stage: updatedContact.stage,
      dm_qualified_date: updatedContact.dm_qualified_date,
      updated_at: updatedContact.updated_at
    }, null, 2));

    // Verify changes
    const checks = [
      updatedContact.first_name === 'Dynamic',
      updatedContact.last_name === 'Test',
      updatedContact.phone === '+1-555-1234',
      updatedContact.ig === '@dynamictest',
      updatedContact.chatbot_ab === 'variant_a',
      updatedContact.stage === 'dm_qualified',
      updatedContact.dm_qualified_date !== null
    ];

    const passed = checks.filter(c => c).length;
    console.log(`\n📊 Verification: ${passed}/${checks.length} checks passed`);

    if (passed === checks.length) {
      console.log('✅ All tests passed!');
    } else {
      console.log('⚠️  Some fields did not update correctly');
    }
  }

  // Step 5: Test partial update (should not overwrite existing data)
  console.log('\nStep 5: Testing partial update (should preserve existing data)...');
  const partialUpdate = {
    trigger_word: 'start',
    objections: 'price'
  };

  const { error: partialError } = await supabase
    .rpc('update_contact_dynamic', {
      contact_id: newContact.id,
      update_data: partialUpdate
    });

  if (partialError) {
    console.error('❌ Error with partial update:', partialError.message);
  } else {
    console.log('✅ Partial update successful!');
  }

  // Verify partial update didn't overwrite other fields
  const { data: finalContact } = await supabase
    .from('contacts')
    .select('*')
    .eq('id', newContact.id)
    .single();

  console.log('✅ Final contact state:');
  console.log(JSON.stringify({
    first_name: finalContact.first_name,
    last_name: finalContact.last_name,
    trigger_word: finalContact.trigger_word,
    objections: finalContact.objections,
    ig: finalContact.ig
  }, null, 2));

  if (finalContact.first_name === 'Dynamic' && finalContact.trigger_word === 'start') {
    console.log('✅ Partial update preserved existing fields!');
  }

  // Step 6: Clean up
  console.log('\nStep 6: Cleaning up test data...');
  const { error: deleteError } = await supabase
    .from('contacts')
    .delete()
    .eq('id', newContact.id);

  if (deleteError) {
    console.error('⚠️  Could not delete test contact:', deleteError.message);
  } else {
    console.log('✅ Test contact deleted');
  }

  console.log('\n✨ All tests complete!');
}

testDynamicUpdate().catch(console.error);
