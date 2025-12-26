-- Migration: Add GHL API credentials for PPCU and Centner
-- Date: December 24, 2025
-- Purpose: Enable GHL API queries for pipeline/opportunity data

BEGIN;

-- Insert PPCU GHL credentials
INSERT INTO tenant_integrations (tenant_id, provider, credentials, is_active)
SELECT
  id,
  'ghl',
  jsonb_build_object(
    'location_id', 'ep0g6pacgWxOebjWoJUE',
    'api_key', 'pit-96165432-f9cd-4ec4-9395-7826a0ee0dc5'
  ),
  true
FROM tenants WHERE slug = 'ppcu'
ON CONFLICT (tenant_id, provider) DO UPDATE SET
  credentials = EXCLUDED.credentials,
  is_active = true,
  updated_at = now();

-- Insert Centner GHL credentials
INSERT INTO tenant_integrations (tenant_id, provider, credentials, is_active)
SELECT
  id,
  'ghl',
  jsonb_build_object(
    'location_id', 'XHmwKHllLgrU2VZ6zLiI',
    'api_key', 'pit-d5df1b09-633d-433c-9c2e-54d450ca4248'
  ),
  true
FROM tenants WHERE slug = 'centner'
ON CONFLICT (tenant_id, provider) DO UPDATE SET
  credentials = EXCLUDED.credentials,
  is_active = true,
  updated_at = now();

COMMIT;
