#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

(async () => {
  console.log('🔍 INVESTIGATING LINK_CLICKED WEBHOOK PROCESSING');
  console.log('═'.repeat(70));
  console.log();

  // Get recent link_clicked webhooks
  const { data: linkClickedLogs } = await supabase
    .from('webhook_logs')
    .select('*')
    .eq('source', 'manychat')
    .eq('event_type', 'link_clicked')
    .order('created_at', { ascending: false })
    .limit(10);

  console.log('Total link_clicked webhooks found:', linkClickedLogs?.length || 0);
  console.log();

  if (!linkClickedLogs || linkClickedLogs.length === 0) {
    console.log('❌ NO link_clicked webhooks found!');
    console.log('   Check ManyChat automation is firing link_clicked events');
    return;
  }

  // Analyze each webhook
  for (const log of linkClickedLogs) {
    console.log('─'.repeat(70));
    console.log('Webhook:', log.created_at);
    console.log('Status:', log.status);
    console.log('MC_ID:', log.mc_id);
    console.log('Contact ID:', log.contact_id || 'NULL');

    if (log.error_message) {
      console.log('ERROR:', log.error_message);
    }

    // Check if contact exists with this mc_id
    if (log.mc_id) {
      const { data: contact } = await supabase
        .from('contacts')
        .select('id, first_name, last_name, email_primary, link_click_date, link_send_date')
        .eq('mc_id', log.mc_id)
        .single();

      if (contact) {
        console.log('Contact Found:', contact.first_name, contact.last_name);
        console.log('  Email:', contact.email_primary);
        console.log('  link_send_date:', contact.link_send_date || 'NULL');
        console.log('  link_click_date:', contact.link_click_date || 'NULL');

        if (!contact.link_click_date) {
          console.log('  ⚠️  CONTACT EXISTS BUT link_click_date IS NULL!');
          console.log('  → Webhook processed but contact NOT updated');
        } else {
          console.log('  ✅ Contact has link_click_date');
        }
      } else {
        console.log('❌ NO CONTACT FOUND with mc_id:', log.mc_id);
        console.log('  → Contact was never created or mc_id mismatch');
      }
    }
    console.log();
  }

  // Check if contacts have link_click_date but no webhook log
  console.log('═'.repeat(70));
  console.log('CONTACTS WITH link_click_date (checking webhook logs):');
  console.log('═'.repeat(70));

  const { data: contactsWithClicks } = await supabase
    .from('contacts')
    .select('id, mc_id, first_name, last_name, link_click_date')
    .not('link_click_date', 'is', null)
    .order('link_click_date', { ascending: false })
    .limit(10);

  console.log('Total contacts with link_click_date:', contactsWithClicks?.length || 0);
  console.log();

  if (contactsWithClicks) {
    for (const contact of contactsWithClicks) {
      const { data: webhookLog } = await supabase
        .from('webhook_logs')
        .select('*')
        .eq('source', 'manychat')
        .eq('event_type', 'link_clicked')
        .eq('mc_id', contact.mc_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      console.log(contact.first_name, contact.last_name);
      console.log('  MC_ID:', contact.mc_id);
      console.log('  Click Date:', contact.link_click_date);
      console.log('  Webhook Log:', webhookLog ? 'Found' : 'NOT FOUND');
      console.log();
    }
  }

  // Summary
  console.log('═'.repeat(70));
  console.log('SUMMARY:');
  console.log('═'.repeat(70));

  const processedCount = linkClickedLogs.filter(l => l.status === 'processed').length;
  const errorCount = linkClickedLogs.filter(l => l.status === 'error').length;

  console.log('Total link_clicked webhooks (last 10):', linkClickedLogs.length);
  console.log('  Processed:', processedCount);
  console.log('  Error:', errorCount);
  console.log('  Received:', linkClickedLogs.length - processedCount - errorCount);
  console.log();
  console.log('Contacts with link_click_date:', contactsWithClicks?.length || 0);
  console.log('Expected: webhook count ≈ contacts with date');
})();
