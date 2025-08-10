import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

// Initialize Supabase admin client
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Extract subscriber ID
    const user_id = body.id || body.subscriber_id;
    
    if (!user_id) {
      return NextResponse.json(
        { error: 'Missing user ID' },
        { status: 400 }
      );
    }

    console.log('ManyChat webhook received for user:', user_id, new Date().toISOString());

    // Extract custom fields
    const customFields = body.custom_fields || {};
    
    // Parse subscription date
    const subscriptionDate = body.subscribed ? new Date(body.subscribed).toISOString() : null;
    
    // Determine channel
    const ig_or_fb = body.ig_id || body.ig_username ? 'Instagram' : 'Facebook';
    
    // Parse tags for attribution
    const allTags = customFields['All Tags'] || '';
    const tagArray = typeof allTags === 'string' ? allTags.split(',').map((t: string) => t.trim()) : [];
    
    // Extract trigger words, A/B test tags, and source
    const trigger_word_tags = tagArray.filter((t: string) => 
      ['RELIEF', '55', 'HEAL'].some(word => t.includes(word))
    ).join(', ');
    
    const ab_test_tags = tagArray.find((t: string) => 
      t.includes('CHATBOT')
    ) || null;
    
    const paid_vs_organic = tagArray.some((t: string) => 
      t.toLowerCase().includes('paid')
    ) ? 'PAID' : 'ORGANIC';

    // Prepare contact data matching new schema exactly
    const contactData: any = {
      user_id: user_id,
      
      // Basic info
      first_name: body.first_name || null,
      last_name: body.last_name || null,
      instagram_name: body.ig_username || null,
      facebook_name: ig_or_fb === 'Facebook' ? body.name : null,
      email_address: body.email || customFields['custom field email'] || null,
      phone_number: body.phone || null,
      
      // Dates
      subscription_date: subscriptionDate,
      last_ig_interaction: body.ig_last_interaction ? new Date(body.ig_last_interaction).toISOString() : null,
      last_fb_interaction: body.last_interaction ? new Date(body.last_interaction).toISOString() : null,
      
      // Health data
      symptoms: customFields['Symptoms'] || customFields['Issues'] || null,
      months_pp: customFields['Months Postpartum'] ? parseInt(customFields['Months Postpartum']) : null,
      objections: customFields['Objections'] || null,
      has_symptoms_value: !!(customFields['Symptoms'] || customFields['Issues']),
      has_months_value: !!customFields['Months Postpartum'],
      
      // Funnel progression from MCB fields (lowercase for PostgreSQL)
      lead_contact: customFields['MCB_LEAD_CONTACT'] === true || customFields['MCB_LEAD_CONTACT'] === 'true',
      lead: customFields['MCB_LEAD'] === true || customFields['MCB_LEAD'] === 'true',
      sent_email_magnet: customFields['MCB_SENT_EMAIL_MAGNET'] === true || customFields['MCB_SENT_EMAIL_MAGNET'] === 'true',
      opened_email_magnet: customFields['MCB_OPENED_EMAIL_MAGNET'] === true || customFields['MCB_OPENED_EMAIL_MAGNET'] === 'true',
      sent_link: customFields['MCB_SENT_LINK'] === true || customFields['MCB_SENT_LINK'] === 'true',
      clicked_link: customFields['MCB_CLICKED_LINK'] === true || customFields['MCB_CLICKED_LINK'] === 'true',
      ready_to_book: customFields['MCB_READY_TO_BOOK'] === true || customFields['MCB_READY_TO_BOOK'] === 'true',
      booked: customFields['MCB_BOOKED'] === true || customFields['MCB_BOOKED'] === 'true',
      attended: customFields['MCB_ATTENDED'] === true || customFields['MCB_ATTENDED'] === 'true',
      sent_package: customFields['MCB_SENT_PACKAGE'] === true || customFields['MCB_SENT_PACKAGE'] === 'true',
      bought_package: customFields['MCB_BOUGHT_PACKAGE'] === true || customFields['MCB_BOUGHT_PACKAGE'] === 'true',
      
      // Summary field (will be populated later via thread query)
      summary: null,
      summary_updated_at: null,
      
      // Social engagement
      ig_follower: false, // Would need to be set via separate API
      fb_page_follower: false, // Would need to be set via separate API
      
      // Attribution
      ig_or_fb: ig_or_fb,
      trigger_word_tags: trigger_word_tags || null,
      ab_test_tags: ab_test_tags,
      paid_vs_organic: paid_vs_organic,
      
      // Thread and ad tracking
      thread_id: customFields['Conversation ID'] || null,
      ad_id: customFields['AD_ID'] || null,
      
      // Helper timestamp
      date_time_helper: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Check if this is a new contact
    const { data: existingContact } = await supabaseAdmin
      .from('contacts')
      .select('*')
      .eq('user_id', user_id)
      .single();

    if (!existingContact) {
      contactData.created_at = new Date().toISOString();
    }

    // Upsert contact with new schema
    const { error: upsertError } = await supabaseAdmin
      .from('contacts')
      .upsert(contactData, { 
        onConflict: 'user_id',
        ignoreDuplicates: false 
      });

    if (upsertError) {
      console.error('Database upsert error:', upsertError);
      return NextResponse.json(
        { error: 'Database error', details: upsertError.message },
        { status: 500 }
      );
    }

    // Generate AI response if there's a message
    let aiResponse = '';
    if (body.last_input_text) {
      try {
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `You are a helpful assistant for a postpartum health consultation service. 
              Be empathetic, professional, and supportive. If someone mentions symptoms or concerns, 
              acknowledge them and offer to help them schedule a consultation.`
            },
            {
              role: 'user',
              content: body.last_input_text
            }
          ],
          max_tokens: 200,
          temperature: 0.7,
        });
        
        aiResponse = completion.choices[0]?.message?.content || 
          'Thank you for your message. How can I help you today?';
      } catch (error) {
        console.error('OpenAI error:', error);
        aiResponse = 'Thank you for your message. How can I help you today?';
      }
    }

    // Return response for ManyChat
    return NextResponse.json({
      status: 'success',
      user_id: user_id,
      stage: contactData.stage,
      ai_response: aiResponse,
      // These fields can be mapped in ManyChat if needed
      has_email: !!contactData.email_address,
      has_symptoms: contactData.has_symptoms_value,
      has_months: contactData.has_months_value
    });

  } catch (error) {
    console.error('ManyChat webhook error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Handle webhook verification
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === process.env.MANYCHAT_VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 });
  }

  return NextResponse.json({ status: 'ok' });
}