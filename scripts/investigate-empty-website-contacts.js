const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function investigateEmptyContacts() {
  const emptyGhlIds = [
    '0YP6asSYCMLlyinqFWtN',
    '0FEUUUCAK3Qs7N499qi9', 
    '0PTqKYahCzx8sWrq7u5A',
    '45nQ1C9N5dJVPJtc8f46'
  ];
  
  console.log('🔍 Investigating 4 contacts with NO data...\n');
  
  for (const ghlId of emptyGhlIds) {
    console.log('='.repeat(60));
    console.log(`GHL ID: ${ghlId}\n`);
    
    // Get webhook logs for this GHL ID
    const { data: logs } = await supabase
      .from('webhook_logs')
      .select('*')
      .eq('source', 'ghl')
      .eq('ghl_id', ghlId)
      .order('created_at', { ascending: true });
      
    if (!logs || logs.length === 0) {
      console.log('❌ No webhook logs found\n');
      continue;
    }
    
    console.log(`Found ${logs.length} webhook(s):\n`);
    
    logs.forEach((log, i) => {
      console.log(`Webhook ${i + 1}:`);
      console.log(`  Created: ${log.created_at}`);
      console.log(`  Event Type: ${log.event_type}`);
      console.log(`  Status: ${log.status}`);
      
      // Parse payload
      const payload = log.payload;
      const customData = payload.customData || {};
      
      console.log('  Payload Data:');
      console.log(`    body.email: ${payload.email || 'MISSING'}`);
      console.log(`    body.phone: ${payload.phone || 'MISSING'}`);
      console.log(`    body.first_name: ${payload.first_name || 'MISSING'}`);
      console.log(`    body.last_name: ${payload.last_name || 'MISSING'}`);
      console.log(`    customData.email: ${customData.email || 'MISSING'}`);
      console.log(`    customData.phone: ${customData.phone || 'MISSING'}`);
      console.log(`    customData.first_name: ${customData.first_name || 'MISSING'}`);
      console.log(`    customData.last_name: ${customData.last_name || 'MISSING'}`);
      console.log('');
    });
  }
}

investigateEmptyContacts().catch(console.error);
