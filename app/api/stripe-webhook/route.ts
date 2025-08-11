import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-11-20.acacia',
});

// Initialize Supabase admin client
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

// Helper to find matching contact
async function findContactByEmail(email: string | null) {
  if (!email) return null;
  
  const { data } = await supabaseAdmin
    .from('contacts')
    .select('*')
    .eq('email_address', email)
    .single();
  
  return data;
}

// Helper to log all events with full details
async function logStripeEvent(
  event: Stripe.Event,
  session: any,
  status: string,
  matchedContactId?: string,
  abandonmentReason?: string
) {
  try {
    const customerEmail = session.customer_email || session.customer_details?.email || session.billing_details?.email;
    const customerName = session.customer_details?.name || session.billing_details?.name;
    const customerPhone = session.customer_details?.phone || session.billing_details?.phone;
    
    await supabaseAdmin
      .from('stripe_webhook_logs')
      .insert({
        event_id: event.id,
        event_type: event.type,
        checkout_session_id: session.id,
        status: status,
        matched_contact_id: matchedContactId,
        match_confidence: matchedContactId ? 100 : 0,
        match_method: matchedContactId ? 'email' : 'not_matched',
        customer_email: customerEmail,
        customer_name: customerName,
        customer_phone: customerPhone,
        amount: (session.amount_total || session.amount || session.amount_refunded || 0) / 100,
        payment_method_type: session.payment_method_types?.[0] || 'unknown',
        abandonment_reason: abandonmentReason,
        abandoned_at: abandonmentReason ? new Date().toISOString() : null,
        raw_event: event,
        created_at: new Date().toISOString(),
      });
  } catch (error) {
    console.error('Failed to log Stripe event:', error);
  }
}

// Process successful payment
async function processSuccessfulPayment(session: any) {
  const amount = session.amount_total || 0;
  const customerEmail = session.customer_email || session.customer_details?.email;
  const customerName = session.customer_details?.name;
  const paymentDate = new Date().toISOString();
  
  console.log(`Processing successful payment: $${amount/100} from ${customerEmail}`);
  
  // Find matching contact
  const contact = await findContactByEmail(customerEmail);
  
  if (contact) {
    // Update contact with purchase data
    const updateData: any = {
      total_purchased: (contact.total_purchased || 0) + (amount / 100),
      updated_at: paymentDate,
    };
    
    // Track purchase dates by amount
    if (amount <= 3000) { // $30 or less - first purchase
      if (!contact.first_purchase_date) {
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
      .eq('user_id', contact.user_id);
    
    console.log(`Updated contact ${contact.user_id} with payment`);
    return contact.user_id;
  } else {
    console.log(`No matching contact for ${customerEmail} - payment orphaned`);
    return null;
  }
}

// Track abandoned checkout (now just logs with proper status)
async function trackAbandonedCheckout(
  session: any,
  status: string,
  reason: string
) {
  const customerEmail = session.customer_email || session.customer_details?.email;
  
  console.log(`Tracking abandoned checkout: ${session.id} - ${status} - ${reason}`);
  
  // Find matching contact
  const contact = await findContactByEmail(customerEmail);
  
  return contact?.user_id;
}

// Mark abandoned checkout as converted in stripe_webhook_logs
async function markCheckoutConverted(sessionId: string) {
  const { error } = await supabaseAdmin
    .from('stripe_webhook_logs')
    .update({
      status: 'converted',
      converted_at: new Date().toISOString(),
    })
    .eq('checkout_session_id', sessionId)
    .in('status', ['bnpl_pending', 'expired', 'failed', 'bnpl_rejected']);
  
  if (error) {
    console.error('Error marking checkout as converted:', error);
  }
}

// Process refund
async function processRefund(charge: any) {
  const refundAmount = charge.amount_refunded || 0;
  const refundEmail = charge.billing_details?.email || charge.receipt_email;
  
  console.log(`Processing refund: $${refundAmount/100} for ${refundEmail}`);
  
  const contact = await findContactByEmail(refundEmail);
  
  if (contact) {
    await supabaseAdmin
      .from('contacts')
      .update({
        total_purchased: Math.max(0, (contact.total_purchased || 0) - (refundAmount / 100)),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', contact.user_id);
    
    console.log('Refund processed successfully');
    return contact.user_id;
  }
  
  return null;
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = request.headers.get('stripe-signature');

  if (!sig) {
    return NextResponse.json({ error: 'No signature' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  console.log(`Processing Stripe event: ${event.type}`);
  const session = event.data.object as any;
  const sessionId = session.id;

  // Handle different event types
  switch (event.type) {
    case 'checkout.session.completed':
      // Check payment status to determine if paid or abandoned
      const paymentStatus = session.payment_status;
      
      if (paymentStatus === 'paid') {
        // Successful instant payment (card, etc.)
        const contactId = await processSuccessfulPayment(session);
        await logStripeEvent(event, session, 'matched', contactId || undefined);
        
        // Also mark as converted if it was previously abandoned
        await markCheckoutConverted(sessionId);
        
      } else if (paymentStatus === 'unpaid' || paymentStatus === 'processing') {
        // BNPL pending or payment processing
        const contactId = await trackAbandonedCheckout(
          session, 
          'bnpl_pending',
          'buy_now_pay_later_pending'
        );
        await logStripeEvent(event, session, 'bnpl_pending', contactId || undefined, 'buy_now_pay_later_pending');
      }
      break;
      
    case 'checkout.session.async_payment_succeeded':
      // BNPL or delayed payment succeeded
      const contactId = await processSuccessfulPayment(session);
      await logStripeEvent(event, session, 'matched', contactId || undefined);
      
      // Mark previous abandonment as converted
      await markCheckoutConverted(sessionId);
      break;
      
    case 'checkout.session.async_payment_failed':
      // BNPL rejected
      const failedContactId = await trackAbandonedCheckout(
        session,
        'bnpl_rejected',
        'buy_now_pay_later_declined'
      );
      await logStripeEvent(event, session, 'bnpl_rejected', failedContactId || undefined, 'buy_now_pay_later_declined');
      break;
      
    case 'checkout.session.expired':
      // Checkout timed out
      const expiredContactId = await trackAbandonedCheckout(
        session,
        'expired',
        'checkout_timeout'
      );
      await logStripeEvent(event, session, 'expired', expiredContactId || undefined, 'checkout_timeout');
      break;
      
    case 'charge.refunded':
      // Handle refunds
      const refundContactId = await processRefund(session);
      await logStripeEvent(event, session, 'refunded', refundContactId || undefined);
      break;
      
    default:
      // Log any other events for debugging
      console.log(`Unhandled event type: ${event.type}`);
      await logStripeEvent(event, session, 'unhandled');
  }

  return NextResponse.json({ received: true });
}

// Stripe requires raw body for webhook verification
export const config = {
  api: {
    bodyParser: false,
  },
};