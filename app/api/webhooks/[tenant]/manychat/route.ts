import { NextRequest, NextResponse } from 'next/server';
import {
  getTenantContext,
  supabaseAdmin,
  webhookError,
  webhookSuccess,
  logWebhook,
} from '../../_shared/tenant-context';

// ManyChat API base URL
const MANYCHAT_API_URL = 'https://api.manychat.com/fb/subscriber';

/**
 * Multi-Tenant ManyChat Webhook Handler
 *
 * Route: POST /api/webhooks/[tenant]/manychat
 * Example: POST /api/webhooks/ppcu/manychat
 *
 * Events:
 * - contact_created: New subscriber
 * - dm_qualified: Answered qualification questions
 * - link_sent: Booking link sent
 * - link_clicked: They clicked the booking link
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  const { tenant: tenantSlug } = await params;

  // Declare variables outside try block for error handling access
  let tenant: Awaited<ReturnType<typeof getTenantContext>> = null;
  let body: any = null;
  let subscriberId: string | null = null;
  let eventType: string | null = null;

  try {
    // Get tenant context
    tenant = await getTenantContext(tenantSlug);
    if (!tenant) {
      console.error('Unknown tenant:', tenantSlug);
      return NextResponse.json({ error: 'Unknown tenant' }, { status: 404 });
    }

    body = await request.json();

    // Handle array payload (ManyChat sometimes sends array)
    if (Array.isArray(body) && body.length > 0) {
      body = body[0];
    }

    console.log(`[${tenantSlug}] ManyChat webhook received:`, {
      hasSubscriber: !!body.subscriber,
      hasSubscriberId: !!body.subscriber_id,
      eventType: body.event_type,
      timestamp: new Date().toISOString(),
    });

    // Extract data - handle both formats
    let manychatData: any = null;

    if (body.subscriber) {
      subscriberId = body.subscriber.id;
      manychatData = body.subscriber;

      if (body.event_type) {
        eventType = body.event_type;
      } else {
        const cf = body.subscriber.custom_fields || {};
        if (cf.MCB_CLICKED_LINK) eventType = 'link_clicked';
        else if (cf.MCB_SENT_LINK) eventType = 'link_sent';
        else if (cf.MCB_LEAD_CONTACT) eventType = 'dm_qualified';
        else if (cf.MCB_LEAD) eventType = 'contact_created';
        else eventType = 'contact_update';
      }
    } else if (body.subscriber_id) {
      subscriberId = body.subscriber_id;
      eventType = body.event_type;
    }

    if (!subscriberId) {
      return webhookError('Missing subscriber_id');
    }

    // Log webhook received
    await logWebhook(supabaseAdmin, {
      tenant_id: tenant.id,
      source: 'manychat',
      event_type: eventType || 'unknown',
      payload: body,
      mc_id: subscriberId,
      status: 'received',
    });

    console.log(`[${tenantSlug}] Logged 'received', hasData=${!!manychatData}, subscriberId=${subscriberId}`);

    // Fetch full subscriber data from ManyChat API if not provided
    if (!manychatData) {
      console.log(`[${tenantSlug}] Fetching ManyChat data for ${subscriberId}...`);
      const apiKey = tenant.credentials.manychat?.api_key || process.env.MANYCHAT_API_KEY;
      manychatData = await fetchManyChatData(subscriberId, apiKey);

      if (!manychatData) {
        await logWebhook(supabaseAdmin, {
          tenant_id: tenant.id,
          source: 'manychat',
          event_type: eventType || 'unknown',
          payload: body,
          mc_id: subscriberId,
          status: 'error',
          error_message: 'Failed to fetch data from ManyChat API',
        });
        return webhookError('Failed to fetch ManyChat data');
      }
    }

    // Find or create contact (tenant-scoped)
    console.log(`[${tenantSlug}] Finding/creating contact for ${subscriberId}...`);
    const contactId = await findOrCreateContact(tenant.id, subscriberId);
    console.log(`[${tenantSlug}] Contact ID: ${contactId}`);

    // Build update data
    const updateData = buildUpdateData(eventType, manychatData);
    console.log(`[${tenantSlug}] Update data built, calling RPC...`);

    // Map ManyChat event types to standardized event types
    const eventTypeMap: Record<string, string> = {
      'contact_created': 'contact_subscribed',
      'dm_qualified': 'dm_qualified',
      'link_sent': 'link_sent',
      'link_clicked': 'link_clicked',
      'contact_update': 'contact_updated',
    };

    const standardEventType = eventType ? eventTypeMap[eventType] || null : null;

    // Build tags from ManyChat custom fields
    const customFields = manychatData.custom_fields || {};
    const tags: Record<string, any> = {};

    // Chatbot variant (A/B testing)
    const chatbotVariant = customFields.chatbot_AB || customFields['Chatbot AB Test'];
    if (chatbotVariant) {
      tags.chatbot = chatbotVariant;
    }

    // Source tag if available
    if (customFields.source || customFields.Source) {
      tags.source = customFields.source || customFields.Source;
    }

    // Update contact AND create event
    const { error: updateError } = await supabaseAdmin.rpc('update_contact_with_event', {
      p_contact_id: contactId,
      p_update_data: updateData,
      p_event_type: standardEventType,
      p_source: 'manychat',
      p_source_event_id: standardEventType ? `mc_${subscriberId}_${Date.now()}` : null,
      p_tags: Object.keys(tags).length > 0 ? tags : null,
    });

    console.log(`[${tenantSlug}] RPC completed, error=${!!updateError}`);

    if (updateError) {
      await logWebhook(supabaseAdmin, {
        tenant_id: tenant.id,
        source: 'manychat',
        event_type: eventType || 'unknown',
        payload: body,
        mc_id: subscriberId,
        status: 'error',
        error_message: updateError.message,
      });
      return webhookError(updateError.message);
    }

    console.log(`[${tenantSlug}] Successfully processed ${eventType} for ${subscriberId}`);

    // Log success
    await logWebhook(supabaseAdmin, {
      tenant_id: tenant.id,
      source: 'manychat',
      event_type: eventType || 'unknown',
      payload: body,
      mc_id: subscriberId,
      contact_id: contactId,
      status: 'processed',
    });

    return webhookSuccess({
      contact_id: contactId,
      event_type: eventType,
      tenant: tenantSlug,
    });
  } catch (error) {
    console.error(`[${tenantSlug}] ManyChat webhook error:`, error);

    // Log error to database (safely handle undefined variables)
    try {
      await logWebhook(supabaseAdmin, {
        tenant_id: tenant?.id || null,
        source: 'manychat',
        event_type: eventType || 'unknown',
        payload: body || null,
        mc_id: subscriberId || null,
        status: 'error',
        error_message: error instanceof Error ? error.message : 'Unknown error',
      });
    } catch (logError) {
      console.error(`[${tenantSlug}] Failed to log error:`, logError);
    }

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
    message: 'ManyChat webhook endpoint is live',
    events: ['contact_created', 'dm_qualified', 'link_sent', 'link_clicked'],
  });
}

/**
 * Fetch full subscriber data from ManyChat API
 */
