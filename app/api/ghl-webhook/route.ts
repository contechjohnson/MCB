import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase admin client
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

// Helper to find contact by email
async function findContactByEmail(email: string) {
  if (!email) return null;
  
  const { data, error } = await supabaseAdmin
    .from('contacts')
    .select('*')
    .eq('email_address', email)
    .single();
  
  if (error) {
    console.error('Error finding contact:', error);
    return null;
  }
  
  return data;
}

// Process discovery call attendance from GoHighLevel
async function processDiscoveryCallAttendance(payload: any) {
  // Extract data from the payload - handles both formats
  const email = payload.email || payload.contact?.email;
  const phone = payload.phone || payload.contact?.phone;
  const firstName = payload.first_name || payload.firstName || payload.contact?.first_name;
  const lastName = payload.last_name || payload.lastName || payload.contact?.last_name;
  const stage = payload.stage;
  const attendedAt = payload.attended_at || new Date().toISOString();
  
  console.log(`Processing discovery call attendance for: ${email}`);
  
  // Find the contact by email
  const contact = await findContactByEmail(email);
  
  if (!contact) {
    console.log(`No contact found for email: ${email}`);
    return { success: false, message: 'Contact not found' };
  }
  
  // Prepare the update data
  const updateData: any = {
    updated_at: new Date().toISOString(),
    last_interaction_date: attendedAt,
  };
  
  // Update phone number if provided and empty
  if (phone && !contact.phone_number) {
    updateData.phone_number = phone;
    console.log(`Adding phone number: ${phone}`);
  }
  
  // Update first and last name if provided and empty
  if (firstName && !contact.first_name) {
    updateData.first_name = firstName;
  }
  if (lastName && !contact.last_name) {
    updateData.last_name = lastName;
  }
  
  // Determine progression flags based on the stage
  let progressionFlags: any = {};
  
  // Handle different stages
  if (stage === 'sent_package') {
    // For sent_package, set all flags including sent_package
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
  } else {
    // Default to attended stage
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
  }
  
  // Only update flags that aren't already true
  Object.entries(progressionFlags).forEach(([flag, value]) => {
    if (!contact[flag]) {
      updateData[flag] = value;
    }
  });
  
  // Determine the correct stage based on current state
  // Priority: BOUGHT_PACKAGE > SENT_PACKAGE > ATTENDED
  let newStage = '';
  
  if (contact.bought_package) {
    // Already bought - keep at highest level
    newStage = 'BOUGHT_PACKAGE';
  } else if (stage === 'sent_package' || contact.sent_package) {
    // Either we're setting sent_package now, or it was already set
    newStage = 'SENT_PACKAGE';
  } else if (stage === 'attended' || contact.attended) {
    // Either we're setting attended now, or it was already set
    newStage = 'ATTENDED';
  } else {
    // This shouldn't happen, but default to current stage
    newStage = contact.stage;
  }
  
  // Only update stage if it's different from current
  if (newStage && newStage !== contact.stage) {
    updateData.stage = newStage;
  }
  
  // Update the contact in Supabase
  const { error: updateError } = await supabaseAdmin
    .from('contacts')
    .update(updateData)
    .eq('user_id', contact.user_id);
  
  if (updateError) {
    console.error('Error updating contact:', updateError);
    return { success: false, message: 'Failed to update contact' };
  }
  
  console.log(`Successfully updated contact ${contact.user_id} for discovery call attendance`);
  return { 
    success: true, 
    message: 'Contact updated successfully',
    contact_id: contact.user_id,
    updates: Object.keys(updateData)
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    console.log('GHL Webhook received:', JSON.stringify(body, null, 2));
    
    // Handle different webhook event types from GHL
    const eventType = body.event_type || body.type || 'discovery_call_attended';
    
    switch (eventType) {
      case 'discovery_call_attended':
      case 'appointment_completed':
      case 'call_completed':
        const result = await processDiscoveryCallAttendance(body);
        return NextResponse.json(result, { status: result.success ? 200 : 404 });
        
      default:
        console.log(`Unhandled GHL event type: ${eventType}`);
        return NextResponse.json({ 
          success: true, 
          message: `Event type ${eventType} acknowledged but not processed` 
        });
    }
  } catch (error) {
    console.error('GHL webhook error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
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
  
  return NextResponse.json({ 
    status: 'ok',
    message: 'GHL webhook endpoint is active',
    endpoint: '/api/ghl-webhook',
    accepts: ['discovery_call_attended', 'appointment_completed', 'call_completed']
  });
}