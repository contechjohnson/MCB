#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

// Get date range from args or default to last 7 days
const startDateArg = process.argv[2];
const endDateArg = process.argv[3];

let startDate, endDate;

if (startDateArg) {
  startDate = new Date(startDateArg);
  endDate = endDateArg ? new Date(endDateArg) : new Date();
} else {
  // Default: last 7 days
  endDate = new Date();
  startDate = new Date();
  startDate.setDate(startDate.getDate() - 7);
}

const startStr = startDate.toISOString().split('T')[0];
const endStr = endDate.toISOString().split('T')[0];

async function exportData() {
  console.log('📊 Exporting Weekly Data to CSV...');
  console.log(`   Date Range: ${startStr} to ${endStr}`);
  console.log();

  // Get all contacts with activity this week (excluding historical)
  const { data: contacts } = await supabase
    .from('contacts')
    .select('*')
    .neq('source', 'instagram_historical')
    .or(`created_at.gte.${startStr},dm_qualified_date.gte.${startStr},link_send_date.gte.${startStr},form_submit_date.gte.${startStr},appointment_held_date.gte.${startStr},purchase_date.gte.${startStr}`)
    .order('created_at', { ascending: false });

  console.log(`✅ Found ${contacts.length} contacts with activity this week`);
  console.log();

  // Define columns to include
  const columns = [
    'first_name',
    'last_name',
    'email_primary',
    'phone',
    'stage',
    'source',
    'ad_id',
    'chatbot_ab',
    'misc_ab',
    'trigger_word',
    'mc_id',
    'ghl_id',
    'thread_id',
    'subscribed',
    'subscribe_date',
    'dm_qualified_date',
    'link_send_date',
    'link_click_date',
    'form_submit_date',
    'appointment_date',
    'appointment_held_date',
    'package_sent_date',
    'checkout_started',
    'checkout_abandoned_date',
    'purchase_date',
    'purchase_amount',
    'q1_question',
    'q2_question',
    'objections'
  ];

  // Create CSV header
  const header = columns.join(',');

  // Create CSV rows
  const rows = contacts.map(contact => {
    return columns.map(col => {
      const value = contact[col];

      // Handle null/undefined
      if (value === null || value === undefined) return '';

      // Handle dates - convert to simple date string
      if (col.includes('date') || col === 'subscribed' || col === 'checkout_started') {
        if (!value) return '';
        const date = new Date(value);
        return date.toISOString().split('T')[0]; // YYYY-MM-DD
      }

      // Handle text fields that might contain commas or quotes
      if (typeof value === 'string') {
        // Escape quotes and wrap in quotes if contains comma, quote, or newline
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }

      return value;
    }).join(',');
  });

  // Combine header and rows
  const csv = [header, ...rows].join('\n');

  // Save to file
  const filename = `reports/weekly_data_${endStr}.csv`;
  fs.writeFileSync(filename, csv);

  console.log('✅ CSV Export Complete!');
  console.log(`   Saved to: ${filename}`);
  console.log();
  console.log('📊 Summary:');
  console.log(`   Total Contacts: ${contacts.length}`);
  console.log(`   Columns: ${columns.length}`);
  console.log();
  console.log('💡 To open in Google Sheets:');
  console.log('   1. Go to sheets.google.com');
  console.log('   2. File → Import → Upload');
  console.log(`   3. Select: ${filename}`);
  console.log();
}

exportData().catch(console.error);
