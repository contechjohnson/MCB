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
