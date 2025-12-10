/**
 * Chatbot Webhook Endpoint
 *
 * Receives DM messages from ManyChat, processes with AI, and returns actions.
 *
 * Flow:
 * 1. Validate tenant
 * 2. Get subscriber info from payload
 * 3. Look up chatbot config (A/B routing via chatbot_AB field)
 * 4. Process message with OpenAI
 * 5. Update ManyChat custom fields
 * 6. Trigger ManyChat response flow
 * 7. Fire Meta CAPI Lead event (if qualified)
 * 8. Return 200
 *
 * ManyChat Webhook Payload (expected):
 * {
 *   "subscriber_id": "123456789",
 *   "message": "User's message text",
 *   "custom_fields": {
 *     "chatbot_AB": "A",
 *     "Conversation ID": "...",
 *     "Symptoms": "...",
 *     ...
 *   }
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  validateTenant,
  webhookError,
  webhookSuccess,
  logWebhook,
  supabaseAdmin,
} from '@/app/api/webhooks/_shared/tenant-context';
import { processChatbotMessage, ChatbotResponse } from '@/lib/chatbot/openai-client';
import { ManyChatClient, updateChatbotFields, PPCU_FIELD_IDS } from '@/lib/manychat/client';
import {
  MetaCAPIClient,
  queueCAPIEvent,
  createLeadEvent,
} from '@/lib/meta-capi/client';

/**
 * Expected payload from ManyChat webhook
 */
interface ManyChatWebhookPayload {
  subscriber_id: string;
  message?: string;
  last_input_text?: string; // Alternative field name
  custom_fields?: {
    chatbot_AB?: string;
    'Conversation ID'?: string;
    Symptoms?: string;
    'Months Postpartum'?: string;
    [key: string]: any;
  };
  // Additional subscriber data that ManyChat might send
  first_name?: string;
  last_name?: string;
  name?: string;
  email?: string;
  phone?: string;
  gender?: string;
  profile_pic?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  const startTime = Date.now();
  const { tenant: tenantSlug } = await params;

  // Validate tenant
  const { tenant, error: tenantError } = await validateTenant(tenantSlug);
  if (tenantError || !tenant) {
    return tenantError || webhookError('Unknown tenant');
  }

  let payload: ManyChatWebhookPayload;
  try {
    payload = await request.json();
  } catch (e) {
    return webhookError('Invalid JSON payload');
  }

  // Extract subscriber ID and message
  const subscriberId = payload.subscriber_id;
  const userMessage = payload.message || payload.last_input_text;

  if (!subscriberId) {
    return webhookError('Missing subscriber_id');
  }

  if (!userMessage) {
    return webhookError('Missing message');
  }

  // Log the webhook
  await logWebhook(supabaseAdmin, {
    tenant_id: tenant.id,
    source: 'chatbot',
    event_type: 'dm_received',
    payload,
    mc_id: subscriberId,
    status: 'processing',
  });

  try {
    // Get A/B test value from custom fields
    const abTestValue = payload.custom_fields?.chatbot_AB;

    // Process message with AI
    const { response, config, thread, isNewThread } = await processChatbotMessage(
      tenant.id,
      subscriberId,
      userMessage,
      abTestValue
    );

    // Initialize ManyChat client
    const manychat = ManyChatClient.fromTenant(tenant);
    if (!manychat) {
      console.warn('ManyChat not configured, skipping field updates');
    }

    // Update ManyChat custom fields
    if (manychat) {
      const fieldUpdateResult = await updateChatbotFields(manychat, subscriberId, {
        aiResponse: response.response,
        symptoms: response.symptoms || undefined,
        monthsPostpartum: response.months_postpartum || undefined,
        handledObjections: response.handled_objections || undefined,
        intendingToSendLink: response.intending_to_send_link,
        intendToSendPdf: response.intend_to_send_pdf,
        intendToSendLeadMagnet: response.intend_to_send_lead_magnet,
        alreadyBooked: response.already_booked,
        email: response.email || undefined,
      });

      if (fieldUpdateResult.status === 'error') {
        console.error('Failed to update ManyChat fields:', fieldUpdateResult.error);
      }

      // Trigger response flow to send the AI message
      if (config.response_flow_id) {
        const flowResult = await manychat.sendFlow(subscriberId, config.response_flow_id);
        if (flowResult.status === 'error') {
          console.error('Failed to trigger response flow:', flowResult.error);
        }
      }
    }

    // Fire Meta CAPI Lead event if qualified (intending to send link)
    if (response.intending_to_send_link) {
      const metaClient = MetaCAPIClient.fromTenant(tenant);

      // Get contact for additional user data
      const { data: contact } = await supabaseAdmin
        .from('contacts')
        .select('id, email, phone, first_name, last_name, fbclid, fbp, fbc, ad_id')
        .eq('tenant_id', tenant.id)
        .eq('mc_id', subscriberId)
        .single();

      if (metaClient && contact) {
        try {
          const leadEvent = createLeadEvent(
            {
              email: contact.email || response.email || payload.email,
              phone: contact.phone || payload.phone,
              firstName: contact.first_name || payload.first_name,
              lastName: contact.last_name || payload.last_name,
              fbp: contact.fbp,
              fbc: contact.fbc,
              externalId: contact.id,
            },
            {
              adId: contact.ad_id,
              contentName: `DM Qualification - ${config.config_name}`,
            }
          );

          await queueCAPIEvent(tenant.id, {
            ...leadEvent,
            contactId: contact.id,
          });

          console.log('Meta CAPI Lead event queued for contact:', contact.id);
        } catch (capiError) {
          console.error('Failed to queue CAPI event:', capiError);
          // Don't fail the webhook for CAPI errors
        }
      }
    }

    // Log success
    await logWebhook(supabaseAdmin, {
      tenant_id: tenant.id,
      source: 'chatbot',
      event_type: 'dm_processed',
      payload: {
        subscriber_id: subscriberId,
        config_name: config.config_name,
        response_length: response.response.length,
        intending_to_send_link: response.intending_to_send_link,
        processing_time_ms: Date.now() - startTime,
      },
      mc_id: subscriberId,
      status: 'processed',
    });

    // Return response (for debugging/logging in ManyChat)
    return webhookSuccess({
      message: 'Processed successfully',
      config: config.config_name,
      is_new_thread: isNewThread,
      intending_to_send_link: response.intending_to_send_link,
      processing_time_ms: Date.now() - startTime,
    });
  } catch (error) {
    console.error('Chatbot webhook error:', error);

    // Log error
    await logWebhook(supabaseAdmin, {
      tenant_id: tenant.id,
      source: 'chatbot',
      event_type: 'dm_error',
      payload,
      mc_id: subscriberId,
      status: 'error',
      error_message: error instanceof Error ? error.message : 'Unknown error',
    });

    // Always return 200 to prevent ManyChat retries
    return webhookError(
      'Processing error',
      error instanceof Error ? error.message : 'Unknown error'
    );
  }
}

/**
 * Handle GET requests (health check)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  const { tenant: tenantSlug } = await params;

  const { tenant, error } = await validateTenant(tenantSlug);
  if (error || !tenant) {
    return NextResponse.json({ error: 'Unknown tenant' }, { status: 404 });
  }

  return NextResponse.json({
    status: 'ok',
    tenant: tenant.slug,
    endpoint: 'chatbot',
    timestamp: new Date().toISOString(),
  });
}
