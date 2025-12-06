require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixOrphanPayments() {
  console.log('Fixing orphan payments...\n');

  // Rachel Barton - Denefits
  const rachelContactId = '96e3e84b-3574-4c03-840f-bfb54f9ed031';
  const rachelPaymentId = '12d18a76-3c20-446a-b33a-b87e8b162038';

  // Irma Vazquez - Stripe
  const irmaContactId = '53484781-aa08-4e88-b823-22e8aed94469';
  const irmaPaymentId = '533fbdfb-5587-48cf-811a-f01c46a72da8';

  // Fix Rachel's payment
  const { data: rachelPayment, error: rachelPaymentError } = await supabase
    .from('payments')
    .update({ contact_id: rachelContactId })
    .eq('id', rachelPaymentId)
    .select();

  if (rachelPaymentError) {
    console.error('Error updating Rachel payment:', rachelPaymentError);
  } else {
    console.log('✓ Rachel Barton payment linked to contact');
  }

  // Update Rachel's contact with purchase info
  const { data: rachelContact, error: rachelContactError } = await supabase
    .from('contacts')
    .update({
      purchase_date: '2025-11-18T03:15:32+00:00',
      purchase_amount: 2475,
      stage: 'purchased',
      email_payment: 'rachel.hatton95@gmail.com'
    })
    .eq('id', rachelContactId)
    .select();

  if (rachelContactError) {
    console.error('Error updating Rachel contact:', rachelContactError);
  } else {
    console.log('✓ Rachel Barton contact updated with purchase info');
  }

  // Fix Irma's payment
  const { data: irmaPayment, error: irmaPaymentError } = await supabase
    .from('payments')
    .update({ contact_id: irmaContactId })
    .eq('id', irmaPaymentId)
    .select();

  if (irmaPaymentError) {
    console.error('Error updating Irma payment:', irmaPaymentError);
  } else {
    console.log('✓ Irma Vazquez payment linked to contact');
  }

  // Update Irma's contact with purchase info
  const { data: irmaContact, error: irmaContactError } = await supabase
    .from('contacts')
    .update({
      purchase_date: '2025-11-18T16:42:19+00:00',
      purchase_amount: 747,
      stage: 'purchased',
      email_payment: 'vazquez.i.irma@gmail.com'
    })
    .eq('id', irmaContactId)
    .select();

  if (irmaContactError) {
    console.error('Error updating Irma contact:', irmaContactError);
  } else {
    console.log('✓ Irma Vazquez contact updated with purchase info');
  }

  console.log('\n=== Summary ===');
  console.log('Rachel Barton: $2,475 (Denefits) - FIXED');
  console.log('Irma Vazquez: $747 (Stripe) - FIXED');
  console.log('Total revenue attributed: $3,222');
}

fixOrphanPayments().catch(console.error);
