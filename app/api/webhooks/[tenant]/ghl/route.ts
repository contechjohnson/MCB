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
  createAddToCartEvent,
} from '@/lib/meta-capi/client';

/**
 * Multi-Tenant GoHighLevel Webhook Handler
 *
 * Route: POST /api/webhooks/[tenant]/ghl
 * Example: POST /api/webhooks/ppcu/ghl
 *
 * Events:
 * - OpportunityCreate: New booking/opportunity
 * - MeetingCompleted: Meeting attended
 * - PackageSent: Treatment package sent
 * - ContactUpdate: Contact info updated
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

    console.log(`[${tenantSlug}] GHL webhook received:`, {
      hasContactId: !!body.contact_id,
      hasOpportunity: !!body.opportunity_name,
      pipelineStage: body.pipleline_stage || body.pipeline_stage,
      timestamp: new Date().toISOString(),
    });

    // Extract data from webhook
    const customData = body.customData || {};
    const ghlContactId = customData.contact_id || body.contact_id;
    const eventType = customData.event_type || body.type || determineEventTypeFromStage(body);
    const email = (body.email || customData.email)?.toLowerCase().trim();
    const phone = normalizePhone(customData.phone || body.phone);

    if (!ghlContactId) {
      return webhookError('Missing contact_id');
    }

    // Skip NO SHOW events - just log and return success
    if (eventType === 'NoShow') {
      console.log(`[${tenantSlug}] Skipping NO SHOW event for GHL contact ${ghlContactId}`);
      await logWebhook(supabaseAdmin, {
        tenant_id: tenant.id,
        source: 'ghl',
        event_type: 'NoShow',
        payload: body,
        ghl_id: ghlContactId,
        status: 'skipped',
      });
      return webhookSuccess({
        message: 'NO SHOW event skipped',
        ghl_id: ghlContactId,
        tenant: tenantSlug,
      });
    }

    // Log webhook received
    await logWebhook(supabaseAdmin, {
      tenant_id: tenant.id,
      source: 'ghl',
      event_type: eventType,
      payload: body,
      ghl_id: ghlContactId,
      status: 'received',
    });

    // Find or create contact (tenant-scoped)
    const contactId = await findOrCreateContactGHL(tenant.id, {
      ghlId: ghlContactId,
      mcId: customData.MC_ID || undefined,
      email: email,
      phone: phone || undefined,
      firstName: customData.first_name || body.first_name,
      lastName: customData.last_name || body.last_name,
      source: customData.source || undefined,
    });

    // Fetch current contact state to check for existing dates (prevents overwriting)
    const { data: currentContact } = await supabaseAdmin
      .from('contacts')
      .select('appointment_held_date, appointment_date')
      .eq('id', contactId)
      .single();

    // Build update data based on event (pass current state to prevent overwrites)
    const updateData = buildGHLUpdateData(eventType, body, {
      hasAppointmentHeldDate: !!currentContact?.appointment_held_date,
      hasAppointmentDate: !!currentContact?.appointment_date,
    });

    // Map GHL event types to standardized event types
    const eventTypeMap: Record<string, string> = {
      'OpportunityCreate': 'appointment_scheduled',
      'MeetingCompleted': 'appointment_held',
      'PackageSent': 'package_sent',
      'ContactUpdate': 'contact_updated',
    };

    const standardEventType = eventType ? eventTypeMap[eventType] || null : null;

    // Update contact AND create event (dual-write)
    const { error: updateError } = await supabaseAdmin.rpc('update_contact_with_event', {
      p_contact_id: contactId,
      p_update_data: updateData,
      p_event_type: standardEventType,
      p_source: 'ghl',
      p_source_event_id: standardEventType ? `ghl_${ghlContactId}_${Date.now()}` : null,
    });

    if (updateError) {
      await logWebhook(supabaseAdmin, {
        tenant_id: tenant.id,
        source: 'ghl',
        event_type: eventType,
        payload: body,
        ghl_id: ghlContactId,
        status: 'error',
        error_message: updateError.message,
      });
      return webhookError(updateError.message);
    }

    console.log(`[${tenantSlug}] Successfully processed ${eventType} for GHL contact ${ghlContactId}`);

    // Fire Meta CAPI AddToCart event for meeting bookings
    const stage = (body.customData?.pipeline_stage || body.pipleline_stage || body.pipeline_stage || '').toLowerCase();
    if (eventType === 'OpportunityCreate' && (stage.includes('booked') || stage.includes('scheduled'))) {
      const metaClient = MetaCAPIClient.fromTenant(tenant);

      // Get contact details for CAPI
      const { data: contact } = await supabaseAdmin
        .from('contacts')
        .select('id, email_primary, email_booking, phone, first_name, last_name, fbclid, fbp, fbc, ad_id')
        .eq('id', contactId)
        .single();

      if (metaClient && contact) {
        try {
          const addToCartEvent = createAddToCartEvent(
            {
              email: contact.email_booking || contact.email_primary || email,
              phone: contact.phone || phone || undefined,
              firstName: contact.first_name,
              lastName: contact.last_name,
              fbp: contact.fbp,
              fbc: contact.fbc,
              externalId: contact.id,
            },
            {
              adId: contact.ad_id,
              contentName: 'Consultation Booking',
            }
          );

          await queueCAPIEvent(tenant.id, {
            ...addToCartEvent,
            contactId: contact.id,
          });

          console.log(`[${tenantSlug}] Meta CAPI AddToCart event queued for contact:`, contact.id);
        } catch (capiError) {
          console.error(`[${tenantSlug}] Failed to queue CAPI event:`, capiError);
          // Don't fail the webhook for CAPI errors
        }
      }
    }

    // Log success
    await logWebhook(supabaseAdmin, {
      tenant_id: tenant.id,
      source: 'ghl',
      event_type: eventType,
      payload: body,
      ghl_id: ghlContactId,
      contact_id: contactId,
      status: 'processed',
    });

    return webhookSuccess({
      contact_id: contactId,
      event_type: eventType,
      tenant: tenantSlug,
    });
  } catch (error) {
    console.error(`[${tenantSlug}] GHL webhook error:`, error);
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
    message: 'GoHighLevel webhook endpoint is live',
    events: ['OpportunityCreate', 'MeetingCompleted', 'PackageSent', 'ContactUpdate'],
  });
}

/**
 * Find existing contact or create new one (tenant-scoped)
 */
