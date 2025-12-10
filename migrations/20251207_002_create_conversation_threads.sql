-- Migration: Create conversation_threads table for OpenAI thread persistence
-- Created: 2024-12-07
-- Purpose: Store OpenAI conversation threads and extracted context per contact

BEGIN;

-- ============================================================
-- TABLE: conversation_threads
-- Tracks OpenAI conversation threads and extracted information
-- ============================================================

CREATE TABLE IF NOT EXISTS conversation_threads (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Tenant isolation
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Contact linkage
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  mc_id TEXT NOT NULL,                    -- ManyChat subscriber ID (always present)

  -- OpenAI thread tracking
  openai_thread_id TEXT,                  -- OpenAI thread ID (null if using chat completions w/o threads)
  chatbot_config_id UUID REFERENCES chatbot_configs(id) ON DELETE SET NULL,

  -- Thread state
  status TEXT DEFAULT 'active',           -- 'active', 'closed', 'escalated', 'paused'
  message_count INTEGER DEFAULT 0,        -- Total messages in thread

  -- Last interaction (for quick access without querying messages)
  last_user_message TEXT,
  last_bot_response TEXT,
  last_interaction_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Extracted context from AI responses (accumulated over conversation)
  extracted_symptoms TEXT[],              -- Array of mentioned symptoms
  extracted_months_postpartum TEXT,       -- e.g., "3 months", "NA"
  extracted_email TEXT,
  extracted_objections TEXT[],            -- Array of handled objections

  -- Intent flags (last known state)
  booking_intent BOOLEAN DEFAULT FALSE,
  link_sent BOOLEAN DEFAULT FALSE,
  pdf_sent BOOLEAN DEFAULT FALSE,
  lead_magnet_sent BOOLEAN DEFAULT FALSE,
  already_booked BOOLEAN DEFAULT FALSE,

  -- Conversation history (for context window management)
  -- Store last N messages as JSONB array for passing to AI
  recent_messages JSONB DEFAULT '[]'::jsonb,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- CONSTRAINTS
-- ============================================================

-- One thread per ManyChat subscriber per tenant
ALTER TABLE conversation_threads
ADD CONSTRAINT unique_tenant_mc_id UNIQUE (tenant_id, mc_id);

-- Valid status values
ALTER TABLE conversation_threads
ADD CONSTRAINT valid_thread_status
CHECK (status IN ('active', 'closed', 'escalated', 'paused'));

-- ============================================================
-- INDEXES
-- ============================================================

-- Primary lookup by tenant + mc_id
CREATE INDEX IF NOT EXISTS idx_conversation_threads_lookup
ON conversation_threads (tenant_id, mc_id);

-- Find threads by contact
CREATE INDEX IF NOT EXISTS idx_conversation_threads_contact
ON conversation_threads (contact_id)
WHERE contact_id IS NOT NULL;

-- Find active threads
CREATE INDEX IF NOT EXISTS idx_conversation_threads_active
ON conversation_threads (tenant_id, status, last_interaction_at DESC)
WHERE status = 'active';

-- Find threads needing follow-up (no interaction in X time)
CREATE INDEX IF NOT EXISTS idx_conversation_threads_stale
ON conversation_threads (tenant_id, last_interaction_at)
WHERE status = 'active';

-- Find threads by config (for A/B analysis)
CREATE INDEX IF NOT EXISTS idx_conversation_threads_config
ON conversation_threads (chatbot_config_id)
WHERE chatbot_config_id IS NOT NULL;

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON TABLE conversation_threads IS 'Tracks OpenAI conversation threads per ManyChat subscriber';
COMMENT ON COLUMN conversation_threads.mc_id IS 'ManyChat subscriber ID - unique per tenant';
COMMENT ON COLUMN conversation_threads.openai_thread_id IS 'OpenAI thread ID for Assistants API (null if using Chat Completions)';
COMMENT ON COLUMN conversation_threads.recent_messages IS 'JSONB array of recent messages for context window';
COMMENT ON COLUMN conversation_threads.extracted_symptoms IS 'Array of symptoms mentioned during conversation';
COMMENT ON COLUMN conversation_threads.booking_intent IS 'Whether contact has expressed booking intent';

-- ============================================================
-- TRIGGER: Auto-update updated_at
-- ============================================================

CREATE TRIGGER update_conversation_threads_updated_at
BEFORE UPDATE ON conversation_threads
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- TRIGGER: Link contact when found
-- ============================================================

-- Function to auto-link contact_id when a contact with matching mc_id exists
CREATE OR REPLACE FUNCTION link_conversation_to_contact()
RETURNS TRIGGER AS $$
BEGIN
  -- Only try to link if contact_id is null
  IF NEW.contact_id IS NULL THEN
    SELECT id INTO NEW.contact_id
    FROM contacts
    WHERE tenant_id = NEW.tenant_id AND mc_id = NEW.mc_id
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_link_conversation_contact
BEFORE INSERT OR UPDATE ON conversation_threads
FOR EACH ROW
EXECUTE FUNCTION link_conversation_to_contact();

COMMIT;
