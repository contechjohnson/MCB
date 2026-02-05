import { NextRequest, NextResponse } from 'next/server';
import {
  getTenantContext,
  supabaseAdmin,
  webhookError,
  webhookSuccess,
  logWebhook,
} from '../../_shared/tenant-context';
import {
  MetaCAPIClient,
  queueCAPIEvent,
  createPurchaseEvent,
} from '@/lib/meta-capi/client';

/**
 * Multi-Tenant Denefits Webhook Handler (via Make.com)
 *
 * Route: POST /api/webhooks/[tenant]/denefits
 * Example: POST /api/webhooks/ppcu/denefits
 *
 * Events:
 * - contract.created: New BNPL contract (payment_plan + downpayment)
 * - contract.payments.recurring_payment: Monthly payment (recurring)
 * - contract.status: Contract status change (logged only)
 *
 * Payment Categories:
 * - payment_plan: Total financed amount (projected revenue)
 * - downpayment: Initial downpayment (cash collected)
 * - recurring: Monthly installment (cash collected)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  const { tenant: tenantSlug } = await params;

  try {
    // Get tenant context
    const tenant = await getTenantContext(tenantSlug);
    if (!tenant) {
      console.error('Unknown tenant:', tenantSlug);
      return NextResponse.json({ error: 'Unknown tenant' }, { status: 404 });
    }

    let body = await request.json();

    // Handle array payload
    if (Array.isArray(body) && body.length > 0) {
      body = body[0];
    }

    const webhookType = body.webhook_type || body.event_type || body.type || 'unknown';

    console.log(`[${tenantSlug}] Denefits webhook received:`, {
      event: webhookType,
      timestamp: new Date().toISOString(),
    });

    // Log webhook received
    await logWebhook(supabaseAdmin, {
      tenant_id: tenant.id,
      source: 'denefits',
      event_type: webhookType,
      payload: body,
      status: 'received',
    });

    // Extract contract details
    const contract = body.data?.contract || body;
    const email = contract.customer_email || body.customer_email || body.email || body.customer?.email;

    // Find contact with email → phone → name+appointment fallback
    const customerPhone = contract.customer_mobile || body.customer_phone || null;
    const customerName = `${contract.customer_first_name || ''} ${contract.customer_last_name || ''}`.trim() || null;
    console.log(`Looking up contact for email: ${email}, phone: ${customerPhone}`);
    const { contactId, matchMethod } = await findContactWithRetry(tenant.id, email, customerPhone, customerName);

    // Log match method for attribution auditing
    if (matchMethod !== 'email' && matchMethod !== 'no_data') {
      console.log(`[${tenantSlug}] Denefits contact matched via ${matchMethod} for ${email || 'no email'}`);
    }

    const contractId = contract.contract_id;
    const contractCode = contract.contract_code;
    const financedAmount = parseFloat(contract.financed_amount || 0);
    const downpayment = parseFloat(contract.downpayment_amount || 0);
    const recurringAmount = parseFloat(contract.recurring_amount || 0);
    const numPayments = parseInt(contract.number_of_payments || 0);
    const remainingPayments = parseInt(contract.remaining_payments || numPayments);
    const contractCreatedDate = contract.date_added
      ? new Date(contract.date_added).toISOString()
      : new Date().toISOString();

    let paymentCreated = false;

    // Handle different webhook types
    if (webhookType === 'contract.payments.recurring_payment') {
      console.log(`Recurring payment for contract ${contractCode}`);
      console.log(`  Amount: $${recurringAmount}, Email: ${email}`);

      // Create idempotent payment ID using contract code + remaining payments count
      // This ensures the same webhook retry won't create duplicates
      const recurringPaymentId = `${contractCode}_recurring_${remainingPayments}`;

      // Check if this payment already exists (idempotency check)
      const { data: existingPayment } = await supabaseAdmin
        .from('payments')
        .select('id')
        .eq('payment_event_id', recurringPaymentId)
        .single();

      if (existingPayment) {
        console.log(`  ℹ️ Recurring payment already exists: ${recurringPaymentId}`);
        // Return success - this is a retry of an already-processed webhook
        await logWebhook(supabaseAdmin, {
          tenant_id: tenant.id,
          source: 'denefits',
          event_type: webhookType,
          payload: body,
          contact_id: contactId,
          status: 'duplicate',
        });
        return webhookSuccess({
          contact_id: contactId,
          event_type: webhookType,
          tenant: tenantSlug,
          duplicate: true,
          payment_id: existingPayment.id,
        });
      }

      // Create individual recurring payment record (cash collected)
      const { data: insertedPayment, error: insertError } = await supabaseAdmin.from('payments').insert({
        tenant_id: tenant.id,
        contact_id: contactId || null,
        payment_event_id: recurringPaymentId,
        payment_source: 'denefits',
        payment_type: 'buy_now_pay_later',
        payment_category: 'recurring',
        customer_email: email,
        customer_name: `${contract.customer_first_name || ''} ${contract.customer_last_name || ''}`.trim() || null,
        customer_phone: contract.customer_mobile || null,
        amount: recurringAmount,
        currency: 'usd',
        status: 'paid',
        payment_date: new Date().toISOString(),
        denefits_contract_id: contractId,
        denefits_contract_code: contractCode,
        denefits_recurring_amount: recurringAmount,
        denefits_remaining_payments: remainingPayments,
        raw_payload: body,
      }).select();

      if (insertError) {
        console.error(`  ❌ Failed to insert recurring payment:`, insertError);
        throw new Error(`Failed to insert recurring payment: ${insertError.message}`);
      }

      paymentCreated = true;
      console.log(`  ✅ Recurring payment $${recurringAmount} recorded for contract ${contractCode}`, insertedPayment);

      // Create recurring_payment_received event if contact exists
      if (contactId) {
        await supabaseAdmin.rpc('update_contact_with_event', {
          p_contact_id: contactId,
          p_update_data: {},
          p_event_type: 'recurring_payment_received',
          p_source: 'denefits',
          p_source_event_id: recurringPaymentId,
        });
      }
    } else if (webhookType === 'contract.status') {
      const statusChange = body.status_change || {};
      console.log(`Contract status changed: ${contractCode}`);
      console.log(`  Previous: ${statusChange.previous_status}, Current: ${statusChange.current_status}`);
    } else if (webhookType === 'contract.created') {
      console.log(`Creating payment records for contract ${contractCode}`);

      // 1. Create payment_plan record (projected revenue - total financed amount)
      const { error: planError } = await supabaseAdmin.from('payments').insert({
        tenant_id: tenant.id,
        contact_id: contactId || null,
        payment_event_id: `${contractCode}_plan`,
        payment_source: 'denefits',
        payment_type: 'buy_now_pay_later',
        payment_category: 'payment_plan',
        customer_email: email,
        customer_name: `${contract.customer_first_name || ''} ${contract.customer_last_name || ''}`.trim() || null,
        customer_phone: contract.customer_mobile || null,
        amount: financedAmount,
        currency: 'usd',
        status: 'active',
        payment_date: contractCreatedDate,
        denefits_contract_id: contractId,
        denefits_contract_code: contractCode,
        denefits_financed_amount: financedAmount,
        denefits_downpayment: downpayment,
        denefits_recurring_amount: recurringAmount,
        denefits_num_payments: numPayments,
        denefits_remaining_payments: remainingPayments,
        raw_payload: body,
      });

      if (planError) {
        console.error(`  ❌ Failed to insert payment plan:`, planError);
        throw new Error(`Failed to insert payment plan: ${planError.message}`);
      }
      console.log(`  ✅ Payment plan $${financedAmount} recorded (projected revenue)`);

      // 2. Create downpayment record if downpayment > 0 (cash collected)
      if (downpayment > 0) {
        const { error: downpaymentError } = await supabaseAdmin.from('payments').insert({
          tenant_id: tenant.id,
          contact_id: contactId || null,
          payment_event_id: `${contractCode}_downpayment`,
          payment_source: 'denefits',
          payment_type: 'buy_now_pay_later',
          payment_category: 'downpayment',
          customer_email: email,
          customer_name: `${contract.customer_first_name || ''} ${contract.customer_last_name || ''}`.trim() || null,
          customer_phone: contract.customer_mobile || null,
          amount: downpayment,
          currency: 'usd',
          status: 'paid',
          payment_date: contractCreatedDate,
          denefits_contract_id: contractId,
          denefits_contract_code: contractCode,
          raw_payload: body,
        });

        if (downpaymentError) {
          console.error(`  ❌ Failed to insert downpayment:`, downpaymentError);
          throw new Error(`Failed to insert downpayment: ${downpaymentError.message}`);
        }
        console.log(`  ✅ Downpayment $${downpayment} recorded (cash collected)`);
      }

      paymentCreated = true;
    }

    if (!contactId) {
      console.warn(`[${tenantSlug}] No contact found for email:`, email, '- Payment logged as orphan');
      await logWebhook(supabaseAdmin, {
        tenant_id: tenant.id,
        source: 'denefits',
        event_type: webhookType,
        payload: body,
        status: 'processed_orphan',
      });
      return webhookSuccess({ orphan: true, tenant: tenantSlug });
    }

    // Update contact stage and fire purchase event for NEW contracts only
    // (recurring payments already fire recurring_payment_received above)
    if (paymentCreated && webhookType === 'contract.created') {
      await supabaseAdmin.rpc('update_contact_with_event', {
        p_contact_id: contactId,
        p_update_data: {
          email_payment: email,
          stage: 'purchased',
          updated_at: new Date().toISOString(),
        },
        p_event_type: 'payment_plan_created',
        p_source: 'denefits',
        p_source_event_id: contractCode || `denefits_${contractId}`,
      });

      // Fire Meta CAPI Purchase event
      const metaClient = MetaCAPIClient.fromTenant(tenant);

      // Get contact details for CAPI
      const { data: contactData } = await supabaseAdmin
        .from('contacts')
        .select('id, email_primary, phone, first_name, last_name, fbclid, fbp, fbc, ad_id')
        .eq('id', contactId)
        .single();

      if (metaClient && contactData) {
        try {
          const purchaseEvent = createPurchaseEvent(
            {
              email: email || contactData.email_primary,
              phone: contactData.phone || contract.customer_mobile,
              firstName: contactData.first_name || contract.customer_first_name,
              lastName: contactData.last_name || contract.customer_last_name,
              fbp: contactData.fbp,
              fbc: contactData.fbc,
              externalId: contactData.id,
            },
            financedAmount,
            {
              adId: contactData.ad_id,
              contentName: 'Denefits BNPL Purchase',
              orderId: contractCode,
            }
          );

          await queueCAPIEvent(tenant.id, {
            ...purchaseEvent,
            contactId: contactData.id,
          });

          console.log(`[${tenantSlug}] Meta CAPI Purchase event queued for contact:`, contactData.id, `amount: $${financedAmount}`);
        } catch (capiError) {
          console.error(`[${tenantSlug}] Failed to queue CAPI event:`, capiError);
          // Don't fail the webhook for CAPI errors
        }
      }
    }

    console.log(`[${tenantSlug}] Successfully processed Denefits ${webhookType} for ${email}`);

    await logWebhook(supabaseAdmin, {
      tenant_id: tenant.id,
      source: 'denefits',
      event_type: webhookType,
      payload: body,
      contact_id: contactId,
      status: 'processed',
    });

    return webhookSuccess({
      contact_id: contactId,
      event_type: webhookType,
      tenant: tenantSlug,
      updated: paymentCreated,
    });
  } catch (error) {
    console.error(`[${tenantSlug}] Denefits webhook error:`, error);
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
  { params }: { params: Promise<{ tenant: string }> }
) {
  const { tenant: tenantSlug } = await params;
  const tenant = await getTenantContext(tenantSlug);
  return NextResponse.json({
    status: 'ok',
    tenant: tenantSlug,
    tenant_name: tenant?.name || 'Unknown',
    message: 'Denefits webhook endpoint is live (via Make.com)',
    events: ['contract.created', 'contract.payments.recurring_payment', 'contract.status'],
  });
}

/**
 * Normalize phone to E.164 format for matching
 */
