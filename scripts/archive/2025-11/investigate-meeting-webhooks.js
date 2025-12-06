#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function investigateMeetingWebhooks() {
  const startStr = '2025-11-13';
  const endStr = '2025-11-20';

  console.log('=== INVESTIGATING WEBHOOK PROCESSING ISSUE ===\n');

  // Get meeting_attended events
  const { data: logs } = await supabase
    .from('webhook_logs')
    .select('*')
    .eq('source', 'ghl')
    .gte('created_at', startStr)
    .lt('created_at', endStr)
    .order('created_at', { ascending: true });

  const meetingLogs = logs.filter(log => {
    const payload = log.payload || {};
    const customData = payload.customData || {};
    const stage = (customData.pipeline_stage || '').toLowerCase();
    return stage === 'meeting_attended';
  });

  console.log('Total meeting_attended webhooks:', meetingLogs.length);

  // Check how many have contact_id (were successfully linked)
  const linked = meetingLogs.filter(log => log.contact_id);
  const unlinked = meetingLogs.filter(log => !log.contact_id);

  console.log('Successfully linked to contact:', linked.length);
  console.log('Failed to link (no contact_id):', unlinked.length);

  // Check for errors
  const withErrors = meetingLogs.filter(log => log.error_message);
  console.log('Webhooks with errors:', withErrors.length);

  if (withErrors.length > 0) {
    console.log('\nSample error messages:');
    withErrors.slice(0, 3).forEach(log => {
      console.log('Error:', log.error_message);
      console.log('Email:', log.payload?.email || log.payload?.customData?.email);
      console.log('---');
    });
  }

  // Get unique emails from meeting_attended events
  const uniqueEmails = new Set();
  meetingLogs.forEach(log => {
    const email = (log.payload?.email || log.payload?.customData?.email || '').toLowerCase().trim();
    if (email) uniqueEmails.add(email);
  });

  console.log('\nUnique emails with meeting_attended events:', uniqueEmails.size);

  // Check if these contacts exist in database
  const emails = Array.from(uniqueEmails).filter(e => e);
  console.log('Checking contacts for', emails.length, 'unique emails...\n');

  let totalFound = 0;
  let withAppointmentDate = 0;

  for (const email of emails) { // Check all emails
    const { data: contact } = await supabase
      .from('contacts')
      .select('id, email_primary, email_booking, appointment_held_date, stage, first_name, last_name')
      .or(`email_primary.ilike.${email},email_booking.ilike.${email}`)
      .limit(1)
      .single();

    if (contact) {
      totalFound++;
      if (contact.appointment_held_date) {
        withAppointmentDate++;
        console.log('✓ Found with date:', contact.first_name, contact.last_name, '- Date:', contact.appointment_held_date);
      } else {
        console.log('✗ Found WITHOUT date:', contact.first_name, contact.last_name, '- Stage:', contact.stage);
      }
    }
  }

  console.log('\n=== SUMMARY ===');
  console.log('Webhooks received: 86 meeting_attended events');
  console.log('Unique emails:', emails.length);
  console.log('Contacts found:', totalFound);
  console.log('With appointment_held_date:', withAppointmentDate);
  console.log('Missing appointment_held_date:', totalFound - withAppointmentDate);

  const percentageUpdated = (withAppointmentDate / totalFound * 100).toFixed(1);
  console.log('\nUpdate rate:', percentageUpdated + '%');

  if (withAppointmentDate < totalFound) {
    console.log('\n⚠️  Some contacts received meeting_attended webhooks but appointment_held_date was NOT set!');
  } else {
    console.log('\n✓ All found contacts have appointment_held_date set correctly!');
  }
}

investigateMeetingWebhooks().catch(console.error);
