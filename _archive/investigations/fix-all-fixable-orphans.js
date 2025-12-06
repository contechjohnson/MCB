require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixAllFixableOrphans() {
  console.log('=== FIXING ALL FIXABLE ORPHAN PAYMENTS ===\n');

  const fixes = [
    {
      name: 'Kim Linares',
      email: 'kimberlylinares41@yahoo.com',
      contactId: 'cc917f49-abdd-4182-baf1-cc2b46f69401',
      paymentId: 'ef91e187-952c-4e82-8289-ed80f0630bcd',
      amount: 1897,
      paymentDate: '2025-11-20T23:37:58+00:00'
    },
    {
      name: 'Desirae Lara',
      email: 'dslara315@gmail.com',
      contactId: 'f36ae26d-02cf-4394-a783-72dbe1c290a9',
      paymentId: '6f69b2db-55ff-4e13-ba18-6ebaf5298ef8',
      amount: 3296,
      paymentDate: '2025-10-08T21:44:54+00:00'
    },
    {
      name: 'Kari Perry',
      email: 'k.inez.wilson@gmail.com',
      contactId: 'cc19e71e-9e1c-447b-a79a-3f17b400dc68',
      paymentId: 'bbb1f453-635f-48ec-bb21-5accfd1fad01',
      amount: 2997,
      paymentDate: '2025-08-16T12:56:04+00:00'
    }
  ];

  let totalFixed = 0;

  for (const fix of fixes) {
    console.log(`\n--- Fixing: ${fix.name} (${fix.email}) ---`);

    // 1. Link payment to contact
    const { error: paymentError } = await supabase
      .from('payments')
      .update({ contact_id: fix.contactId })
      .eq('id', fix.paymentId);

    if (paymentError) {
      console.error('❌ Error updating payment:', paymentError);
      continue;
    }

    console.log('✓ Payment linked to contact');

    // 2. Update contact with purchase info
    const { error: contactError } = await supabase
      .rpc('update_contact_dynamic', {
        contact_id: fix.contactId,
        update_data: {
          purchase_date: fix.paymentDate,
          purchase_amount: fix.amount,
          stage: 'purchased',
          email_payment: fix.email
        }
      });

    if (contactError) {
      console.error('❌ Error updating contact:', contactError);
      continue;
    }

    console.log('✓ Contact updated with purchase info');
    console.log(`  Purchase Date: ${fix.paymentDate}`);
    console.log(`  Purchase Amount: $${fix.amount}`);
    console.log(`  Stage: purchased`);

    totalFixed += fix.amount;
  }

  console.log('\n\n=== SUMMARY ===');
  console.log(`✅ Fixed ${fixes.length} orphan payments`);
  console.log(`💰 Total revenue recovered: $${totalFixed.toLocaleString()}`);
  console.log('');
  fixes.forEach(f => {
    console.log(`   ${f.name}: $${f.amount}`);
  });
}

fixAllFixableOrphans().catch(console.error);
