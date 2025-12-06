#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

(async () => {
  // Get contacts from last 30 days (excluding historical)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: contacts } = await supabase
    .from('contacts')
    .select('*')
    .gte('created_at', thirtyDaysAgo.toISOString())
    .neq('source', 'instagram_historical')
    .order('created_at', { ascending: false });

  console.log('🔗 LINK TRACKING - LAST 30 DAYS');
  console.log('════════════════════════════════════════════════════════════');
  console.log();

  const total = contacts.length;
  const hasLinkSend = contacts.filter(c => c.link_send_date).length;
  const hasLinkClick = contacts.filter(c => c.link_click_date).length;
  const dmQualified = contacts.filter(c => c.dm_qualified_date).length;
  const formSubmitted = contacts.filter(c => c.form_submit_date).length;

  console.log('Total Contacts:    ', total);
  console.log('DM Qualified:      ', dmQualified, `(${Math.round(dmQualified/total*100)}%)`);
  console.log('Link Sent:         ', hasLinkSend, `(${Math.round(hasLinkSend/total*100)}%)`);
  console.log('Link Clicked:      ', hasLinkClick, `(${Math.round(hasLinkClick/total*100)}%)`);
  console.log('Form Submitted:    ', formSubmitted, `(${Math.round(formSubmitted/total*100)}%)`);
  console.log();

  // The problem: DM qualified but no link send
  const qualifiedNoLink = contacts.filter(c => c.dm_qualified_date && !c.link_send_date);
  console.log('⚠️  DM Qualified but NO Link Send:', qualifiedNoLink.length);
  console.log('   (These should have gotten a link sent)');
  console.log();

  // Link sent but not clicked
  const sentNotClicked = contacts.filter(c => c.link_send_date && !c.link_click_date);
  console.log('📤 Link Sent but NOT Clicked:', sentNotClicked.length);
  console.log('   (Sent link, waiting for click)');
  console.log();

  // Clicked but no form submit
  const clickedNoForm = contacts.filter(c => c.link_click_date && !c.form_submit_date);
  console.log('🖱️  Link Clicked but NO Form Submit:', clickedNoForm.length);
  console.log('   (Clicked but didnt complete form)');
  console.log();

  // Form submitted without link click (direct website traffic?)
  const formNoClick = contacts.filter(c => c.form_submit_date && !c.link_click_date);
  console.log('🌐 Form Submitted WITHOUT Link Click:', formNoClick.length);
  console.log('   (Direct website traffic or tracking gap)');
  console.log();

  console.log('════════════════════════════════════════════════════════════');
  console.log('FUNNEL FLOW:');
  console.log('════════════════════════════════════════════════════════════');
  console.log();
  console.log('New Contact       →', total);
  console.log('  ↓ DM Qualified  →', dmQualified, `(${Math.round(dmQualified/total*100)}%)`);
  console.log('  ↓ Link Sent     →', hasLinkSend, `(${Math.round(hasLinkSend/dmQualified*100)}% of qualified)`);
  console.log('  ↓ Link Clicked  →', hasLinkClick, hasLinkSend > 0 ? `(${Math.round(hasLinkClick/hasLinkSend*100)}% of sent)` : '(N/A)');
  console.log('  ↓ Form Submit   →', formSubmitted, `(${Math.round(formSubmitted/total*100)}% of total)`);
  console.log();

  // Check webhook logs for link events
  console.log('════════════════════════════════════════════════════════════');
  console.log('WEBHOOK LOG CHECK:');
  console.log('════════════════════════════════════════════════════════════');

  const { data: allManychatLogs, count: totalLogs } = await supabase
    .from('webhook_logs')
    .select('event_type', { count: 'exact' })
    .eq('source', 'manychat')
    .gte('created_at', thirtyDaysAgo.toISOString());

  console.log('Total ManyChat webhooks (last 30 days):', totalLogs || 0);
  console.log();

  // Get unique event types
  const eventTypes = {};
  if (allManychatLogs) {
    allManychatLogs.forEach(log => {
      eventTypes[log.event_type] = (eventTypes[log.event_type] || 0) + 1;
    });
  }

  console.log('Event Type Breakdown:');
  Object.entries(eventTypes)
    .sort((a, b) => b[1] - a[1])
    .forEach(([type, count]) => {
      const marker = type.includes('link') ? '🔗' : '  ';
      console.log(`  ${marker} ${type}: ${count}`);
    });
  console.log();

  // When did link tracking start?
  const { data: firstLinkSend } = await supabase
    .from('contacts')
    .select('link_send_date')
    .not('link_send_date', 'is', null)
    .order('link_send_date', { ascending: true })
    .limit(1)
    .single();

  const { data: firstLinkClick } = await supabase
    .from('contacts')
    .select('link_click_date')
    .not('link_click_date', 'is', null)
    .order('link_click_date', { ascending: true })
    .limit(1)
    .single();

  console.log('════════════════════════════════════════════════════════════');
  console.log('TRACKING START DATES:');
  console.log('════════════════════════════════════════════════════════════');
  console.log('First link_send_date:', firstLinkSend?.link_send_date || 'NONE');
  console.log('First link_click_date:', firstLinkClick?.link_click_date || 'NONE');
  console.log();

  console.log('💡 DIAGNOSIS:');
  console.log('════════════════════════════════════════════════════════════');

  if (hasLinkSend === 0 && hasLinkClick === 0) {
    console.log('❌ NO LINK TRACKING DATA AT ALL');
    console.log('   → Link webhooks are not firing or not being processed');
    console.log('   → Check ManyChat webhook configuration');
  } else if (hasLinkSend > 0 && hasLinkClick < 10) {
    console.log('⚠️  Link sends tracked but very few clicks');
    console.log('   → Link tracking started recently?');
    console.log('   → Check when tracking began:', firstLinkSend?.link_send_date);
  } else if (qualifiedNoLink.length > 400) {
    console.log('⚠️  Most DM qualified contacts have NO link_send_date');
    console.log('   → Link send tracking started after Nov 5?');
    console.log('   → Historical contacts qualified before tracking began');
  }

  if (formNoClick.length > 100) {
    console.log('🌐 Many form submits WITHOUT link clicks');
    console.log('   → Direct website traffic bypassing DM flow');
    console.log('   → Or link click tracking not capturing all clicks');
  }
})();
