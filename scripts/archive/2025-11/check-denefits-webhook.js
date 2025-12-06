require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const email = 'oghowoodson@gmail.com';

(async () => {
  console.log(`\nSearching for webhook and payment data for: ${email}\n`);

  // Check webhook logs for this email
  const { data: logs, error: logsError } = await supabase
    .from('webhook_logs')
    .select('*')
    .eq('source', 'denefits')
    .order('created_at', { ascending: false })
    .limit(20);

  console.log('=== ALL RECENT DENEFITS WEBHOOK LOGS ===');
  if (logsError) {
    console.error('Error:', logsError);
  } else if (logs && logs.length > 0) {
    console.log(`Found ${logs.length} recent Denefits webhooks\n`);

    // Filter logs that contain this email
    const matchingLogs = logs.filter(log => {
      const payload = log.payload;
      if (Array.isArray(payload) && payload.length > 0) {
        const contract = payload[0]?.data?.contract;
        return contract?.customer_email?.toLowerCase() === email.toLowerCase();
      }
      return false;
    });

    if (matchingLogs.length > 0) {
      console.log(`✅ Found ${matchingLogs.length} webhook(s) for ${email}:`);
      matchingLogs.forEach(log => {
        console.log('\nLog ID:', log.id);
        console.log('Created:', log.created_at);
        console.log('Status:', log.status);
        console.log('Event Type:', log.event_type);
        if (log.error_message) {
          console.log('Error:', log.error_message);
        }

        // Extract contract details
        const payload = Array.isArray(log.payload) ? log.payload[0] : log.payload;
        const contract = payload?.data?.contract || payload;
        if (contract) {
          console.log('Contract ID:', contract.contract_id);
          console.log('Contract Code:', contract.contract_code);
          console.log('Amount:', contract.financed_amount);
          console.log('Customer:', `${contract.customer_first_name} ${contract.customer_last_name}`);
          console.log('Email:', contract.customer_email);
        }
      });
    } else {
      console.log(`❌ No webhooks found for ${email} in recent logs`);
      console.log('\nShowing sample of recent webhooks:');
      logs.slice(0, 3).forEach(log => {
        const payload = Array.isArray(log.payload) ? log.payload[0] : log.payload;
        const contract = payload?.data?.contract || payload;
        console.log(`- ${log.created_at}: ${contract?.customer_email || 'no email'}`);
      });
    }
  } else {
    console.log('No Denefits webhook logs found at all');
  }

  // Check payments table
  const { data: payments, error: paymentsError } = await supabase
    .from('payments')
    .select('*')
    .ilike('customer_email', email);

  console.log('\n=== PAYMENTS TABLE ===');
  if (paymentsError) {
    console.error('Error:', paymentsError);
  } else if (payments && payments.length > 0) {
    console.log(`✅ Found ${payments.length} payment(s) for ${email}`);
    payments.forEach(p => {
      console.log('\nPayment ID:', p.id);
      console.log('Amount:', p.amount);
      console.log('Source:', p.payment_source);
      console.log('Type:', p.payment_type);
      console.log('Contact ID:', p.contact_id || 'ORPHAN');
      console.log('Contract Code:', p.denefits_contract_code);
      console.log('Created:', p.created_at);
    });
  } else {
    console.log(`❌ No payments found for ${email}`);
  }

  // Check contacts table
  const { data: contacts, error: contactsError } = await supabase
    .from('contacts')
    .select('*')
    .or(`email_primary.ilike.${email},email_booking.ilike.${email},email_payment.ilike.${email}`);

  console.log('\n=== CONTACTS TABLE ===');
  if (contactsError) {
    console.error('Error:', contactsError);
  } else if (contacts && contacts.length > 0) {
    console.log(`✅ Found ${contacts.length} contact(s) with this email`);
    contacts.forEach(c => {
      console.log('\nContact ID:', c.id);
      console.log('Name:', c.first_name, c.last_name);
      console.log('Email Primary:', c.email_primary);
      console.log('Email Booking:', c.email_booking);
      console.log('Email Payment:', c.email_payment);
      console.log('Stage:', c.stage);
      console.log('Purchase Date:', c.purchase_date);
      console.log('Purchase Amount:', c.purchase_amount);
    });
  } else {
    console.log(`❌ No contacts found for ${email}`);
  }

  // Test the find_contact_by_email function
  console.log('\n=== TESTING find_contact_by_email FUNCTION ===');
  const { data: contactId, error: rpcError } = await supabase
    .rpc('find_contact_by_email', { search_email: email.toLowerCase().trim() });

  if (rpcError) {
    console.error('❌ RPC Error:', rpcError);
  } else if (contactId) {
    console.log('✅ Function returned contact ID:', contactId);
  } else {
    console.log('❌ Function returned NULL (no contact found)');
  }

  console.log('\n');
})();
