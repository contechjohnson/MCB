import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Admin client for bypassing RLS
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

/**
 * Denefits Webhook Handler
 *
 * Handles payment events from Denefits (Buy Now Pay Later):
 * - payment_approved: Customer approved for financing
 * - payment_plan_created: Payment plan created
 * - payment_received: Payment made on plan
 * - payment_completed: Full payment plan completed
 *
 * Strategy: Find contact by email, update purchase info
 *
 * NOTE: Adjust this based on actual Denefits webhook payload
 * Check your Make.com scenario to see exact field names
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    console.log('Denefits webhook received:', {
      event: body.event_type || body.type,
      timestamp: new Date().toISOString()
    });

    // Log the webhook
    await supabaseAdmin.from('webhook_logs').insert({
      source: 'denefits',
      event_type: body.event_type || body.type || 'unknown',
      payload: body,
      status: 'received'
    });

    // Extract data from webhook
    // ADJUST THESE FIELD NAMES based on actual Denefits payload
    const email = body.customer_email || body.email || body.customer?.email;
    const amount = body.amount || body.total_amount || body.plan_amount || 0;
    const eventType = body.event_type || body.type;
    const customerId = body.customer_id || body.denefits_customer_id;
    const planId = body.plan_id || body.payment_plan_id;

    if (!email) {
      console.error('No email in Denefits webhook');
      await supabaseAdmin.from('webhook_logs').insert({
        source: 'denefits',
        event_type: eventType,
        payload: body,
        status: 'error',
        error_message: 'No email found in payload'
      });
      return NextResponse.json({ error: 'Missing email' }, { status: 200 });
    }

    // Find contact by email (checks all 3 email fields)
    const { data: contactId } = await supabaseAdmin
      .rpc('find_contact_by_email', { search_email: email.toLowerCase().trim() });

    if (!contactId) {
      console.warn('No contact found for Denefits payment:', email);
      // Still log the event for manual review
      await supabaseAdmin.from('webhook_logs').insert({
        source: 'denefits',
        event_type: eventType,
        payload: body,
        status: 'error',
        error_message: 'Contact not found by email'
      });
      return NextResponse.json({
        warning: 'Contact not found',
        email: email
      }, { status: 200 });
    }

    // Update contact based on event type
    const updateData = buildDenefitsUpdateData(eventType, body, amount);

    const { error: updateError } = await supabaseAdmin
      .from('contacts')
      .update(updateData)
      .eq('id', contactId);

    if (updateError) {
      console.error('Error updating contact:', updateError);
      await supabaseAdmin.from('webhook_logs').insert({
        source: 'denefits',
        event_type: eventType,
        payload: body,
        status: 'error',
        error_message: updateError.message
      });
      return NextResponse.json({ error: updateError.message }, { status: 200 });
    }

    console.log(`Successfully processed Denefits ${eventType} for ${email}`);

    // Update webhook log
    await supabaseAdmin.from('webhook_logs').insert({
      source: 'denefits',
      event_type: eventType,
      contact_id: contactId,
      payload: body,
      status: 'processed'
    });

    return NextResponse.json({
      success: true,
      contact_id: contactId,
      event_type: eventType
    }, { status: 200 });

  } catch (error) {
    console.error('Denefits webhook error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 200 });
  }
}

/**
 * GET handler for testing
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Denefits webhook endpoint is live',
    endpoints: {
      POST: 'Receives Denefits webhooks',
      events: ['payment_approved', 'payment_plan_created', 'payment_received', 'payment_completed']
    },
    note: 'Adjust event types based on actual Denefits webhook events'
  });
}

/**
 * Build update data based on Denefits event type
 * CUSTOMIZE THIS based on your actual Denefits events
 */
function buildDenefitsUpdateData(eventType: string, body: any, amount: number) {
  const baseData: any = {
    email_payment: body.customer_email || body.email,
    updated_at: new Date().toISOString()
  };

  // Adjust these event names to match actual Denefits events
  switch (eventType) {
    case 'payment_approved':
    case 'application_approved':
      // Customer approved for financing
      return {
        ...baseData,
        checkout_started: new Date().toISOString(),
        stage: 'checkout_started'
        // Don't set purchase_date yet - they haven't paid
      };

    case 'payment_plan_created':
    case 'plan_created':
      // Payment plan created (similar to checkout.session.completed)
      return {
        ...baseData,
        purchase_date: new Date().toISOString(),
        purchase_amount: amount,
        stage: 'purchased'
        // They committed to payment plan
      };

    case 'payment_received':
    case 'payment_made':
      // They made a payment on their plan
      return {
        ...baseData,
        // Don't change purchase_amount - that's the total
        // This is just a payment installment
      };

    case 'payment_completed':
    case 'plan_paid_off':
      // Full plan paid off
      return {
        ...baseData,
        stage: 'purchased'
        // They finished paying
      };

    case 'payment_failed':
    case 'payment_declined':
      // Payment failed
      return {
        ...baseData,
        // Maybe track failed payments?
      };

    default:
      // Unknown event, just update base data
      return baseData;
  }
}
