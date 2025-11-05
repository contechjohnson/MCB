import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-11-20.acacia'
});

// Admin client for bypassing RLS
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

/**
 * Stripe Webhook Handler
 *
 * Handles payment events from Stripe:
 * - checkout.session.completed: Payment successful
 * - checkout.session.expired: Checkout abandoned
 * - charge.refunded: Refund processed
 *
 * Strategy: Match by email (checks all 3 email fields)
 * Updates purchase info on existing contacts
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      console.error('No Stripe signature found');
      return NextResponse.json({ error: 'No signature' }, { status: 400 });
    }

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET!
      );
    } catch (err) {
      console.error('Stripe signature verification failed:', err);
      return NextResponse.json({
        error: 'Invalid signature'
      }, { status: 400 });
    }

    console.log('Stripe webhook received:', {
      event: event.type,
      id: event.id,
      timestamp: new Date().toISOString()
    });

    // Log webhook
    await supabaseAdmin.from('webhook_logs').insert({
      source: 'stripe',
      event_type: event.type,
      payload: event,
      status: 'received'
    });

    // Check for duplicate events (using payments table)
    const { data: existingPayment } = await supabaseAdmin
      .from('payments')
      .select('id')
      .eq('payment_event_id', event.id)
      .single();

    if (existingPayment) {
      console.log('Duplicate Stripe event, skipping:', event.id);
      return NextResponse.json({ received: true, duplicate: true }, { status: 200 });
    }

    // Handle different event types
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event);
        break;

      case 'checkout.session.expired':
        await handleCheckoutExpired(event);
        break;

      case 'charge.refunded':
        await handleChargeRefunded(event);
        break;

      default:
        console.log('Unhandled Stripe event type:', event.type);
    }

    return NextResponse.json({ received: true }, { status: 200 });

  } catch (error) {
    console.error('Stripe webhook error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 200 }); // Always return 200 to prevent Stripe retries
  }
}

/**
 * GET handler for testing
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Stripe webhook endpoint is live',
    endpoints: {
      POST: 'Receives Stripe webhooks (requires signature)',
      events: ['checkout.session.completed', 'checkout.session.expired', 'charge.refunded']
    }
  });
}

/**
 * Handle successful checkout
 */
async function handleCheckoutCompleted(event: Stripe.Event) {
  const session = event.data.object as Stripe.Checkout.Session;

  const email = session.customer_email?.toLowerCase().trim();
  const amount = session.amount_total ? session.amount_total / 100 : 0; // Convert cents to dollars
  const customerId = session.customer as string;

  if (!email) {
    console.error('No email in checkout session');
    return;
  }

  // Find contact by email (checks all 3 email fields)
  const { data: contactId } = await supabaseAdmin
    .rpc('find_contact_by_email', { search_email: email });

  // Log payment (works for both matched and orphan payments)
  await supabaseAdmin.from('payments').insert({
    contact_id: contactId || null,  // NULL = orphan
    payment_event_id: event.id,
    payment_source: 'stripe',
    payment_type: 'buy_in_full',
    customer_email: email,
    customer_name: session.customer_details?.name || null,
    customer_phone: session.customer_details?.phone || null,
    amount: amount,
    currency: session.currency || 'usd',
    status: 'paid',
    payment_date: new Date(event.created * 1000).toISOString(),
    stripe_event_type: event.type,
    stripe_customer_id: customerId || null,
    stripe_session_id: session.id,
    raw_payload: event
  });

  if (!contactId) {
    console.warn('No contact found for email:', email, '- Payment logged as orphan');
    return;
  }

  // Update contact with purchase info (recalculate total from all payments)
  const { data: totalPurchases } = await supabaseAdmin
    .from('payments')
    .select('amount')
    .eq('contact_id', contactId)
    .in('status', ['paid', 'active']);

  const totalAmount = totalPurchases?.reduce((sum, p) => sum + Number(p.amount), 0) || amount;

  const { error: updateError } = await supabaseAdmin
    .from('contacts')
    .update({
      email_payment: email,
      stripe_customer_id: customerId,
      purchase_date: new Date().toISOString(),
      purchase_amount: totalAmount,  // Total from ALL payments
      stage: 'purchased',
      updated_at: new Date().toISOString()
    })
    .eq('id', contactId);

  if (updateError) {
    console.error('Error updating contact with purchase:', updateError);
  }

  console.log(`Payment recorded for contact ${contactId}: $${amount}`);
}

/**
 * Handle expired checkout (abandoned)
 */
async function handleCheckoutExpired(event: Stripe.Event) {
  const session = event.data.object as Stripe.Checkout.Session;

  const email = session.customer_email?.toLowerCase().trim();

  if (!email) {
    console.error('No email in expired checkout session');
    return;
  }

  // Find contact by email
  const { data: contactId } = await supabaseAdmin
    .rpc('find_contact_by_email', { search_email: email });

  if (!contactId) {
    console.warn('No contact found for expired checkout:', email);
    return;
  }

  // Update contact with checkout started timestamp (they got far enough to start checkout)
  const { error: updateError } = await supabaseAdmin
    .from('contacts')
    .update({
      checkout_started: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', contactId);

  if (updateError) {
    console.error('Error updating contact with expired checkout:', updateError);
  }

  console.log(`Checkout expired for contact ${contactId}`);
}

/**
 * Handle refund
 */
async function handleChargeRefunded(event: Stripe.Event) {
  const charge = event.data.object as Stripe.Charge;

  const email = charge.billing_details?.email?.toLowerCase().trim();
  const refundAmount = charge.amount_refunded ? charge.amount_refunded / 100 : 0;

  if (!email) {
    console.error('No email in refunded charge');
    return;
  }

  // Find contact by email
  const { data: contactId } = await supabaseAdmin
    .rpc('find_contact_by_email', { search_email: email });

  if (!contactId) {
    console.warn('No contact found for refund:', email);
    return;
  }

  // Get current purchase amount
  const { data: contact } = await supabaseAdmin
    .from('contacts')
    .select('purchase_amount')
    .eq('id', contactId)
    .single();

  const currentAmount = contact?.purchase_amount || 0;
  const newAmount = Math.max(0, currentAmount - refundAmount);

  // Update contact (reduce purchase amount)
  const { error: updateError } = await supabaseAdmin
    .from('contacts')
    .update({
      purchase_amount: newAmount,
      updated_at: new Date().toISOString()
    })
    .eq('id', contactId);

  if (updateError) {
    console.error('Error updating contact with refund:', updateError);
  }

  // Log refund as negative payment
  await supabaseAdmin.from('payments').insert({
    contact_id: contactId,
    payment_event_id: event.id,
    payment_source: 'stripe',
    payment_type: 'refund',
    customer_email: email,
    amount: -refundAmount,  // Negative amount for refund
    status: 'refunded',
    payment_date: new Date(event.created * 1000).toISOString(),
    stripe_event_type: event.type,
    raw_payload: event
  });

  console.log(`Refund recorded for contact ${contactId}: $${refundAmount}`);
}
