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
