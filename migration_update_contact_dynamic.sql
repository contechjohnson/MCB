-- Migration: Dynamic Contact Update Function
-- Created: Nov 5, 2025
-- Purpose: Bypass Supabase schema cache by using dynamic JSONB-based updates
--
-- This function accepts a contact_id (UUID) and a JSONB object containing
-- any fields you want to update. It will only update fields that are provided
-- in the JSONB object, leaving others unchanged.
--
-- Usage:
--   SELECT update_contact_dynamic(
--     'contact-uuid-here'::UUID,
--     '{"first_name": "John", "email_primary": "john@example.com", "stage": "dm_qualified"}'::JSONB
--   );

CREATE OR REPLACE FUNCTION update_contact_dynamic(
  contact_id UUID,
  update_data JSONB
)
RETURNS VOID AS $$
BEGIN
  UPDATE contacts
  SET
    -- Contact Info
    first_name = COALESCE((update_data->>'first_name')::TEXT, first_name),
    last_name = COALESCE((update_data->>'last_name')::TEXT, last_name),
    email_primary = COALESCE((update_data->>'email_primary')::TEXT, email_primary),
    email_booking = COALESCE((update_data->>'email_booking')::TEXT, email_booking),
    email_payment = COALESCE((update_data->>'email_payment')::TEXT, email_payment),
    phone = COALESCE((update_data->>'phone')::TEXT, phone),

    -- Social Media
    ig = COALESCE((update_data->>'ig')::TEXT, ig),
    ig_id = COALESCE((update_data->>'ig_id')::BIGINT, ig_id),
    fb = COALESCE((update_data->>'fb')::TEXT, fb),

    -- External IDs
    mc_id = COALESCE((update_data->>'mc_id')::TEXT, mc_id),
    ghl_id = COALESCE((update_data->>'ghl_id')::TEXT, ghl_id),
    ad_id = COALESCE((update_data->>'ad_id')::TEXT, ad_id),
    stripe_customer_id = COALESCE((update_data->>'stripe_customer_id')::TEXT, stripe_customer_id),

    -- AB Testing & Tracking
    chatbot_ab = COALESCE((update_data->>'chatbot_ab')::TEXT, chatbot_ab),
    misc_ab = COALESCE((update_data->>'misc_ab')::TEXT, misc_ab),
    trigger_word = COALESCE((update_data->>'trigger_word')::TEXT, trigger_word),

    -- Qualification Questions
    q1_question = COALESCE((update_data->>'q1_question')::TEXT, q1_question),
    q2_question = COALESCE((update_data->>'q2_question')::TEXT, q2_question),
    objections = COALESCE((update_data->>'objections')::TEXT, objections),
    lead_summary = COALESCE((update_data->>'lead_summary')::TEXT, lead_summary),

    -- AI Context
    thread_id = COALESCE((update_data->>'thread_id')::TEXT, thread_id),

    -- Timestamps - ManyChat Journey
    subscribed = COALESCE((update_data->>'subscribed')::TIMESTAMPTZ, subscribed),
    subscribe_date = COALESCE((update_data->>'subscribe_date')::TIMESTAMPTZ, subscribe_date),
    followed_date = COALESCE((update_data->>'followed_date')::TIMESTAMPTZ, followed_date),
    ig_last_interaction = COALESCE((update_data->>'ig_last_interaction')::TIMESTAMPTZ, ig_last_interaction),
    dm_qualified_date = COALESCE((update_data->>'dm_qualified_date')::TIMESTAMPTZ, dm_qualified_date),
    link_send_date = COALESCE((update_data->>'link_send_date')::TIMESTAMPTZ, link_send_date),
    link_click_date = COALESCE((update_data->>'link_click_date')::TIMESTAMPTZ, link_click_date),

    -- Timestamps - Booking & Meeting Journey
    form_submit_date = COALESCE((update_data->>'form_submit_date')::TIMESTAMPTZ, form_submit_date),
    meeting_book_date = COALESCE((update_data->>'meeting_book_date')::TIMESTAMPTZ, meeting_book_date),
    meeting_held_date = COALESCE((update_data->>'meeting_held_date')::TIMESTAMPTZ, meeting_held_date),

    -- Timestamps - Purchase Journey
    checkout_started = COALESCE((update_data->>'checkout_started')::TIMESTAMPTZ, checkout_started),
    purchase_date = COALESCE((update_data->>'purchase_date')::TIMESTAMPTZ, purchase_date),
    purchase_amount = COALESCE((update_data->>'purchase_amount')::DECIMAL(10, 2), purchase_amount),

    -- Timestamps - Feedback
    feedback_sent_date = COALESCE((update_data->>'feedback_sent_date')::TIMESTAMPTZ, feedback_sent_date),
    feedback_received_date = COALESCE((update_data->>'feedback_received_date')::TIMESTAMPTZ, feedback_received_date),
    feedback_text = COALESCE((update_data->>'feedback_text')::TEXT, feedback_text),

    -- Stage (current funnel position)
    stage = COALESCE((update_data->>'stage')::TEXT, stage),

    -- Housekeeping (always update this)
    updated_at = NOW()
  WHERE id = contact_id;
