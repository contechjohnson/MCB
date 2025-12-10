-- ============================================================
-- COMBINED MIGRATION: Chatbot & Meta CAPI Infrastructure
-- Created: 2024-12-07
-- Purpose: Run all 4 migrations in one go via Supabase SQL Editor
-- ============================================================
--
-- INSTRUCTIONS:
-- 1. Go to Supabase Dashboard → SQL Editor
-- 2. Paste this entire file
-- 3. Click "Run"
--
-- This creates:
-- - chatbot_configs: A/B test variants with system prompts
-- - conversation_threads: OpenAI thread tracking per subscriber
-- - meta_capi_events: Queue for Meta Conversions API events
-- - FB tracking columns on contacts table (fbclid, fbp, fbc)
-- ============================================================

-- ############################################################
-- MIGRATION 1: chatbot_configs
-- ############################################################

CREATE TABLE IF NOT EXISTS chatbot_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  config_name TEXT NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  system_prompt TEXT NOT NULL,
  model TEXT DEFAULT 'gpt-4o',
  temperature NUMERIC(3,2) DEFAULT 0.70,
  max_tokens INTEGER DEFAULT 1000,
  response_schema JSONB DEFAULT '{
    "response": "string",
    "symptoms": "string",
    "months_postpartum": "string",
    "handled_objections": "string",
    "intending_to_send_link": "boolean",
    "intend_to_send_pdf": "boolean",
    "intend_to_send_lead_magnet": "boolean",
    "already_booked": "boolean",
    "email": "string"
  }'::jsonb,
  welcome_flow_id TEXT,
  response_flow_id TEXT NOT NULL,
  ab_test_field TEXT DEFAULT 'chatbot_AB',
  ab_test_value TEXT,
  total_messages INTEGER DEFAULT 0,
  total_qualifications INTEGER DEFAULT 0,
  total_bookings INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Constraints
ALTER TABLE chatbot_configs
ADD CONSTRAINT IF NOT EXISTS unique_tenant_config_name UNIQUE (tenant_id, config_name);

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_ab_routing
ON chatbot_configs (tenant_id, ab_test_field, ab_test_value)
WHERE ab_test_value IS NOT NULL AND is_active = TRUE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_one_default_per_tenant
ON chatbot_configs (tenant_id)
WHERE is_default = TRUE AND is_active = TRUE;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_chatbot_configs_tenant
ON chatbot_configs (tenant_id);

CREATE INDEX IF NOT EXISTS idx_chatbot_configs_ab_lookup
ON chatbot_configs (tenant_id, ab_test_field, ab_test_value)
WHERE is_active = TRUE;

-- Comments
COMMENT ON TABLE chatbot_configs IS 'Stores chatbot configurations per tenant, including prompts and A/B test variants';
COMMENT ON COLUMN chatbot_configs.config_name IS 'Human-readable name for this config (e.g., variant_a, variant_b)';
COMMENT ON COLUMN chatbot_configs.system_prompt IS 'Full system prompt for the chatbot - stored here, not in OpenAI';
COMMENT ON COLUMN chatbot_configs.response_schema IS 'Expected JSON structure for AI responses (for validation)';
COMMENT ON COLUMN chatbot_configs.ab_test_field IS 'ManyChat custom field name used for A/B test assignment';
COMMENT ON COLUMN chatbot_configs.ab_test_value IS 'Value in ab_test_field that routes to this config';
COMMENT ON COLUMN chatbot_configs.welcome_flow_id IS 'ManyChat flow ID to trigger for new conversations';
COMMENT ON COLUMN chatbot_configs.response_flow_id IS 'ManyChat flow ID to trigger for sending AI response';

