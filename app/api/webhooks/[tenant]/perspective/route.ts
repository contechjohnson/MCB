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
 * Creates contacts from Perspective form submissions.
 * Stores the RAW funnelName in funnel_variant for flexible analysis.
 * Uses tags for categorization (booking_source, funnel_type, etc.)
 *
 * PPCU Live Funnels (examples):
 * - LVNG_BOF_Calendly → funnel_variant = 'LVNG_BOF_Calendly', tags.booking_source = 'calendly'
 * - LVNG_BOF_JANE → funnel_variant = 'LVNG_BOF_JANE', tags.booking_source = 'jane'
 * - LVNG_TOFMOF_MANYCHAT_JANE → funnel_variant = 'LVNG_TOFMOF_MANYCHAT_JANE', tags.booking_source = 'jane'
 *
 * Deprecated Funnels (skipped):
 * - Contains 'checkout', 'supplements', or '_lm'
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

    // Extract data from Perspective payload
    const profile = body.profile || {};
    const values = body.values || {};
    const funnelName = (body.funnelName || '').toLowerCase();

    // Skip deprecated funnels (checkout, supplements, lead magnets)
    // PPCU deprecated funnels: LVNG_CHECKOUT, LVNG_TOF_SUPPLEMENTS, LVNG_TOF_LM
    const isDeprecatedFunnel =
      funnelName.includes('checkout') ||
      funnelName.includes('supplements') ||
      funnelName.includes('_lm');

    if (isDeprecatedFunnel) {
      console.log(`[${tenantSlug}] Skipping deprecated funnel: ${body.funnelName}`);
      await logWebhook(supabaseAdmin, {
        tenant_id: tenant.id,
        source: 'perspective',
        event_type: 'deprecated_funnel',
        payload: body,
        status: 'skipped',
      });
      return webhookSuccess({
        message: 'Deprecated funnel skipped',
        funnel: body.funnelName,
        tenant: tenantSlug,
      });
    }

    // Store RAW funnel name + auto-derive booking_source and traffic_source
    const rawFunnelName = body.funnelName || 'unknown';
    const funnelLower = rawFunnelName.toLowerCase();

    // Auto-derive booking_source from funnel name
    let bookingSource: string | null = null;
    if (funnelLower.includes('calendly')) {
      bookingSource = 'calendly';
    } else if (funnelLower.includes('jane')) {
      bookingSource = 'jane';
    }

    // Auto-derive traffic_source from funnel name
    let trafficSource: string | null = null;
    if (funnelLower.includes('manychat')) {
      trafficSource = 'manychat';
    } else if (funnelLower.includes('website') || funnelLower.includes('other')) {
      trafficSource = 'website_other';
    }

    // Build tags with auto-derived values + any passed from payload
    const tags: Record<string, any> = {
      funnel: rawFunnelName,
      ...(bookingSource && { booking_source: bookingSource }),
      ...(trafficSource && { traffic_source: trafficSource }),
      ...(body.tags || {}), // Accept any tags from payload (can override)
    };

    // Include perspective funnel ID if available
    if (body.funnelId) {
      tags.perspective_funnel_id = body.funnelId;
    }

    console.log(`[${tenantSlug}] Perspective webhook received:`, {
      funnelName: rawFunnelName,
      funnelId: body.funnelId,
      tags,
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
        event_type: 'discovery_form_submitted',
        payload: body,
        status: 'error',
        error_message: 'Missing email',
      });
      return webhookError('Missing email');
    }

    // Log webhook received
    await logWebhook(supabaseAdmin, {
      tenant_id: tenant.id,
      source: 'perspective',
      event_type: 'discovery_form_submitted',
      payload: body,
      status: 'received',
    });

    // All non-deprecated funnels are discovery funnels
    return await handleDiscoveryFunnel(tenant, {
      email,
      firstName,
      phone,
      adId,
      convertedAt,
      funnelVariant: rawFunnelName, // Store raw funnel name
      tags,
      body,
      tenantSlug,
    });
  } catch (error) {
    console.error(`[${tenantSlug}] Perspective webhook error:`, error);
    return webhookError(
      'Internal server error',
      error instanceof Error ? error.message : 'Unknown error'
    );
  }
}

