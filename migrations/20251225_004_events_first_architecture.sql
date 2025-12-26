-- Migration: Events-First Architecture
-- Purpose: Simplify contacts table to identity + current state only
-- Date: 2025-12-25
-- Status: PENDING

-- ============================================
-- STEP 1: Copy existing chatbot_ab to tags
-- ============================================
UPDATE contacts
SET tags = COALESCE(tags, '{}'::jsonb) || jsonb_build_object('chatbot', chatbot_ab)
WHERE chatbot_ab IS NOT NULL
  AND chatbot_ab != ''
  AND (tags->>'chatbot' IS NULL OR tags->>'chatbot' = '');

-- ============================================
-- STEP 2: Backfill ad_id to recent events
-- ============================================
UPDATE funnel_events fe
SET event_data = COALESCE(event_data, '{}'::jsonb) || jsonb_build_object('ad_id', c.ad_id)
FROM contacts c
WHERE fe.contact_id = c.id
  AND c.ad_id IS NOT NULL
  AND (fe.event_data->>'ad_id' IS NULL OR fe.event_data->>'ad_id' = '');

-- ============================================
-- STEP 3: Create simplified RPC
-- Events-first: contacts = identity + stage + tags only
-- All date tracking moves to funnel_events
-- ============================================
CREATE OR REPLACE FUNCTION public.update_contact_with_event(
  p_contact_id uuid,
  p_update_data jsonb,
  p_event_type text DEFAULT NULL,
  p_source text DEFAULT NULL,
  p_source_event_id text DEFAULT NULL,
  p_tags jsonb DEFAULT NULL
)
RETURNS TABLE(success boolean, event_id uuid)
LANGUAGE plpgsql
AS $function$
DECLARE
  v_event_id UUID;
  v_tenant_id UUID;
  v_event_data JSONB := '{}'::jsonb;
  v_contact_snapshot JSONB;
  v_existing_tags JSONB;
BEGIN
  -- Get existing tags
  SELECT tags INTO v_existing_tags FROM contacts WHERE id = p_contact_id;

  -- ============================================
  -- UPDATE CONTACTS: Identity + Stage + Tags ONLY
  -- Date columns are NO LONGER updated here
  -- ============================================
  UPDATE contacts SET
    -- Identity fields (keep updating)
    first_name = CASE WHEN p_update_data ? 'first_name' THEN (p_update_data->>'first_name') ELSE first_name END,
    last_name = CASE WHEN p_update_data ? 'last_name' THEN (p_update_data->>'last_name') ELSE last_name END,
    email_primary = CASE WHEN p_update_data ? 'email_primary' THEN (p_update_data->>'email_primary') ELSE email_primary END,
    email_booking = CASE WHEN p_update_data ? 'email_booking' THEN (p_update_data->>'email_booking') ELSE email_booking END,
    email_payment = CASE WHEN p_update_data ? 'email_payment' THEN (p_update_data->>'email_payment') ELSE email_payment END,
    phone = CASE WHEN p_update_data ? 'phone' THEN (p_update_data->>'phone') ELSE phone END,

    -- Social/platform IDs (keep updating)
    ig = CASE WHEN p_update_data ? 'ig' THEN (p_update_data->>'ig') ELSE ig END,
    ig_id = CASE WHEN p_update_data ? 'ig_id' THEN (p_update_data->>'ig_id')::BIGINT ELSE ig_id END,
    fb = CASE WHEN p_update_data ? 'fb' THEN (p_update_data->>'fb') ELSE fb END,
    mc_id = CASE WHEN p_update_data ? 'mc_id' THEN (p_update_data->>'mc_id') ELSE mc_id END,
    ghl_id = CASE WHEN p_update_data ? 'ghl_id' THEN (p_update_data->>'ghl_id') ELSE ghl_id END,
    stripe_customer_id = CASE WHEN p_update_data ? 'stripe_customer_id' THEN (p_update_data->>'stripe_customer_id') ELSE stripe_customer_id END,

    -- First-touch attribution (keep on contact)
    ad_id = CASE WHEN p_update_data ? 'ad_id' AND ad_id IS NULL THEN (p_update_data->>'ad_id') ELSE ad_id END,

    -- Current state (keep updating)
    stage = CASE WHEN p_update_data ? 'stage' THEN (p_update_data->>'stage') ELSE stage END,
    source = CASE WHEN p_update_data ? 'source' THEN (p_update_data->>'source') ELSE source END,

    -- Merge tags (new tags override existing ones with same key)
    tags = CASE WHEN p_tags IS NOT NULL THEN COALESCE(v_existing_tags, '{}'::jsonb) || p_tags ELSE tags END,

    -- Updated timestamp
    updated_at = NOW()

    -- ============================================
    -- REMOVED: All date columns
    -- These are now ONLY tracked in funnel_events
    -- - subscribe_date, dm_qualified_date, link_send_date
    -- - link_click_date, form_submit_date, appointment_date
    -- - appointment_held_date, package_sent_date
    -- - checkout_started, purchase_date, deposit_paid_date
    -- - ig_last_interaction, purchase_amount
    -- ============================================

  WHERE id = p_contact_id
  RETURNING tenant_id INTO v_tenant_id;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Contact not found: %', p_contact_id;
  END IF;

  -- ============================================
  -- CREATE FUNNEL EVENT: Full details here
  -- This is now the source of truth for all history
  -- ============================================
  IF p_event_type IS NOT NULL THEN
    -- Build event_data with all relevant info (including dates, amounts, etc.)
    v_event_data := jsonb_strip_nulls(jsonb_build_object(
      -- Amounts
      'amount', p_update_data->>'purchase_amount',
      'currency', 'usd',
      -- Attribution
      'ad_id', p_update_data->>'ad_id',
      -- IDs for reference
      'mc_id', p_update_data->>'mc_id',
      'ghl_id', p_update_data->>'ghl_id',
      -- Lead qualification data
      'q1_answer', p_update_data->>'q1_question',
      'q2_answer', p_update_data->>'q2_question',
      'objections', p_update_data->>'objections',
      'lead_summary', p_update_data->>'lead_summary',
      'trigger_word', p_update_data->>'trigger_word',
      -- Legacy fields (for backward compat in event_data)
      'chatbot_ab', p_update_data->>'chatbot_ab',
      'funnel_variant', p_update_data->>'funnel_variant',
      'ig', p_update_data->>'ig',
      'fb', p_update_data->>'fb'
    ));

    -- Get current contact state for snapshot
    SELECT jsonb_build_object(
      'email', COALESCE(email_primary, email_booking, email_payment),
      'first_name', first_name,
      'last_name', last_name,
      'phone', phone,
      'stage', stage,
      'source', source,
      'tags', tags
    )
    INTO v_contact_snapshot
    FROM contacts
    WHERE id = p_contact_id;

    -- Insert funnel event (source of truth)
    INSERT INTO funnel_events (
      tenant_id,
      contact_id,
      event_type,
      event_timestamp,
      source,
      source_event_id,
      event_data,
      contact_snapshot,
      tags,
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
      COALESCE(p_tags, '{}'::jsonb),
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
$function$;

-- ============================================
-- COMMENT: Document the architecture change
-- ============================================
COMMENT ON FUNCTION public.update_contact_with_event IS
'Events-first architecture (Dec 2025):
- Contacts: identity + stage + tags only
- funnel_events: source of truth for all history
- Date columns on contacts are DEPRECATED (not updated)
- Query funnel_events for reporting';