-- Trigger (only create if not exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_chatbot_configs_updated_at') THEN
    CREATE TRIGGER update_chatbot_configs_updated_at
    BEFORE UPDATE ON chatbot_configs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;


-- ############################################################
-- MIGRATION 2: conversation_threads
-- ############################################################

CREATE TABLE IF NOT EXISTS conversation_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  mc_id TEXT NOT NULL,
  openai_thread_id TEXT,
  chatbot_config_id UUID REFERENCES chatbot_configs(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'active',
  message_count INTEGER DEFAULT 0,
  last_user_message TEXT,
  last_bot_response TEXT,
  last_interaction_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  extracted_symptoms TEXT[],
  extracted_months_postpartum TEXT,
  extracted_email TEXT,
  extracted_objections TEXT[],
  booking_intent BOOLEAN DEFAULT FALSE,
  link_sent BOOLEAN DEFAULT FALSE,
  pdf_sent BOOLEAN DEFAULT FALSE,
  lead_magnet_sent BOOLEAN DEFAULT FALSE,
  already_booked BOOLEAN DEFAULT FALSE,
  recent_messages JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Constraints
ALTER TABLE conversation_threads
ADD CONSTRAINT IF NOT EXISTS unique_tenant_mc_id UNIQUE (tenant_id, mc_id);

ALTER TABLE conversation_threads
ADD CONSTRAINT IF NOT EXISTS valid_thread_status
CHECK (status IN ('active', 'closed', 'escalated', 'paused'));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_conversation_threads_lookup
ON conversation_threads (tenant_id, mc_id);

CREATE INDEX IF NOT EXISTS idx_conversation_threads_contact
ON conversation_threads (contact_id)
WHERE contact_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_conversation_threads_active
ON conversation_threads (tenant_id, status, last_interaction_at DESC)
WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_conversation_threads_stale
ON conversation_threads (tenant_id, last_interaction_at)
WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_conversation_threads_config
ON conversation_threads (chatbot_config_id)
WHERE chatbot_config_id IS NOT NULL;

-- Comments
COMMENT ON TABLE conversation_threads IS 'Tracks OpenAI conversation threads per ManyChat subscriber';
COMMENT ON COLUMN conversation_threads.mc_id IS 'ManyChat subscriber ID - unique per tenant';
COMMENT ON COLUMN conversation_threads.openai_thread_id IS 'OpenAI thread ID for Assistants API (null if using Chat Completions)';
COMMENT ON COLUMN conversation_threads.recent_messages IS 'JSONB array of recent messages for context window';
COMMENT ON COLUMN conversation_threads.extracted_symptoms IS 'Array of symptoms mentioned during conversation';
COMMENT ON COLUMN conversation_threads.booking_intent IS 'Whether contact has expressed booking intent';

-- Triggers
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_conversation_threads_updated_at') THEN
    CREATE TRIGGER update_conversation_threads_updated_at
    BEFORE UPDATE ON conversation_threads
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Function to auto-link contact_id
CREATE OR REPLACE FUNCTION link_conversation_to_contact()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.contact_id IS NULL THEN
    SELECT id INTO NEW.contact_id
    FROM contacts
    WHERE tenant_id = NEW.tenant_id AND mc_id = NEW.mc_id
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'auto_link_conversation_contact') THEN
    CREATE TRIGGER auto_link_conversation_contact
    BEFORE INSERT OR UPDATE ON conversation_threads
    FOR EACH ROW
    EXECUTE FUNCTION link_conversation_to_contact();
  END IF;
END $$;


-- ############################################################
-- MIGRATION 3: meta_capi_events
-- ############################################################

CREATE TABLE IF NOT EXISTS meta_capi_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  event_name TEXT NOT NULL,
  event_time TIMESTAMP WITH TIME ZONE NOT NULL,
  event_id TEXT NOT NULL,
  event_source_url TEXT,
  action_source TEXT DEFAULT 'system_generated',
  ad_id TEXT,
  adset_id TEXT,
  campaign_id TEXT,
  pixel_id TEXT,
  user_email_hash TEXT,
  user_phone_hash TEXT,
  user_first_name_hash TEXT,
  user_last_name_hash TEXT,
  user_fbp TEXT,
  user_fbc TEXT,
  user_external_id TEXT,
  user_client_ip_address TEXT,
  user_client_user_agent TEXT,
  event_value NUMERIC(10, 2),
  currency TEXT DEFAULT 'USD',
  content_type TEXT,
  content_ids TEXT[],
  content_name TEXT,
  custom_data JSONB DEFAULT '{}'::jsonb,
  sent_to_meta BOOLEAN DEFAULT FALSE,
  send_attempts INTEGER DEFAULT 0,
  last_send_attempt_at TIMESTAMP WITH TIME ZONE,
  sent_at TIMESTAMP WITH TIME ZONE,
  meta_response JSONB,
  meta_events_received INTEGER,
  meta_fbtrace_id TEXT,
  send_error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Constraints
ALTER TABLE meta_capi_events
ADD CONSTRAINT IF NOT EXISTS unique_tenant_event_id UNIQUE (tenant_id, event_id);

ALTER TABLE meta_capi_events
ADD CONSTRAINT IF NOT EXISTS valid_event_name
CHECK (event_name IN ('Lead', 'AddToCart', 'InitiateCheckout', 'Purchase', 'CompleteRegistration', 'Contact', 'Schedule'));

ALTER TABLE meta_capi_events
ADD CONSTRAINT IF NOT EXISTS valid_action_source
CHECK (action_source IN ('website', 'app', 'phone_call', 'chat', 'email', 'physical_store', 'system_generated', 'other'));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_capi_events_unsent
ON meta_capi_events (tenant_id, created_at)
WHERE sent_to_meta = FALSE AND send_attempts < 5;

CREATE INDEX IF NOT EXISTS idx_capi_events_contact
ON meta_capi_events (contact_id)
WHERE contact_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_capi_events_type
ON meta_capi_events (tenant_id, event_name, event_time DESC);

CREATE INDEX IF NOT EXISTS idx_capi_events_failed
ON meta_capi_events (tenant_id, last_send_attempt_at)
WHERE sent_to_meta = FALSE AND send_error IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_capi_events_ad
ON meta_capi_events (ad_id)
WHERE ad_id IS NOT NULL;

-- Comments
COMMENT ON TABLE meta_capi_events IS 'Queue for Meta Conversions API events - tracks send status and responses';
COMMENT ON COLUMN meta_capi_events.event_id IS 'Unique dedup ID sent to Meta (UUID generated at creation)';
COMMENT ON COLUMN meta_capi_events.user_email_hash IS 'SHA256 hash of lowercase email for CAPI';
COMMENT ON COLUMN meta_capi_events.user_fbp IS '_fbp cookie value - Facebook browser ID for attribution';
COMMENT ON COLUMN meta_capi_events.user_fbc IS '_fbc cookie value - Facebook click ID from ad click';
COMMENT ON COLUMN meta_capi_events.meta_fbtrace_id IS 'Facebook trace ID for debugging with Meta support';

-- Trigger
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_meta_capi_events_updated_at') THEN
    CREATE TRIGGER update_meta_capi_events_updated_at
    BEFORE UPDATE ON meta_capi_events
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Function for auto-generating event_id
CREATE OR REPLACE FUNCTION generate_capi_event_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.event_id IS NULL OR NEW.event_id = '' THEN
    NEW.event_id = gen_random_uuid()::text;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'auto_generate_capi_event_id') THEN
    CREATE TRIGGER auto_generate_capi_event_id
    BEFORE INSERT ON meta_capi_events
    FOR EACH ROW
    EXECUTE FUNCTION generate_capi_event_id();
  END IF;
