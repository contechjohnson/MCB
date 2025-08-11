import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase admin client
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate test environment
    if (process.env.NODE_ENV === 'production' && !body.testKey?.includes('test_mode_')) {
      return NextResponse.json({ error: 'Test endpoint disabled in production' }, { status: 403 });
    }

    const { name, email, amount, matchToContact } = body;

    // Create a simulated Stripe event
    const eventId = `evt_test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const paymentDate = new Date().toISOString();

    // If matchToContact is provided, try to match
    let matchedContactId = null;
    let matchConfidence = 0;
    let matchMethod = 'not_matched';
    let status: 'matched' | 'orphaned' = 'orphaned';

    if (matchToContact) {
      // Try to find contact by email or name
      const { data: contacts } = await supabaseAdmin
        .from('contacts')
        .select('user_id, email_address, first_name, last_name')
        .or(`email_address.eq.${email},first_name.ilike.%${name?.split(' ')[0]}%`);

      if (contacts && contacts.length > 0) {
        matchedContactId = contacts[0].user_id;
        matchConfidence = email === contacts[0].email_address ? 100 : 85;
        matchMethod = email === contacts[0].email_address ? 'email' : 'name_fuzzy';
        status = 'matched';

        // Update the contact with purchase data
        const updateData: any = {
          total_purchased: amount / 100,
          updated_at: paymentDate,
        };

        // Track purchase dates based on amount
        if (amount <= 3000) { // $30 or less
          const { data: existing } = await supabaseAdmin
            .from('contacts')
            .select('first_purchase_date')
            .eq('user_id', matchedContactId)
            .single();

          if (!existing?.first_purchase_date) {
            updateData.first_purchase_date = paymentDate;
            updateData.first_purchase_amount = amount / 100;
          }

          if (amount === 2000) { // $20 discovery call
            updateData.attended = true;
          }
        }

        if (amount > 3000) { // Package purchase
          updateData.package_purchase_date = paymentDate;
          updateData.package_purchase_amount = amount / 100;
          updateData.bought_package = true;
          updateData.sent_package = true;
        }

        await supabaseAdmin
          .from('contacts')
          .update(updateData)
          .eq('user_id', matchedContactId);
      }
    }

    // Log the test payment
    const { error: logError } = await supabaseAdmin
      .from('stripe_webhook_logs')
      .insert({
        event_id: eventId,
        event_type: 'test.payment',
        amount: amount / 100,
        customer_email: email,
        customer_name: name,
        matched_contact_id: matchedContactId,
        match_confidence: matchConfidence,
        match_method: matchMethod,
        status: status,
        raw_event: {
          test: true,
          created_at: paymentDate,
          amount: amount,
          customer: { name, email }
        },
      });

    if (logError) {
      console.error('Failed to log test payment:', logError);
      return NextResponse.json({ error: 'Failed to log payment', details: logError }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      eventId,
      amount: amount / 100,
      status,
      matchedContactId,
      matchConfidence,
      message: status === 'matched' 
        ? `Payment matched to contact ${matchedContactId} with ${matchConfidence}% confidence`
        : 'Payment logged as orphaned (no matching contact)'
    });

  } catch (error: any) {
    console.error('Test payment error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}