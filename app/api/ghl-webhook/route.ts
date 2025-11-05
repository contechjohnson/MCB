import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Admin client for bypassing RLS
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

/**
 * GoHighLevel Webhook Handler
 *
 * Handles events from GHL:
 * - opportunity_created: New booking/opportunity
 * - opportunity_status_change: Meeting attended, package sent, etc.
 *
 * Strategy: Find existing contact by email OR create new one
 * This handles both:
 * 1. ManyChat contacts who booked (link MC → GHL)
 * 2. Direct-to-funnel contacts (create with GHL_ID)
 */
export async function POST(request: NextRequest) {
  try {
    let body = await request.json();

    // Handle array payload
    if (Array.isArray(body) && body.length > 0) {
      body = body[0];
    }

    console.log('GHL webhook received:', {
      hasContactId: !!body.contact_id,
      hasOpportunity: !!body.opportunity_name,
      pipelineStage: body.pipleline_stage || body.pipeline_stage,
      timestamp: new Date().toISOString()
    });

    // Extract data from webhook (check customData first, fallback to root)
    const customData = body.customData || {};
    const ghlContactId = customData.contact_id || body.contact_id;
    const eventType = customData.event_type || body.type || determineEventTypeFromStage(body);
    const email = (customData.email || body.email)?.toLowerCase().trim();
    const phone = normalizePhone(customData.phone || body.phone);

    if (!ghlContactId) {
      console.error('No contact_id in GHL webhook');
      return NextResponse.json({ error: 'Missing contact_id' }, { status: 200 });
    }

    // Log the webhook
    await supabaseAdmin.from('webhook_logs').insert({
      source: 'ghl',
      event_type: eventType,
      GHL_ID: ghlContactId,
      payload: body,
      status: 'received'
    });

    // Find or create contact using smart matching
    const contactId = await findOrCreateContactGHL({
      ghlId: ghlContactId,
      email: email,
      phone: phone,
      firstName: customData.first_name || body.first_name,
      lastName: customData.last_name || body.last_name
    });

    // Build update data based on event
    const updateData = buildGHLUpdateData(eventType, body);

    const { error: updateError } = await supabaseAdmin
      .from('contacts')
      .update(updateData)
      .eq('id', contactId);

    if (updateError) {
      console.error('Error updating contact:', updateError);
      await supabaseAdmin.from('webhook_logs').insert({
        source: 'ghl',
        event_type: eventType,
        GHL_ID: ghlContactId,
        payload: body,
        status: 'error',
        error_message: updateError.message
      });
      return NextResponse.json({ error: updateError.message }, { status: 200 });
    }

    console.log(`Successfully processed ${eventType} for GHL contact ${ghlContactId}`);

    // Update webhook log
    await supabaseAdmin.from('webhook_logs').insert({
      source: 'ghl',
      event_type: eventType,
      GHL_ID: ghlContactId,
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
    console.error('GHL webhook error:', error);
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
    message: 'GoHighLevel webhook endpoint is live',
    endpoints: {
      POST: 'Receives GHL webhooks',
      events: ['OpportunityCreate', 'OpportunityStageUpdate']
    }
  });
}

/**
 * Find existing contact or create new one
 * Uses smart matching: GHL_ID > Email > Phone
 */
async function findOrCreateContactGHL(data: {
  ghlId: string;
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
}): Promise<string> {
  // Try smart finder (checks GHL_ID, email, phone)
  const { data: existingId } = await supabaseAdmin
    .rpc('find_contact_smart', {
      search_ghl_id: data.ghlId,
      search_email: data.email || null,
      search_phone: data.phone || null
    });

  if (existingId) {
    // Found existing contact - ensure GHL_ID is set (might be ManyChat contact)
    await supabaseAdmin
      .from('contacts')
      .update({ GHL_ID: data.ghlId })
      .eq('id', existingId)
      .is('GHL_ID', null); // Only update if not already set

    return existingId;
  }

  // Create new contact using function to bypass schema cache
  const { data: newContact, error } = await supabaseAdmin
    .rpc('create_contact_with_ghl_id', {
      ghl_id: data.ghlId,
      contact_email: data.email || null,
      contact_phone: data.phone || null,
      contact_first_name: data.firstName || null,
      contact_last_name: data.lastName || null,
      contact_stage: 'form_submitted',
      contact_source: 'website'
    });

  if (error) {
    throw new Error(`Failed to create contact: ${error.message}`);
  }

  return newContact;
}

/**
 * Build update data based on GHL event type
 */
/**
 * Determine event type from GHL pipeline stage
 */
function determineEventTypeFromStage(body: any): string {
  const stage = (body.pipleline_stage || body.pipeline_stage || '').toLowerCase();

  if (stage.includes('scheduled') || stage.includes('booked')) {
    return 'OpportunityCreate';
  }
  if (stage.includes('completed') || stage.includes('attended')) {
    return 'MeetingCompleted';
  }
  if (stage.includes('package') || stage.includes('sent')) {
    return 'PackageSent';
  }

  return 'ContactUpdate';
}

function buildGHLUpdateData(eventType: string, body: any) {
  // Extract custom data (where MC_ID, AD_ID, etc. live)
  const customData = body.customData || {};
  const customFields = body; // Fallback to root level

  const baseData: any = {
    email_booking: (customData.email || body.email)?.toLowerCase().trim() || null,
    phone: normalizePhone(customData.phone || body.phone) || null,
    first_name: customData.first_name || body.first_name || null,
    last_name: customData.last_name || body.last_name || null,
    // Capture MC_ID, AD_ID, THREAD_ID from customData first, then root
    MC_ID: customData.MC_ID || customFields.MC_ID || null,
    AD_ID: customData.AD_ID || customFields.AD_ID || null,
    thread_ID: customData.THREAD_ID || customFields.THREAD_ID || null,
    // Source logic: MC_ID OR AD_ID = Instagram, otherwise website
    source: (customData.MC_ID || customFields.MC_ID || customData.AD_ID || customFields.AD_ID) ? 'instagram' : 'website',
    updated_at: new Date().toISOString()
  };

  // Opportunity/booking events
  if (eventType === 'OpportunityCreate' || eventType.includes('Opportunity')) {
    const stage = (body.pipleline_stage || body.pipeline_stage || '').toLowerCase();
    const appointmentTime = body['Discovery Call Time (EST)'] || body.appointment_start_time;

    // Common booking data
    const opportunityData = {
      ...baseData,
      form_submit_date: new Date().toISOString()
    };

    // Stage-specific updates
    if (stage.includes('scheduled') || stage.includes('booked') || appointmentTime) {
      if (appointmentTime) {
        try {
          opportunityData.meeting_book_date = new Date(appointmentTime).toISOString();
        } catch {
          opportunityData.meeting_book_date = new Date().toISOString();
        }
      } else {
        opportunityData.meeting_book_date = new Date().toISOString();
      }
      opportunityData.stage = 'meeting_booked';
    }

    if (stage.includes('completed') || stage.includes('attended') || stage.includes('show')) {
      opportunityData.meeting_held_date = new Date().toISOString();
      opportunityData.stage = 'meeting_held';
    }

    if (stage.includes('package') || stage.includes('sent')) {
      opportunityData.stage = 'package_sent';
    }

    return opportunityData;
  }

  // Meeting completed
  if (eventType === 'MeetingCompleted') {
    return {
      ...baseData,
      meeting_held_date: new Date().toISOString(),
      stage: 'meeting_held'
    };
  }

  // Package sent
  if (eventType === 'PackageSent') {
    return {
      ...baseData,
      stage: 'package_sent'
    };
  }

  // Contact created/updated
  if (eventType === 'ContactCreate' || eventType === 'ContactUpdate') {
    return {
      ...baseData,
      stage: 'form_submitted'
    };
  }

  // Default: just update base data
  return baseData;
}

/**
 * Normalize phone number to E.164 format (or at least consistent format)
 * Removes formatting, keeps just digits with country code
 */
function normalizePhone(phone?: string): string | null {
  if (!phone) return null;

  // Remove all non-digits
  const digits = phone.replace(/\D/g, '');

  // If it's 10 digits, assume US and add +1
  if (digits.length === 10) {
    return `+1${digits}`;
  }

  // If it's 11 digits starting with 1, add +
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }

  // Otherwise return with + prefix
  return digits.length > 0 ? `+${digits}` : null;
}
