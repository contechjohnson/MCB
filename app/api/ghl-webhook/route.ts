import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase admin client
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

// Helper to normalize phone numbers to E.164 format
function normalizePhoneNumber(phone: string | null | undefined): string | null {
  if (!phone) return null;
  
  // Remove all non-digit characters
  let cleaned = phone.replace(/\D/g, '');
  
  // Handle different formats
  if (cleaned.length === 10) {
    // US number without country code - add +1
    return '+1' + cleaned;
  } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
    // US number with country code - add +
    return '+' + cleaned;
  } else if (phone.startsWith('+')) {
    // Already in E.164 format
    return phone;
  } else if (cleaned.length > 10) {
    // International number - add +
    return '+' + cleaned;
  }
  
  // Return the original if we can't determine format
  console.log(`Warning: Could not normalize phone number: ${phone}`);
  return phone;
}

// Helper to find or create contact
async function findOrCreateContact(email: string, firstName?: string, lastName?: string, phone?: string) {
  if (!email) {
    console.error('No email provided to findOrCreateContact');
    return null;
  }
  
  // Normalize email for case-insensitive matching
  const normalizedEmail = email.toLowerCase().trim();
  
  console.log(`Looking for contact with email: ${normalizedEmail}`);
  
  // Try to find existing contact with case-insensitive email match
  const { data: existingContacts, error: searchError } = await supabaseAdmin
    .from('contacts')
    .select('*')
    .ilike('email_address', normalizedEmail);
  
  if (searchError) {
    console.error('Error searching for contact:', searchError);
    return null;
  }
  
  if (existingContacts && existingContacts.length > 0) {
    console.log(`Found ${existingContacts.length} existing contact(s) for email: ${normalizedEmail}`);
    return existingContacts[0]; // Return the first match
  }
  
  // Contact doesn't exist, create a new one
  console.log(`No contact found for email: ${normalizedEmail}, creating new contact`);
  
  // Generate a unique user_id (you might want to adjust this based on your system)
  const newUserId = `ghl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const newContact = {
    user_id: newUserId,
    email_address: normalizedEmail,
    first_name: firstName || null,
    last_name: lastName || null,
    phone_number: normalizePhoneNumber(phone),
    // Set initial stage
    stage: 'LEAD_CONTACT',
    // Set channel as unknown since it's coming from GHL
    ig_or_fb: 'Unknown',
    // Set source as paid since they're in GHL pipeline
    paid_vs_organic: 'PAID',
    // Set timestamps
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    subscription_date: new Date().toISOString(),
    // Set lead_contact to true since we have email
    lead_contact: true,
  };
  
  const { data: createdContact, error: createError } = await supabaseAdmin
    .from('contacts')
    .insert(newContact)
    .select()
    .single();
  
  if (createError) {
    console.error('Error creating contact:', createError);
    return null;
  }
  
  console.log(`Successfully created new contact with user_id: ${newUserId}`);
  return createdContact;
}

// Process events from GoHighLevel (booked, attended, sent_package)
async function processGHLWebhook(payload: any) {
  // Extract data from the payload - handles multiple formats
  const email = payload.email || payload.contact?.email || payload.Email || payload.EMAIL;
  const phone = payload.phone || payload.contact?.phone || payload.Phone || payload.PHONE || payload.phone_number;
  const firstName = payload.first_name || payload.firstName || payload.contact?.first_name || payload.FirstName || payload.FIRST_NAME;
  const lastName = payload.last_name || payload.lastName || payload.contact?.last_name || payload.LastName || payload.LAST_NAME;
  const stage = payload.stage || payload.Stage || payload.STAGE || 'attended';
  
  // Extract country for A2P compliance (required by GHL for US/Canada)
  const country = payload.country || payload.Country || payload.COUNTRY || 'US';
  
  // Extract booking date/time for booked stage
  const bookingDate = payload.booking_date || payload.bookingDate || payload.booking_datetime || 
                      payload.appointment_date || payload.appointmentDate || payload.scheduled_date;
  
  // Use appropriate timestamp based on stage
  const eventTimestamp = payload.attended_at || payload.event_date || new Date().toISOString();
  
  console.log('Processing GHL webhook with data:', {
    email,
    phone,
    firstName,
    lastName,
    stage,
    country,
    bookingDate
  });
  
  if (!email) {
    console.error('No email provided in GHL webhook payload');
    return { 
      success: false, 
      message: 'Email is required',
      debug: 'No email found in payload'
    };
  }
  
  // Find or create the contact
  const contact = await findOrCreateContact(email, firstName, lastName, phone);
  
  if (!contact) {
    console.error(`Failed to find or create contact for email: ${email}`);
    return { 
      success: false, 
      message: 'Failed to process contact',
      debug: `Could not find or create contact with email: ${email}`
    };
  }
  
  // Prepare the update data
  const updateData: any = {
    updated_at: new Date().toISOString(),
    last_interaction_date: eventTimestamp,
  };
  
  // Update phone number if provided (always update if provided from GHL)
  if (phone) {
    const normalizedPhone = normalizePhoneNumber(phone);
    updateData.phone_number = normalizedPhone;
    console.log(`Updating phone number from ${phone} to: ${normalizedPhone}`);
  }
  
  // Update names if provided (always update if provided from GHL)
  if (firstName) {
    updateData.first_name = firstName;
  }
  if (lastName) {
    updateData.last_name = lastName;
  }
  
  // Update booking date if provided (for booked stage)
  if (bookingDate) {
    updateData.booking_date = new Date(bookingDate).toISOString();
    console.log(`Setting booking date to: ${updateData.booking_date}`);
  }
  
  // Determine progression flags based on the stage
  let progressionFlags: any = {};
  
  // Handle different stages with proper hierarchy
  const normalizedStage = stage.toLowerCase();
  
  // Stage hierarchy: BOOKED < ATTENDED < SENT_PACKAGE < BOUGHT_PACKAGE
  // We never downgrade a contact's stage
  
  if (normalizedStage === 'sent_package' || normalizedStage === 'package_sent') {
    // SENT_PACKAGE - Highest stage we handle via webhook
    progressionFlags = {
      lead: true,
      lead_contact: true,
      has_symptoms: true,
      has_months_postpartum: true,
      sent_link: true,
      clicked_link: true,
      booked: true,
      attended: true,
      sent_package: true,
    };
    // Only update stage if not already at BOUGHT_PACKAGE
    if (!contact.bought_package) {
      updateData.stage = 'SENT_PACKAGE';
    }
  } else if (normalizedStage === 'attended' || normalizedStage === 'appointment_attended' || normalizedStage === 'discovery_call_attended') {
    // ATTENDED - Middle stage
    progressionFlags = {
      lead: true,
      lead_contact: true,
      has_symptoms: true,
      has_months_postpartum: true,
      sent_link: true,
      clicked_link: true,
      booked: true,
      attended: true,
    };
    // Only update stage if currently lower than ATTENDED
    if (!contact.attended && !contact.sent_package && !contact.bought_package) {
      updateData.stage = 'ATTENDED';
    }
  } else if (normalizedStage === 'booked' || normalizedStage === 'appointment_booked' || normalizedStage === 'scheduled') {
    // BOOKED - Entry stage from GHL
    progressionFlags = {
      lead: true,
      lead_contact: true,
      sent_link: true,
      clicked_link: true,
      booked: true,
    };
    // Only update stage if currently lower than BOOKED
    if (!contact.booked && !contact.attended && !contact.sent_package && !contact.bought_package) {
      updateData.stage = 'BOOKED';
    }
  } else {
    // Unknown stage - log it but still process as a lead update
    console.log(`Unknown stage received: ${stage}`);
    progressionFlags = {
      lead: true,
      lead_contact: true,
    };
  }
  
  // Only update flags that aren't already true
  Object.entries(progressionFlags).forEach(([flag, value]) => {
    if (!contact[flag]) {
      updateData[flag] = value;
    }
  });
  
  // Update the contact in Supabase
  const { error: updateError } = await supabaseAdmin
    .from('contacts')
    .update(updateData)
    .eq('user_id', contact.user_id);
  
  if (updateError) {
    console.error('Error updating contact:', updateError);
    return { 
      success: false, 
      message: 'Failed to update contact',
      debug: updateError.message
    };
  }
  
  console.log(`Successfully updated contact ${contact.user_id} (${email}) for GHL event`);
  return { 
    success: true, 
    message: 'Contact updated successfully',
    contact_id: contact.user_id,
    email: email,
    updates: Object.keys(updateData),
    was_created: !contact.created_at || contact.created_at === updateData.created_at
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    console.log('GHL Webhook received:', JSON.stringify(body, null, 2));
    
    // Log all webhook events for debugging
    await supabaseAdmin
      .from('webhook_logs')
      .insert({
        source: 'ghl',
        payload: body,
        created_at: new Date().toISOString()
      });
    
    // Handle different webhook event types from GHL
    const eventType = body.event_type || body.type || body.eventType || 'discovery_call_attended';
    
    // Process the webhook regardless of event type
    const result = await processGHLWebhook(body);
    
    // Return appropriate status code
    if (result.success) {
      return NextResponse.json(result, { status: 200 });
    } else {
      // Return 200 even for "not found" to prevent GHL from retrying
      // But include error details in the response
      return NextResponse.json(result, { status: 200 });
    }
    
  } catch (error) {
    console.error('GHL webhook error:', error);
    // Return 200 to prevent retries, but indicate error in response
    return NextResponse.json(
      { 
        success: false, 
        message: 'Internal server error',
        debug: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 200 }
    );
  }
}

// Also handle GET requests for webhook verification
export async function GET(request: NextRequest) {
  // GHL might send a verification request
  const searchParams = request.nextUrl.searchParams;
  const challenge = searchParams.get('challenge');
  
  if (challenge) {
    // Echo back the challenge for verification
    return NextResponse.json({ challenge });
  }
  
  // Test endpoint to check if webhook is working
  return NextResponse.json({ 
    status: 'ok',
    message: 'GHL webhook endpoint is active',
    endpoint: '/api/ghl-webhook',
    accepts: ['discovery_call_attended', 'appointment_completed', 'call_completed', 'sent_package'],
    expectedFields: {
      required: ['email'],
      optional: ['first_name', 'last_name', 'phone', 'stage']
    },
    notes: [
      'Contact will be created if not found',
      'Email matching is case-insensitive',
      'Phone numbers will be updated if provided',
      'Returns 200 status to prevent retries'
    ]
  });
}