/**
 * Handle Discovery Funnel - Creates new contacts with raw funnel_variant and tags
 */
async function handleDiscoveryFunnel(
  tenant: { id: string; name: string },
  data: {
    email: string;
    firstName?: string;
    phone?: string;
    adId?: string;
    convertedAt?: string;
    funnelVariant: string; // Raw funnel name
    tags: Record<string, any>;
    body: any;
    tenantSlug: string;
  }
) {
  const { email, firstName, phone, adId, convertedAt, funnelVariant, tags, body, tenantSlug } = data;

  // Try to find existing contact by email
  const { data: existingContact } = await supabaseAdmin
    .from('contacts')
    .select('id, tags')
    .eq('tenant_id', tenant.id)
    .or(
      `email_primary.ilike.${email},email_booking.ilike.${email},email_payment.ilike.${email}`
    )
    .single();

  if (existingContact) {
    // Contact exists - update with identity data but preserve existing tags.funnel
    console.log(
      `[${tenantSlug}] Discovery funnel: existing contact found ${existingContact.id}, updating`
    );

    // Events-first: Only update identity fields + stage
    const updateData: any = {
      stage: 'form_submitted',
      updated_at: new Date().toISOString(),
    };
    if (firstName) updateData.first_name = firstName;
    if (phone) updateData.phone = phone;
    if (adId) updateData.ad_id = adId;

    const { error: updateError } = await supabaseAdmin.rpc('update_contact_with_event', {
      p_contact_id: existingContact.id,
      p_update_data: updateData,
      p_event_type: 'form_submitted',
      p_source: 'perspective',
      p_source_event_id: `perspective_discovery_${email}_${Date.now()}`,
      p_tags: tags, // Pass tags to merge with existing
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

  // Create new contact for discovery funnel (events-first: no deprecated columns)
  console.log(`[${tenantSlug}] Discovery funnel: creating new contact for ${email} (funnel: ${funnelVariant})`);

  // Store funnel name in tags instead of deprecated funnel_variant column
  const contactTags = { ...tags, funnel: funnelVariant };

  const { data: newContact, error: insertError } = await supabaseAdmin
    .from('contacts')
    .insert({
      tenant_id: tenant.id,
      email_primary: email,
      first_name: firstName || null,
      phone: phone || null,
      ad_id: adId || null,
      source: 'instagram_direct',
      tags: contactTags, // Funnel name stored in tags.funnel
      stage: 'form_submitted',
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
      ad_id: adId,
      funnel_name: body.funnelName,
    },
    tags: contactTags, // Tags include funnel name
    contact_snapshot: {
      email,
      first_name: firstName,
      phone,
      stage: 'form_submitted',
      source: 'instagram_direct',
    },
  });

  console.log(`[${tenantSlug}] New ${funnelVariant} contact created: ${newContact.id}`);

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
    funnel_variant: funnelVariant,
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
  { params }: { params: Promise<{ tenant: string }> }
) {
  const { tenant: tenantSlug } = await params;
  const tenant = await getTenantContext(tenantSlug);
  return NextResponse.json({
    status: 'ok',
    tenant: tenantSlug,
    tenant_name: tenant?.name || 'Unknown',
    message: 'Perspective webhook endpoint is live',
    purpose: 'Creates contacts from funnels - events-first architecture',
    behavior: {
      funnel_variant: 'Stores RAW funnelName in funnel_variant column',
      tags: 'Pass-through from payload + funnel name stored as tags.funnel',
    },
    note: 'No auto-derivation - tags come from webhook payload',
    deprecated_funnels: ['checkout', 'supplements', '_lm'],
  });
}
