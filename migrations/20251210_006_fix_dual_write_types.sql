-- Migration: Fix type mismatches in update_contact_with_event
-- Issue: COALESCE types text and bigint cannot be matched
-- Solution: Remove problematic fields or handle types correctly

DROP FUNCTION IF EXISTS update_contact_with_event;

CREATE OR REPLACE FUNCTION update_contact_with_event(
  p_contact_id UUID,
  p_update_data JSONB,
  p_event_type TEXT DEFAULT NULL,
  p_source TEXT DEFAULT 'webhook',
  p_source_event_id TEXT DEFAULT NULL
)
RETURNS TABLE(
  contact_updated BOOLEAN,
  event_created UUID
) AS $$
DECLARE
  v_event_id UUID;
  v_tenant_id UUID;
  v_event_data JSONB := '{}'::jsonb;
  v_contact_snapshot JSONB;
BEGIN
  -- Update contacts table (only fields that exist in p_update_data)
  UPDATE contacts SET
    -- Text fields
    first_name = CASE WHEN p_update_data ? 'first_name' THEN (p_update_data->>'first_name') ELSE first_name END,
    last_name = CASE WHEN p_update_data ? 'last_name' THEN (p_update_data->>'last_name') ELSE last_name END,
    email_primary = CASE WHEN p_update_data ? 'email_primary' THEN (p_update_data->>'email_primary') ELSE email_primary END,
    email_booking = CASE WHEN p_update_data ? 'email_booking' THEN (p_update_data->>'email_booking') ELSE email_booking END,
    email_payment = CASE WHEN p_update_data ? 'email_payment' THEN (p_update_data->>'email_payment') ELSE email_payment END,
    phone = CASE WHEN p_update_data ? 'phone' THEN (p_update_data->>'phone') ELSE phone END,
    ig = CASE WHEN p_update_data ? 'ig' THEN (p_update_data->>'ig') ELSE ig END,
    ig_id = CASE WHEN p_update_data ? 'ig_id' THEN (p_update_data->>'ig_id') ELSE ig_id END,
    fb = CASE WHEN p_update_data ? 'fb' THEN (p_update_data->>'fb') ELSE fb END,
    mc_id = CASE WHEN p_update_data ? 'mc_id' THEN (p_update_data->>'mc_id') ELSE mc_id END,
    ghl_id = CASE WHEN p_update_data ? 'ghl_id' THEN (p_update_data->>'ghl_id') ELSE ghl_id END,
    stripe_customer_id = CASE WHEN p_update_data ? 'stripe_customer_id' THEN (p_update_data->>'stripe_customer_id') ELSE stripe_customer_id END,
    ad_id = CASE WHEN p_update_data ? 'ad_id' THEN (p_update_data->>'ad_id') ELSE ad_id END,
    fbclid = CASE WHEN p_update_data ? 'fbclid' THEN (p_update_data->>'fbclid') ELSE fbclid END,
    fbp = CASE WHEN p_update_data ? 'fbp' THEN (p_update_data->>'fbp') ELSE fbp END,
    fbc = CASE WHEN p_update_data ? 'fbc' THEN (p_update_data->>'fbc') ELSE fbc END,
    q1_question = CASE WHEN p_update_data ? 'q1_question' THEN (p_update_data->>'q1_question') ELSE q1_question END,
    q2_question = CASE WHEN p_update_data ? 'q2_question' THEN (p_update_data->>'q2_question') ELSE q2_question END,
    objections = CASE WHEN p_update_data ? 'objections' THEN (p_update_data->>'objections') ELSE objections END,
    lead_summary = CASE WHEN p_update_data ? 'lead_summary' THEN (p_update_data->>'lead_summary') ELSE lead_summary END,
    trigger_word = CASE WHEN p_update_data ? 'trigger_word' THEN (p_update_data->>'trigger_word') ELSE trigger_word END,
    stage = CASE WHEN p_update_data ? 'stage' THEN (p_update_data->>'stage') ELSE stage END,
    source = CASE WHEN p_update_data ? 'source' THEN (p_update_data->>'source') ELSE source END,
    chatbot_ab = CASE WHEN p_update_data ? 'chatbot_ab' THEN (p_update_data->>'chatbot_ab') ELSE chatbot_ab END,
    misc_ab = CASE WHEN p_update_data ? 'misc_ab' THEN (p_update_data->>'misc_ab') ELSE misc_ab END,
    thread_id = CASE WHEN p_update_data ? 'thread_id' THEN (p_update_data->>'thread_id') ELSE thread_id END,

    -- Timestamp fields
    subscribe_date = CASE WHEN p_update_data ? 'subscribe_date' THEN (p_update_data->>'subscribe_date')::TIMESTAMPTZ ELSE subscribe_date END,
    dm_qualified_date = CASE WHEN p_update_data ? 'dm_qualified_date' THEN (p_update_data->>'dm_qualified_date')::TIMESTAMPTZ ELSE dm_qualified_date END,
    link_send_date = CASE WHEN p_update_data ? 'link_send_date' THEN (p_update_data->>'link_send_date')::TIMESTAMPTZ ELSE link_send_date END,
    link_click_date = CASE WHEN p_update_data ? 'link_click_date' THEN (p_update_data->>'link_click_date')::TIMESTAMPTZ ELSE link_click_date END,
    form_submit_date = CASE WHEN p_update_data ? 'form_submit_date' THEN (p_update_data->>'form_submit_date')::TIMESTAMPTZ ELSE form_submit_date END,
    appointment_date = CASE WHEN p_update_data ? 'appointment_date' THEN (p_update_data->>'appointment_date')::TIMESTAMPTZ ELSE appointment_date END,
    appointment_held_date = CASE WHEN p_update_data ? 'appointment_held_date' THEN (p_update_data->>'appointment_held_date')::TIMESTAMPTZ ELSE appointment_held_date END,
    package_sent_date = CASE WHEN p_update_data ? 'package_sent_date' THEN (p_update_data->>'package_sent_date')::TIMESTAMPTZ ELSE package_sent_date END,
    checkout_started = CASE WHEN p_update_data ? 'checkout_started' THEN (p_update_data->>'checkout_started')::TIMESTAMPTZ ELSE checkout_started END,
    purchase_date = CASE WHEN p_update_data ? 'purchase_date' THEN (p_update_data->>'purchase_date')::TIMESTAMPTZ ELSE purchase_date END,
    ig_last_interaction = CASE WHEN p_update_data ? 'ig_last_interaction' THEN (p_update_data->>'ig_last_interaction')::TIMESTAMPTZ ELSE ig_last_interaction END,

    -- Numeric fields
    purchase_amount = CASE WHEN p_update_data ? 'purchase_amount' THEN (p_update_data->>'purchase_amount')::DECIMAL(10,2) ELSE purchase_amount END,

    -- Always update timestamp
    updated_at = NOW()

  WHERE id = p_contact_id
  RETURNING tenant_id INTO v_tenant_id;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Contact not found: %', p_contact_id;
  END IF;

  -- Create event if event_type provided
  IF p_event_type IS NOT NULL THEN
    v_event_data := jsonb_strip_nulls(jsonb_build_object(
      'q1_answer', p_update_data->>'q1_question',
      'q2_answer', p_update_data->>'q2_question',
      'objections', p_update_data->>'objections',
      'lead_summary', p_update_data->>'lead_summary',
      'trigger_word', p_update_data->>'trigger_word',
      'amount', p_update_data->>'purchase_amount',
      'currency', 'usd',
      'ad_id', p_update_data->>'ad_id',
      'chatbot_ab', p_update_data->>'chatbot_ab',
      'ig', p_update_data->>'ig',
      'fb', p_update_data->>'fb',
      'mc_id', p_update_data->>'mc_id',
      'ghl_id', p_update_data->>'ghl_id'
    ));

    SELECT jsonb_build_object(
      'email', COALESCE(email_primary, email_booking, email_payment),
      'first_name', first_name,
      'last_name', last_name,
      'phone', phone,
      'stage', stage,
      'source', source
    )
    INTO v_contact_snapshot
    FROM contacts
    WHERE id = p_contact_id;

    INSERT INTO funnel_events (
      tenant_id,
      contact_id,
      event_type,
      event_timestamp,
      source,
      source_event_id,
      event_data,
      contact_snapshot,
      created_at,
      created_by
    )
    VALUES (
      v_tenant_id,
      p_contact_id,
      p_event_type,
      NOW(),
      p_source,
      p_source_event_id,
      v_event_data,
      v_contact_snapshot,
      NOW(),
      'webhook'
    )
    ON CONFLICT (tenant_id, source, source_event_id)
    WHERE source_event_id IS NOT NULL
    DO NOTHING
    RETURNING id INTO v_event_id;
  END IF;

  RETURN QUERY SELECT TRUE, v_event_id;

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error in update_contact_with_event: %', SQLERRM;
    RAISE;
END;
$$ LANGUAGE plpgsql;
