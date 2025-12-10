-- Migration: Migrate historical contact timestamps to funnel_events
-- Created: 2025-12-10
-- Purpose: Convert all existing contact timestamp columns to immutable events
--
-- This migration performs a one-time retroactive conversion of ~1,578 contacts
-- with their timestamp fields (dm_qualified_date, purchase_date, etc.) into
-- the new funnel_events table.
--
-- IMPORTANT: This is safe to run multiple times (idempotent). Events are marked
-- with created_by='migration' so they can be identified and removed if needed.
--
-- Prerequisites:
-- - 20251210_001_create_funnel_events.sql must be run first
--
-- Expected results:
-- - ~1,578 contact_subscribed events (one per contact)
-- - ~400-500 dm_qualified events
-- - ~100-200 link_sent events
-- - ~50-100 link_clicked events
-- - ~5-10 purchase_completed events
-- - Total: ~10,000-15,000 events

-- ================================================================
-- HELPER FUNCTION: Create event from contact timestamp
-- ================================================================

CREATE OR REPLACE FUNCTION create_event_from_contact_timestamp(
  p_contact_id UUID,
  p_tenant_id UUID,
  p_event_type TEXT,
  p_timestamp TIMESTAMPTZ,
  p_event_data JSONB DEFAULT '{}'::jsonb,
  p_source TEXT DEFAULT 'system'
)
RETURNS UUID AS $$
DECLARE
  v_event_id UUID;
  v_contact_snapshot JSONB;
BEGIN
  -- Skip if timestamp is NULL
  IF p_timestamp IS NULL THEN
    RETURN NULL;
  END IF;

  -- Build contact snapshot (what we knew about the contact at migration time)
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

  -- Insert event (deduplication via source_event_id)
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
    p_tenant_id,
    p_contact_id,
    p_event_type,
    p_timestamp,
    p_source,
    'migration_' || p_contact_id::text || '_' || p_event_type,  -- Unique ID for dedup
    p_event_data,
    v_contact_snapshot,
    NOW(),
    'migration'
  )
  ON CONFLICT (tenant_id, source, source_event_id)
  WHERE source_event_id IS NOT NULL
  DO NOTHING  -- Skip if already migrated
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$ LANGUAGE plpgsql;

-- ================================================================
-- MIGRATION EXECUTION
-- ================================================================

DO $$
DECLARE
  v_contact RECORD;
  v_event_count INTEGER := 0;
  v_contact_count INTEGER := 0;
  v_start_time TIMESTAMP := clock_timestamp();
