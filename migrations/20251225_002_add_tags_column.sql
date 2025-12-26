-- Migration: Add flexible tags column for webhook categorization
-- Purpose: Allow arbitrary tagging of contacts and events (booking_source, funnel_type, etc.)
-- Date: 2025-12-25
-- Status: APPLIED

-- Add tags column to contacts table (JSONB for flexibility)
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '{}';

-- Add tags column to funnel_events table (for event-level tagging)
ALTER TABLE funnel_events ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '{}';

-- Create index on tags for efficient querying
CREATE INDEX IF NOT EXISTS idx_contacts_tags ON contacts USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_funnel_events_tags ON funnel_events USING GIN (tags);

-- Example usage:
-- Contact tags: {"booking_source": "jane", "funnel_type": "discovery", "campaign": "holiday_2025"}
-- Event tags: {"booking_source": "calendly", "pipeline": "free_discovery"}

-- Common tag keys:
-- booking_source: jane, calendly, website
-- funnel_type: discovery, lead_magnet, checkout, bottom_of_funnel, top_of_funnel
-- pipeline: ppcu_pipeline, free_discovery_call
-- perspective_funnel_id: (from Perspective)
-- ghl_stage: (from GHL pipeline stage)
-- ad_campaign: (arbitrary campaign names)

COMMENT ON COLUMN contacts.tags IS 'Flexible JSONB tags for categorization (booking_source, funnel_type, etc.)';
COMMENT ON COLUMN funnel_events.tags IS 'Event-level tags passed through webhooks';

-- Note: Also updated update_contact_with_event RPC to accept p_tags parameter
-- See: 20251225_003_update_rpc_with_tags.sql (applied via MCP)
