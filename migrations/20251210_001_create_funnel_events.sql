-- Migration: Create funnel_events table (Event-Driven Architecture Foundation)
-- Created: 2025-12-10
-- Purpose: Immutable event log for all contact funnel actions
--
-- This table is the core of the event-driven architecture migration.
-- It stores every action (subscribe, qualify, book, purchase) as an event
-- rather than timestamps in the contacts table.
--
-- Benefits:
-- - Complete audit trail (never lose data)
-- - Retroactive analysis (rebuild state from events)
-- - Flexible analytics (time between events, source attribution)
-- - Event replay capability
--
-- Related migrations:
-- - 20251210_002: Migrate historical contact timestamps to events
-- - 20251210_004: Dual-write function (update contacts + create events)
-- - 20251210_005: Analytics views for event querying

-- ================================================================
-- MAIN TABLE
-- ================================================================

CREATE TABLE IF NOT EXISTS funnel_events (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Tenant isolation (multi-tenancy)
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Contact linkage (who did this action)
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,

  -- Event identity
  event_type TEXT NOT NULL,  -- 'contact_subscribed', 'dm_qualified', 'link_sent', 'link_clicked',
                              -- 'form_submitted', 'appointment_scheduled', 'appointment_held',
                              -- 'package_sent', 'checkout_started', 'purchase_completed', etc.
  event_timestamp TIMESTAMPTZ NOT NULL,  -- When the event occurred (critical for sequencing)

  -- Source tracking (where did this event come from)
  source TEXT NOT NULL,  -- 'manychat', 'ghl', 'stripe', 'denefits', 'chatbot', 'system', 'manual'
  source_event_id TEXT,  -- External event ID for idempotency (e.g., Stripe event ID, MC subscriber ID + timestamp)

  -- Flexible metadata (event-specific data)
  event_data JSONB DEFAULT '{}'::jsonb,  -- Q1/Q2 answers, amounts, chatbot variant, etc.
                                          -- Example: {"q1_answer": "fatigue", "q2_answer": "6 months", "chatbot_ab": "A"}

  -- Historical context (contact state at event time)
  contact_snapshot JSONB,  -- Captures contact state when event occurred (email, name, stage)
                           -- Example: {"email": "test@example.com", "stage": "new_lead", "first_name": "Jane"}

  -- Audit fields
  created_at TIMESTAMPTZ DEFAULT NOW(),  -- When event was recorded in database
  created_by TEXT DEFAULT 'system'  -- 'webhook', 'migration', 'admin', 'automation'
);

-- ================================================================
-- INDEXES (Performance Optimization)
-- ================================================================

-- Primary query pattern: "Get all events for a contact, ordered by time"
CREATE INDEX IF NOT EXISTS idx_funnel_events_contact
ON funnel_events (contact_id, event_timestamp DESC);

-- Funnel analytics: "Count events by type for a tenant in a date range"
CREATE INDEX IF NOT EXISTS idx_funnel_events_tenant_type
ON funnel_events (tenant_id, event_type, event_timestamp DESC);

-- General chronological queries
CREATE INDEX IF NOT EXISTS idx_funnel_events_timestamp
ON funnel_events (event_timestamp DESC);

-- Source-based queries (debugging webhook issues)
CREATE INDEX IF NOT EXISTS idx_funnel_events_source
ON funnel_events (tenant_id, source, event_timestamp DESC);

-- ================================================================
-- CONSTRAINTS
-- ================================================================

-- Prevent duplicate events from same source (idempotency)
-- Example: Stripe sends same event twice → only one event created
CREATE UNIQUE INDEX IF NOT EXISTS idx_funnel_events_source_dedup
ON funnel_events (tenant_id, source, source_event_id)
WHERE source_event_id IS NOT NULL;

-- Ensure event_type uses standardized values (can extend per client)
ALTER TABLE funnel_events ADD CONSTRAINT IF NOT EXISTS valid_event_type CHECK (
  event_type IN (
    -- Contact lifecycle
    'contact_subscribed',
    'contact_created',
    'contact_updated',

    -- Engagement
    'dm_qualified',
    'link_sent',
    'link_clicked',
    'form_submitted',

    -- Booking
    'appointment_scheduled',
    'appointment_held',
    'appointment_cancelled',
    'appointment_rescheduled',

    -- Package/Treatment
    'package_sent',

    -- Payment
    'checkout_started',
    'purchase_completed',
    'payment_refunded',
    'payment_plan_created',
    'payment_plan_updated',

    -- Feedback/Engagement
    'feedback_requested',
    'feedback_received',
    'testimonial_collected',

    -- System
    'migration_event',
    'manual_override'
  )
);

-- ================================================================
-- COMMENTS (Database Documentation)
-- ================================================================

COMMENT ON TABLE funnel_events IS
'Immutable event log for contact funnel actions. Every action (subscribe, qualify, book, purchase) is recorded as an event. Used for analytics, debugging, and contact state reconstruction.';

COMMENT ON COLUMN funnel_events.event_type IS
'Standardized event type (e.g., dm_qualified, purchase_completed). Constrained to valid values.';

COMMENT ON COLUMN funnel_events.event_data IS
'Flexible JSONB storage for event-specific data. Examples: Q1/Q2 answers, payment amounts, chatbot variants.';

COMMENT ON COLUMN funnel_events.contact_snapshot IS
'Contact state at the time of the event. Enables retroactive analysis: "What stage was this contact on Nov 15?"';

COMMENT ON COLUMN funnel_events.source_event_id IS
'External system event ID for idempotency. Prevents duplicate events from webhook retries.';

COMMENT ON COLUMN funnel_events.created_by IS
'How this event was created: webhook (real-time), migration (historical), admin (manual), automation (triggered)';

-- ================================================================
-- VERIFICATION
-- ================================================================

-- Verify table created successfully
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'funnel_events') THEN
    RAISE NOTICE 'SUCCESS: funnel_events table created';
  ELSE
    RAISE EXCEPTION 'FAILED: funnel_events table not found';
  END IF;
END $$;

-- Display table stats
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname || '.' || tablename)) AS total_size
FROM pg_tables
WHERE tablename = 'funnel_events';
