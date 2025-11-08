const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function checkWebsiteWebhooks() {
  console.log('🔍 Checking website webhook logs...\n');
  
  // Get all website webhooks
  const { data: logs, error } = await supabase
    .from('webhook_logs')
    .select('*')
    .eq('source', 'website')
    .order('created_at', { ascending: false });
    
  if (error) {
    console.log('❌ Error:', error);
    return;
  }
  
  console.log(`Total website webhooks: ${logs ? logs.length : 0}\n`);
  
  if (!logs || logs.length === 0) {
    console.log('No website webhooks found');
    return;
  }
  
  // Show summary
  console.log('='.repeat(60));
  logs.forEach((log, i) => {
    console.log(`\nWebhook ${i + 1}:`);
    console.log(`  Created: ${log.created_at}`);
    console.log(`  Event Type: ${log.event_type || 'N/A'}`);
    console.log(`  Status: ${log.status}`);
    console.log(`  Error: ${log.error_message || 'none'}`);
    
    // Parse payload to see what data was sent
    try {
      const payload = typeof log.payload === 'string' ? JSON.parse(log.payload) : log.payload;
      console.log(`  Payload keys: ${Object.keys(payload).join(', ')}`);
      
      // Look for common contact fields
      const email = payload.email || payload.Email || payload.customer_email || payload.customerEmail;
      const name = payload.name || payload.Name || payload.first_name || payload.firstName;
      const phone = payload.phone || payload.Phone;
      
      console.log('  Contact Data:');
      console.log(`    Email: ${email || 'MISSING'}`);
      console.log(`    Name: ${name || 'MISSING'}`);
      console.log(`    Phone: ${phone || 'MISSING'}`);
      
      if (!email && !name && !phone) {
        console.log('  ⚠️  NO CONTACT INFO IN PAYLOAD');
      }
      
    } catch (e) {
      console.log('  Could not parse payload');
    }
  });
  
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 Checking if any contacts were created from website...\n');
  
  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, email_primary, first_name, last_name, source, created_at')
    .eq('source', 'website')
    .order('created_at', { ascending: false })
    .limit(10);
    
  console.log(`Contacts with source='website': ${contacts ? contacts.length : 0}\n`);
  
  if (contacts && contacts.length > 0) {
    contacts.forEach((c, i) => {
      console.log(`  ${i + 1}. ${c.first_name} ${c.last_name} - ${c.email_primary} (${c.created_at})`);
    });
  }
}

checkWebsiteWebhooks().catch(console.error);
