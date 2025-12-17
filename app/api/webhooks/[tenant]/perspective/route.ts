import { NextRequest, NextResponse } from 'next/server';
import {
  getTenantContext,
  supabaseAdmin,
  webhookError,
  webhookSuccess,
  logWebhook,
} from '../../_shared/tenant-context';

/**
 * Multi-Tenant Perspective Webhook Handler
 *
 * Route: POST /api/webhooks/[tenant]/perspective
 * Example: POST /api/webhooks/ppcu/perspective
 *
 * Events:
 * - discovery_form_submitted: New lead from discovery call funnel (creates contact)
 * - checkout_form_submitted: Existing customer filled checkout form (updates contact)
 *
 * Funnel Detection:
 * - Discovery funnel: funnelName contains 'discovery' or 'calendly' (NOT 'checkout')
 * - Checkout funnel: funnelName contains 'checkout' or doesn't match discovery
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

    let body = await request.json();

    // Handle array payload
    if (Array.isArray(body) && body.length > 0) {
      body = body[0];
    }

    // Extract data from Perspective payload
    const profile = body.profile || {};
    const values = body.values || {};
    const funnelName = (body.funnelName || '').toLowerCase();

    // Determine funnel type
    // Discovery funnel = anything that's NOT explicitly a checkout funnel
    // Known discovery funnels: "PPCU V1 SALES FUNNEL", anything with "discovery" or "calendly"
    // Known checkout funnels: "PPCU Checkout", anything with "checkout"
    const isCheckoutFunnel = funnelName.includes('checkout');
    const isDiscoveryFunnel = !isCheckoutFunnel;

    console.log(`[${tenantSlug}] Perspective webhook received:`, {
      funnelName: body.funnelName,
      funnelId: body.funnelId,
      isDiscoveryFunnel,
      hasProfile: !!body.profile,
      timestamp: new Date().toISOString(),
    });

    const email = (profile.email?.value || values.email)?.toLowerCase().trim();
    const firstName = profile.firstName?.value || values.firstName;
    const phone = normalizePhone(profile.phone?.value || values.phone);
    const convertedAt = values.ps_converted_at || body.meta?.ps_converted_at;

    // Extract ad attribution (from hidden fields or URL params)
    const adId =
      values.ad_id ||
      values.AD_ID ||
      values.adid ||
      body.meta?.ad_id ||
      body.meta?.utm_content ||
      null;

    if (!email) {
      await logWebhook(supabaseAdmin, {
        tenant_id: tenant.id,
        source: 'perspective',
        event_type: isDiscoveryFunnel ? 'discovery_form_submitted' : 'checkout_form_submitted',
        payload: body,
        status: 'error',
        error_message: 'Missing email',
      });
      return webhookError('Missing email');
    }

    // Log webhook received
    const eventType = isDiscoveryFunnel ? 'discovery_form_submitted' : 'checkout_form_submitted';
    await logWebhook(supabaseAdmin, {
      tenant_id: tenant.id,
      source: 'perspective',
      event_type: eventType,
      payload: body,
      status: 'received',
    });

    if (isDiscoveryFunnel) {
      // DISCOVERY FUNNEL: Create or find contact
      return await handleDiscoveryFunnel(tenant, {
        email,
        firstName,
        phone,
        adId,
        convertedAt,
        body,
        tenantSlug,
      });
    } else {
      // CHECKOUT FUNNEL: Update existing contact (original behavior)
      return await handleCheckoutFunnel(tenant, {
        email,
        firstName,
        phone,
        convertedAt,
        body,
        tenantSlug,
      });
    }
  } catch (error) {
    console.error(`[${tenantSlug}] Perspective webhook error:`, error);
    return webhookError(
      'Internal server error',
      error instanceof Error ? error.message : 'Unknown error'
    );
  }
}

/**
 * Handle Discovery Funnel - Creates new contacts for calendly_free funnel
 */
