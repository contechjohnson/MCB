-- MCB Database Schema v2.0
-- Clean, purpose-built schema focused on tracking funnel progression through timestamps
-- Created: Nov 2, 2025

-- ====================
-- STEP 1: Archive old tables
-- ====================

-- Rename existing tables to _archive (keeps data safe, queryable for historical insights)
ALTER TABLE IF EXISTS contacts RENAME TO contacts_archive_20251102;
ALTER TABLE IF EXISTS stripe_webhook_logs RENAME TO stripe_webhook_logs_archive_20251102;
ALTER TABLE IF EXISTS webhook_logs RENAME TO webhook_logs_archive_20251102;

-- Create indexes on archived tables for fast queries
CREATE INDEX IF NOT EXISTS idx_archive_contacts_email ON contacts_archive_20251102(email_address);
CREATE INDEX IF NOT EXISTS idx_archive_contacts_stage ON contacts_archive_20251102(stage);
CREATE INDEX IF NOT EXISTS idx_archive_contacts_userid ON contacts_archive_20251102(user_id);

-- ====================
-- STEP 2: Create new contacts table
-- ====================

CREATE TABLE contacts (
  -- Primary Identifiers
  phone TEXT PRIMARY KEY,              -- Phone number (most stable unique identifier)
  MC_ID TEXT UNIQUE,                   -- Manychat ID (main identifier for funnel tracking)
  GHL_ID TEXT,                         -- Go High Level ID (added when pushed to GHL)
  AD_ID TEXT,                          -- Facebook/Meta Ad ID (for ROAS tracking)

  -- Contact Information
  first_name TEXT,
  last_name TEXT,
  email_primary TEXT,                  -- Primary email (first one we see, usually from ManyChat)
  email_booking TEXT,                  -- Email used when booking (may differ from primary)
  email_payment TEXT,                  -- Email used in Stripe checkout (may differ from both)
  IG TEXT,                             -- Instagram username
  FB TEXT,                             -- Facebook name (rarely used)

  -- Funnel Stage & Testing
  stage TEXT,                          -- Current stage in funnel (auto-updated by webhooks)
  chatbot_AB TEXT,                     -- Which chatbot variant (A or B)
  MISC_AB TEXT,                        -- Other AB tests
  trigger_word TEXT,                   -- Word that triggered the conversation (can be comma-separated)

  -- Qualification Questions
  Q1_question TEXT,                    -- Answer to first qualification question
  Q2_question TEXT,                    -- Answer to second qualification question
  objections TEXT,                     -- Recorded objections for data mining

  -- Timestamps (all include time, not just date)
  subscribe_date TIMESTAMPTZ,          -- When they first opted in to Manychat
  followed_date TIMESTAMPTZ,           -- When they became an IG/FB follower (may be before subscribe)
  DM_qualified_date TIMESTAMPTZ,       -- When they answered both qualification questions
  link_send_date TIMESTAMPTZ,          -- When chatbot sent the booking link
  link_click_date TIMESTAMPTZ,         -- When lead clicked the link
  form_submit_date TIMESTAMPTZ,        -- When they submitted the form on funnel page
  meeting_book_date TIMESTAMPTZ,       -- When they booked the meeting
  meeting_held_date TIMESTAMPTZ,       -- When they actually attended the meeting
  purchase_date TIMESTAMPTZ,           -- When they made a purchase (from Stripe)

  -- Purchase & Revenue
  purchase_amount DECIMAL(10, 2) DEFAULT 0,  -- Total lifetime purchase amount (cumulative)
  stripe_customer_id TEXT,             -- Stripe customer ID for future lookups

  -- Feedback (sent ~3 months after purchase)
  feedback_sent_date TIMESTAMPTZ,      -- When we sent them the feedback request link
  feedback_received_date TIMESTAMPTZ,  -- When they submitted feedback
  feedback_text TEXT,                  -- Their actual feedback response

  -- AI & Context
  lead_summary TEXT,                   -- AI-generated summary from chatbot memory
  thread_ID TEXT,                      -- OpenAI Assistant API conversation ID

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ====================
-- STEP 3: Create indexes for fast queries
-- ====================

-- Primary lookups
CREATE INDEX idx_contacts_email_primary ON contacts(email_primary);
CREATE INDEX idx_contacts_email_booking ON contacts(email_booking);
CREATE INDEX idx_contacts_email_payment ON contacts(email_payment);
CREATE INDEX idx_contacts_mc_id ON contacts(MC_ID);
CREATE INDEX idx_contacts_ghl_id ON contacts(GHL_ID);

-- Performance tracking
CREATE INDEX idx_contacts_ad_id ON contacts(AD_ID);
CREATE INDEX idx_contacts_stage ON contacts(stage);
CREATE INDEX idx_contacts_chatbot_ab ON contacts(chatbot_AB);

-- Date-based queries (for reporting)
CREATE INDEX idx_contacts_subscribe_date ON contacts(subscribe_date);
CREATE INDEX idx_contacts_purchase_date ON contacts(purchase_date);
CREATE INDEX idx_contacts_meeting_book_date ON contacts(meeting_book_date);
CREATE INDEX idx_contacts_meeting_held_date ON contacts(meeting_held_date);
CREATE INDEX idx_contacts_feedback_sent_date ON contacts(feedback_sent_date);

-- ====================
-- STEP 4: Create webhook logs table
-- ====================

CREATE TABLE webhook_logs (
  id BIGSERIAL PRIMARY KEY,
  source TEXT NOT NULL,                -- 'manychat', 'ghl', 'stripe', 'make'
  event_type TEXT,                     -- Type of event
  phone TEXT,                          -- Associated contact phone (if applicable)
  MC_ID TEXT,                          -- Associated ManyChat ID (if applicable)
  payload JSONB NOT NULL,              -- Full webhook payload
  status TEXT DEFAULT 'received',      -- 'received', 'processed', 'error'
  error_message TEXT,                  -- If status = 'error'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_webhook_logs_source ON webhook_logs(source);
CREATE INDEX idx_webhook_logs_phone ON webhook_logs(phone);
CREATE INDEX idx_webhook_logs_mc_id ON webhook_logs(MC_ID);
CREATE INDEX idx_webhook_logs_created_at ON webhook_logs(created_at);

-- ====================
-- STEP 5: Create stripe events table (simplified)
-- ====================

CREATE TABLE stripe_events (
  id BIGSERIAL PRIMARY KEY,
  event_id TEXT UNIQUE NOT NULL,       -- Stripe event ID (prevents duplicates)
  event_type TEXT NOT NULL,            -- 'checkout.session.completed', 'charge.refunded', etc.
  customer_email TEXT,                 -- Email from Stripe
  phone TEXT,                          -- Matched contact phone (if found)
  MC_ID TEXT,                          -- Matched ManyChat ID (if found)
  amount DECIMAL(10, 2),               -- Amount in dollars
  status TEXT,                         -- 'paid', 'refunded', 'failed'
  raw_event JSONB,                     -- Full Stripe event for debugging
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_stripe_events_email ON stripe_events(customer_email);
CREATE INDEX idx_stripe_events_phone ON stripe_events(phone);
CREATE INDEX idx_stripe_events_mc_id ON stripe_events(MC_ID);
CREATE INDEX idx_stripe_events_event_type ON stripe_events(event_type);

-- ====================
-- STEP 6: Helper function to find contacts by any email
-- ====================

-- This function checks ALL email fields when trying to match a contact
CREATE OR REPLACE FUNCTION find_contact_by_email(search_email TEXT)
RETURNS TEXT AS $$
  SELECT phone FROM contacts
  WHERE email_primary ILIKE search_email
     OR email_booking ILIKE search_email
     OR email_payment ILIKE search_email
  LIMIT 1;
$$ LANGUAGE sql;

-- ====================
-- STEP 7: Create auto-update trigger for updated_at
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
-- SUCCESS!
-- ====================

-- Check that tables were created
SELECT
  'contacts' as table_name,
  COUNT(*) as row_count
FROM contacts
UNION ALL
SELECT
  'webhook_logs',
  COUNT(*)
FROM webhook_logs
UNION ALL
SELECT
  'stripe_events',
  COUNT(*)
FROM stripe_events;

-- Done! Your clean v2.0 schema is ready.
