import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import {
  getTenantContext,
  supabaseAdmin,
  webhookError,
  webhookSuccess,
  logWebhook,
} from '../../_shared/tenant-context';

/**
 * Multi-Tenant Stripe Webhook Handler
 *
 * Route: POST /api/webhooks/[tenant]/stripe
 * Example: POST /api/webhooks/ppcu/stripe
 *
 * Events:
 * - checkout.session.created: Checkout started
 * - checkout.session.completed: Payment successful
 * - checkout.session.expired: Checkout abandoned
 * - charge.refunded: Refund processed
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { tenant: string } }
) {
  const tenantSlug = params.tenant;

  try {
    // Get tenant context
    const tenant = await getTenantContext(tenantSlug);
    if (!tenant) {
      console.error('Unknown tenant:', tenantSlug);
      return NextResponse.json({ error: 'Unknown tenant' }, { status: 404 });
    }

    // Get Stripe credentials for this tenant
    const stripeSecretKey = tenant.credentials.stripe?.secret_key || process.env.STRIPE_SECRET_KEY;
    const stripeWebhookSecret = tenant.credentials.stripe?.webhook_secret || process.env.STRIPE_WEBHOOK_SECRET;

    if (!stripeSecretKey) {
      console.error(`[${tenantSlug}] No Stripe secret key configured`);
      return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
    }

    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2025-08-27.basil' as any });

    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      console.error(`[${tenantSlug}] No Stripe signature found`);
      return NextResponse.json({ error: 'No signature' }, { status: 400 });
    }

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, stripeWebhookSecret!);
    } catch (err) {
      console.error(`[${tenantSlug}] Stripe signature verification failed:`, err);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    console.log(`[${tenantSlug}] Stripe webhook received:`, {
      event: event.type,
      id: event.id,
      timestamp: new Date().toISOString(),
    });

    // Log webhook received
    await logWebhook(supabaseAdmin, {
      tenant_id: tenant.id,
      source: 'stripe',
      event_type: event.type,
      payload: event as any,
      status: 'received',
    });

    // Check for duplicate events
    const { data: existingPayment } = await supabaseAdmin
      .from('payments')
      .select('id')
      .eq('tenant_id', tenant.id)
      .eq('payment_event_id', event.id)
      .single();

    if (existingPayment) {
      console.log(`[${tenantSlug}] Duplicate Stripe event, skipping:`, event.id);
      return NextResponse.json({ received: true, duplicate: true }, { status: 200 });
    }

    // Handle different event types
    const eventType = event.type as string;
    if (eventType === 'checkout.session.created') {
      await handleCheckoutCreated(tenant.id, event);
    } else if (eventType === 'checkout.session.completed') {
      await handleCheckoutCompleted(tenant.id, event);
    } else if (eventType === 'checkout.session.expired') {
      await handleCheckoutExpired(tenant.id, event);
    } else if (eventType === 'charge.refunded') {
      await handleChargeRefunded(tenant.id, event);
    } else {
      console.log(`[${tenantSlug}] Unhandled Stripe event type:`, event.type);
    }

    return NextResponse.json({ received: true, tenant: tenantSlug }, { status: 200 });
  } catch (error) {
    console.error(`[${tenantSlug}] Stripe webhook error:`, error);
    return webhookError(
      'Internal server error',
      error instanceof Error ? error.message : 'Unknown error'
    );
  }
}

/**
 * GET handler for testing
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { tenant: string } }
) {
  const tenant = await getTenantContext(params.tenant);
  return NextResponse.json({
    status: 'ok',
    tenant: params.tenant,
    tenant_name: tenant?.name || 'Unknown',
    message: 'Stripe webhook endpoint is live',
    events: ['checkout.session.created', 'checkout.session.completed', 'checkout.session.expired', 'charge.refunded'],
  });
}

/**
 * Find contact by email with retry logic (tenant-scoped)
 */
async function findContactWithRetry(
  tenantId: string,
  email: string,
  maxRetries = 3
): Promise<string | null> {
  const delays = [0, 5000, 15000];

  for (let i = 0; i < maxRetries; i++) {
    if (delays[i] > 0) {
      console.log(`  Retry ${i}: Waiting ${delays[i] / 1000}s...`);
      await new Promise((resolve) => setTimeout(resolve, delays[i]));
    }

    // Search by any email field within tenant
    const { data: contact } = await supabaseAdmin
      .from('contacts')
      .select('id')
      .eq('tenant_id', tenantId)
      .or(`email_primary.ilike.${email},email_booking.ilike.${email},email_payment.ilike.${email}`)
      .single();

    if (contact) {
      if (i > 0) console.log(`  ✅ Contact found on retry ${i}`);
      return contact.id;
    }
  }

  console.warn(`  ❌ Contact not found after ${maxRetries} attempts`);
  return null;
}

/**
 * Handle checkout session created
 */
