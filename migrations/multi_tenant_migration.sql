-- =====================================================
-- Multi-Tenant Database Migration
-- Project: succdcwblbzikenhhlrz
-- Date: 2025-12-06
-- =====================================================

-- Migration 1: Create tenants table
-- =====================================================
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  owner_name TEXT,
  report_email TEXT,
  is_active BOOLEAN DEFAULT true,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_active ON tenants(is_active);

INSERT INTO tenants (slug, name, owner_name, report_email, config) VALUES
  ('ppcu', 'Postpartum Care USA', 'Eric', 'connor@columnline.com', '{"historical_filter": true}'),
  ('centner', 'Centner Wellness', NULL, NULL, '{}'),
  ('columnline', 'Columnline AI', 'Connor', 'connor@columnline.com', '{}')
ON CONFLICT (slug) DO NOTHING;

COMMENT ON TABLE tenants IS 'Multi-tenant configuration for MCB funnel tracking';

-- Migration 2: Create tenant_integrations table
-- =====================================================
CREATE TABLE IF NOT EXISTS tenant_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  credentials JSONB NOT NULL DEFAULT '{}',
  webhook_secret TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_tenant_integrations_tenant ON tenant_integrations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_integrations_provider ON tenant_integrations(provider);
CREATE INDEX IF NOT EXISTS idx_tenant_integrations_active ON tenant_integrations(tenant_id, is_active);

COMMENT ON TABLE tenant_integrations IS 'Per-tenant API credentials and webhook configuration';

-- Migration 3: Add tenant_id to all core tables
-- =====================================================
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE webhook_logs ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE meta_ads ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE meta_ad_creatives ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE meta_ad_insights ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);

CREATE INDEX IF NOT EXISTS idx_contacts_tenant_id ON contacts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payments_tenant_id ON payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_tenant_id ON webhook_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_meta_ads_tenant_id ON meta_ads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_meta_ad_creatives_tenant_id ON meta_ad_creatives(tenant_id);
CREATE INDEX IF NOT EXISTS idx_meta_ad_insights_tenant_id ON meta_ad_insights(tenant_id);

-- Migration 4: Migrate PPCU data
-- =====================================================
UPDATE contacts SET tenant_id = (SELECT id FROM tenants WHERE slug = 'ppcu') WHERE tenant_id IS NULL;
UPDATE payments SET tenant_id = (SELECT id FROM tenants WHERE slug = 'ppcu') WHERE tenant_id IS NULL;
UPDATE webhook_logs SET tenant_id = (SELECT id FROM tenants WHERE slug = 'ppcu') WHERE tenant_id IS NULL;
UPDATE meta_ads SET tenant_id = (SELECT id FROM tenants WHERE slug = 'ppcu') WHERE tenant_id IS NULL;
UPDATE meta_ad_creatives SET tenant_id = (SELECT id FROM tenants WHERE slug = 'ppcu') WHERE tenant_id IS NULL;
UPDATE meta_ad_insights SET tenant_id = (SELECT id FROM tenants WHERE slug = 'ppcu') WHERE tenant_id IS NULL;

-- Migration 5: Update constraints
-- =====================================================
ALTER TABLE contacts ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE payments ALTER COLUMN tenant_id SET NOT NULL;

ALTER TABLE contacts DROP CONSTRAINT IF EXISTS contacts_mc_id_key;
ALTER TABLE contacts DROP CONSTRAINT IF EXISTS contacts_ghl_id_key;
ALTER TABLE meta_ads DROP CONSTRAINT IF EXISTS meta_ads_ad_id_key;

ALTER TABLE contacts ADD CONSTRAINT contacts_tenant_mc_id_unique UNIQUE(tenant_id, mc_id);
ALTER TABLE contacts ADD CONSTRAINT contacts_tenant_ghl_id_unique UNIQUE(tenant_id, ghl_id);
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_payment_event_id_key;
ALTER TABLE payments ADD CONSTRAINT payments_tenant_event_id_unique UNIQUE(tenant_id, payment_event_id);
ALTER TABLE meta_ads ADD CONSTRAINT meta_ads_tenant_ad_id_unique UNIQUE(tenant_id, ad_id);

CREATE INDEX IF NOT EXISTS idx_contacts_tenant_stage ON contacts(tenant_id, stage);
CREATE INDEX IF NOT EXISTS idx_contacts_tenant_created ON contacts(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_contacts_tenant_source ON contacts(tenant_id, source);
CREATE INDEX IF NOT EXISTS idx_payments_tenant_date ON payments(tenant_id, payment_date);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_tenant_source ON webhook_logs(tenant_id, source);
