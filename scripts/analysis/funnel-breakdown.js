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

  console.log('📊 NEW CONTACTS - LAST 30 DAYS');
  console.log('(Excluding instagram_historical)');
  console.log('═'.repeat(60));
  console.log();

  // Overall counts
  const total = contacts.length;
  const dmQualified = contacts.filter(c => c.dm_qualified_date).length;
  const linkClicked = contacts.filter(c => c.link_click_date).length;
  const formSubmitted = contacts.filter(c => c.form_submit_date).length;
  const appointmentHeld = contacts.filter(c => c.appointment_held_date).length;
  const purchased = contacts.filter(c => c.purchase_date).length;

  console.log('TOTAL NEW CONTACTS:', total);
  console.log();
  console.log('Stage Breakdown:');
  console.log('─'.repeat(60));
  console.log('DM Qualified:      ', dmQualified.toString().padStart(4), `(${Math.round(dmQualified/total*100)}%)`);
  console.log('Link Clicked:      ', linkClicked.toString().padStart(4), `(${Math.round(linkClicked/total*100)}%)`);
  console.log('Form Submitted:    ', formSubmitted.toString().padStart(4), `(${Math.round(formSubmitted/total*100)}%)`);
  console.log('Appointment Held:  ', appointmentHeld.toString().padStart(4), `(${Math.round(appointmentHeld/total*100)}%)`);
  console.log('Purchased:         ', purchased.toString().padStart(4), `(${Math.round(purchased/total*100)}%)`);
  console.log();

  // Breakdown by date (last 14 days for readability)
  console.log('═'.repeat(60));
  console.log('DAILY BREAKDOWN (Last 14 Days):');
  console.log('═'.repeat(60));
  console.log();

  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  const recentContacts = contacts.filter(c => new Date(c.created_at) >= fourteenDaysAgo);

  // Group by date
  const byDate = {};
  recentContacts.forEach(c => {
    const date = c.created_at.split('T')[0];
    if (!byDate[date]) {
      byDate[date] = {
        total: 0,
        dmQualified: 0,
        linkClicked: 0,
        formSubmitted: 0,
        appointmentHeld: 0,
        purchased: 0
      };
    }
    byDate[date].total++;
    if (c.dm_qualified_date) byDate[date].dmQualified++;
    if (c.link_click_date) byDate[date].linkClicked++;
    if (c.form_submit_date) byDate[date].formSubmitted++;
    if (c.appointment_held_date) byDate[date].appointmentHeld++;
    if (c.purchase_date) byDate[date].purchased++;
  });

  const dates = Object.keys(byDate).sort().reverse();

  console.log('Date       | Total | DM Qual | Link Click | Form Submit | Appt Held | Purchased');
  console.log('─'.repeat(85));

  dates.forEach(date => {
    const d = byDate[date];
    console.log(
      date + ' | ' +
      d.total.toString().padStart(5) + ' | ' +
      d.dmQualified.toString().padStart(7) + ' | ' +
      d.linkClicked.toString().padStart(10) + ' | ' +
      d.formSubmitted.toString().padStart(11) + ' | ' +
      d.appointmentHeld.toString().padStart(9) + ' | ' +
      d.purchased.toString().padStart(9)
    );
  });

  console.log();
  console.log('═'.repeat(60));
})();
