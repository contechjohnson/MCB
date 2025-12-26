-- Migration: Remove Deprecated Columns from Contacts
-- Purpose: Clean up columns that are no longer updated (events-first architecture)
-- Date: 2025-12-25
-- Status: PENDING

-- ============================================
-- STEP 1: Remove deprecated date columns
-- These are no longer updated - funnel_events is source of truth
-- ============================================

ALTER TABLE contacts DROP COLUMN IF EXISTS subscribe_date;
ALTER TABLE contacts DROP COLUMN IF EXISTS dm_qualified_date;
ALTER TABLE contacts DROP COLUMN IF EXISTS link_send_date;
ALTER TABLE contacts DROP COLUMN IF EXISTS link_click_date;
ALTER TABLE contacts DROP COLUMN IF EXISTS form_submit_date;
ALTER TABLE contacts DROP COLUMN IF EXISTS appointment_date;
ALTER TABLE contacts DROP COLUMN IF EXISTS appointment_held_date;
ALTER TABLE contacts DROP COLUMN IF EXISTS package_sent_date;
ALTER TABLE contacts DROP COLUMN IF EXISTS checkout_started;
ALTER TABLE contacts DROP COLUMN IF EXISTS purchase_date;
ALTER TABLE contacts DROP COLUMN IF EXISTS deposit_paid_date;
ALTER TABLE contacts DROP COLUMN IF EXISTS ig_last_interaction;

-- ============================================
-- STEP 2: Remove deprecated categorization columns
-- These are replaced by JSONB tags column
-- ============================================

ALTER TABLE contacts DROP COLUMN IF EXISTS chatbot_ab;
ALTER TABLE contacts DROP COLUMN IF EXISTS funnel_variant;
ALTER TABLE contacts DROP COLUMN IF EXISTS misc_ab;

-- ============================================
-- STEP 3: Remove deprecated amount column
-- Purchase amounts tracked in payments table
-- ============================================

ALTER TABLE contacts DROP COLUMN IF EXISTS purchase_amount;

-- ============================================
-- STEP 4: Remove deprecated question columns
-- These are stored in funnel_events.event_data
-- ============================================

ALTER TABLE contacts DROP COLUMN IF EXISTS q1_question;
ALTER TABLE contacts DROP COLUMN IF EXISTS q2_question;
ALTER TABLE contacts DROP COLUMN IF EXISTS objections;
ALTER TABLE contacts DROP COLUMN IF EXISTS lead_summary;
ALTER TABLE contacts DROP COLUMN IF EXISTS trigger_word;

-- ============================================
-- STEP 5: Remove deprecated chat columns
-- Thread tracking via funnel_events
-- ============================================

ALTER TABLE contacts DROP COLUMN IF EXISTS thread_id;

-- ============================================
-- STEP 6: Remove deprecated subscription column
-- This was from ManyChat - not used
-- ============================================

ALTER TABLE contacts DROP COLUMN IF EXISTS subscribed;

-- ============================================
-- COMMENT: Document the change
-- ============================================

COMMENT ON TABLE contacts IS
'Events-first architecture (Dec 2025):
KEPT: Identity fields (id, tenant_id, email_*, phone, first_name, last_name)
KEPT: Platform IDs (mc_id, ghl_id, ig, ig_id, fb, stripe_customer_id)
KEPT: Current state (stage, source)
KEPT: First-touch attribution (ad_id)
KEPT: Flexible metadata (tags JSONB)
KEPT: Timestamps (created_at, updated_at)

REMOVED: All date columns (use funnel_events)
REMOVED: chatbot_ab, funnel_variant (use tags)
REMOVED: purchase_amount (use payments table)
REMOVED: q1_question, q2_question, objections, lead_summary (use funnel_events.event_data)';

-- ============================================
-- STEP 7: Verify remaining columns
-- ============================================

-- After this migration, contacts should only have:
-- id, tenant_id, created_at, updated_at
-- mc_id, ghl_id, ig, ig_id, fb, stripe_customer_id
-- email_primary, email_booking, email_payment
-- phone, first_name, last_name
-- stage, source, ad_id, tags
