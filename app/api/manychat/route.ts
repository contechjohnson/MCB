import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Admin client for bypassing RLS
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: { persistSession: false },
    db: { schema: 'public' },
    global: { headers: { 'x-client-info': 'supabase-js-node' } }
  }
);

// ManyChat API base URL
const MANYCHAT_API_URL = 'https://api.manychat.com/fb/subscriber';

/**
 * ManyChat Webhook Handler
 *
 * Handles multiple events from ManyChat:
 * - contact_created: New subscriber
 * - dm_qualified: Answered both qualification questions (FINAL state)
 * - link_sent: Booking link sent
 * - link_clicked: They clicked the booking link
 *
 * Strategy: Accept full subscriber payload from ManyChat
 * Same payload structure, different event_type determines which timestamp to create
 * Updates Q1, Q2, objections on ALL events (answers might change)
 */
export async function POST(request: NextRequest) {
  try {
    let body = await request.json();

    // Handle array payload (ManyChat sometimes sends array)
    if (Array.isArray(body) && body.length > 0) {
      body = body[0];
    }

    console.log('ManyChat webhook received:', {
      hasSubscriber: !!body.subscriber,
      hasSubscriberId: !!body.subscriber_id,
      eventType: body.event_type,
      timestamp: new Date().toISOString()
    });

    // Extract data - handle both formats
    let subscriberId: string | null = null;
    let eventType: string | null = null;
    let manychatData: any = null;

    // Format 1: Full payload with subscriber object (what you're actually sending)
    if (body.subscriber) {
      subscriberId = body.subscriber.id;
      manychatData = body.subscriber; // We already have full data!

      // Determine event type from custom fields if not explicitly provided
      if (body.event_type) {
        eventType = body.event_type;
      } else {
        // Infer event type from custom fields
        const cf = body.subscriber.custom_fields || {};
        if (cf.MCB_CLICKED_LINK) {
          eventType = 'link_clicked';
        } else if (cf.MCB_SENT_LINK) {
          eventType = 'link_sent';
        } else if (cf.MCB_LEAD_CONTACT) {
          eventType = 'dm_qualified';
        } else if (cf.MCB_LEAD) {
          eventType = 'contact_created';
        } else {
          eventType = 'contact_update';
        }
      }
    }
    // Format 2: Simple payload with just subscriber_id and event_type
    else if (body.subscriber_id) {
      subscriberId = body.subscriber_id;
      eventType = body.event_type;
    }

    if (!subscriberId) {
      console.error('No subscriber_id in webhook');
      return NextResponse.json({ error: 'Missing subscriber_id' }, { status: 200 });
    }

    // Log the webhook
    await supabaseAdmin.from('webhook_logs').insert({
      source: 'manychat',
      event_type: eventType,
      mc_id: subscriberId,
      payload: body,
      status: 'received'
    });

    // Fetch full subscriber data from ManyChat API (only if we don't have it)
    if (!manychatData) {
      manychatData = await fetchManyChatData(subscriberId);

      if (!manychatData) {
        console.error('Failed to fetch ManyChat data');
        await supabaseAdmin.from('webhook_logs').insert({
          source: 'manychat',
          event_type: eventType,
          mc_id: subscriberId,
          payload: body,
          status: 'error',
          error_message: 'Failed to fetch data from ManyChat API'
        });
        return NextResponse.json({ error: 'Failed to fetch ManyChat data' }, { status: 200 });
      }
    }

    // Find or create contact
    const contactId = await findOrCreateContact(subscriberId);

    // Update contact based on event type (using function to bypass schema cache)
    const updateData = buildUpdateData(eventType, manychatData);

    const { error: updateError } = await supabaseAdmin
      .rpc('update_contact_dynamic', {
        contact_id: contactId,
        update_data: updateData
      });

    if (updateError) {
      console.error('Error updating contact:', updateError);
      await supabaseAdmin.from('webhook_logs').insert({
        source: 'manychat',
        event_type: eventType,
        mc_id: subscriberId,
        payload: body,
        status: 'error',
        error_message: updateError.message
      });
      return NextResponse.json({ error: updateError.message }, { status: 200 });
    }

    console.log(`Successfully processed ${eventType} for ${subscriberId}`);

    // Update webhook log status
    await supabaseAdmin.from('webhook_logs').insert({
      source: 'manychat',
      event_type: eventType,
      mc_id: subscriberId,
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
    console.error('ManyChat webhook error:', error);
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
    message: 'ManyChat webhook endpoint is live',
    endpoints: {
      POST: 'Receives ManyChat webhooks',
      events: ['contact_created', 'dm_qualified', 'link_sent', 'link_clicked']
    }
  });
}

/**
 * Fetch full subscriber data from ManyChat API
 */
async function fetchManyChatData(subscriberId: string) {
  try {
    const response = await fetch(
      `${MANYCHAT_API_URL}/getInfo?subscriber_id=${subscriberId}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${process.env.MANYCHAT_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      console.error('ManyChat API error:', response.status, response.statusText);
      return null;
    }

    const data = await response.json();
    return data.data; // ManyChat wraps response in { status: 'success', data: {...} }
  } catch (error) {
    console.error('Error fetching ManyChat data:', error);
    return null;
  }
}

/**
 * Find existing contact by MC_ID or create new one
 */
async function findOrCreateContact(subscriberId: string): Promise<string> {
  // Try to find existing contact
  const { data: existingId } = await supabaseAdmin
    .rpc('find_contact_by_mc_id', { search_mc_id: subscriberId });

  if (existingId) {
    return existingId;
  }

  // Create new contact using raw SQL to bypass schema cache
  const { data: newContact, error } = await supabaseAdmin
    .rpc('create_contact_with_mc_id', {
      mc_id: subscriberId,
      sub_date: new Date().toISOString(),
      contact_stage: 'new_lead'
    });

  if (error) {
    throw new Error(`Failed to create contact: ${error.message}`);
  }

  return newContact;
}

/**
 * Build update data based on event type and ManyChat data
 */
function buildUpdateData(eventType: string | null, manychatData: any) {
  const customFields = manychatData.custom_fields || {};

  // Base data (always update every time - freshest data wins)
  const baseData: any = {
    first_name: manychatData.first_name || null,
    last_name: manychatData.last_name || null,
    email_primary: manychatData.email || customFields['custom field email'] || customFields.MCB_SEARCH_EMAIL || null,
    phone: manychatData.phone || manychatData.whatsapp_phone || null,
    IG: manychatData.ig_username || manychatData.instagram_username || null,
    ig_id: manychatData.ig_id || null,
    FB: manychatData.name || null,
    AD_ID: customFields.AD_ID || customFields.ADID || null,
    chatbot_AB: customFields.chatbot_AB || customFields['Chatbot AB Test'] || null,
    thread_ID: customFields.thread_id || customFields['Conversation ID'] || null,
    trigger_word: customFields.trigger_word || customFields['All Tags'] || null,
    subscribed: manychatData.subscribed || null,
    ig_last_interaction: manychatData.ig_last_interaction || null,
    // Source: Use custom field if provided, otherwise default to instagram
    // IMPORTANT: If contact had 'instagram_historical', overwrite it with new live source
    // This ensures historical imports get updated to live sources when new events occur
    source: customFields.source || customFields.Source || 'instagram',
    updated_at: new Date().toISOString()
  };

  // Question fields (update on ALL events - answers might change!)
  // Q1 = Symptoms (first question), Q2 = Months (second question)
  const questionFields: any = {
    Q1_question: customFields.Symptoms || null,
    Q2_question: customFields['Months Postpartum'] || customFields['How Far Postpartum'] || null,
    objections: customFields.Objections || null
  };

  // Map ManyChat's DATE_* custom fields to database columns
  // These are datetime strings from ManyChat, use them if available
  // Otherwise fall back to auto-generated timestamps based on event type
  const dateFields: any = {};

  if (customFields.DATE_LINK_SENT) {
    dateFields.link_send_date = customFields.DATE_LINK_SENT;
  }
  if (customFields.DATE_LINK_CLICKED) {
    dateFields.link_click_date = customFields.DATE_LINK_CLICKED;
  }
  if (customFields.DATE_FORM_FILLED) {
    dateFields.form_submit_date = customFields.DATE_FORM_FILLED;
  }
  if (customFields.DATE_DM_QUALIFIED) {
    dateFields.DM_qualified_date = customFields.DATE_DM_QUALIFIED;
  }
  if (customFields.DATE_MEETING_BOOKED) {
    dateFields.appointment_date = customFields.DATE_MEETING_BOOKED;
  }
  if (customFields.DATE_MEETING_HELD) {
    dateFields.appointment_held_date = customFields.DATE_MEETING_HELD;
  }
  // Note: DATE_PURCHASE is handled by Stripe/Denefits webhooks

  // Event-specific updates
  switch (eventType) {
    case 'contact_created':
      return {
        ...baseData,
        ...questionFields,  // Include Q1, Q2, objections
        ...dateFields,
        subscribe_date: new Date().toISOString(),  // Webhook timestamp
        stage: 'new_lead'
      };

    case 'dm_qualified':
      // They answered BOTH questions (final state)
      return {
        ...baseData,
        ...questionFields,  // Include Q1, Q2, objections
        ...dateFields,
        lead_summary: customFields['Cody > Response'] || null,
        DM_qualified_date: new Date().toISOString(),  // Webhook timestamp
        stage: 'DM_qualified'
      };

    case 'link_sent':
      return {
        ...baseData,
        ...questionFields,  // Include Q1, Q2, objections (might have changed!)
        ...dateFields,
        link_send_date: new Date().toISOString(),  // Webhook timestamp
        stage: 'landing_link_sent'
      };

    case 'link_clicked':
      return {
        ...baseData,
        ...questionFields,  // Include Q1, Q2, objections (might have changed!)
        ...dateFields,
        link_click_date: new Date().toISOString(),  // Webhook timestamp
        stage: 'landing_link_clicked'
      };

    default:
      // Unknown event or contact_update - just update all available data
      return {
        ...baseData,
        ...questionFields,
        ...dateFields,
        lead_summary: customFields['Cody > Response'] || null
      };
  }
}