END;
$$ LANGUAGE plpgsql;

-- ====================
-- VERIFICATION & TESTING
-- ====================

-- Create a test helper function to demonstrate usage
CREATE OR REPLACE FUNCTION test_update_contact_dynamic()
RETURNS TEXT AS $$
DECLARE
  test_contact_id UUID;
BEGIN
  -- Create a test contact
  INSERT INTO contacts (mc_id, email_primary, stage)
  VALUES ('test_dynamic_' || gen_random_uuid()::TEXT, 'test@dynamic.com', 'new_lead')
  RETURNING id INTO test_contact_id;

  -- Test 1: Update just the name
  PERFORM update_contact_dynamic(
    test_contact_id,
    '{"first_name": "Dynamic", "last_name": "Test"}'::JSONB
  );

  -- Test 2: Update stage and add a timestamp
  PERFORM update_contact_dynamic(
    test_contact_id,
    '{"stage": "dm_qualified", "dm_qualified_date": "2025-11-05T12:00:00Z"}'::JSONB
  );

  -- Test 3: Update multiple fields at once
  PERFORM update_contact_dynamic(
    test_contact_id,
    '{"phone": "+1-555-1234", "ig": "@dynamictest", "chatbot_ab": "variant_a"}'::JSONB
  );

  -- Clean up
  DELETE FROM contacts WHERE id = test_contact_id;

  RETURN 'All tests passed! Function is working correctly.';
END;
$$ LANGUAGE plpgsql;

-- Run the test (uncomment to execute)
-- SELECT test_update_contact_dynamic();

-- ====================
-- USAGE EXAMPLES
-- ====================

-- Example 1: Update just the email
-- SELECT update_contact_dynamic(
--   'your-contact-uuid'::UUID,
--   '{"email_primary": "newemail@example.com"}'::JSONB
-- );

-- Example 2: Update stage and timestamp together
-- SELECT update_contact_dynamic(
--   'your-contact-uuid'::UUID,
--   '{"stage": "dm_qualified", "dm_qualified_date": "2025-11-05T12:00:00Z"}'::JSONB
-- );

-- Example 3: Bulk update from webhook data
-- SELECT update_contact_dynamic(
--   'your-contact-uuid'::UUID,
--   '{"first_name": "John", "last_name": "Doe", "phone": "+1-555-1234", "subscribed": "2025-11-05T10:00:00Z"}'::JSONB
-- );

-- Example 4: Update social media fields
-- SELECT update_contact_dynamic(
--   'your-contact-uuid'::UUID,
--   '{"ig": "@johndoe", "ig_id": 123456789, "ig_last_interaction": "2025-11-05T12:00:00Z"}'::JSONB
-- );
