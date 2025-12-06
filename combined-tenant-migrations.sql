-- 20251205_001_create_tenants.sql
-- Migration: Create tenants table
-- Purpose: Multi-tenant support for MCB funnel tracking
-- Date: December 5, 2025

-- Create tenants table
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,           -- 'ppcu', 'centner', 'columnline'
  name TEXT NOT NULL,                   -- 'Postpartum Care USA'
  owner_name TEXT,                      -- 'Eric' (for report greetings)
  report_email TEXT,                    -- Where to send weekly reports
  is_active BOOLEAN DEFAULT true,
  config JSONB DEFAULT '{}',            -- Flexible config (OpenAI thread_id, etc.)
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create index on slug for lookups
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_active ON tenants(is_active);

-- Insert initial tenants
INSERT INTO tenants (slug, name, owner_name, report_email, config) VALUES
  ('ppcu', 'Postpartum Care USA', 'Eric', 'connor@columnline.com', '{"historical_filter": true}'),
  ('centner', 'Centner Wellness', NULL, NULL, '{}'),
  ('columnline', 'Columnline AI', 'Connor', 'connor@columnline.com', '{}')
ON CONFLICT (slug) DO NOTHING;

-- Add comment
COMMENT ON TABLE tenants IS 'Multi-tenant configuration for MCB funnel tracking';


-- 20251205_002_create_tenant_integrations.sql
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


-- 20251205_003_add_tenant_id_columns.sql
-- Migration: Add tenant_id to all core tables
-- Purpose: Enable multi-tenant data isolation
-- Date: December 5, 2025
-- IMPORTANT: Run 001_create_tenants.sql FIRST

-- Add tenant_id to contacts
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);

-- Add tenant_id to payments
ALTER TABLE payments ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);

-- Add tenant_id to webhook_logs
ALTER TABLE webhook_logs ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);

-- Add tenant_id to meta_ads
ALTER TABLE meta_ads ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);

-- Add tenant_id to meta_ad_creatives
ALTER TABLE meta_ad_creatives ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);

-- Add tenant_id to meta_ad_insights
ALTER TABLE meta_ad_insights ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);

-- Add tenant_id to stripe_webhook_logs (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'stripe_webhook_logs') THEN
    ALTER TABLE stripe_webhook_logs ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
  END IF;
END $$;

-- Add tenant_id to weekly_snapshots (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'weekly_snapshots') THEN
    ALTER TABLE weekly_snapshots ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
  END IF;
END $$;

-- Create indexes on tenant_id for performance
CREATE INDEX IF NOT EXISTS idx_contacts_tenant_id ON contacts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payments_tenant_id ON payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_tenant_id ON webhook_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_meta_ads_tenant_id ON meta_ads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_meta_ad_creatives_tenant_id ON meta_ad_creatives(tenant_id);
CREATE INDEX IF NOT EXISTS idx_meta_ad_insights_tenant_id ON meta_ad_insights(tenant_id);


-- 20251205_004_migrate_ppcu_data.sql
-- Migration: Assign all existing data to PPCU tenant
-- Purpose: Migrate existing single-tenant data to multi-tenant structure
-- Date: December 5, 2025
-- IMPORTANT: Run 001, 002, 003 FIRST

-- Get PPCU tenant ID
DO $$
DECLARE
  ppcu_id UUID;
