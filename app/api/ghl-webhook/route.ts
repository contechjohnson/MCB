import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Admin client for bypassing RLS
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

// LEGACY ENDPOINT: Hardcoded to PPCU tenant
const PPCU_TENANT_ID = '2cb58664-a84a-4d74-844a-4ccd49fcef5a';

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
    // IMPORTANT: Use body.email first - customData.email sometimes contains host's email
    const email = (body.email || customData.email)?.toLowerCase().trim();
    const phone = normalizePhone(customData.phone || body.phone);

    if (!ghlContactId) {
      console.error('No contact_id in GHL webhook');
      return NextResponse.json({ error: 'Missing contact_id' }, { status: 200 });
    }

    // Log the webhook
    await supabaseAdmin.from('webhook_logs').insert({
      tenant_id: PPCU_TENANT_ID,
      source: 'ghl',
      event_type: eventType,
      ghl_id: ghlContactId,
      payload: body,
      status: 'received'
    });

    // Find or create contact using smart matching
    const contactId = await findOrCreateContactGHL({
      ghlId: ghlContactId,
      mcId: customData.MC_ID || undefined,  // Include MC_ID for matching
      email: email,
      phone: phone || undefined,
      firstName: customData.first_name || body.first_name,
      lastName: customData.last_name || body.last_name,
      source: customData.source || undefined
    });

    // Build update data based on event
    const updateData = buildGHLUpdateData(eventType, body);

    console.log('GHL Update Data:', JSON.stringify(updateData, null, 2));

    // Use dynamic update function to bypass schema cache
    const { error: updateError } = await supabaseAdmin
      .rpc('update_contact_dynamic', {
        contact_id: contactId,
        update_data: updateData
      });

    if (updateError) {
      console.error('Error updating contact:', updateError);
      await supabaseAdmin.from('webhook_logs').insert({
        tenant_id: PPCU_TENANT_ID,
        source: 'ghl',
        event_type: eventType,
        ghl_id: ghlContactId,
        payload: body,
        status: 'error',
        error_message: updateError.message
      });
      return NextResponse.json({ error: updateError.message }, { status: 200 });
    }

    console.log(`Successfully processed ${eventType} for GHL contact ${ghlContactId}`);

    // Update webhook log
    await supabaseAdmin.from('webhook_logs').insert({
      tenant_id: PPCU_TENANT_ID,
      source: 'ghl',
      event_type: eventType,
      ghl_id: ghlContactId,
      contact_id: contactId,
      payload: {
        ...body,
        _debug_update_data: updateData  // Add debug info
      },
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
 * Uses smart matching: GHL_ID > MC_ID > Email > Phone
 * LEGACY: Hardcoded to PPCU tenant
 */
async function findOrCreateContactGHL(data: {
  ghlId: string;
  mcId?: string | null;
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  source?: string | null;
}): Promise<string> {
  // Try finding by GHL ID first
  const { data: byGhlId } = await supabaseAdmin
    .from('contacts')
    .select('id')
    .eq('tenant_id', PPCU_TENANT_ID)
    .eq('ghl_id', data.ghlId)
    .single();

  if (byGhlId) {
    return byGhlId.id;
  }

  // Try finding by MC_ID (might be ManyChat contact who booked)
  if (data.mcId) {
    const { data: byMcId } = await supabaseAdmin
      .from('contacts')
      .select('id')
      .eq('tenant_id', PPCU_TENANT_ID)
      .eq('mc_id', data.mcId)
      .single();

    if (byMcId) {
      // Found ManyChat contact - link GHL ID
      await supabaseAdmin
        .rpc('update_contact_dynamic', {
          contact_id: byMcId.id,
          update_data: { ghl_id: data.ghlId }
        });
      return byMcId.id;
    }
  }

  // Try finding by email
  if (data.email) {
    const { data: byEmail } = await supabaseAdmin
      .from('contacts')
      .select('id')
      .eq('tenant_id', PPCU_TENANT_ID)
      .ilike('email_primary', data.email)
      .single();

    if (byEmail) {
      // Found by email - link GHL ID
      await supabaseAdmin
        .rpc('update_contact_dynamic', {
          contact_id: byEmail.id,
          update_data: { ghl_id: data.ghlId }
        });
      return byEmail.id;
    }
  }

  // Create new contact (direct-to-funnel, no ManyChat)
  const { data: newContact, error } = await supabaseAdmin
    .from('contacts')
    .insert({
      tenant_id: PPCU_TENANT_ID,
      ghl_id: data.ghlId,
      email_booking: data.email || null,
      phone: data.phone || null,
      first_name: data.firstName || null,
      last_name: data.lastName || null,
      stage: 'form_submitted',
      source: data.source || 'website',
      subscribe_date: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to create contact: ${error.message}`);
  }

  return newContact.id;
}

/**
 * Build update data based on GHL event type
 */
/**
 * Determine event type from GHL pipeline stage
 */
function determineEventTypeFromStage(body: any): string {
  // Check customData.pipeline_stage FIRST (user's hardcoded values)
  const customData = body.customData || {};
  const customStage = (customData.pipeline_stage || '').toLowerCase();
  const ghlStage = (body.pipleline_stage || body.pipeline_stage || '').toLowerCase();

  // User's hardcoded stages always take priority
  if (customStage === 'form_filled') {
    return 'OpportunityCreate';
  }
  if (customStage === 'meeting_booked') {
    return 'OpportunityCreate';
  }
  if (customStage === 'meeting_attended') {
    return 'MeetingCompleted';
  }
  if (customStage === 'package_sent') {
    return 'PackageSent';
  }

  // Fallback to GHL's stage names
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

function buildGHLUpdateData(eventType: string, body: any) {
  // Extract custom data (where MC_ID, AD_ID, etc. live)
  const customData = body.customData || {};
  const customFields = body; // Fallback to root level

  const baseData: any = {
    // IMPORTANT: Use body.email first - customData.email sometimes contains host's email
    email_booking: (body.email || customData.email)?.toLowerCase().trim() || null,
    phone: normalizePhone(customData.phone || body.phone) || null,
    first_name: customData.first_name || body.first_name || null,
    last_name: customData.last_name || body.last_name || null,
    // Capture MC_ID, AD_ID, THREAD_ID from customData first, then root
    MC_ID: customData.MC_ID || customFields.MC_ID || null,
    AD_ID: customData.AD_ID || customFields.AD_ID || null,
    thread_ID: customData.THREAD_ID || customFields.THREAD_ID || null,
    // Source logic: Use explicit source if provided, otherwise infer from MC_ID/AD_ID
    // IMPORTANT: This overwrites 'instagram_historical' with live source when new events occur
    source: customData.source || ((customData.MC_ID || customFields.MC_ID || customData.AD_ID || customFields.AD_ID) ? 'instagram' : 'website'),
    updated_at: new Date().toISOString()
  };

  // Opportunity/booking events
  if (eventType === 'OpportunityCreate' || eventType.includes('Opportunity')) {
    // Check customData.pipeline_stage first (user's hardcoded values), fallback to GHL's actual stage
    const stage = (customData.pipeline_stage || body.pipleline_stage || body.pipeline_stage || '').toLowerCase();
    const appointmentTime = body['Discovery Call Time (EST)'] || body.appointment_start_time;

    // Handle user's hardcoded pipeline_stage values
    if (stage === 'form_filled') {
      return {
        ...baseData,
        form_submit_date: new Date().toISOString(),
        stage: 'form_submitted'
      };
    }

    if (stage === 'meeting_booked') {
      const updateData: any = {
        ...baseData,
        stage: 'meeting_booked'
      };
      // Try to capture actual appointment time if provided
      if (appointmentTime) {
        try {
          updateData.appointment_date = new Date(appointmentTime).toISOString();
        } catch {
          // Invalid date, skip - use current time
          updateData.appointment_date = new Date().toISOString();
        }
      } else {
        // No appointment time provided, use current time
        updateData.appointment_date = new Date().toISOString();
      }
      return updateData;
    }

    if (stage === 'meeting_attended') {
      return {
        ...baseData,
        appointment_held_date: new Date().toISOString(),
        stage: 'meeting_held'
      };
    }

    if (stage === 'package_sent') {
      return {
        ...baseData,
        package_sent_date: new Date().toISOString(),
        stage: 'package_sent'
      };
    }

    // Fallback: Try to infer from GHL's actual stage names (for backward compatibility)
    const opportunityData: any = {
      ...baseData,
      form_submit_date: new Date().toISOString()
    };

    if (stage.includes('scheduled') || stage.includes('booked') || appointmentTime) {
      if (appointmentTime) {
        try {
          opportunityData.appointment_date = new Date(appointmentTime).toISOString();
        } catch {
          opportunityData.appointment_date = new Date().toISOString();
        }
      } else {
        opportunityData.appointment_date = new Date().toISOString();
      }
      opportunityData.stage = 'meeting_booked';
    }

    if (stage.includes('completed') || stage.includes('attended') || stage.includes('show')) {
      opportunityData.appointment_held_date = new Date().toISOString();
      opportunityData.stage = 'meeting_held';
    }

    if (stage.includes('package') || stage.includes('sent')) {
      opportunityData.package_sent_date = new Date().toISOString();
      opportunityData.stage = 'package_sent';
    }

    return opportunityData;
  }

  // Meeting completed
  if (eventType === 'MeetingCompleted') {
    return {
      ...baseData,
      appointment_held_date: new Date().toISOString(),
      stage: 'meeting_held'
    };
  }

  // Package sent
  if (eventType === 'PackageSent') {
    return {
      ...baseData,
      package_sent_date: new Date().toISOString(),
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
