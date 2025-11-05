import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Admin client for bypassing RLS
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

/**
 * Perspective.co Webhook Handler
 *
 * Handles form submission events from Perspective.co funnel pages
 * This captures leads BEFORE they get to GHL, allowing faster attribution
 *
 * Strategy: Find existing contact by MC_ID (from MCP_TOKEN) or email
 * Updates form_submit_date to track when they filled out the funnel form
 */
export async function POST(request: NextRequest) {
  try {
    let body = await request.json();

    // Handle array payload
    if (Array.isArray(body) && body.length > 0) {
      body = body[0];
    }

    console.log('Perspective webhook received:', {
      hasData: !!body.data,
      hasProfile: !!body.data?.attributes?.profile,
      email: body.data?.attributes?.profile?.email,
      timestamp: new Date().toISOString()
    });

    // Extract data from Perspective payload
    const profile = body.data?.attributes?.profile || {};
    const email = profile.email?.toLowerCase().trim();
    const mcpToken = profile.mcp_token || profile.MCP_TOKEN;
    const mcId = profile.mcid;

    if (!email && !mcId) {
      console.error('No email or MC ID in Perspective webhook');
      return NextResponse.json({ error: 'Missing email or MC ID' }, { status: 200 });
    }

    // Log the webhook
    await supabaseAdmin.from('webhook_logs').insert({
      source: 'perspective',
      event_type: 'form_submission',
      MC_ID: mcId || null,
      payload: body,
      status: 'received'
    });

    // Find existing contact (prefer MC_ID match, fallback to email)
    let contactId: string | null = null;

    if (mcId) {
      const { data: existingId } = await supabaseAdmin
        .rpc('find_contact_by_mc_id', { search_mc_id: mcId.toString() });
      contactId = existingId;
    }

    if (!contactId && email) {
      const { data: existingId } = await supabaseAdmin
        .rpc('find_contact_by_email', { search_email: email });
      contactId = existingId;
    }

    // If no existing contact, create one
    if (!contactId) {
      const { data: newContact, error } = await supabaseAdmin
        .from('contacts')
        .insert({
          MC_ID: mcId ? mcId.toString() : null,
          email_primary: email || null,
          first_name: profile.firstName || null,
          phone: normalizePhone(profile.phone) || null,
          form_submit_date: new Date().toISOString(),
          stage: 'form_submitted'
        })
        .select('id')
        .single();

      if (error) {
        console.error('Error creating contact:', error);
        await supabaseAdmin.from('webhook_logs').insert({
          source: 'perspective',
          event_type: 'form_submission',
          MC_ID: mcId || null,
          payload: body,
          status: 'error',
          error_message: error.message
        });
        return NextResponse.json({ error: error.message }, { status: 200 });
      }

      contactId = newContact.id;
    } else {
      // Update existing contact
      const updateData: any = {
        email_primary: email || undefined,
        first_name: profile.firstName || undefined,
        phone: normalizePhone(profile.phone) || undefined,
        form_submit_date: new Date().toISOString(),
        stage: 'form_submitted',
        updated_at: new Date().toISOString()
      };

      // Only update MC_ID if we have it and it's not already set
      if (mcId) {
        const { data: contact } = await supabaseAdmin
          .from('contacts')
          .select('MC_ID')
          .eq('id', contactId)
          .single();

        if (!contact?.MC_ID) {
          updateData.MC_ID = mcId.toString();
        }
      }

      const { error: updateError } = await supabaseAdmin
        .from('contacts')
        .update(updateData)
        .eq('id', contactId);

      if (updateError) {
        console.error('Error updating contact:', updateError);
        await supabaseAdmin.from('webhook_logs').insert({
          source: 'perspective',
          event_type: 'form_submission',
          MC_ID: mcId || null,
          payload: body,
          status: 'error',
          error_message: updateError.message
        });
        return NextResponse.json({ error: updateError.message }, { status: 200 });
      }
    }

    console.log(`Successfully processed Perspective form submission for ${email || mcId}`);

    // Update webhook log
    await supabaseAdmin.from('webhook_logs').insert({
      source: 'perspective',
      event_type: 'form_submission',
      MC_ID: mcId || null,
      contact_id: contactId,
      payload: body,
      status: 'processed'
    });

    return NextResponse.json({
      success: true,
      contact_id: contactId
    }, { status: 200 });

  } catch (error) {
    console.error('Perspective webhook error:', error);
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
    message: 'Perspective.co webhook endpoint is live',
    endpoints: {
      POST: 'Receives Perspective form submission webhooks',
      events: ['form_submission']
    }
  });
}

/**
 * Normalize phone number to E.164 format
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
