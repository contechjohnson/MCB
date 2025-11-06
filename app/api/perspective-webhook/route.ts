import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Admin client for bypassing RLS
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

/**
 * Perspective Webhook Handler
 *
 * Handles form submission from Perspective checkout page:
 * - When customer fills out email/name/phone form (before selecting package)
 * - Sets checkout_started timestamp (highest intent signal)
 *
 * Strategy: Find contact by email, set checkout_started
 */
export async function POST(request: NextRequest) {
  try {
    let body = await request.json();

    // Handle array payload
    if (Array.isArray(body) && body.length > 0) {
      body = body[0];
    }

    console.log('Perspective webhook received:', {
      hasFunnelId: !!body.funnelId,
      hasProfile: !!body.profile,
      timestamp: new Date().toISOString()
    });

    // Extract data from Perspective payload
    // Perspective sends profile as objects with {value, title} structure
    const profile = body.profile || {};
    const values = body.values || {};

    const email = (profile.email?.value || values.email)?.toLowerCase().trim();
    const firstName = profile.firstName?.value || values.firstName;
    const phone = profile.phone?.value || values.phone;
    const convertedAt = values.ps_converted_at || body.meta?.ps_converted_at;

    if (!email) {
      console.error('No email in Perspective webhook');
      return NextResponse.json({ error: 'Missing email' }, { status: 200 });
    }

    // Log the webhook
    await supabaseAdmin.from('webhook_logs').insert({
      source: 'perspective',
      event_type: 'checkout_form_submitted',
      payload: body,
      status: 'received'
    });

    // Find contact by email (checks all 3 email fields)
    const { data: contactId } = await supabaseAdmin
      .rpc('find_contact_by_email', { search_email: email });

    if (!contactId) {
      console.warn('No contact found for Perspective checkout:', email);
      await supabaseAdmin.from('webhook_logs').insert({
        source: 'perspective',
        event_type: 'checkout_form_submitted',
        payload: body,
        status: 'no_contact_found'
      });
      return NextResponse.json({
        success: true,
        message: 'No contact found - they may not have had discovery call yet'
      }, { status: 200 });
    }

    // Update contact with checkout_started timestamp
    const { error: updateError } = await supabaseAdmin
      .rpc('update_contact_dynamic', {
        contact_id: contactId,
        update_data: {
          checkout_started: convertedAt || new Date().toISOString(),
          // Update contact info if provided
          ...(firstName && { first_name: firstName }),
          ...(phone && { phone: phone })
        }
      });

    if (updateError) {
      console.error('Error updating contact:', updateError);
      await supabaseAdmin.from('webhook_logs').insert({
        source: 'perspective',
        event_type: 'checkout_form_submitted',
        payload: body,
        status: 'error',
        error_message: updateError.message
      });
      return NextResponse.json({ error: updateError.message }, { status: 200 });
    }

    console.log(`Checkout started for contact ${contactId}: ${email}`);

    // Update webhook log
    await supabaseAdmin.from('webhook_logs').insert({
      source: 'perspective',
      event_type: 'checkout_form_submitted',
      contact_id: contactId,
      payload: body,
      status: 'processed'
    });

    return NextResponse.json({
      success: true,
      contact_id: contactId,
      message: 'Checkout started timestamp recorded'
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
    message: 'Perspective webhook endpoint is live',
    endpoints: {
      POST: 'Receives Perspective checkout form submissions',
      purpose: 'Tracks when customers start checkout (fill out qualification form)'
    }
  });
}
