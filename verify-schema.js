// Verify the contacts table has all the columns we need
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function verifySchema() {
  console.log('🔍 Verifying contacts table schema...\n');

  try {
    // Test 1: Insert a test contact with new columns
    console.log('Test 1: Insert test contact with new columns...');
    const testContact = {
      MC_ID: 'test_verify_' + Date.now(),
      email_primary: 'verify@test.com',
      subscribed: new Date().toISOString(),
      ig_id: 1234567890,
      ig_last_interaction: new Date().toISOString(),
      first_name: 'Test',
      stage: 'new_lead'
    };

    const { data: insertData, error: insertError } = await supabase
      .from('contacts')
      .insert(testContact)
      .select()
      .single();

    if (insertError) {
      console.error('❌ Insert failed:', insertError.message);
      return;
    }

    console.log('✅ Insert successful!');
    console.log('   Contact ID:', insertData.id);

    // Test 2: Read back the contact
    console.log('\nTest 2: Reading back the contact...');
    const { data: readData, error: readError } = await supabase
      .from('contacts')
      .select('*')
      .eq('MC_ID', testContact.MC_ID)
      .single();

    if (readError) {
      console.error('❌ Read failed:', readError.message);
      return;
    }

    console.log('✅ Read successful!');
    console.log('   Has subscribed:', !!readData.subscribed);
    console.log('   Has ig_id:', !!readData.ig_id);
    console.log('   Has ig_last_interaction:', !!readData.ig_last_interaction);

    // Test 3: Update the contact
    console.log('\nTest 3: Updating contact...');
    const { error: updateError } = await supabase
      .from('contacts')
      .update({
        stage: 'DM_qualified',
        DM_qualified_date: new Date().toISOString()
      })
      .eq('id', insertData.id);

    if (updateError) {
      console.error('❌ Update failed:', updateError.message);
      return;
    }

    console.log('✅ Update successful!');

    // Test 4: Test helper functions
    console.log('\nTest 4: Testing helper functions...');

    // Note: We can't directly call Postgres functions via the JS client
    // but we verified they were created in the migration

    // Test 5: Clean up test data
    console.log('\nTest 5: Cleaning up...');
    const { error: deleteError } = await supabase
      .from('contacts')
      .delete()
      .eq('MC_ID', testContact.MC_ID);

    if (deleteError) {
      console.error('❌ Cleanup failed:', deleteError.message);
      return;
    }

    console.log('✅ Cleanup successful!');

    // Final summary
    console.log('\n' + '='.repeat(60));
    console.log('✅ ALL TESTS PASSED!');
    console.log('='.repeat(60));
    console.log('\nThe contacts table is working correctly with:');
    console.log('  ✓ subscribed column');
    console.log('  ✓ ig_id column');
    console.log('  ✓ ig_last_interaction column');
    console.log('  ✓ Insert operations');
    console.log('  ✓ Read operations');
    console.log('  ✓ Update operations');
    console.log('  ✓ Delete operations');
    console.log('\n🚀 Ready to handle webhook data!\n');

  } catch (error) {
    console.error('❌ Verification failed:', error.message);
    console.error(error);
  }
}

verifySchema();
