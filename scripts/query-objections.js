#!/usr/bin/env node
/**
 * Query all contacts with objections
 * 
 * Returns all contacts that have non-null objections field,
 * excluding historical data.
 */

const { createClient } = require('@supabase/supabase-js');

// Get environment variables (already set in system)
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('ERROR: Missing Supabase credentials.');
  console.error('SUPABASE_URL:', SUPABASE_URL ? 'Set' : 'Missing');
  console.error('SUPABASE_KEY:', SUPABASE_KEY ? 'Set' : 'Missing');
  process.exit(1);
}

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false }
});

async function main() {
  console.log('🔍 Querying all contacts with objections...\n');

  try {
    const { data, error } = await supabase
      .from('contacts')
      .select('id, first_name, email_primary, source, stage, objections, chatbot_ab, created_at')
      .not('objections', 'is', null)
      .neq('source', 'instagram_historical')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase error:', error);
      throw error;
    }

    if (!data || data.length === 0) {
      console.log('No contacts found with objections.');
      return;
    }

    console.log(`✅ Found ${data.length} contacts with objections\n`);
    console.log('='.repeat(100));
    
    // Output each contact's objections
    data.forEach((contact, index) => {
      console.log(`\n[${index + 1}/${data.length}] ${contact.first_name || 'Unknown'} (${contact.email_primary || 'No email'})`);
      console.log(`Source: ${contact.source} | Stage: ${contact.stage} | AB Test: ${contact.chatbot_ab || 'N/A'}`);
      console.log(`Created: ${new Date(contact.created_at).toLocaleDateString()}`);
      console.log(`\nOBJECTIONS:`);
      console.log(contact.objections);
      console.log('-'.repeat(100));
    });

    console.log(`\n📊 Summary: ${data.length} total contacts with objections\n`);

  } catch (error) {
    console.error(`❌ Error querying database: ${error.message}`);
    console.error('Full error:', error);
    process.exit(1);
  }
}

// Run main function
main().catch(error => {
  console.error(`❌ Fatal error: ${error.message}`);
  console.error('Stack:', error.stack);
  process.exit(1);
});
