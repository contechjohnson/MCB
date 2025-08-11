import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase admin client
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function POST(request: NextRequest) {
  try {
    // Security check - only allow in development
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Test endpoint disabled in production' }, { status: 403 });
    }

    const now = new Date();
    const testEvents = [
      // Connor Johnson - First Purchase
      {
        event_id: `evt_test_connor_1_${Date.now()}`,
        event_type: 'checkout.session.completed',
        checkout_session_id: 'cs_test_connor_1',
        status: 'matched',
        customer_email: 'con.tech.johnson@gmail.com',
        customer_name: 'Connor Johnson',
        amount: 25.00,
        payment_method_type: 'card',
        created_at: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
        raw_event: { test: true, description: 'First purchase - discovery call' }
      },
      // Connor Johnson - Package Purchase
      {
        event_id: `evt_test_connor_2_${Date.now() + 1}`,
        event_type: 'checkout.session.completed',
        checkout_session_id: 'cs_test_connor_2',
        status: 'matched',
        customer_email: 'con.tech.johnson@gmail.com',
        customer_name: 'Connor Johnson',
        amount: 497.00,
        payment_method_type: 'card',
        created_at: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
        raw_event: { test: true, description: 'Package purchase' }
      },
      // Lead3 - Abandoned
      {
        event_id: `evt_test_lead3_1_${Date.now()}`,
        event_type: 'checkout.session.expired',
        checkout_session_id: 'cs_test_lead3_expired',
        status: 'expired',
        customer_email: 'lead3@example.com',
        customer_name: 'Lead3 FromManyChat',
        amount: 30.00,
        payment_method_type: 'card',
        abandonment_reason: 'checkout_timeout',
        abandoned_at: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        created_at: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        raw_event: { test: true, description: 'Abandoned checkout - expired' }
      },
      // Lead3 - Success after follow-up
      {
        event_id: `evt_test_lead3_2_${Date.now() + 1}`,
        event_type: 'checkout.session.completed',
        checkout_session_id: 'cs_test_lead3_success',
        status: 'matched',
        customer_email: 'lead3@example.com',
        customer_name: 'Lead3 FromManyChat',
        amount: 30.00,
        payment_method_type: 'card',
        created_at: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
        raw_event: { test: true, description: 'Successful after follow-up' }
      },
      // BNPL Pending example
      {
        event_id: `evt_test_bnpl_${Date.now()}`,
        event_type: 'checkout.session.completed',
        checkout_session_id: 'cs_test_bnpl_pending',
        status: 'bnpl_pending',
        customer_email: 'sarah@example.com',
        customer_name: 'Sarah Johnson',
        customer_phone: '+1234567890',
        amount: 150.00,
        payment_method_type: 'klarna',
        abandonment_reason: 'buy_now_pay_later_pending',
        abandoned_at: new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString(), // 6 hours ago
        created_at: new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString(),
        raw_event: { test: true, description: 'BNPL pending approval' }
      }
    ];

    // Insert test events
    const { error: insertError } = await supabaseAdmin
      .from('stripe_webhook_logs')
      .insert(testEvents);

    if (insertError) {
      throw insertError;
    }

    // Now try to match and update contacts
    // Update Connor if exists
    const { data: connor } = await supabaseAdmin
      .from('contacts')
      .select('*')
      .eq('email_address', 'con.tech.johnson@gmail.com')
      .single();

    if (connor) {
      await supabaseAdmin
        .from('contacts')
        .update({
          first_purchase_date: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
          first_purchase_amount: 25.00,
          package_purchase_date: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          package_purchase_amount: 497.00,
          total_purchased: 522.00,
          attended: true,
          bought_package: true,
          sent_package: true
        })
        .eq('user_id', connor.user_id);

      // Update matched_contact_id in stripe logs
      await supabaseAdmin
        .from('stripe_webhook_logs')
        .update({ matched_contact_id: connor.user_id })
        .eq('customer_email', 'con.tech.johnson@gmail.com');
    }

    // Update Lead3 if exists
    const { data: lead3 } = await supabaseAdmin
      .from('contacts')
      .select('*')
      .or('email_address.eq.lead3@example.com,first_name.eq.Lead3')
      .single();

    if (lead3) {
      await supabaseAdmin
        .from('contacts')
        .update({
          first_purchase_date: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(),
          first_purchase_amount: 30.00,
          total_purchased: 30.00,
          attended: true
        })
        .eq('user_id', lead3.user_id);

      // Update matched_contact_id in stripe logs
      await supabaseAdmin
        .from('stripe_webhook_logs')
        .update({ matched_contact_id: lead3.user_id })
        .eq('customer_email', 'lead3@example.com');
    }

    // Get the results
    const { data: results } = await supabaseAdmin
      .from('stripe_webhook_logs')
      .select('*')
      .like('event_id', 'evt_test_%')
      .order('created_at', { ascending: false });

    // Get cycle metrics for these contacts
    const { data: cycleMetrics } = await supabaseAdmin
      .from('contacts')
      .select('first_name, last_name, email_address, subscription_date, first_purchase_date, package_purchase_date, total_purchased')
      .in('email_address', ['con.tech.johnson@gmail.com', 'lead3@example.com']);

    return NextResponse.json({
      success: true,
      eventsAdded: testEvents.length,
      results: results,
      cycleMetrics: cycleMetrics,
      connorMatched: !!connor,
      lead3Matched: !!lead3
    });

  } catch (error: any) {
    console.error('Test events error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  // Show test events status
  const { data: testEvents } = await supabaseAdmin
    .from('stripe_webhook_logs')
    .select('*')
    .like('event_id', 'evt_test_%')
    .order('created_at', { ascending: false });

  const { data: contacts } = await supabaseAdmin
    .from('contacts')
    .select('*')
    .in('email_address', ['con.tech.johnson@gmail.com', 'lead3@example.com']);

  return NextResponse.json({
    testEvents: testEvents?.length || 0,
    events: testEvents,
    matchedContacts: contacts
  });
}