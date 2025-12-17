-- Migration: Add funnel_variant column for A/B testing
-- Purpose: Track which funnel path each contact entered through
-- Values: 'jane_paid' (ManyChat → Jane), 'calendly_free' (Perspective → Calendly)

-- Add funnel_variant column
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS funnel_variant TEXT;

-- Add comment for documentation
COMMENT ON COLUMN contacts.funnel_variant IS 'Tracks which funnel the contact entered through: jane_paid, calendly_free, etc.';

-- Index for analytics queries that filter by funnel variant
CREATE INDEX IF NOT EXISTS idx_contacts_funnel_variant
ON contacts(tenant_id, funnel_variant, created_at DESC);

-- Backfill existing contacts as jane_paid (the original funnel)
-- Excludes historical imports which have source = 'instagram_historical'
UPDATE contacts
SET funnel_variant = 'jane_paid'
WHERE funnel_variant IS NULL
  AND source != 'instagram_historical';

-- Update the update_contact_with_event function to handle funnel_variant
-- This ensures the dual-write function preserves funnel_variant when updating contacts
CREATE OR REPLACE FUNCTION update_contact_with_event(
  p_contact_id UUID,
  p_update_data JSONB,
  p_event_type TEXT DEFAULT NULL,
  p_source TEXT DEFAULT NULL,
  p_source_event_id TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
  v_contact_before JSONB;
  v_contact_after JSONB;
  v_event_id UUID;
  v_tenant_id UUID;
BEGIN
  -- Get current contact state
  SELECT to_jsonb(c.*) INTO v_contact_before
  FROM contacts c
  WHERE c.id = p_contact_id;

  IF v_contact_before IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Contact not found');
  END IF;

  v_tenant_id := (v_contact_before->>'tenant_id')::UUID;

  -- Update contact with dynamic fields, preserving funnel_variant if not explicitly set
  UPDATE contacts
  SET
    email_primary = COALESCE((p_update_data->>'email_primary'), email_primary),
    email_booking = COALESCE((p_update_data->>'email_booking'), email_booking),
    email_payment = COALESCE((p_update_data->>'email_payment'), email_payment),
    first_name = COALESCE((p_update_data->>'first_name'), first_name),
    last_name = COALESCE((p_update_data->>'last_name'), last_name),
    phone = COALESCE((p_update_data->>'phone'), phone),
    ig = COALESCE((p_update_data->>'ig'), ig),
    fb = COALESCE((p_update_data->>'fb'), fb),
    stage = COALESCE((p_update_data->>'stage'), stage),
    source = COALESCE((p_update_data->>'source'), source),
    funnel_variant = COALESCE((p_update_data->>'funnel_variant'), funnel_variant),
    mc_id = COALESCE((p_update_data->>'mc_id'), mc_id),
    ghl_id = COALESCE((p_update_data->>'ghl_id'), ghl_id),
    stripe_customer_id = COALESCE((p_update_data->>'stripe_customer_id'), stripe_customer_id),
    ad_id = COALESCE((p_update_data->>'ad_id'), ad_id),
    thread_id = COALESCE((p_update_data->>'thread_id'), thread_id),
    chatbot_ab = COALESCE((p_update_data->>'chatbot_ab'), chatbot_ab),
    misc_ab = COALESCE((p_update_data->>'misc_ab'), misc_ab),
    trigger_word = COALESCE((p_update_data->>'trigger_word'), trigger_word),
    q1_question = COALESCE((p_update_data->>'q1_question'), q1_question),
    q2_question = COALESCE((p_update_data->>'q2_question'), q2_question),
    objections = COALESCE((p_update_data->>'objections'), objections),
    lead_summary = COALESCE((p_update_data->>'lead_summary'), lead_summary),
    subscribe_date = COALESCE((p_update_data->>'subscribe_date')::TIMESTAMPTZ, subscribe_date),
    dm_qualified_date = COALESCE((p_update_data->>'dm_qualified_date')::TIMESTAMPTZ, dm_qualified_date),
    link_send_date = COALESCE((p_update_data->>'link_send_date')::TIMESTAMPTZ, link_send_date),
    link_click_date = COALESCE((p_update_data->>'link_click_date')::TIMESTAMPTZ, link_click_date),
    form_submit_date = COALESCE((p_update_data->>'form_submit_date')::TIMESTAMPTZ, form_submit_date),
    appointment_date = COALESCE((p_update_data->>'appointment_date')::TIMESTAMPTZ, appointment_date),
    appointment_held_date = COALESCE((p_update_data->>'appointment_held_date')::TIMESTAMPTZ, appointment_held_date),
    package_sent_date = COALESCE((p_update_data->>'package_sent_date')::TIMESTAMPTZ, package_sent_date),
    checkout_started = COALESCE((p_update_data->>'checkout_started')::TIMESTAMPTZ, checkout_started),
    purchase_date = COALESCE((p_update_data->>'purchase_date')::TIMESTAMPTZ, purchase_date),
    purchase_amount = COALESCE((p_update_data->>'purchase_amount')::DECIMAL, purchase_amount),
    updated_at = NOW()
  WHERE id = p_contact_id;

  -- Get updated contact state
  SELECT to_jsonb(c.*) INTO v_contact_after
  FROM contacts c
  WHERE c.id = p_contact_id;

  -- Create funnel event if event_type is provided
  IF p_event_type IS NOT NULL THEN
    INSERT INTO funnel_events (
      tenant_id,
      contact_id,
      event_type,
      event_timestamp,
      source,
      source_event_id,
      event_data,
      contact_snapshot
    )
    VALUES (
      v_tenant_id,
      p_contact_id,
      p_event_type,
      NOW(),
      COALESCE(p_source, 'system'),
      p_source_event_id,
      p_update_data,
      v_contact_before
    )
    RETURNING id INTO v_event_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'contact_id', p_contact_id,
    'event_id', v_event_id,
    'updated_fields', (
      SELECT jsonb_object_agg(key, value)
      FROM jsonb_each(p_update_data)
      WHERE value IS NOT NULL
    )
  );
END;
$$ LANGUAGE plpgsql;