BEGIN
  SELECT id INTO ppcu_id FROM tenants WHERE slug = 'ppcu';

  IF ppcu_id IS NULL THEN
    RAISE EXCEPTION 'PPCU tenant not found. Run 001_create_tenants.sql first.';
  END IF;

  -- Update all contacts to PPCU
  UPDATE contacts SET tenant_id = ppcu_id WHERE tenant_id IS NULL;
  RAISE NOTICE 'Updated contacts: %', (SELECT COUNT(*) FROM contacts WHERE tenant_id = ppcu_id);

  -- Update all payments to PPCU
  UPDATE payments SET tenant_id = ppcu_id WHERE tenant_id IS NULL;
  RAISE NOTICE 'Updated payments: %', (SELECT COUNT(*) FROM payments WHERE tenant_id = ppcu_id);

  -- Update all webhook_logs to PPCU
  UPDATE webhook_logs SET tenant_id = ppcu_id WHERE tenant_id IS NULL;
  RAISE NOTICE 'Updated webhook_logs: %', (SELECT COUNT(*) FROM webhook_logs WHERE tenant_id = ppcu_id);

  -- Update all meta_ads to PPCU
  UPDATE meta_ads SET tenant_id = ppcu_id WHERE tenant_id IS NULL;
  RAISE NOTICE 'Updated meta_ads: %', (SELECT COUNT(*) FROM meta_ads WHERE tenant_id = ppcu_id);

  -- Update all meta_ad_creatives to PPCU
  UPDATE meta_ad_creatives SET tenant_id = ppcu_id WHERE tenant_id IS NULL;
  RAISE NOTICE 'Updated meta_ad_creatives: %', (SELECT COUNT(*) FROM meta_ad_creatives WHERE tenant_id = ppcu_id);

  -- Update all meta_ad_insights to PPCU
  UPDATE meta_ad_insights SET tenant_id = ppcu_id WHERE tenant_id IS NULL;
  RAISE NOTICE 'Updated meta_ad_insights: %', (SELECT COUNT(*) FROM meta_ad_insights WHERE tenant_id = ppcu_id);

END $$;

-- Verify migration
SELECT
  'contacts' as table_name,
  COUNT(*) as total,
  COUNT(tenant_id) as with_tenant,
  COUNT(*) - COUNT(tenant_id) as without_tenant
FROM contacts
UNION ALL
SELECT
  'payments',
  COUNT(*),
  COUNT(tenant_id),
  COUNT(*) - COUNT(tenant_id)
FROM payments
UNION ALL
SELECT
  'meta_ads',
  COUNT(*),
  COUNT(tenant_id),
  COUNT(*) - COUNT(tenant_id)
FROM meta_ads;


-- 20251205_005_update_constraints.sql
-- Migration: Update unique constraints for multi-tenant
-- Purpose: Allow same mc_id/ghl_id across different tenants
-- Date: December 5, 2025
-- IMPORTANT: Run 001-004 FIRST. Then make tenant_id NOT NULL.

-- Step 1: Make tenant_id NOT NULL on critical tables (after data migration)
ALTER TABLE contacts ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE payments ALTER COLUMN tenant_id SET NOT NULL;
-- webhook_logs can stay nullable for legacy logs

-- Step 2: Drop old global unique constraints
ALTER TABLE contacts DROP CONSTRAINT IF EXISTS contacts_mc_id_key;
ALTER TABLE contacts DROP CONSTRAINT IF EXISTS contacts_ghl_id_key;
ALTER TABLE meta_ads DROP CONSTRAINT IF EXISTS meta_ads_ad_id_key;

-- Step 3: Add new composite unique constraints (tenant-scoped)
-- mc_id is unique within a tenant
ALTER TABLE contacts ADD CONSTRAINT contacts_tenant_mc_id_unique
  UNIQUE(tenant_id, mc_id);

-- ghl_id is unique within a tenant
ALTER TABLE contacts ADD CONSTRAINT contacts_tenant_ghl_id_unique
  UNIQUE(tenant_id, ghl_id);

-- payment_event_id is unique within a tenant
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_payment_event_id_key;
ALTER TABLE payments ADD CONSTRAINT payments_tenant_event_id_unique
  UNIQUE(tenant_id, payment_event_id);

-- ad_id is unique within a tenant
ALTER TABLE meta_ads ADD CONSTRAINT meta_ads_tenant_ad_id_unique
  UNIQUE(tenant_id, ad_id);

-- Step 4: Add composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_contacts_tenant_stage ON contacts(tenant_id, stage);
CREATE INDEX IF NOT EXISTS idx_contacts_tenant_created ON contacts(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_contacts_tenant_source ON contacts(tenant_id, source);
CREATE INDEX IF NOT EXISTS idx_payments_tenant_date ON payments(tenant_id, payment_date);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_tenant_source ON webhook_logs(tenant_id, source);

-- Step 5: Verify constraints
SELECT
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type
FROM information_schema.table_constraints tc
WHERE tc.table_name IN ('contacts', 'payments', 'meta_ads')
  AND tc.constraint_type IN ('UNIQUE', 'PRIMARY KEY')
ORDER BY tc.table_name, tc.constraint_type;