async function handleCheckoutCreated(tenantId: string, event: Stripe.Event) {
  const session = event.data.object as Stripe.Checkout.Session;
  const email = session.customer_email?.toLowerCase().trim();

  if (!email) return;

  const { data: contact } = await supabaseAdmin
    .from('contacts')
    .select('id')
    .eq('tenant_id', tenantId)
    .or(`email_primary.ilike.${email},email_booking.ilike.${email},email_payment.ilike.${email}`)
    .single();

  if (!contact) {
    console.warn('No contact found for checkout started:', email);
    return;
  }

  await supabaseAdmin.rpc('update_contact_dynamic', {
    contact_id: contact.id,
    update_data: { checkout_started: new Date().toISOString() },
  });

  console.log(`Checkout started for contact ${contact.id}`);
}

/**
 * Handle successful checkout
 */
async function handleCheckoutCompleted(tenantId: string, event: Stripe.Event) {
  const session = event.data.object as Stripe.Checkout.Session;
  const email = (session.customer_email || session.customer_details?.email)?.toLowerCase().trim();
  const amount = session.amount_total ? session.amount_total / 100 : 0;
  const customerId = session.customer as string;

  // Always log the payment, even without email
  const contactId = email ? await findContactWithRetry(tenantId, email) : null;

  await supabaseAdmin.from('payments').insert({
    tenant_id: tenantId,
    contact_id: contactId || null,
    payment_event_id: event.id,
    payment_source: 'stripe',
    payment_type: 'buy_in_full',
    customer_email: email || null,
    customer_name: session.customer_details?.name || null,
    customer_phone: session.customer_details?.phone || null,
    amount: amount,
    currency: session.currency || 'usd',
    status: 'paid',
    payment_date: new Date(event.created * 1000).toISOString(),
    stripe_event_type: event.type,
    stripe_customer_id: customerId || null,
    stripe_session_id: session.id,
    raw_payload: event,
  });

  if (!contactId) {
    console.warn('Payment logged as orphan:', email || 'no email');
    return;
  }

  // Calculate total purchases for this contact
  const { data: totalPurchases } = await supabaseAdmin
    .from('payments')
    .select('amount')
    .eq('tenant_id', tenantId)
    .eq('contact_id', contactId)
    .in('status', ['paid', 'active']);

  const totalAmount = totalPurchases?.reduce((sum, p) => sum + Number(p.amount), 0) || amount;

  await supabaseAdmin.rpc('update_contact_dynamic', {
    contact_id: contactId,
    update_data: {
      email_payment: email,
      stripe_customer_id: customerId,
      purchase_date: new Date().toISOString(),
      purchase_amount: totalAmount,
      stage: 'purchased',
    },
  });

  console.log(`Payment recorded for contact ${contactId}: $${amount}`);
}

/**
 * Handle expired checkout
 */
async function handleCheckoutExpired(tenantId: string, event: Stripe.Event) {
  const session = event.data.object as Stripe.Checkout.Session;
  const email = session.customer_email?.toLowerCase().trim();

  if (!email) return;

  const { data: contact } = await supabaseAdmin
    .from('contacts')
    .select('id')
    .eq('tenant_id', tenantId)
    .or(`email_primary.ilike.${email},email_booking.ilike.${email},email_payment.ilike.${email}`)
    .single();

  if (!contact) return;

  await supabaseAdmin.rpc('update_contact_dynamic', {
    contact_id: contact.id,
    update_data: { checkout_started: new Date().toISOString() },
  });

  console.log(`Checkout expired for contact ${contact.id}`);
}

/**
 * Handle refund
 */
async function handleChargeRefunded(tenantId: string, event: Stripe.Event) {
  const charge = event.data.object as Stripe.Charge;
  const email = charge.billing_details?.email?.toLowerCase().trim();
  const refundAmount = charge.amount_refunded ? charge.amount_refunded / 100 : 0;

  if (!email) return;

  const { data: contact } = await supabaseAdmin
    .from('contacts')
    .select('id, purchase_amount')
    .eq('tenant_id', tenantId)
    .or(`email_primary.ilike.${email},email_booking.ilike.${email},email_payment.ilike.${email}`)
    .single();

  if (!contact) return;

  const newAmount = Math.max(0, (contact.purchase_amount || 0) - refundAmount);

  await supabaseAdmin.rpc('update_contact_dynamic', {
    contact_id: contact.id,
    update_data: { purchase_amount: newAmount },
  });

  await supabaseAdmin.from('payments').insert({
    tenant_id: tenantId,
    contact_id: contact.id,
    payment_event_id: event.id,
    payment_source: 'stripe',
    payment_type: 'refund',
    customer_email: email,
    amount: -refundAmount,
    status: 'refunded',
    payment_date: new Date(event.created * 1000).toISOString(),
    stripe_event_type: event.type,
    raw_payload: event,
  });

  console.log(`Refund recorded for contact ${contact.id}: $${refundAmount}`);
}
