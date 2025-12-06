-- Migration: Create tenant_integrations table
-- Purpose: Store per-tenant API credentials and webhook secrets
-- Date: December 5, 2025

-- Create tenant_integrations table
CREATE TABLE IF NOT EXISTS tenant_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,               -- 'manychat', 'ghl', 'stripe', 'meta', 'openai', 'denefits'
  credentials JSONB NOT NULL DEFAULT '{}',  -- API keys, tokens (encrypt in production)
  webhook_secret TEXT,                  -- For verifying webhook signatures
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, provider)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_tenant_integrations_tenant ON tenant_integrations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_integrations_provider ON tenant_integrations(provider);
CREATE INDEX IF NOT EXISTS idx_tenant_integrations_active ON tenant_integrations(tenant_id, is_active);

-- Add comment
COMMENT ON TABLE tenant_integrations IS 'Per-tenant API credentials and webhook configuration';
COMMENT ON COLUMN tenant_integrations.credentials IS 'JSONB containing API keys. Keys vary by provider.';

-- Example structure for each provider (for documentation):
-- manychat: { "bot_id": "123", "api_key": "xxx:yyy", "verify_token": "..." }
-- stripe: { "secret_key": "sk_live_...", "webhook_secret": "whsec_..." }
-- ghl: { "api_key": "...", "location_id": "..." }
-- meta: { "access_token": "...", "ad_account_id": "act_..." }
-- openai: { "api_key": "sk-...", "assistant_id": "asst_..." }
-- denefits: { "api_key": "..." }