function normalizePhone(phone?: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return digits.length > 0 ? `+${digits}` : null;
}

/**
 * Find contact by email with retry logic, then phone fallback (tenant-scoped)
 * Uses separate queries instead of .or() with .ilike() to avoid 406 errors
 *
 * Match priority:
 * 1. Email across all 3 email fields (with retry)
 * 2. Phone number (normalized E.164)
 * 3. Name + recent appointment_held event (last 14 days)
 */
async function findContactWithRetry(
  tenantId: string,
  email: string | undefined,
  phone?: string | null,
  customerName?: string | null,
  maxRetries = 3
): Promise<{ contactId: string | null; matchMethod: string }> {
  if (!email && !phone && !customerName) {
    return { contactId: null, matchMethod: 'no_data' };
  }

  const normalizedEmail = email?.toLowerCase().trim();
  const delays = [0, 5000, 15000];

  // 1. Email-based matching with retries
  if (normalizedEmail) {
    for (let i = 0; i < maxRetries; i++) {
      if (delays[i] > 0) {
        console.log(`  Retry ${i}: Waiting ${delays[i] / 1000}s...`);
        await new Promise((resolve) => setTimeout(resolve, delays[i]));
      }

      // Try email_primary first (most common)
      let { data: contact } = await supabaseAdmin
        .from('contacts')
        .select('id')
        .eq('tenant_id', tenantId)
        .ilike('email_primary', normalizedEmail)
        .single();

      if (contact) {
        if (i > 0) console.log(`  ✅ Contact found on retry ${i} via email_primary`);
        return { contactId: contact.id, matchMethod: 'email' };
      }

      // Try email_booking
      ({ data: contact } = await supabaseAdmin
        .from('contacts')
        .select('id')
        .eq('tenant_id', tenantId)
        .ilike('email_booking', normalizedEmail)
        .single());

      if (contact) {
        if (i > 0) console.log(`  ✅ Contact found on retry ${i} via email_booking`);
        return { contactId: contact.id, matchMethod: 'email' };
      }

      // Try email_payment
      ({ data: contact } = await supabaseAdmin
        .from('contacts')
        .select('id')
        .eq('tenant_id', tenantId)
        .ilike('email_payment', normalizedEmail)
        .single());

      if (contact) {
        if (i > 0) console.log(`  ✅ Contact found on retry ${i} via email_payment`);
        return { contactId: contact.id, matchMethod: 'email' };
      }
    }
  }

  // 2. Phone-based fallback
  const normalizedPhone = normalizePhone(phone);
  if (normalizedPhone) {
    console.log(`  📞 Trying phone fallback: ${normalizedPhone}`);
    const { data: phoneContact } = await supabaseAdmin
      .from('contacts')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('phone', normalizedPhone)
      .single();

    if (phoneContact) {
      console.log(`  ✅ Contact found via phone: ${phoneContact.id}`);
      return { contactId: phoneContact.id, matchMethod: 'phone' };
    }
  }

  // 3. Name + recent appointment_held fallback
  if (customerName) {
    const firstName = customerName.split(' ')[0]?.toLowerCase().trim();
    if (firstName && firstName.length > 1) {
      console.log(`  👤 Trying name+appointment fallback: ${firstName}`);
      const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

      const { data: recentAppointments } = await supabaseAdmin
        .from('funnel_events')
        .select('contact_id')
        .eq('event_type', 'appointment_held')
        .gte('event_timestamp', fourteenDaysAgo)
        .execute();

      if (recentAppointments && recentAppointments.length > 0) {
        const contactIds = [...new Set(recentAppointments.map((e: any) => e.contact_id))];

        for (let i = 0; i < contactIds.length; i += 50) {
          const batch = contactIds.slice(i, i + 50);
          const { data: matchingContacts } = await supabaseAdmin
            .from('contacts')
            .select('id, first_name')
            .eq('tenant_id', tenantId)
            .in('id', batch)
            .ilike('first_name', firstName)
            .execute();

          if (matchingContacts && matchingContacts.length === 1) {
            console.log(`  ✅ Contact found via name+appointment: ${matchingContacts[0].id}`);
            return { contactId: matchingContacts[0].id, matchMethod: 'name_appointment' };
          }
        }
      }
    }
  }

  console.warn(`  ❌ Contact not found after all attempts for: ${normalizedEmail || 'no email'}`);
  return { contactId: null, matchMethod: 'none' };
}
