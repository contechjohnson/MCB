// Example: ManyChat Webhook Using Dynamic Update Function
// This shows how to use update_contact_dynamic() in your actual webhook code

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    console.log('ManyChat webhook received:', payload);

    // Extract data from ManyChat payload
    const mcId = payload.subscriber_id || payload.id;
    const email = payload.email;
    const firstName = payload.first_name;
    const lastName = payload.last_name;
    const phone = payload.phone;
    const igUsername = payload.instagram_username || payload.ig_username;
    const igId = payload.instagram_id || payload.ig_id;

    // Step 1: Find or create contact
    let contactId: string;

    // Try to find existing contact by MC_ID
    const { data: existingContact } = await supabaseAdmin
      .from('contacts')
      .select('id')
      .eq('mc_id', mcId)
      .single();

    if (existingContact) {
      contactId = existingContact.id;
      console.log('Found existing contact:', contactId);
    } else {
      // Create new contact
      const { data: newContact, error: insertError } = await supabaseAdmin
        .from('contacts')
        .insert({
          mc_id: mcId,
          email_primary: email,
          stage: 'new_lead',
          subscribe_date: new Date().toISOString()
        })
        .select('id')
        .single();

      if (insertError) {
        console.error('Error creating contact:', insertError);
        return NextResponse.json({
          success: false,
          error: insertError.message
        }, { status: 200 });
      }

      contactId = newContact!.id;
      console.log('Created new contact:', contactId);
    }

    // Step 2: Prepare update data (only include fields that are present)
    const updateData: Record<string, any> = {};

    if (firstName) updateData.first_name = firstName;
    if (lastName) updateData.last_name = lastName;
    if (email) updateData.email_primary = email;
    if (phone) updateData.phone = phone;
    if (igUsername) updateData.ig = igUsername;
    if (igId) updateData.ig_id = parseInt(igId);

    // Always update these
    updateData.subscribed = new Date().toISOString();
    updateData.ig_last_interaction = new Date().toISOString();

    // Handle custom fields from ManyChat
    const customFields = payload.custom_fields || {};

    if (customFields.Q1) updateData.q1_question = customFields.Q1;
    if (customFields.Q2) updateData.q2_question = customFields.Q2;
    if (customFields.trigger_word) updateData.trigger_word = customFields.trigger_word;
    if (customFields.chatbot_variant) updateData.chatbot_ab = customFields.chatbot_variant;
    if (customFields.ad_id) updateData.ad_id = customFields.ad_id;
    if (customFields.thread_id) updateData.thread_id = customFields.thread_id;

    // Step 3: Use dynamic update function
    console.log('Updating contact with data:', updateData);

    const { error: updateError } = await supabaseAdmin.rpc('update_contact_dynamic', {
      contact_id: contactId,
      update_data: updateData
    });

    if (updateError) {
      console.error('Error updating contact:', updateError);
      return NextResponse.json({
        success: false,
        error: updateError.message
      }, { status: 200 });
    }

    console.log('Contact updated successfully');

    // Step 4: Log the webhook event
    await supabaseAdmin
      .from('webhook_logs')
      .insert({
        source: 'manychat',
        event_type: 'subscriber_data',
        contact_id: contactId,
        mc_id: mcId,
        payload: payload,
        status: 'processed'
      });

    return NextResponse.json({
      success: true,
      contact_id: contactId
    }, { status: 200 });

  } catch (error: any) {
    console.error('Webhook error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 200 });
  }
}

// GET endpoint for testing
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'ManyChat webhook endpoint is alive',
    timestamp: new Date().toISOString()
  });
}