BEGIN
  RAISE NOTICE 'Starting historical data migration...';
  RAISE NOTICE 'This will convert contact timestamp columns to events';
  RAISE NOTICE '';

  -- Iterate through all contacts with tenant_id
  FOR v_contact IN
    SELECT
      id,
      tenant_id,
      -- Timestamps
      subscribe_date,
      dm_qualified_date,
      link_send_date,
      link_click_date,
      form_submit_date,
      appointment_date,
      appointment_held_date,
      package_sent_date,
      checkout_started,
      purchase_date,
      -- Event-specific data
      q1_question,
      q2_question,
      objections,
      lead_summary,
      purchase_amount,
      chatbot_ab,
      trigger_word,
      ad_id,
      source
    FROM contacts
    WHERE tenant_id IS NOT NULL
    ORDER BY created_at
  LOOP
    v_contact_count := v_contact_count + 1;

    -- ==============================================================
    -- 1. CONTACT_SUBSCRIBED (subscribe_date)
    -- ==============================================================
    IF v_contact.subscribe_date IS NOT NULL THEN
      PERFORM create_event_from_contact_timestamp(
        v_contact.id,
        v_contact.tenant_id,
        'contact_subscribed',
        v_contact.subscribe_date,
        jsonb_build_object(
          'chatbot_ab', v_contact.chatbot_ab,
          'trigger_word', v_contact.trigger_word,
          'ad_id', v_contact.ad_id,
          'source', v_contact.source
        )
      );
      v_event_count := v_event_count + 1;
    END IF;

    -- ==============================================================
    -- 2. DM_QUALIFIED (dm_qualified_date)
    -- ==============================================================
    IF v_contact.dm_qualified_date IS NOT NULL THEN
      PERFORM create_event_from_contact_timestamp(
        v_contact.id,
        v_contact.tenant_id,
        'dm_qualified',
        v_contact.dm_qualified_date,
        jsonb_build_object(
          'q1_answer', v_contact.q1_question,
          'q2_answer', v_contact.q2_question,
          'objections', v_contact.objections,
          'lead_summary', v_contact.lead_summary,
          'chatbot_ab', v_contact.chatbot_ab
        )
      );
      v_event_count := v_event_count + 1;
    END IF;

    -- ==============================================================
    -- 3. LINK_SENT (link_send_date)
    -- ==============================================================
    IF v_contact.link_send_date IS NOT NULL THEN
      PERFORM create_event_from_contact_timestamp(
        v_contact.id,
        v_contact.tenant_id,
        'link_sent',
        v_contact.link_send_date,
        '{}'::jsonb
      );
      v_event_count := v_event_count + 1;
    END IF;

    -- ==============================================================
    -- 4. LINK_CLICKED (link_click_date)
    -- ==============================================================
    IF v_contact.link_click_date IS NOT NULL THEN
      PERFORM create_event_from_contact_timestamp(
        v_contact.id,
        v_contact.tenant_id,
        'link_clicked',
        v_contact.link_click_date,
        '{}'::jsonb
      );
      v_event_count := v_event_count + 1;
    END IF;

    -- ==============================================================
    -- 5. FORM_SUBMITTED (form_submit_date)
    -- ==============================================================
    IF v_contact.form_submit_date IS NOT NULL THEN
      PERFORM create_event_from_contact_timestamp(
        v_contact.id,
        v_contact.tenant_id,
        'form_submitted',
        v_contact.form_submit_date,
        '{}'::jsonb
      );
      v_event_count := v_event_count + 1;
    END IF;

    -- ==============================================================
    -- 6. APPOINTMENT_SCHEDULED (appointment_date)
    -- ==============================================================
    IF v_contact.appointment_date IS NOT NULL THEN
      PERFORM create_event_from_contact_timestamp(
        v_contact.id,
        v_contact.tenant_id,
        'appointment_scheduled',
        v_contact.appointment_date,
        '{}'::jsonb
      );
      v_event_count := v_event_count + 1;
    END IF;

    -- ==============================================================
    -- 7. APPOINTMENT_HELD (appointment_held_date)
    -- ==============================================================
    IF v_contact.appointment_held_date IS NOT NULL THEN
      PERFORM create_event_from_contact_timestamp(
        v_contact.id,
        v_contact.tenant_id,
        'appointment_held',
        v_contact.appointment_held_date,
        '{}'::jsonb
      );
      v_event_count := v_event_count + 1;
    END IF;

    -- ==============================================================
    -- 8. PACKAGE_SENT (package_sent_date)
    -- ==============================================================
    IF v_contact.package_sent_date IS NOT NULL THEN
      PERFORM create_event_from_contact_timestamp(
        v_contact.id,
        v_contact.tenant_id,
        'package_sent',
        v_contact.package_sent_date,
        '{}'::jsonb
      );
      v_event_count := v_event_count + 1;
    END IF;

    -- ==============================================================
    -- 9. CHECKOUT_STARTED (checkout_started)
    -- ==============================================================
    IF v_contact.checkout_started IS NOT NULL THEN
      PERFORM create_event_from_contact_timestamp(
        v_contact.id,
        v_contact.tenant_id,
        'checkout_started',
        v_contact.checkout_started,
        '{}'::jsonb
      );
      v_event_count := v_event_count + 1;
    END IF;

    -- ==============================================================
    -- 10. PURCHASE_COMPLETED (purchase_date)
    -- ==============================================================
    IF v_contact.purchase_date IS NOT NULL THEN
      PERFORM create_event_from_contact_timestamp(
        v_contact.id,
        v_contact.tenant_id,
        'purchase_completed',
        v_contact.purchase_date,
        jsonb_build_object(
          'amount', v_contact.purchase_amount,
          'currency', 'usd'
        )
      );
      v_event_count := v_event_count + 1;
    END IF;

    -- Progress indicator every 100 contacts
    IF v_contact_count % 100 = 0 THEN
      RAISE NOTICE 'Processed % contacts, created % events...', v_contact_count, v_event_count;
    END IF;

  END LOOP;

  -- Final summary
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration complete!';
  RAISE NOTICE 'Processed contacts: %', v_contact_count;
  RAISE NOTICE 'Events created: %', v_event_count;
  RAISE NOTICE 'Duration: % seconds', EXTRACT(EPOCH FROM (clock_timestamp() - v_start_time))::INTEGER;
  RAISE NOTICE '========================================';
