-- Fresh contacts table recreation with ALL columns
-- Including: subscribed, ig_last_interaction, ig_id
-- Date: Jan 5, 2025

-- ====================
-- STEP 1: Drop everything cleanly
-- ====================

DROP TABLE IF EXISTS contacts CASCADE;
DROP FUNCTION IF EXISTS find_contact_by_email(TEXT);
DROP FUNCTION IF EXISTS find_contact_by_mc_id(TEXT);
DROP FUNCTION IF EXISTS find_contact_by_ghl_id(TEXT);
DROP FUNCTION IF EXISTS find_contact_by_phone(TEXT);
DROP FUNCTION IF EXISTS find_contact_smart(TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS update_updated_at_column();

-- ====================
-- STEP 2: Create contacts table with ALL columns
-- ====================

CREATE TABLE contacts (
  -- Internal ID (always exists, immutable)
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- External IDs (all optional, depending on entry point)
  MC_ID TEXT UNIQUE,                   -- ManyChat subscriber ID (if came through ManyChat)
  GHL_ID TEXT UNIQUE,                  -- GoHighLevel contact ID (when they book/form submit)
  AD_ID TEXT,                          -- Facebook/Meta Ad ID (for ROAS tracking)
  stripe_customer_id TEXT,             -- Stripe customer ID (when they purchase)
  ig_id BIGINT,                        -- Instagram user ID (numeric)

  -- Contact Information (used for matching across platforms)
  first_name TEXT,
  last_name TEXT,
  email_primary TEXT,                  -- Primary email (usually from ManyChat or first seen)
  email_booking TEXT,                  -- Email used when booking (from GHL)
  email_payment TEXT,                  -- Email used in Stripe checkout
  phone TEXT,                          -- Phone number (optional, formatting varies by platform)
  IG TEXT,                             -- Instagram username
  FB TEXT,                             -- Facebook name

  -- Funnel Stage & Testing
  stage TEXT,                          -- Current funnel stage (auto-updated by webhooks)
  chatbot_AB TEXT,                     -- Which chatbot variant (A or B)
  MISC_AB TEXT,                        -- Other AB tests
  trigger_word TEXT,                   -- Word that triggered ManyChat conversation

  -- Qualification Questions (from ManyChat)
  Q1_question TEXT,                    -- Answer to Q1 (e.g., "How many months postpartum?")
  Q2_question TEXT,                    -- Answer to Q2 (e.g., "What symptoms?")
  objections TEXT,                     -- Recorded objections for data mining

  -- Funnel Timestamps (all timestamptz for exact tracking)
  -- ManyChat Journey
  subscribe_date TIMESTAMPTZ,          -- When they first opted in to ManyChat
  subscribed TIMESTAMPTZ,              -- Alternative subscribe date field (may be used by some webhooks)
  followed_date TIMESTAMPTZ,           -- When they became IG/FB follower (may precede subscribe)
  DM_qualified_date TIMESTAMPTZ,       -- When they answered BOTH qualification questions (final state)
  link_send_date TIMESTAMPTZ,          -- When chatbot sent the booking link
  link_click_date TIMESTAMPTZ,         -- When they clicked the booking link
  ig_last_interaction TIMESTAMPTZ,     -- Last time they interacted via Instagram

  -- Booking & Meeting Journey
  form_submit_date TIMESTAMPTZ,        -- When they submitted the form (GHL or funnel page)
  meeting_book_date TIMESTAMPTZ,       -- When they booked a discovery call (from GHL)
  meeting_held_date TIMESTAMPTZ,       -- When they actually attended the call

  -- Purchase Journey
  checkout_started TIMESTAMPTZ,        -- When they started Stripe checkout (optional tracking)
  purchase_date TIMESTAMPTZ,           -- When they completed purchase (from Stripe)

  -- Purchase & Revenue
  purchase_amount DECIMAL(10, 2) DEFAULT 0,  -- Total lifetime purchase amount

  -- Feedback (sent ~3 months after purchase)
  feedback_sent_date TIMESTAMPTZ,      -- When we sent feedback request link
  feedback_received_date TIMESTAMPTZ,  -- When they submitted feedback
  feedback_text TEXT,                  -- Their actual feedback response

  -- AI & Context (from ManyChat AI conversations)
  lead_summary TEXT,                   -- AI-generated summary from chatbot memory
  thread_ID TEXT,                      -- OpenAI Assistant API conversation thread ID

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ====================
-- STEP 3: Create indexes for fast queries
-- ====================

-- External ID lookups (most common queries)
CREATE INDEX idx_contacts_mc_id ON contacts(MC_ID) WHERE MC_ID IS NOT NULL;
CREATE INDEX idx_contacts_ghl_id ON contacts(GHL_ID) WHERE GHL_ID IS NOT NULL;
CREATE INDEX idx_contacts_stripe_customer_id ON contacts(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
CREATE INDEX idx_contacts_ig_id ON contacts(ig_id) WHERE ig_id IS NOT NULL;

-- Email lookups (for matching across platforms)
CREATE INDEX idx_contacts_email_primary ON contacts(email_primary) WHERE email_primary IS NOT NULL;
CREATE INDEX idx_contacts_email_booking ON contacts(email_booking) WHERE email_booking IS NOT NULL;
CREATE INDEX idx_contacts_email_payment ON contacts(email_payment) WHERE email_payment IS NOT NULL;

-- Phone lookup (optional)
CREATE INDEX idx_contacts_phone ON contacts(phone) WHERE phone IS NOT NULL;

-- Performance tracking
CREATE INDEX idx_contacts_ad_id ON contacts(AD_ID) WHERE AD_ID IS NOT NULL;
CREATE INDEX idx_contacts_stage ON contacts(stage);
CREATE INDEX idx_contacts_chatbot_ab ON contacts(chatbot_AB);

-- Date-based queries (for reporting and funnel analysis)
CREATE INDEX idx_contacts_subscribe_date ON contacts(subscribe_date) WHERE subscribe_date IS NOT NULL;
CREATE INDEX idx_contacts_subscribed ON contacts(subscribed) WHERE subscribed IS NOT NULL;
CREATE INDEX idx_contacts_dm_qualified_date ON contacts(DM_qualified_date) WHERE DM_qualified_date IS NOT NULL;
CREATE INDEX idx_contacts_meeting_book_date ON contacts(meeting_book_date) WHERE meeting_book_date IS NOT NULL;
CREATE INDEX idx_contacts_meeting_held_date ON contacts(meeting_held_date) WHERE meeting_held_date IS NOT NULL;
CREATE INDEX idx_contacts_purchase_date ON contacts(purchase_date) WHERE purchase_date IS NOT NULL;
CREATE INDEX idx_contacts_feedback_sent_date ON contacts(feedback_sent_date) WHERE feedback_sent_date IS NOT NULL;
CREATE INDEX idx_contacts_ig_last_interaction ON contacts(ig_last_interaction) WHERE ig_last_interaction IS NOT NULL;

-- ====================
-- STEP 4: Helper functions for smart matching
-- ====================

-- Find contact by any email field (case-insensitive)
CREATE OR REPLACE FUNCTION find_contact_by_email(search_email TEXT)
RETURNS UUID AS $$
  SELECT id FROM contacts
  WHERE email_primary ILIKE search_email
     OR email_booking ILIKE search_email
     OR email_payment ILIKE search_email
  LIMIT 1;
$$ LANGUAGE sql;

-- Find contact by MC_ID
CREATE OR REPLACE FUNCTION find_contact_by_mc_id(search_mc_id TEXT)
RETURNS UUID AS $$
  SELECT id FROM contacts
  WHERE MC_ID = search_mc_id
  LIMIT 1;
$$ LANGUAGE sql;

-- Find contact by GHL_ID
CREATE OR REPLACE FUNCTION find_contact_by_ghl_id(search_ghl_id TEXT)
RETURNS UUID AS $$
  SELECT id FROM contacts
  WHERE GHL_ID = search_ghl_id
  LIMIT 1;
$$ LANGUAGE sql;

-- Find contact by phone (normalized comparison)
CREATE OR REPLACE FUNCTION find_contact_by_phone(search_phone TEXT)
RETURNS UUID AS $$
  -- Remove all non-digits for comparison
  SELECT id FROM contacts
  WHERE REGEXP_REPLACE(phone, '[^0-9]', '', 'g') = REGEXP_REPLACE(search_phone, '[^0-9]', '', 'g')
  LIMIT 1;
$$ LANGUAGE sql;

-- Smart contact finder: tries multiple methods in priority order
-- Priority: GHL_ID > MC_ID > Email > Phone
CREATE OR REPLACE FUNCTION find_contact_smart(
  search_ghl_id TEXT DEFAULT NULL,
  search_mc_id TEXT DEFAULT NULL,
  search_email TEXT DEFAULT NULL,
  search_phone TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  result UUID;
BEGIN
  -- Try GHL_ID first (most reliable)
  IF search_ghl_id IS NOT NULL THEN
    SELECT id INTO result FROM contacts WHERE GHL_ID = search_ghl_id LIMIT 1;
    IF result IS NOT NULL THEN RETURN result; END IF;
  END IF;

  -- Try MC_ID
  IF search_mc_id IS NOT NULL THEN
    SELECT id INTO result FROM contacts WHERE MC_ID = search_mc_id LIMIT 1;
    IF result IS NOT NULL THEN RETURN result; END IF;
  END IF;

  -- Try email (all fields)
  IF search_email IS NOT NULL THEN
    SELECT id INTO result FROM contacts
    WHERE email_primary ILIKE search_email
       OR email_booking ILIKE search_email
       OR email_payment ILIKE search_email
    LIMIT 1;
    IF result IS NOT NULL THEN RETURN result; END IF;
  END IF;

  -- Try phone (normalized)
  IF search_phone IS NOT NULL THEN
    SELECT id INTO result FROM contacts
    WHERE REGEXP_REPLACE(phone, '[^0-9]', '', 'g') = REGEXP_REPLACE(search_phone, '[^0-9]', '', 'g')
    LIMIT 1;
    IF result IS NOT NULL THEN RETURN result; END IF;
  END IF;

  -- Not found
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- ====================
-- STEP 5: Auto-update trigger for updated_at
-- ====================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_contacts_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ====================
-- SUCCESS! Fresh contacts table with all columns created.
-- ====================
