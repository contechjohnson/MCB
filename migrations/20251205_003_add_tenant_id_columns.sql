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