async function findOrCreateContactGHL(
  tenantId: string,
  data: {
    ghlId: string;
    mcId?: string | null;
    email?: string;
    phone?: string;
    firstName?: string;
    lastName?: string;
    source?: string | null;
  }
): Promise<string> {
  // Try to find by GHL ID within tenant
  const { data: existingByGhl } = await supabaseAdmin
    .from('contacts')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('ghl_id', data.ghlId)
    .single();

  if (existingByGhl) {
    return existingByGhl.id;
  }

  // Try to find by MC ID within tenant (if provided)
  if (data.mcId) {
    const { data: existingByMc } = await supabaseAdmin
      .from('contacts')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('mc_id', data.mcId)
      .single();

    if (existingByMc) {
      // Link GHL ID to existing ManyChat contact
      await supabaseAdmin.rpc('update_contact_dynamic', {
        contact_id: existingByMc.id,
        update_data: { ghl_id: data.ghlId },
      });
      return existingByMc.id;
    }
  }

  // Try to find by email within tenant
  if (data.email) {
    const { data: existingByEmail } = await supabaseAdmin
      .from('contacts')
      .select('id')
      .eq('tenant_id', tenantId)
      .ilike('email_primary', data.email)
      .single();

    if (existingByEmail) {
      // Link GHL ID to existing contact
      await supabaseAdmin.rpc('update_contact_dynamic', {
        contact_id: existingByEmail.id,
        update_data: { ghl_id: data.ghlId },
      });
      return existingByEmail.id;
    }
  }

  // Create new contact - default to jane_paid funnel (ManyChat/DM flow)
  // Contacts from Perspective discovery funnel will already exist with calendly_free
  const { data: newContact, error } = await supabaseAdmin
    .from('contacts')
    .insert({
      tenant_id: tenantId,
      ghl_id: data.ghlId,
      email_primary: data.email || null,
      phone: data.phone || null,
      first_name: data.firstName || null,
      last_name: data.lastName || null,
      stage: 'form_submitted',
      source: data.source || 'website',
      funnel_variant: 'jane_paid', // Default for GHL-created contacts
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to create contact: ${error.message}`);
  }

  return newContact.id;
}

/**
 * Determine event type from GHL pipeline stage
 */
function determineEventTypeFromStage(body: any): string {
  const customData = body.customData || {};
  const customStage = (customData.pipeline_stage || '').toLowerCase();
  const ghlStage = (body.pipleline_stage || body.pipeline_stage || '').toLowerCase();

  // Skip NO SHOW - don't process these
  if (ghlStage.includes('no show') || ghlStage.includes('noshow') || ghlStage.includes('no-show')) {
    return 'NoShow';
  }

  // If customData.pipeline_stage exists, use it (Jane/CLARA pipeline)
  if (customStage === 'form_filled' || customStage === 'meeting_booked') {
    return 'OpportunityCreate';
  }
  if (customStage === 'meeting_attended') {
    return 'MeetingCompleted';
  }
  if (customStage === 'package_sent') {
    return 'PackageSent';
  }

  // FREE DISCOVERY CALL PIPELINE stages (no customData)
  // "DC BOOKED" = meeting booked
  if (ghlStage === 'dc booked') {
    return 'OpportunityCreate';
  }
  // "Completed DC" = meeting attended
  if (ghlStage === 'completed dc') {
    return 'MeetingCompleted';
  }

  // Fallback detection
  if (ghlStage.includes('scheduled') || ghlStage.includes('booked')) {
    return 'OpportunityCreate';
  }
  if (ghlStage.includes('completed') || ghlStage.includes('attended')) {
    return 'MeetingCompleted';
  }
  if (ghlStage.includes('package') || ghlStage.includes('sent')) {
    return 'PackageSent';
  }

  return 'ContactUpdate';
}

/**
 * Build update data based on GHL event type
 * @param currentState - Current contact state to prevent overwriting certain fields
 */
function buildGHLUpdateData(
  eventType: string,
  body: any,
  currentState: { hasAppointmentHeldDate?: boolean; hasAppointmentDate?: boolean } = {}
) {
  const customData = body.customData || {};
  const customFields = body;

  const baseData: any = {
    email_booking: (body.email || customData.email)?.toLowerCase().trim() || null,
    phone: normalizePhone(customData.phone || body.phone) || null,
    first_name: customData.first_name || body.first_name || null,
    last_name: customData.last_name || body.last_name || null,
    mc_id: customData.MC_ID || customFields.MC_ID || null,
    ad_id: customData.AD_ID || customFields.AD_ID || null,
    thread_id: customData.THREAD_ID || customFields.THREAD_ID || null,
    source:
      customData.source ||
      (customData.MC_ID || customFields.MC_ID || customData.AD_ID || customFields.AD_ID
        ? 'instagram'
        : 'website'),
    updated_at: new Date().toISOString(),
  };

  const stage = (customData.pipeline_stage || body.pipleline_stage || body.pipeline_stage || '').toLowerCase();
  const appointmentTime = body['Discovery Call Time (EST)'] || body.appointment_start_time;

  if (eventType === 'OpportunityCreate' || eventType.includes('Opportunity')) {
    if (stage === 'form_filled') {
      return { ...baseData, form_submit_date: new Date().toISOString(), stage: 'form_submitted' };
    }
    if (stage === 'meeting_booked') {
      return {
        ...baseData,
        stage: 'meeting_booked',
        appointment_date: appointmentTime ? new Date(appointmentTime).toISOString() : new Date().toISOString(),
      };
    }
    // DC BOOKED from FREE DISCOVERY CALL PIPELINE
    if (stage === 'dc booked') {
      return {
        ...baseData,
        stage: 'meeting_booked',
        appointment_date: appointmentTime ? new Date(appointmentTime).toISOString() : new Date().toISOString(),
      };
    }
    if (stage === 'meeting_attended') {
      // Only set appointment_held_date if not already set (prevents overwriting)
      const result: any = { ...baseData, stage: 'meeting_held' };
      if (!currentState.hasAppointmentHeldDate) {
        result.appointment_held_date = new Date().toISOString();
      }
      return result;
    }
    if (stage === 'package_sent') {
      return { ...baseData, package_sent_date: new Date().toISOString(), stage: 'package_sent' };
    }

    // Fallback
    const opportunityData: any = { ...baseData, form_submit_date: new Date().toISOString() };
    if (stage.includes('scheduled') || stage.includes('booked') || appointmentTime) {
      opportunityData.appointment_date = appointmentTime
        ? new Date(appointmentTime).toISOString()
        : new Date().toISOString();
      opportunityData.stage = 'meeting_booked';
    }
    if (stage.includes('completed') || stage.includes('attended') || stage.includes('show')) {
      // Only set appointment_held_date if not already set (prevents overwriting)
      if (!currentState.hasAppointmentHeldDate) {
        opportunityData.appointment_held_date = new Date().toISOString();
      }
      opportunityData.stage = 'meeting_held';
    }
    if (stage.includes('package') || stage.includes('sent')) {
      opportunityData.package_sent_date = new Date().toISOString();
      opportunityData.stage = 'package_sent';
    }
    return opportunityData;
  }

  if (eventType === 'MeetingCompleted') {
    // Only set appointment_held_date if not already set (prevents overwriting from multiple triggers)
    const result: any = { ...baseData, stage: 'meeting_held' };
    if (!currentState.hasAppointmentHeldDate) {
      result.appointment_held_date = new Date().toISOString();
    }
    return result;
  }

  if (eventType === 'PackageSent') {
    return { ...baseData, package_sent_date: new Date().toISOString(), stage: 'package_sent' };
  }

  if (eventType === 'ContactCreate' || eventType === 'ContactUpdate') {
    return { ...baseData, stage: 'form_submitted' };
  }

  return baseData;
}

/**
 * Normalize phone number
 */
function normalizePhone(phone?: string): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return digits.length > 0 ? `+${digits}` : null;
}
