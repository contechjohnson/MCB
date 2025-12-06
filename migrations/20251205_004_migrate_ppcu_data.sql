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
