import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Admin client for bypassing RLS
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
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
 * Strategy: When webhook fires, we PULL full data from ManyChat API
 * This ensures we always get the latest conversation state
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    console.log('ManyChat webhook received:', {
      event: body.event_type,
      subscriber_id: body.subscriber_id,
      timestamp: new Date().toISOString()
    });

    // Extract data from webhook
    const subscriberId = body.subscriber_id;
    const eventType = body.event_type; // 'contact_created', 'dm_qualified', 'link_sent', 'link_clicked'

    if (!subscriberId) {
      console.error('No subscriber_id in webhook');
      return NextResponse.json({ error: 'Missing subscriber_id' }, { status: 200 });
    }

    // Log the webhook
    await supabaseAdmin.from('webhook_logs').insert({
      source: 'manychat',
      event_type: eventType,
      MC_ID: subscriberId,
      payload: body,
      status: 'received'
    });

    // Fetch full subscriber data from ManyChat API
    const manychatData = await fetchManyChatData(subscriberId);

    if (!manychatData) {
      console.error('Failed to fetch ManyChat data');
      await supabaseAdmin.from('webhook_logs').insert({
        source: 'manychat',
        event_type: eventType,
        MC_ID: subscriberId,
        payload: body,
        status: 'error',
        error_message: 'Failed to fetch data from ManyChat API'
      });
      return NextResponse.json({ error: 'Failed to fetch ManyChat data' }, { status: 200 });
    }

    // Find or create contact
    const contactId = await findOrCreateContact(subscriberId);

    // Update contact based on event type
    const updateData = buildUpdateData(eventType, manychatData);

    const { error: updateError } = await supabaseAdmin
      .from('contacts')
      .update(updateData)
      .eq('id', contactId);

    if (updateError) {
      console.error('Error updating contact:', updateError);
      await supabaseAdmin.from('webhook_logs').insert({
        source: 'manychat',
        event_type: eventType,
        MC_ID: subscriberId,
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
      MC_ID: subscriberId,
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

  // Create new contact
  const { data: newContact, error } = await supabaseAdmin
    .from('contacts')
    .insert({
      MC_ID: subscriberId,
      subscribe_date: new Date().toISOString(),
      stage: 'new_lead'
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
 */
function buildUpdateData(eventType: string, manychatData: any) {
  const customFields = manychatData.custom_fields || {};

  // Base data (always update)
  const baseData: any = {
    first_name: manychatData.first_name || null,
    last_name: manychatData.last_name || null,
    email_primary: manychatData.email || null,
    phone: manychatData.phone || null,
    IG: manychatData.instagram_username || null,
    FB: manychatData.name || null,
    updated_at: new Date().toISOString()
  };

  // Event-specific updates
  switch (eventType) {
    case 'contact_created':
      return {
        ...baseData,
        subscribe_date: new Date().toISOString(),
        stage: 'new_lead'
      };

    case 'dm_qualified':
      // They answered BOTH questions (final state)
      return {
        ...baseData,
        Q1_question: customFields.Q1 || customFields.months_postpartum || null,
        Q2_question: customFields.Q2 || customFields.symptoms || null,
        objections: customFields.objections || null,
        lead_summary: customFields.lead_summary || null,
        thread_ID: customFields.thread_id || null,
        DM_qualified_date: new Date().toISOString(),
        stage: 'DM_qualified'
      };

    case 'link_sent':
      return {
        ...baseData,
        link_send_date: new Date().toISOString(),
        stage: 'landing_link_sent'
      };

    case 'link_clicked':
      return {
        ...baseData,
        link_click_date: new Date().toISOString(),
        stage: 'landing_link_clicked'
      };

    default:
      // Unknown event, just update base data
      return baseData;
  }
}