async function handleDiscoveryFunnel(
  tenant: { id: string; name: string },
  data: {
    email: string;
    firstName?: string;
    phone?: string;
    adId?: string;
    convertedAt?: string;
    body: any;
    tenantSlug: string;
  }
) {
  const { email, firstName, phone, adId, convertedAt, body, tenantSlug } = data;

  // Try to find existing contact by email
  const { data: existingContact } = await supabaseAdmin
    .from('contacts')
    .select('id, funnel_variant')
    .eq('tenant_id', tenant.id)
    .or(
      `email_primary.ilike.${email},email_booking.ilike.${email},email_payment.ilike.${email}`
    )
    .single();

  if (existingContact) {
    // Contact exists - update with form submit data but preserve funnel_variant
    console.log(
      `[${tenantSlug}] Discovery funnel: existing contact found ${existingContact.id}, updating`
    );

    const updateData: any = {
      form_submit_date: convertedAt || new Date().toISOString(),
    };
    if (firstName) updateData.first_name = firstName;
    if (phone) updateData.phone = phone;
    if (adId) updateData.ad_id = adId;
    // Don't overwrite funnel_variant if already set

    const { error: updateError } = await supabaseAdmin.rpc('update_contact_with_event', {
      p_contact_id: existingContact.id,
      p_update_data: updateData,
      p_event_type: 'form_submitted',
      p_source: 'perspective',
      p_source_event_id: `perspective_discovery_${email}_${Date.now()}`,
    });

    if (updateError) {
      await logWebhook(supabaseAdmin, {
        tenant_id: tenant.id,
        source: 'perspective',
        event_type: 'discovery_form_submitted',
        payload: body,
        contact_id: existingContact.id,
        status: 'error',
        error_message: updateError.message,
      });
      return webhookError(updateError.message);
    }

    await logWebhook(supabaseAdmin, {
      tenant_id: tenant.id,
      source: 'perspective',
      event_type: 'discovery_form_submitted',
      payload: body,
      contact_id: existingContact.id,
      status: 'processed',
    });

    return webhookSuccess({
      contact_id: existingContact.id,
      message: 'Discovery form submitted - existing contact updated',
      tenant: tenantSlug,
      is_new: false,
    });
  }

  // Create new contact for discovery funnel
  console.log(`[${tenantSlug}] Discovery funnel: creating new contact for ${email}`);

  const { data: newContact, error: insertError } = await supabaseAdmin
    .from('contacts')
    .insert({
      tenant_id: tenant.id,
      email_primary: email,
      first_name: firstName || null,
      phone: phone || null,
      ad_id: adId || null,
      source: 'instagram_direct',
      funnel_variant: 'calendly_free',
      stage: 'form_submitted',
      form_submit_date: convertedAt || new Date().toISOString(),
      subscribe_date: convertedAt || new Date().toISOString(),
    })
    .select('id')
    .single();

  if (insertError) {
    await logWebhook(supabaseAdmin, {
      tenant_id: tenant.id,
      source: 'perspective',
      event_type: 'discovery_form_submitted',
      payload: body,
      status: 'error',
      error_message: insertError.message,
    });
    return webhookError(insertError.message);
  }

  // Create funnel event for the new contact
  await supabaseAdmin.from('funnel_events').insert({
    tenant_id: tenant.id,
    contact_id: newContact.id,
    event_type: 'form_submitted',
    event_timestamp: convertedAt || new Date().toISOString(),
    source: 'perspective',
    source_event_id: `perspective_discovery_${email}_${Date.now()}`,
    event_data: {
      funnel_variant: 'calendly_free',
      ad_id: adId,
      funnel_name: body.funnelName,
    },
    contact_snapshot: {
      email,
      first_name: firstName,
      phone,
      stage: 'form_submitted',
      source: 'instagram_direct',
      funnel_variant: 'calendly_free',
    },
  });

  console.log(`[${tenantSlug}] New calendly_free contact created: ${newContact.id}`);

  await logWebhook(supabaseAdmin, {
    tenant_id: tenant.id,
    source: 'perspective',
    event_type: 'discovery_form_submitted',
    payload: body,
    contact_id: newContact.id,
    status: 'processed',
  });

  return webhookSuccess({
    contact_id: newContact.id,
    message: 'Discovery form submitted - new contact created',
    tenant: tenantSlug,
    is_new: true,
    funnel_variant: 'calendly_free',
  });
}

/**
 * Handle Checkout Funnel - Updates existing contacts (original behavior)
 */
async function handleCheckoutFunnel(
  tenant: { id: string; name: string },
  data: {
    email: string;
    firstName?: string;
    phone?: string;
    convertedAt?: string;
    body: any;
    tenantSlug: string;
  }
) {
  const { email, firstName, phone, convertedAt, body, tenantSlug } = data;

  // Find contact by email (tenant-scoped)
  const { data: contact } = await supabaseAdmin
    .from('contacts')
    .select('id')
    .eq('tenant_id', tenant.id)
    .or(
      `email_primary.ilike.${email},email_booking.ilike.${email},email_payment.ilike.${email}`
    )
    .single();

  if (!contact) {
    console.warn(`[${tenantSlug}] No contact found for Perspective checkout:`, email);
    await logWebhook(supabaseAdmin, {
      tenant_id: tenant.id,
      source: 'perspective',
      event_type: 'checkout_form_submitted',
      payload: body,
      status: 'no_contact_found',
    });
    return webhookSuccess({
      message: 'No contact found - they may not have had discovery call yet',
      tenant: tenantSlug,
    });
  }

  // Update contact with checkout_started timestamp
  const updateData: any = {
    checkout_started: convertedAt || new Date().toISOString(),
  };
  if (firstName) updateData.first_name = firstName;
  if (phone) updateData.phone = phone;

  const { error: updateError } = await supabaseAdmin.rpc('update_contact_with_event', {
    p_contact_id: contact.id,
    p_update_data: updateData,
    p_event_type: 'checkout_started',
    p_source: 'perspective',
    p_source_event_id: `perspective_checkout_${email}_${Date.now()}`,
  });

  if (updateError) {
    await logWebhook(supabaseAdmin, {
      tenant_id: tenant.id,
      source: 'perspective',
      event_type: 'checkout_form_submitted',
      payload: body,
      status: 'error',
      error_message: updateError.message,
    });
    return webhookError(updateError.message);
  }

  console.log(`[${tenantSlug}] Checkout started for contact ${contact.id}: ${email}`);

  await logWebhook(supabaseAdmin, {
    tenant_id: tenant.id,
    source: 'perspective',
    event_type: 'checkout_form_submitted',
    payload: body,
    contact_id: contact.id,
    status: 'processed',
  });

  return webhookSuccess({
    contact_id: contact.id,
    message: 'Checkout started timestamp recorded',
    tenant: tenantSlug,
  });
}

/**
 * Normalize phone number
 */
function normalizePhone(phone?: string): string | undefined {
  if (!phone) return undefined;
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return digits.length > 0 ? `+${digits}` : undefined;
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
    message: 'Perspective webhook endpoint is live',
    purpose: 'Handles both discovery funnel (creates contacts) and checkout funnel (updates contacts)',
    funnels: {
      discovery: 'funnelName contains "discovery" or "calendly" → creates calendly_free contact',
      checkout: 'funnelName contains "checkout" → updates existing contact checkout_started',
    },
  });
}
