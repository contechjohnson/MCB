-- Migration: Create dual-write RPC function
-- Created: 2025-12-10
-- Purpose: Replace update_contact_dynamic with update_contact_with_event
--
-- This function writes to BOTH old schema (contacts table) and new schema (funnel_events table)
-- atomically. This enables zero-downtime migration from contact-centric to event-driven.
--
-- Key features:
-- - Atomicity: Both writes succeed or both fail (transaction safety)
-- - Idempotency: Duplicate events prevented via source_event_id unique constraint
-- - Backward compatibility: Old schema (contacts table) continues to work
-- - Event log: New schema (funnel_events) captures immutable history
--
-- Prerequisites:
-- - 20251210_001_create_funnel_events.sql must be run first
--
-- Usage example:
-- SELECT * FROM update_contact_with_event(
--   p_contact_id := 'uuid-here',
--   p_update_data := '{"dm_qualified_date": "2025-12-10T10:30:00Z", "q1_question": "fatigue", "stage": "dm_qualified"}'::jsonb,
--   p_event_type := 'dm_qualified',
--   p_source := 'manychat',
--   p_source_event_id := 'mc_12345_1234567890'
-- );

-- ================================================================
-- FUNCTION: update_contact_with_event
-- ================================================================

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
  -- ================================================================
  -- PHASE 1: Update contacts table (OLD SCHEMA - Backward Compatibility)
  -- ================================================================

  UPDATE contacts SET
    -- Basic contact info
    first_name = COALESCE((p_update_data->>'first_name')::TEXT, first_name),
    last_name = COALESCE((p_update_data->>'last_name')::TEXT, last_name),
    email_primary = COALESCE((p_update_data->>'email_primary')::TEXT, email_primary),
    email_booking = COALESCE((p_update_data->>'email_booking')::TEXT, email_booking),
    email_payment = COALESCE((p_update_data->>'email_payment')::TEXT, email_payment),
    phone = COALESCE((p_update_data->>'phone')::TEXT, phone),

    -- Social profiles
    ig = COALESCE((p_update_data->>'ig')::TEXT, ig),
    ig_id = COALESCE((p_update_data->>'ig_id')::TEXT, ig_id),
    fb = COALESCE((p_update_data->>'fb')::TEXT, fb),

    -- External IDs
    mc_id = COALESCE((p_update_data->>'mc_id')::TEXT, mc_id),
    ghl_id = COALESCE((p_update_data->>'ghl_id')::TEXT, ghl_id),
    stripe_customer_id = COALESCE((p_update_data->>'stripe_customer_id')::TEXT, stripe_customer_id),
    ad_id = COALESCE((p_update_data->>'ad_id')::TEXT, ad_id),

    -- Facebook attribution
    fbclid = COALESCE((p_update_data->>'fbclid')::TEXT, fbclid),
    fbp = COALESCE((p_update_data->>'fbp')::TEXT, fbp),
    fbc = COALESCE((p_update_data->>'fbc')::TEXT, fbc),

    -- Funnel timestamps (backward compatibility - will eventually be deprecated)
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

    -- Qualification data
    q1_question = COALESCE((p_update_data->>'q1_question')::TEXT, q1_question),
    q2_question = COALESCE((p_update_data->>'q2_question')::TEXT, q2_question),
    objections = COALESCE((p_update_data->>'objections')::TEXT, objections),
    lead_summary = COALESCE((p_update_data->>'lead_summary')::TEXT, lead_summary),
    trigger_word = COALESCE((p_update_data->>'trigger_word')::TEXT, trigger_word),

    -- Purchase data
    purchase_amount = COALESCE((p_update_data->>'purchase_amount')::DECIMAL(10,2), purchase_amount),

    -- State
    stage = COALESCE((p_update_data->>'stage')::TEXT, stage),
    source = COALESCE((p_update_data->>'source')::TEXT, source),

    -- A/B testing
    chatbot_ab = COALESCE((p_update_data->>'chatbot_ab')::TEXT, chatbot_ab),
    misc_ab = COALESCE((p_update_data->>'misc_ab')::TEXT, misc_ab),

    -- OpenAI thread ID (chatbot)
    thread_id = COALESCE((p_update_data->>'thread_id')::TEXT, thread_id),

    -- Meta
    ig_last_interaction = COALESCE((p_update_data->>'ig_last_interaction')::TIMESTAMPTZ, ig_last_interaction),
    updated_at = NOW()

  WHERE id = p_contact_id
  RETURNING tenant_id INTO v_tenant_id;

  -- Check if contact was found
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Contact not found: %', p_contact_id;
  END IF;

  -- ================================================================
  -- PHASE 2: Create event (NEW SCHEMA - Event Log)
  -- ================================================================

  IF p_event_type IS NOT NULL THEN
    -- Build event_data from relevant fields in p_update_data
    v_event_data := jsonb_strip_nulls(jsonb_build_object(
      -- Qualification
      'q1_answer', p_update_data->>'q1_question',
      'q2_answer', p_update_data->>'q2_question',
      'objections', p_update_data->>'objections',
      'lead_summary', p_update_data->>'lead_summary',
      'trigger_word', p_update_data->>'trigger_word',

      -- Purchase
      'amount', p_update_data->>'purchase_amount',
      'currency', 'usd',

      -- Attribution
      'ad_id', p_update_data->>'ad_id',
      'chatbot_ab', p_update_data->>'chatbot_ab',

      -- Social
      'ig', p_update_data->>'ig',
      'fb', p_update_data->>'fb',

      -- IDs (for linkage debugging)
      'mc_id', p_update_data->>'mc_id',
      'ghl_id', p_update_data->>'ghl_id'
    ));

    -- Get current contact snapshot (state at event time)
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

    -- Insert event (with idempotency via ON CONFLICT)
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
    DO NOTHING  -- Idempotency: skip duplicate events
    RETURNING id INTO v_event_id;

    -- Note: v_event_id will be NULL if event was a duplicate (DO NOTHING triggered)
  END IF;

  -- ================================================================
  -- RETURN RESULTS
  -- ================================================================

  RETURN QUERY SELECT TRUE, v_event_id;

