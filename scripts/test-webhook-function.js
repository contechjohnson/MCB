#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testFunction() {
  console.log('Testing update_contact_with_event with real data...\n');

  // Get a real contact
  const { data: contact } = await supabase
    .from('contacts')
    .select('id')
    .limit(1)
    .single();

  if (!contact) {
    console.error('No contact found');
    return;
  }

  console.log(`Using contact: ${contact.id}\n`);

  // Test with data similar to what webhooks send
  const { data, error } = await supabase.rpc('update_contact_with_event', {
    p_contact_id: contact.id,
    p_update_data: {
      stage: 'dm_qualified',
      dm_qualified_date: new Date().toISOString(),
    },
    p_event_type: 'dm_qualified',
    p_source: 'manychat',
    p_source_event_id: `test_${Date.now()}`,
  });

  if (error) {
    console.error('❌ Error:', error);
    console.error('\nDetails:', JSON.stringify(error, null, 2));
  } else {
    console.log('✅ Success!');
    console.log('Result:', data);
  }
}

testFunction().catch(console.error);
