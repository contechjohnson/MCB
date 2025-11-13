import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Admin client for bypassing RLS
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

/**
 * Denefits Webhook Handler (via Make.com)
 *
 * Handles webhooks from Denefits routed through Make.com:
 * - contract.created: New BNPL contract created (customer financed)
 * - contract.payments.recurring_payment: Monthly payment made
 * - contract.status: Contract status changed (Active, Overdue, etc.)
 *
 * Strategy:
 * - contract.created: Create payment record with contract.date_added as purchase_date
 * - recurring_payment: Check if payment exists. If NOT, create it using contract.date_added
 *   (handles missed contract.created webhooks). If exists, just log event.
 * - contract.status: Log status change for tracking
 *
 * IMPORTANT: Always use contract.date_added (not current date) as payment_date and purchase_date.
 * Always use financed_amount (not recurring_amount) as payment amount.
 *
 * Make.com Endpoint: https://hook.us2.make.com/15fn280oj21071gnh2xls9f7ixvblu0u
 * Secret Key: key_lmi8ohcoc9wdntg
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    console.log('Denefits webhook received:', {
      event: body.event_type || body.type,
      timestamp: new Date().toISOString()
    });

    // Extract webhook_type early for logging
    let webhookType = 'unknown';
    if (Array.isArray(body) && body.length > 0) {
      webhookType = body[0].webhook_type || body[0].event_type || body[0].type || 'unknown';
    } else {
      webhookType = body.webhook_type || body.event_type || body.type || 'unknown';
    }

    // Log the webhook
    await supabaseAdmin.from('webhook_logs').insert({
      source: 'denefits',
      event_type: webhookType,
      payload: body,
      status: 'received'
    });

    // Handle array payload (Denefits sends array)
    let payload = body;
    if (Array.isArray(body) && body.length > 0) {
      payload = body[0];
    }

    // Extract webhook_type from root level (NOT in data.contract)
    const webhookType = payload.webhook_type || payload.event_type || payload.type || 'unknown';

    // Extract contract details from Denefits payload
    const contract = payload.data?.contract || payload;

    // Extract email from nested structure
    const email = contract.customer_email || payload.customer_email || payload.email || payload.customer?.email;

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

    // Contract created date (when they signed up for financing)
    const contractCreatedDate = contract.date_added ? new Date(contract.date_added).toISOString() : new Date().toISOString();

    // Track if we created a payment (for contact update logic)
    let paymentCreated = false;

    // Handle different webhook types
    if (webhookType === 'contract.payments.recurring_payment') {
      // Recurring payment - check if we already have the original payment record
      console.log(`Recurring payment for contract ${contractCode}`);
      console.log(`  Amount: $${recurringAmount}, Remaining: ${remainingPayments} payments`);

      // Check if payment already exists
      const { data: existingPayment } = await supabaseAdmin
        .from('payments')
        .select('id')
        .eq('denefits_contract_code', contractCode)
        .single();

      if (!existingPayment) {
        // We missed the contract.created webhook - create payment now using ORIGINAL contract date
        console.log(`  ⚠️  No payment found - creating from contract.date_added: ${contractCreatedDate}`);

        await supabaseAdmin.from('payments').insert({
          contact_id: contactId || null,
          payment_event_id: contractCode || `denefits_${contractId}`,
          payment_source: 'denefits',
          payment_type: 'buy_now_pay_later',
          customer_email: email,
          customer_name: `${contract.customer_first_name || ''} ${contract.customer_last_name || ''}`.trim() || null,
          customer_phone: contract.customer_mobile || null,
          amount: financedAmount,  // FULL financed amount (not recurring amount)
          currency: 'usd',
          status: 'active',
          payment_date: contractCreatedDate,  // Use ORIGINAL contract creation date
          denefits_contract_id: contractId,
          denefits_contract_code: contractCode,
          denefits_financed_amount: financedAmount,
          denefits_downpayment: downpayment,
          denefits_recurring_amount: recurringAmount,
          denefits_num_payments: numPayments,
          denefits_remaining_payments: remainingPayments,
          raw_payload: body
        });

        paymentCreated = true;
        console.log(`  ✅ Payment created from recurring webhook with original date: ${contractCreatedDate}`);
      } else {
        console.log(`  ✅ Payment already exists - just logging recurring payment event`);
      }

    } else if (webhookType === 'contract.status') {
      // Contract status changed (Active, Overdue, Canceled, etc.)
      const statusChange = payload.status_change || {};
      console.log(`Contract status changed: ${contractCode}`);
      console.log(`  Previous: ${statusChange.previous_status}, Current: ${statusChange.current_status}`);
      console.log(`  Contract Status: ${contract.contract_status}`);
      // Just log it for now, can add logic to update contact stage if needed

    } else if (webhookType === 'contract.created') {
      // New contract created - create payment record
      console.log(`Creating payment record for contract ${contractCode}`);
      console.log(`  Amount: $${financedAmount}, Created: ${contractCreatedDate}`);

      await supabaseAdmin.from('payments').insert({
        contact_id: contactId || null,  // NULL = orphan
        payment_event_id: contractCode || `denefits_${contractId}`,
        payment_source: 'denefits',
        payment_type: 'buy_now_pay_later',
        customer_email: email,
        customer_name: `${contract.customer_first_name || ''} ${contract.customer_last_name || ''}`.trim() || null,
        customer_phone: contract.customer_mobile || null,
        amount: financedAmount,  // FULL financed amount (not recurring amount)
        currency: 'usd',
        status: 'active',  // Denefits contracts are "active" vs "paid"
        payment_date: contractCreatedDate,  // Use contract creation date, NOT current date
        denefits_contract_id: contractId,
        denefits_contract_code: contractCode,
        denefits_financed_amount: financedAmount,
        denefits_downpayment: downpayment,
        denefits_recurring_amount: recurringAmount,
        denefits_num_payments: numPayments,
        denefits_remaining_payments: remainingPayments,
        raw_payload: body
      });

      paymentCreated = true;
    } else {
      // Unknown webhook type - log it but don't process
      console.log(`Unknown webhook type: ${webhookType} - logging only`);
    }

    if (!contactId) {
      console.warn('No contact found for email:', email, '- Payment logged as orphan');
      await supabaseAdmin.from('webhook_logs').insert({
        source: 'denefits',
        event_type: webhookType,
        payload: body,
        status: 'processed_orphan'
      });
      return NextResponse.json({ success: true, orphan: true }, { status: 200 });
    }

    // Update contact with purchase info
    // Update if we created a payment (contract.created OR recurring that created missing payment)
    // OR if contact has no purchase_date yet

    // Check if contact already has purchase_date
    const { data: existingContact } = await supabaseAdmin
      .from('contacts')
      .select('purchase_date, purchase_amount, stage')
      .eq('id', contactId)
      .single();

    // Update if: (1) we just created a payment, OR (2) contact has no purchase_date
    const shouldUpdate = paymentCreated || !existingContact?.purchase_date;

    if (shouldUpdate) {
      // Recalculate total from all payments
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
            purchase_date: existingContact?.purchase_date || contractCreatedDate,  // Use contract creation date
            purchase_amount: totalAmount,  // Total from ALL payments (Stripe + Denefits)
            stage: 'purchased'
          }
        });

      if (updateError) {
        console.error('Error updating contact:', updateError);
        await supabaseAdmin.from('webhook_logs').insert({
          source: 'denefits',
          event_type: webhookType,
          payload: body,
          status: 'error',
          error_message: updateError.message
        });
        return NextResponse.json({ error: updateError.message }, { status: 200 });
      }

      console.log(`Updated contact ${contactId}: purchase_date=${contractCreatedDate}, amount=$${totalAmount}`);
    } else {
      console.log(`Skipping contact update - ${webhookType} event, ${paymentCreated ? 'no payment created' : 'already has purchase_date: ' + existingContact?.purchase_date}`);
    }

    console.log(`Successfully processed Denefits ${webhookType} for ${email}`);

    // Update webhook log
    await supabaseAdmin.from('webhook_logs').insert({
      source: 'denefits',
      event_type: webhookType,
      contact_id: contactId,
      payload: body,
      status: 'processed'
    });

    return NextResponse.json({
      success: true,
      contact_id: contactId,
      event_type: webhookType,
      updated: shouldUpdate
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
    message: 'Denefits webhook endpoint is live (via Make.com)',
    endpoints: {
      POST: 'Receives Denefits webhooks forwarded from Make.com',
      makeComUrl: 'https://hook.us2.make.com/15fn280oj21071gnh2xls9f7ixvblu0u',
      events: [
        'contract.created - New contract created',
        'contract.payments.recurring_payment - Monthly payment made',
        'contract.status - Contract status changed'
      ]
    },
    routing: 'Denefits → Make.com → Vercel',
    secretKey: 'key_lmi8ohcoc9wdntg'
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
