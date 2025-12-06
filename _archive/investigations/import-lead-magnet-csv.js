require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function importLeadMagnetCSV() {
  console.log('=== IMPORTING LEAD MAGNET CSV ===\n');

  // Read CSV
  const csv = fs.readFileSync('/Users/connorjohnson/Downloads/Export-2025-11-21 19_20_08.csv', 'utf8');
  const lines = csv.split('\n');
  const headers = lines[0].split(',');

  // Find column indexes
  const getIndex = (name) => headers.indexOf(name);
  const emailIdx = getIndex('email');
  const firstnameIdx = getIndex('firstname');
  const phoneIdx = getIndex('phone');
  const createdIdx = getIndex('created_at');
  const adIdIdx = getIndex('ad_id');
  const resultIdx = getIndex('ps_result_page');

  console.log('Parsing CSV...');

  // Parse rows
  const leads = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;

    // Simple CSV parsing
    const row = lines[i].match(/(?:"([^"]*(?:""[^"]*)*)"|([^,]+))/g) || [];
    const cleanValue = (idx) => row[idx]?.replace(/^"|"$/g, '').trim() || null;

    const email = cleanValue(emailIdx)?.toLowerCase();
    if (!email || !email.includes('@')) continue;

    leads.push({
      email_primary: email,
      first_name: cleanValue(firstnameIdx),
      phone: cleanValue(phoneIdx),
      created_at: cleanValue(createdIdx),
      ad_id: cleanValue(adIdIdx),
      qualification_result: cleanValue(resultIdx),
      source: 'instagram_lm',
      stage: 'form_submitted'
    });
  }

  console.log(`Parsed ${leads.length} leads from CSV\n`);

  // Get existing emails to avoid duplicates
  const { data: existingContacts } = await supabase
    .from('contacts')
    .select('email_primary');

  const existingEmails = new Set(
    existingContacts?.map(c => c.email_primary?.toLowerCase()) || []
  );

  console.log(`Existing contacts in DB: ${existingEmails.size}`);

  // Filter out duplicates
  const newLeads = leads.filter(l => !existingEmails.has(l.email_primary));
  const duplicates = leads.length - newLeads.length;

  console.log(`New leads to import: ${newLeads.length}`);
  console.log(`Duplicates skipped: ${duplicates}\n`);

  if (newLeads.length === 0) {
    console.log('No new leads to import!');
    return;
  }

  // Import in batches of 100
  const batchSize = 100;
  let imported = 0;
  let errors = 0;

  for (let i = 0; i < newLeads.length; i += batchSize) {
    const batch = newLeads.slice(i, i + batchSize);

    const insertData = batch.map(lead => ({
      email_primary: lead.email_primary,
      first_name: lead.first_name,
      phone: lead.phone,
      ad_id: lead.ad_id,
      source: 'instagram_lm',
      stage: 'form_submitted',
      subscribe_date: lead.created_at ? new Date(lead.created_at).toISOString() : new Date().toISOString()
    }));

    const { data, error } = await supabase
      .from('contacts')
      .insert(insertData);

    if (error) {
      console.error(`Batch ${Math.floor(i / batchSize) + 1} error:`, error.message);
      errors += batch.length;
    } else {
      imported += batch.length;
      process.stdout.write(`Imported: ${imported}/${newLeads.length}\r`);
    }
  }

  console.log(`\n\n=== IMPORT COMPLETE ===`);
  console.log(`Successfully imported: ${imported}`);
  console.log(`Errors: ${errors}`);
  console.log(`Duplicates skipped: ${duplicates}`);
  console.log(`Total in CSV: ${leads.length}`);
}

importLeadMagnetCSV().catch(console.error);
