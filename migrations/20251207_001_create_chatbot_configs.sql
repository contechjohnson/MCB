-- Migration: Create chatbot_configs table for A/B test variants and prompt storage
-- Created: 2024-12-07
-- Purpose: Store chatbot configurations per tenant with A/B test routing

BEGIN;

-- ============================================================
-- TABLE: chatbot_configs
-- Stores chatbot variants with system prompts and ManyChat flow IDs
-- ============================================================

CREATE TABLE IF NOT EXISTS chatbot_configs (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Tenant isolation
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Config identity
  config_name TEXT NOT NULL,              -- 'default', 'variant_a', 'variant_b'
  is_default BOOLEAN DEFAULT FALSE,       -- One config per tenant should be default
  is_active BOOLEAN DEFAULT TRUE,         -- Can disable without deleting

  -- Prompt configuration (stored here, NOT in OpenAI)
  system_prompt TEXT NOT NULL,            -- The full system prompt for the chatbot
  model TEXT DEFAULT 'gpt-4o',            -- OpenAI model to use
  temperature NUMERIC(3,2) DEFAULT 0.70,  -- Model temperature (0.00-2.00)
  max_tokens INTEGER DEFAULT 1000,        -- Max response tokens

  -- Response format configuration
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

  -- ManyChat flow IDs
  welcome_flow_id TEXT,                   -- ManyChat flow for new conversations
  response_flow_id TEXT NOT NULL,         -- ManyChat flow to send AI response

  -- A/B test routing
  ab_test_field TEXT DEFAULT 'chatbot_AB', -- ManyChat custom field name for A/B
  ab_test_value TEXT,                      -- Value that routes to this config ('A' or 'B')

  -- Metrics (updated by chatbot endpoint)
  total_messages INTEGER DEFAULT 0,
  total_qualifications INTEGER DEFAULT 0,
  total_bookings INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- CONSTRAINTS
-- ============================================================

-- Unique config name per tenant
ALTER TABLE chatbot_configs
ADD CONSTRAINT unique_tenant_config_name UNIQUE (tenant_id, config_name);

-- Unique A/B test value per tenant (can't have two configs with same routing value)
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_ab_routing
ON chatbot_configs (tenant_id, ab_test_field, ab_test_value)
WHERE ab_test_value IS NOT NULL AND is_active = TRUE;

-- Only one default per tenant
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_default_per_tenant
ON chatbot_configs (tenant_id)
WHERE is_default = TRUE AND is_active = TRUE;

-- ============================================================
-- INDEXES
-- ============================================================

-- Fast lookup by tenant
CREATE INDEX IF NOT EXISTS idx_chatbot_configs_tenant
ON chatbot_configs (tenant_id);

-- A/B routing lookup
CREATE INDEX IF NOT EXISTS idx_chatbot_configs_ab_lookup
ON chatbot_configs (tenant_id, ab_test_field, ab_test_value)
WHERE is_active = TRUE;

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON TABLE chatbot_configs IS 'Stores chatbot configurations per tenant, including prompts and A/B test variants';
COMMENT ON COLUMN chatbot_configs.config_name IS 'Human-readable name for this config (e.g., variant_a, variant_b)';
COMMENT ON COLUMN chatbot_configs.system_prompt IS 'Full system prompt for the chatbot - stored here, not in OpenAI';
COMMENT ON COLUMN chatbot_configs.response_schema IS 'Expected JSON structure for AI responses (for validation)';
COMMENT ON COLUMN chatbot_configs.ab_test_field IS 'ManyChat custom field name used for A/B test assignment';
COMMENT ON COLUMN chatbot_configs.ab_test_value IS 'Value in ab_test_field that routes to this config';
COMMENT ON COLUMN chatbot_configs.welcome_flow_id IS 'ManyChat flow ID to trigger for new conversations';
COMMENT ON COLUMN chatbot_configs.response_flow_id IS 'ManyChat flow ID to trigger for sending AI response';

-- ============================================================
-- TRIGGER: Auto-update updated_at
-- ============================================================

CREATE TRIGGER update_chatbot_configs_updated_at
BEFORE UPDATE ON chatbot_configs
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

COMMIT;
