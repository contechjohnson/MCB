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
 * - checkout_form_submitted: Customer filled checkout form
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

    console.log(`[${tenantSlug}] Perspective webhook received:`, {
      hasFunnelId: !!body.funnelId,
      hasProfile: !!body.profile,
      timestamp: new Date().toISOString(),
    });

    // Extract data from Perspective payload
    const profile = body.profile || {};
    const values = body.values || {};

    const email = (profile.email?.value || values.email)?.toLowerCase().trim();
    const firstName = profile.firstName?.value || values.firstName;
    const phone = profile.phone?.value || values.phone;
    const convertedAt = values.ps_converted_at || body.meta?.ps_converted_at;

    if (!email) {
      return webhookError('Missing email');
    }

    // Log webhook received
    await logWebhook(supabaseAdmin, {
      tenant_id: tenant.id,
      source: 'perspective',
      event_type: 'checkout_form_submitted',
      payload: body,
      status: 'received',
    });

    // Find contact by email (tenant-scoped)
    const { data: contact } = await supabaseAdmin
      .from('contacts')
      .select('id')
      .eq('tenant_id', tenant.id)
      .or(`email_primary.ilike.${email},email_booking.ilike.${email},email_payment.ilike.${email}`)
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
      p_source_event_id: `perspective_${email}_${Date.now()}`,
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
  } catch (error) {
    console.error(`[${tenantSlug}] Perspective webhook error:`, error);
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
    message: 'Perspective webhook endpoint is live',
    purpose: 'Tracks when customers start checkout (fill out qualification form)',
  });
}
