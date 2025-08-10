import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: 'Supabase configuration missing' },
        { status: 500 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const body = await request.json();
    
    // Verify webhook signature if needed
    const signature = request.headers.get('x-manychat-signature');
    
    // Log the webhook data to Supabase
    const { error } = await supabase
      .from('webhook_logs')
      .insert({
        payload: body,
        signature,
        received_at: new Date().toISOString(),
        source: 'manychat'
      });

    if (error) {
      console.error('Supabase Error:', error);
      return NextResponse.json(
        { error: 'Database error' },
        { status: 500 }
      );
    }

    // Process the webhook data based on the event type
    const { event_type, user_id, message } = body;

    switch (event_type) {
      case 'user_message':
        // Handle user message
        console.log(`Message from user ${user_id}: ${message}`);
        break;
      case 'user_subscribed':
        // Handle new subscription
        console.log(`User ${user_id} subscribed`);
        break;
      default:
        console.log(`Unhandled event type: ${event_type}`);
    }

    return NextResponse.json({ 
      success: true,
      message: 'Webhook processed successfully' 
    });

  } catch (error) {
    console.error('Webhook Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Handle GET requests for webhook verification
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const challenge = searchParams.get('hub.challenge');
  const verify_token = searchParams.get('hub.verify_token');

  if (verify_token === process.env.MANYCHAT_VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 });
  }

  return new Response('Forbidden', { status: 403 });
}