async function fetchManyChatData(subscriberId: string, apiKey: string | undefined) {
  if (!apiKey) {
    console.error('No ManyChat API key configured');
    return null;
  }

  try {
    // Add 5-second timeout to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(
      `${MANYCHAT_API_URL}/getInfo?subscriber_id=${subscriberId}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error('ManyChat API error:', response.status, response.statusText);
      return null;
    }

    const data = await response.json();
    return data.data;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('ManyChat API timeout after 5 seconds');
    } else {
      console.error('Error fetching ManyChat data:', error);
    }
    return null;
  }
}

/**
 * Find existing contact by MC_ID or create new one (tenant-scoped)
 */
async function findOrCreateContact(tenantId: string, subscriberId: string): Promise<string> {
  // Try to find existing contact within tenant
  const { data: existing } = await supabaseAdmin
    .from('contacts')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('mc_id', subscriberId)
    .single();

  if (existing) {
    return existing.id;
  }

  // Create new contact (events-first: no date columns, just identity + stage)
  const { data: newContact, error } = await supabaseAdmin
    .from('contacts')
    .insert({
      tenant_id: tenantId,
      mc_id: subscriberId,
      stage: 'new_lead',
      source: 'instagram',
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to create contact: ${error.message}`);
  }

  return newContact.id;
}

/**
 * Build update data based on event type and ManyChat data
 *
 * EVENTS-FIRST ARCHITECTURE:
 * - Only update identity fields + current stage on contacts
 * - All date/history tracking is done via funnel_events table
 * - Metadata like chatbot variant, thread_id go into tags JSONB
 */
function buildUpdateData(eventType: string | null, manychatData: any) {
  const customFields = manychatData.custom_fields || {};

  // Only fields that exist in the contacts table (20 columns)
  const baseData: any = {
    first_name: manychatData.first_name || null,
    last_name: manychatData.last_name || null,
    email_primary:
      manychatData.email ||
      customFields['custom field email'] ||
      customFields.MCB_SEARCH_EMAIL ||
      null,
    phone: manychatData.phone || manychatData.whatsapp_phone || null,
    ig: manychatData.ig_username || manychatData.instagram_username || null,
    ig_id: manychatData.ig_id || null,
    fb: manychatData.name || null,
    ad_id: customFields.AD_ID || customFields.ADID || null,
    source: customFields.source || customFields.Source || 'instagram',
    updated_at: new Date().toISOString(),
  };

  // Stage progression based on event type
  switch (eventType) {
    case 'contact_created':
      return { ...baseData, stage: 'new_lead' };

    case 'dm_qualified':
      return { ...baseData, stage: 'dm_qualified' };

    case 'link_sent':
      return { ...baseData, stage: 'landing_link_sent' };

    case 'link_clicked':
      return { ...baseData, stage: 'landing_link_clicked' };

    default:
      return baseData;
  }
}