EXCEPTION
  WHEN OTHERS THEN
    -- Log error and re-raise
    RAISE NOTICE 'Error in update_contact_with_event: %', SQLERRM;
    RAISE;
END;
$$ LANGUAGE plpgsql;

-- ================================================================
-- COMMENTS (Database Documentation)
-- ================================================================

COMMENT ON FUNCTION update_contact_with_event IS
'Dual-write function: Updates contacts table (old schema) AND creates event in funnel_events (new schema). Atomically safe - both succeed or both fail. Idempotent via source_event_id constraint.';

-- ================================================================
-- VERIFICATION / TESTING
-- ================================================================

-- Test 1: Update contact without creating event (backward compatibility)
DO $$
DECLARE
  v_test_contact_id UUID;
  v_result RECORD;
BEGIN
  -- Get a test contact
  SELECT id INTO v_test_contact_id FROM contacts LIMIT 1;

  IF v_test_contact_id IS NOT NULL THEN
    -- Update without event
    SELECT * INTO v_result FROM update_contact_with_event(
      v_test_contact_id,
      '{"first_name": "Test Update"}'::jsonb,
      NULL,  -- No event type
      'test',
      NULL
    );

    RAISE NOTICE 'Test 1 - Update without event: contact_updated=%, event_created=%',
      v_result.contact_updated, v_result.event_created;
  END IF;
END $$;

-- Test 2: Update contact WITH event creation
DO $$
DECLARE
  v_test_contact_id UUID;
  v_result RECORD;
BEGIN
  -- Get a test contact
  SELECT id INTO v_test_contact_id FROM contacts LIMIT 1;

  IF v_test_contact_id IS NOT NULL THEN
    -- Update with event
    SELECT * INTO v_result FROM update_contact_with_event(
      v_test_contact_id,
      '{"q1_question": "Test symptom", "stage": "dm_qualified"}'::jsonb,
      'dm_qualified',  -- Event type
      'test',
      'test_event_' || gen_random_uuid()::text  -- Unique event ID
    );

    RAISE NOTICE 'Test 2 - Update with event: contact_updated=%, event_created=%',
      v_result.contact_updated, v_result.event_created;

    -- Verify event was created
    IF v_result.event_created IS NOT NULL THEN
      RAISE NOTICE 'Event created successfully: %', v_result.event_created;
    ELSE
      RAISE WARNING 'Event was not created (may be duplicate)';
    END IF;
  END IF;
END $$;

-- Test 3: Idempotency (duplicate event should be ignored)
DO $$
DECLARE
  v_test_contact_id UUID;
  v_result1 RECORD;
  v_result2 RECORD;
  v_event_id TEXT;
BEGIN
  -- Get a test contact
  SELECT id INTO v_test_contact_id FROM contacts LIMIT 1;

  IF v_test_contact_id IS NOT NULL THEN
    -- Generate unique event ID
    v_event_id := 'idempotency_test_' || gen_random_uuid()::text;

    -- First call - should create event
    SELECT * INTO v_result1 FROM update_contact_with_event(
      v_test_contact_id,
      '{"q1_question": "Idempotency test"}'::jsonb,
      'dm_qualified',
      'test',
      v_event_id
    );

    -- Second call with SAME event ID - should NOT create duplicate
    SELECT * INTO v_result2 FROM update_contact_with_event(
      v_test_contact_id,
      '{"q1_question": "Idempotency test 2"}'::jsonb,
      'dm_qualified',
      'test',
      v_event_id  -- Same ID
    );

    RAISE NOTICE 'Test 3 - Idempotency:';
    RAISE NOTICE '  First call created event: %', v_result1.event_created;
    RAISE NOTICE '  Second call created event: % (should be NULL)', v_result2.event_created;

    IF v_result1.event_created IS NOT NULL AND v_result2.event_created IS NULL THEN
      RAISE NOTICE '  ✓ Idempotency working correctly';
    ELSE
      RAISE WARNING '  ✗ Idempotency may not be working';
    END IF;
  END IF;
END $$;

-- ================================================================
-- CLEANUP (if needed)
-- ================================================================

-- To rollback this migration:
-- DROP FUNCTION IF EXISTS update_contact_with_event;

-- ================================================================
-- MIGRATION NOTES
-- ================================================================

-- Next steps:
-- 1. Update webhook handlers to use update_contact_with_event instead of update_contact_dynamic
-- 2. Deploy webhook changes with feature flag (use_new_webhook_handler)
-- 3. Validate parity between old and new schema
-- 4. Once validated, deprecate update_contact_dynamic
-- 5. Eventually remove timestamp columns from contacts table (far future)
