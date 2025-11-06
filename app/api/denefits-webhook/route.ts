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

    // Handle array payload (Denefits sends array)
    let payload = body;
    if (Array.isArray(body) && body.length > 0) {
      payload = body[0];
    }

    // Extract contract details from Denefits payload
    const contract = payload.data?.contract || payload;
    const eventType = payload.webhook_type || payload.event_type || payload.type || 'contract.created';

    // Extract email from nested structure
    const email = contract.customer_email || payload.customer_email || payload.email || payload.customer?.email;

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

    const contractId = contract.contract_id;
    const contractCode = contract.contract_code;
    const financedAmount = parseFloat(contract.financed_amount || 0);
    const downpayment = parseFloat(contract.downpayment_amount || 0);
    const recurringAmount = parseFloat(contract.recurring_amount || 0);
    const numPayments = parseInt(contract.number_of_payments || 0);
    const remainingPayments = parseInt(contract.remaining_payments || numPayments);

    // Log payment to payments table (works for both matched and orphan)
    await supabaseAdmin.from('payments').insert({
      contact_id: contactId || null,  // NULL = orphan
      payment_event_id: contractCode || `denefits_${contractId}`,
      payment_source: 'denefits',
      payment_type: 'buy_now_pay_later',
      customer_email: email,
      customer_name: `${contract.customer_first_name || ''} ${contract.customer_last_name || ''}`.trim() || null,
      customer_phone: contract.customer_mobile || null,
      amount: financedAmount,
      currency: 'usd',
      status: 'active',  // Denefits contracts are "active" vs "paid"
      payment_date: contract.date_added ? new Date(contract.date_added).toISOString() : new Date().toISOString(),
      denefits_contract_id: contractId,
      denefits_contract_code: contractCode,
      denefits_financed_amount: financedAmount,
      denefits_downpayment: downpayment,
      denefits_recurring_amount: recurringAmount,
      denefits_num_payments: numPayments,
      denefits_remaining_payments: remainingPayments,
      raw_payload: body
    });

    if (!contactId) {
      console.warn('No contact found for email:', email, '- Payment logged as orphan');
      await supabaseAdmin.from('webhook_logs').insert({
        source: 'denefits',
        event_type: eventType,
        payload: body,
        status: 'processed_orphan'
      });
      return NextResponse.json({ success: true, orphan: true }, { status: 200 });
    }

    // Update contact with purchase info (recalculate total from all payments)
    const { data: totalPurchases } = await supabaseAdmin
      .from('payments')
      .select('amount')
      .eq('contact_id', contactId)
      .in('status', ['paid', 'active']);

    const totalAmount = totalPurchases?.reduce((sum, p) => sum + Number(p.amount), 0) || financedAmount;

    const { error: updateError } = await supabaseAdmin
      .rpc('update_contact_dynamic', {
        contact_id: contactId,
        update_data: {
          email_payment: email,
          purchase_date: new Date().toISOString(),
          purchase_amount: totalAmount,  // Total from ALL payments
          stage: 'purchased'
        }
      });

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
