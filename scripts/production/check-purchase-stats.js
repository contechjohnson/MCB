require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  // Get unique contact_ids from payments
  const { data: payments } = await supabase
    .from('payments')
    .select('contact_id')
    .not('contact_id', 'is', null);

  const uniqueContactIds = [...new Set(payments.map(p => p.contact_id))];
  console.log('Unique contacts with payments:', uniqueContactIds.length);

  // Check those contacts
  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, name, email_primary, purchase_date, purchase_amount, stage')
    .in('id', uniqueContactIds);

  console.log('Contacts found:', contacts?.length);

  const withPurchase = contacts?.filter(c => c.purchase_date) || [];
  const withoutPurchase = contacts?.filter(c => !c.purchase_date) || [];

  console.log('With purchase_date:', withPurchase.length);
  console.log('Without purchase_date:', withoutPurchase.length);

  if (withoutPurchase.length > 0) {
    console.log('\nContacts missing purchase_date:');
    withoutPurchase.slice(0, 5).forEach(c => {
      console.log('  -', c.name || c.email_primary, '| stage:', c.stage);
    });
  }

  // Also check: how many contacts have purchase_date in general?
  const { count: totalWithPurchase } = await supabase
    .from('contacts')
    .select('*', { count: 'exact', head: true })
    .not('purchase_date', 'is', null);

  const { count: totalContacts } = await supabase
    .from('contacts')
    .select('*', { count: 'exact', head: true })
    .neq('source', 'instagram_historical');

  console.log('\nOverall stats:');
  console.log('Total active contacts:', totalContacts);
  console.log('Contacts with purchase_date:', totalWithPurchase);
}
check();