END $$;

-- ================================================================
-- VERIFICATION QUERIES
-- ================================================================

-- Count events by type
SELECT
  event_type,
  COUNT(*) as event_count,
  COUNT(DISTINCT contact_id) as unique_contacts
FROM funnel_events
WHERE created_by = 'migration'
GROUP BY event_type
ORDER BY event_count DESC;

-- Compare old schema vs new schema (should match)
DO $$
DECLARE
  v_old_subscribed INTEGER;
  v_new_subscribed INTEGER;
  v_old_qualified INTEGER;
  v_new_qualified INTEGER;
  v_old_purchased INTEGER;
  v_new_purchased INTEGER;
BEGIN
  -- Contact subscribed
  SELECT COUNT(*) INTO v_old_subscribed FROM contacts WHERE subscribe_date IS NOT NULL;
  SELECT COUNT(*) INTO v_new_subscribed FROM funnel_events WHERE event_type = 'contact_subscribed' AND created_by = 'migration';

  -- DM qualified
  SELECT COUNT(*) INTO v_old_qualified FROM contacts WHERE dm_qualified_date IS NOT NULL;
  SELECT COUNT(*) INTO v_new_qualified FROM funnel_events WHERE event_type = 'dm_qualified' AND created_by = 'migration';

  -- Purchased
  SELECT COUNT(*) INTO v_old_purchased FROM contacts WHERE purchase_date IS NOT NULL;
  SELECT COUNT(*) INTO v_new_purchased FROM funnel_events WHERE event_type = 'purchase_completed' AND created_by = 'migration';

  RAISE NOTICE '';
  RAISE NOTICE '=== DATA INTEGRITY CHECK ===';
  RAISE NOTICE 'Subscribed - Old: %, New: %, Match: %', v_old_subscribed, v_new_subscribed, (v_old_subscribed = v_new_subscribed);
  RAISE NOTICE 'Qualified - Old: %, New: %, Match: %', v_old_qualified, v_new_qualified, (v_old_qualified = v_new_qualified);
  RAISE NOTICE 'Purchased - Old: %, New: %, Match: %', v_old_purchased, v_new_purchased, (v_old_purchased = v_new_purchased);

  IF v_old_subscribed != v_new_subscribed OR v_old_qualified != v_new_qualified OR v_old_purchased != v_new_purchased THEN
    RAISE WARNING 'DATA MISMATCH DETECTED - Review migration logic!';
  ELSE
    RAISE NOTICE 'ALL CHECKS PASSED ✓';
  END IF;
END $$;

-- Sample events from different types
SELECT
  event_type,
  event_timestamp,
  event_data->>'q1_answer' as q1,
  event_data->>'amount' as amount,
  contact_snapshot->>'email' as email
FROM funnel_events
WHERE created_by = 'migration'
ORDER BY event_timestamp DESC
LIMIT 10;

-- ================================================================
-- ROLLBACK (if needed)
-- ================================================================

-- Uncomment to remove all migrated events:
-- DELETE FROM funnel_events WHERE created_by = 'migration';
-- DROP FUNCTION IF EXISTS create_event_from_contact_timestamp;

-- ================================================================
-- CLEANUP
-- ================================================================

-- Drop helper function (optional - keep if you want to re-run migration)
-- DROP FUNCTION IF EXISTS create_event_from_contact_timestamp;

COMMENT ON FUNCTION create_event_from_contact_timestamp IS
'Helper function for migrating contact timestamps to events. Creates event with deduplication via source_event_id.';
