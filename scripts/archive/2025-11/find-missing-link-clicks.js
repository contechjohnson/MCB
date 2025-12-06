#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

(async () => {
  console.log('🚨 CRITICAL INVESTIGATION: MISSING LINK CLICKS');
  console.log('═'.repeat(70));
  console.log();

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: contacts } = await supabase
    .from('contacts')
    .select('*')
    .gte('created_at', thirtyDaysAgo.toISOString())
    .neq('source', 'instagram_historical');

  // People who got link sent AND submitted form, but NO link click
  const linkSentFormSubmittedNoClick = contacts.filter(c =>
    c.link_send_date &&
    c.form_submit_date &&
    !c.link_click_date
  );

  console.log('SMOKING GUN:');
  console.log('─'.repeat(70));
  console.log('Contacts who:');
  console.log('  ✅ Got link sent (link_send_date)');
  console.log('  ✅ Submitted form (form_submit_date)');
  console.log('  ❌ NO link click tracked (link_click_date = NULL)');
  console.log();
  console.log('Total:', linkSentFormSubmittedNoClick.length);
  console.log();

  if (linkSentFormSubmittedNoClick.length > 0) {
    console.log('🚨 This means ManyChat link_clicked webhook is BROKEN!');
    console.log('   They HAD to click the link to get to the form.');
    console.log('   But webhook never fired or failed to process.');
    console.log();

    console.log('Recent Examples:');
    console.log('─'.repeat(70));

    linkSentFormSubmittedNoClick.slice(0, 10).forEach(c => {
      console.log('Name:', c.first_name, c.last_name);
      console.log('  MC_ID:', c.mc_id);
      console.log('  Link Sent:', c.link_send_date?.split('T')[0]);
      console.log('  Form Submit:', c.form_submit_date?.split('T')[0]);
      console.log('  Link Click:', c.link_click_date || '❌ NULL');
      console.log();
    });
  }

  // Also check: people with form submit but NO link send (different entry point?)
  const formSubmitNoLinkSend = contacts.filter(c =>
    c.form_submit_date &&
    !c.link_send_date
  );

  console.log('═'.repeat(70));
  console.log('ALTERNATIVE ENTRY POINTS:');
  console.log('─'.repeat(70));
  console.log('Contacts who submitted form WITHOUT ever getting link sent:');
  console.log('Total:', formSubmitNoLinkSend.length);
  console.log();

  if (formSubmitNoLinkSend.length > 0) {
    console.log('These people found the form another way:');
    console.log('  - Instagram bio link?');
    console.log('  - Website navigation?');
    console.log('  - Direct URL?');
    console.log('  - Google search?');
    console.log();

    console.log('Recent Examples (check source):');
    console.log('─'.repeat(70));

    formSubmitNoLinkSend.slice(0, 10).forEach(c => {
      console.log('Name:', c.first_name, c.last_name);
      console.log('  Source:', c.source);
      console.log('  MC_ID:', c.mc_id || 'NULL');
      console.log('  GHL_ID:', c.ghl_id || 'NULL');
      console.log('  Form Submit:', c.form_submit_date?.split('T')[0]);
      console.log();
    });
  }

  console.log('═'.repeat(70));
  console.log('CONCLUSION:');
  console.log('═'.repeat(70));

  if (linkSentFormSubmittedNoClick.length > 100) {
    console.log('🚨 MAJOR ISSUE: ManyChat link_clicked webhook is broken!');
    console.log('   Expected: ~' + (linkSentFormSubmittedNoClick.length + 28) + ' link clicks');
    console.log('   Actual: 28 link clicks');
    console.log('   Missing: ~' + linkSentFormSubmittedNoClick.length + ' link clicks');
    console.log();
    console.log('🔧 FIX NEEDED:');
    console.log('   1. Check ManyChat automation for link_clicked trigger');
    console.log('   2. Verify webhook URL is correct');
    console.log('   3. Check if link tracking is enabled on the link');
  }

  if (formSubmitNoLinkSend.length > 50) {
    console.log();
    console.log('📊 Many form submits from alternative entry points');
    console.log('   This is normal if people can access form directly');
    console.log('   (Instagram bio, direct URL, Google search)');
  }
})();
