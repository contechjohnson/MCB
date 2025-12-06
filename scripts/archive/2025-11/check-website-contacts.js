const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function checkWebsiteContacts() {
  console.log('🔍 Checking contacts with source = website...\n');
  
  // Get contacts from website
  const { data: websiteContacts, error } = await supabase
    .from('contacts')
    .select('*')
    .eq('source', 'website')
    .order('created_at', { ascending: false })
    .limit(20);
    
  if (error) {
    console.log('❌ Error:', error);
    return;
  }
  
  console.log(`Total contacts with source='website': ${websiteContacts ? websiteContacts.length : 0}\n`);
  
  if (!websiteContacts || websiteContacts.length === 0) {
    console.log('No website contacts found\n');
    
    // Check all sources
    const { data: allContacts } = await supabase
      .from('contacts')
      .select('source')
      .limit(1000);
      
    const sourceCounts = {};
    allContacts?.forEach(c => {
      const src = c.source || 'null';
      sourceCounts[src] = (sourceCounts[src] || 0) + 1;
    });
    
    console.log('📊 Contact sources (sampling last 1000):\n');
    Object.entries(sourceCounts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([source, count]) => {
        console.log(`  ${source}: ${count}`);
      });
      
    return;
  }
  
  // Show recent website contacts
  console.log('='.repeat(60));
  websiteContacts.forEach((c, i) => {
    console.log(`\nContact ${i + 1}:`);
    console.log(`  ID: ${c.id}`);
    console.log(`  Name: ${c.first_name} ${c.last_name}`);
    console.log(`  Email Primary: ${c.email_primary || 'MISSING'}`);
    console.log(`  Email Booking: ${c.email_booking || 'none'}`);
    console.log(`  Phone: ${c.phone || 'MISSING'}`);
    console.log(`  Stage: ${c.stage}`);
    console.log(`  GHL ID: ${c.ghl_id || 'none'}`);
    console.log(`  MC ID: ${c.mc_id || 'none'}`);
    console.log(`  Created: ${c.created_at}`);
    
    // Check if this contact has any data
    const hasData = c.email_primary || c.email_booking || c.phone || c.first_name;
    if (!hasData) {
      console.log('  ⚠️  NO CONTACT INFO');
    }
  });
}

checkWebsiteContacts().catch(console.error);
