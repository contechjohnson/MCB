-- Migration: Create meta_capi_events table for Meta Conversions API event queue
-- Created: 2024-12-07
-- Purpose: Queue and track Meta CAPI events for conversion attribution

BEGIN;

-- ============================================================
-- TABLE: meta_capi_events
-- Queue for Meta Conversions API events with delivery tracking
-- ============================================================

CREATE TABLE IF NOT EXISTS meta_capi_events (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Tenant isolation
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Contact linkage
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,

  -- Event identity
  event_name TEXT NOT NULL,               -- 'Lead', 'AddToCart', 'InitiateCheckout', 'Purchase'
  event_time TIMESTAMP WITH TIME ZONE NOT NULL,
  event_id TEXT NOT NULL,                 -- Deduplication ID (UUID generated at creation)
  event_source_url TEXT,                  -- URL where event occurred (optional)
  action_source TEXT DEFAULT 'system_generated', -- 'website', 'app', 'system_generated', etc.

  -- Attribution data
  ad_id TEXT,                             -- Meta ad ID from contact.ad_id
  adset_id TEXT,                          -- Meta adset ID if available
  campaign_id TEXT,                       -- Meta campaign ID if available
  pixel_id TEXT,                          -- Meta pixel ID (from tenant config)

  -- User data (hashed for CAPI - store hashed versions)
  user_email_hash TEXT,                   -- SHA256 lowercase email
  user_phone_hash TEXT,                   -- SHA256 phone with country code
  user_first_name_hash TEXT,              -- SHA256 lowercase first name
  user_last_name_hash TEXT,               -- SHA256 lowercase last name
  user_fbp TEXT,                          -- _fbp cookie value (browser ID)
  user_fbc TEXT,                          -- _fbc cookie value (click ID)
  user_external_id TEXT,                  -- Our contact ID or mc_id as external ID
  user_client_ip_address TEXT,            -- IP address if available
  user_client_user_agent TEXT,            -- User agent if available

  -- Event-specific data
  event_value NUMERIC(10, 2),             -- Value (for Purchase events)
  currency TEXT DEFAULT 'USD',
  content_type TEXT,                      -- 'product', 'service', etc.
  content_ids TEXT[],                     -- Array of content/product IDs
  content_name TEXT,                      -- Name of content/service

  -- Custom data (flexible JSONB for any additional parameters)
  custom_data JSONB DEFAULT '{}'::jsonb,

  -- Transmission tracking
  sent_to_meta BOOLEAN DEFAULT FALSE,
  send_attempts INTEGER DEFAULT 0,
  last_send_attempt_at TIMESTAMP WITH TIME ZONE,
  sent_at TIMESTAMP WITH TIME ZONE,       -- Successful send time

  -- Response tracking
  meta_response JSONB,                    -- Full response from Meta API
  meta_events_received INTEGER,           -- events_received from response
  meta_fbtrace_id TEXT,                   -- fbtrace_id for debugging
  send_error TEXT,                        -- Error message if failed

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- CONSTRAINTS
-- ============================================================

-- Unique event_id per tenant (deduplication)
ALTER TABLE meta_capi_events
ADD CONSTRAINT unique_tenant_event_id UNIQUE (tenant_id, event_id);

-- Valid event names
ALTER TABLE meta_capi_events
ADD CONSTRAINT valid_event_name
CHECK (event_name IN ('Lead', 'AddToCart', 'InitiateCheckout', 'Purchase', 'CompleteRegistration', 'Contact', 'Schedule'));

-- Valid action source
ALTER TABLE meta_capi_events
ADD CONSTRAINT valid_action_source
CHECK (action_source IN ('website', 'app', 'phone_call', 'chat', 'email', 'physical_store', 'system_generated', 'other'));

-- ============================================================
-- INDEXES
-- ============================================================

-- Find unsent events (for retry job)
CREATE INDEX IF NOT EXISTS idx_capi_events_unsent
ON meta_capi_events (tenant_id, created_at)
WHERE sent_to_meta = FALSE AND send_attempts < 5;

-- Find events by contact
CREATE INDEX IF NOT EXISTS idx_capi_events_contact
ON meta_capi_events (contact_id)
WHERE contact_id IS NOT NULL;

-- Analytics by event type
CREATE INDEX IF NOT EXISTS idx_capi_events_type
ON meta_capi_events (tenant_id, event_name, event_time DESC);

-- Track failed sends
CREATE INDEX IF NOT EXISTS idx_capi_events_failed
ON meta_capi_events (tenant_id, last_send_attempt_at)
WHERE sent_to_meta = FALSE AND send_error IS NOT NULL;

-- Lookup by ad attribution
CREATE INDEX IF NOT EXISTS idx_capi_events_ad
ON meta_capi_events (ad_id)
WHERE ad_id IS NOT NULL;

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON TABLE meta_capi_events IS 'Queue for Meta Conversions API events - tracks send status and responses';
COMMENT ON COLUMN meta_capi_events.event_id IS 'Unique dedup ID sent to Meta (UUID generated at creation)';
COMMENT ON COLUMN meta_capi_events.user_email_hash IS 'SHA256 hash of lowercase email for CAPI';
COMMENT ON COLUMN meta_capi_events.user_fbp IS '_fbp cookie value - Facebook browser ID for attribution';
COMMENT ON COLUMN meta_capi_events.user_fbc IS '_fbc cookie value - Facebook click ID from ad click';
COMMENT ON COLUMN meta_capi_events.meta_fbtrace_id IS 'Facebook trace ID for debugging with Meta support';

-- ============================================================
-- TRIGGER: Auto-update updated_at
-- ============================================================

CREATE TRIGGER update_meta_capi_events_updated_at
BEFORE UPDATE ON meta_capi_events
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- TRIGGER: Auto-generate event_id if not provided
-- ============================================================

CREATE OR REPLACE FUNCTION generate_capi_event_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.event_id IS NULL OR NEW.event_id = '' THEN
    NEW.event_id = gen_random_uuid()::text;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_generate_capi_event_id
BEFORE INSERT ON meta_capi_events
FOR EACH ROW
EXECUTE FUNCTION generate_capi_event_id();

COMMIT;
