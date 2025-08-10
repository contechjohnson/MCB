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
    
    // Handle ManyChat's actual format - they send the user data directly
    const subscriber_id = body.id || body.subscriber_id;
    const message = body.last_input_text || body.message || 'Hello';
    const channel = body.ig_id ? 'ig' : 'fb';
    
    // Extract profile info from ManyChat format
    const profile = {
      name: body.name || body.full_name,
      first_name: body.first_name,
      last_name: body.last_name,
      email: body.email,
      phone: body.phone,
      username: body.ig_username
    };
    
    // Extract custom fields
    const customFields = body.custom_fields || {};
    const tags = customFields['All Tags'] || [];

    console.log('ManyChat webhook received:', { subscriber_id, message, channel, profile });

    if (!subscriber_id) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    // Parse tags
    const ab_variant = tags.find((t: string) => t.startsWith('ab:'))?.split(':')[1] || null;
    const acquisition_source = tags.includes('source:paid') ? 'paid' : 
                              tags.includes('source:organic') ? 'organic' : null;
    const trigger_tag = tags.find((t: string) => t.startsWith('trigger:')) || null;

    // Check if contact exists
    const { data: existingContact } = await supabaseAdmin
      .from('contacts')
      .select('*')
      .eq('mcid', subscriber_id)
      .single();

    // Build conversation history
    const conversationHistory = existingContact?.conversation_history || [];
    conversationHistory.push({
      role: 'user',
      content: message,
      timestamp: now
    });

    // Get AI response using chat completions (simpler than Assistants for now)
    const aiMessages = [
      {
        role: 'system' as const,
        content: `You are a helpful AI assistant for a ManyChat automation system. 
        Respond naturally and helpfully. If the user mentions booking or consultations, 
        let them know you can help schedule that. Keep responses concise and friendly.
        If they provide their email, acknowledge it and thank them.`
      },
      ...conversationHistory.slice(-10).map((msg: any) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      }))
    ];

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: aiMessages,
      max_tokens: 200,
      temperature: 0.7,
    });

    const replyText = completion.choices[0]?.message?.content || 
      'I can help you with that! What would you like to know?';

    // Add AI response to history
    conversationHistory.push({
      role: 'assistant',
      content: replyText,
      timestamp: now
    });

    // Determine if this is a booking-related message
    const bookingKeywords = ['book', 'schedule', 'appointment', 'consultation', 'meeting'];
    const hasBookingIntent = bookingKeywords.some(keyword => 
      message.toLowerCase().includes(keyword)
    );

    // Prepare contact data
    const contactData: any = {
      mcid: subscriber_id,
      channel,
      name: profile.name || null,
      username: profile.username || null,
      email: profile.email || null,
      phone: profile.phone || null,
      tags,
      ab_variant,
      acquisition_source,
      trigger_tag,
      conversation_history: conversationHistory,
      last_ai_response: replyText,
      total_messages: conversationHistory.filter((m: any) => m.role === 'user').length,
      last_mc_interaction_at: now,
      updated_at: now,
      // Store custom fields for later use
      symptoms: customFields['Symptoms'] || null,
      months_postpartum: customFields['Months Postpartum'] ? parseInt(customFields['Months Postpartum']) : null,
      objections_json: customFields['Objections'] ? { objections: customFields['Objections'] } : null,
    };

    // Set timestamps based on progression
    if (!existingContact) {
      contactData.dm_started_at = now;
      contactData.stage = 'new';
      contactData.created_at = now;
    }

    if (profile.email && !existingContact?.lead_captured_at) {
      contactData.lead_captured_at = now;
      contactData.stage = 'lead';
    }

    if (hasBookingIntent && !existingContact?.booking_shown_at) {
      contactData.booking_shown_at = now;
      if (contactData.stage !== 'lead') {
        contactData.stage = 'qualified';
      }
    }

    // Upsert contact
    const { error: upsertError } = await supabaseAdmin
      .from('contacts')
      .upsert(contactData, { onConflict: 'mcid' });

    if (upsertError) {
      console.error('Database upsert error:', upsertError);
    }

    // Return ManyChat response
    const response = {
      reply_text: replyText,
      booking_flag: hasBookingIntent,
      booking_url: hasBookingIntent ? 'https://calendly.com/your-booking-link' : '',
      lead_stage: contactData.stage || 'new'
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('ManyChat AI Router Error:', error);
    return NextResponse.json({
      reply_text: 'I apologize, but I encountered an error. Please try again.',
      booking_flag: false,
      booking_url: '',
      lead_stage: 'new'
    });
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