END $$;


-- ############################################################
-- MIGRATION 4: Add FB tracking columns to contacts
-- ############################################################

ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS fbclid TEXT;

ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS fbp TEXT;

ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS fbc TEXT;

-- Index
CREATE INDEX IF NOT EXISTS idx_contacts_fbclid
ON contacts (fbclid)
WHERE fbclid IS NOT NULL;

-- Comments
COMMENT ON COLUMN contacts.fbclid IS 'Facebook Click ID from ?fbclid= URL parameter when user clicked an ad';
COMMENT ON COLUMN contacts.fbp IS 'Facebook Browser ID from _fbp cookie - persists across sessions';
COMMENT ON COLUMN contacts.fbc IS 'Facebook Click ID Cookie from _fbc cookie - derived from fbclid';


-- ############################################################
-- VERIFICATION
-- ############################################################

DO $$
BEGIN
  RAISE NOTICE '✅ All migrations completed successfully!';
  RAISE NOTICE '';
  RAISE NOTICE 'Created tables:';
  RAISE NOTICE '  - chatbot_configs';
  RAISE NOTICE '  - conversation_threads';
  RAISE NOTICE '  - meta_capi_events';
  RAISE NOTICE '';
  RAISE NOTICE 'Added columns to contacts:';
  RAISE NOTICE '  - fbclid, fbp, fbc';
END $$;
