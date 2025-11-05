-- Migration: Historical Data Tables
-- Purpose: Separate schema for analyzing messy legacy data from Google Sheets, Airtable, Stripe
-- Created: 2025-05-11
--
-- These tables are SEPARATE from the live webhook system (contacts, payments, etc.)
-- They allow analysis of historical data without polluting the clean production database

-- =============================================================================
-- TABLE: hist_contacts
-- =============================================================================
-- Normalized contact records from all historical sources
-- Primary key is email (the only reliable common field across sources)
-- Deduped by email - if multiple sources have same email, we keep most complete record

CREATE TABLE IF NOT EXISTS hist_contacts (
    -- Primary identifier
    email TEXT PRIMARY KEY,

    -- Basic contact info
    first_name TEXT,
    last_name TEXT,
    phone TEXT, -- Will be normalized (digits only) during import

    -- Source tracking
    source TEXT, -- 'google_sheets', 'airtable', or 'merged' if from multiple
    import_batch_id UUID, -- Links to hist_import_logs to track when this was imported

    -- Attribution data (where they came from)
    ad_type TEXT, -- 'paid', 'organic', or NULL if unknown
    trigger_word TEXT, -- ManyChat keyword that started conversation (if available)
    campaign_name TEXT, -- Any campaign identifier from Airtable

    -- Funnel stage (best guess based on available data)
    reached_stage TEXT, -- 'contacted', 'qualified', 'booked', 'attended', 'purchased'
    has_purchase BOOLEAN DEFAULT FALSE,

    -- Timestamps (what we can extract from historical data)
    first_seen TIMESTAMPTZ, -- Earliest date we have for this contact
    last_seen TIMESTAMPTZ, -- Most recent date we have for this contact
    purchase_date TIMESTAMPTZ, -- If they purchased, when

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Notes/flags for data quality issues
    data_quality_notes TEXT, -- e.g., "missing phone", "duplicate found in airtable"
    is_suspicious BOOLEAN DEFAULT FALSE -- Flag for obviously wrong data (future dates, etc.)
);

-- Index for common queries
CREATE INDEX IF NOT EXISTS idx_hist_contacts_ad_type ON hist_contacts(ad_type);
CREATE INDEX IF NOT EXISTS idx_hist_contacts_trigger_word ON hist_contacts(trigger_word);
CREATE INDEX IF NOT EXISTS idx_hist_contacts_has_purchase ON hist_contacts(has_purchase);
CREATE INDEX IF NOT EXISTS idx_hist_contacts_first_seen ON hist_contacts(first_seen);
CREATE INDEX IF NOT EXISTS idx_hist_contacts_source ON hist_contacts(source);

-- =============================================================================
-- TABLE: hist_payments
-- =============================================================================
-- Payment records from Stripe and Denefits exports
-- Links to hist_contacts by email
-- Allows multiple payments per customer (e.g., initial purchase + upsells)

CREATE TABLE IF NOT EXISTS hist_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Link to contact
    email TEXT NOT NULL, -- Foreign key to hist_contacts(email)

    -- Payment details
    amount NUMERIC(10, 2) NOT NULL, -- Amount in dollars (e.g., 997.00)
    currency TEXT DEFAULT 'USD',
    payment_date TIMESTAMPTZ NOT NULL,

    -- Source tracking
    source TEXT NOT NULL, -- 'stripe' or 'denefits'
    external_id TEXT, -- Stripe charge ID or Denefits contract ID
    payment_type TEXT, -- 'buy_in_full', 'buy_now_pay_later', 'refund'

    -- Import metadata
    import_batch_id UUID, -- Links to hist_import_logs

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Data quality
    is_suspicious BOOLEAN DEFAULT FALSE -- Flag for negative amounts, future dates, etc.
);

-- Indexes for analysis
CREATE INDEX IF NOT EXISTS idx_hist_payments_email ON hist_payments(email);
CREATE INDEX IF NOT EXISTS idx_hist_payments_date ON hist_payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_hist_payments_source ON hist_payments(source);
CREATE INDEX IF NOT EXISTS idx_hist_payments_type ON hist_payments(payment_type);

-- =============================================================================
-- TABLE: hist_timeline
-- =============================================================================
-- Event timeline reconstructed from whatever date fields we can extract
-- This lets us calculate conversion timing even with sparse data
-- Example: If we only have "contact_created" and "purchased" dates, we can still
-- calculate time-to-conversion

CREATE TABLE IF NOT EXISTS hist_timeline (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Link to contact
    email TEXT NOT NULL, -- Foreign key to hist_contacts(email)

    -- Event details
    event_type TEXT NOT NULL, -- 'contact_created', 'qualified', 'booked', 'attended', 'purchased', etc.
    event_date TIMESTAMPTZ NOT NULL,

    -- Context
    source TEXT, -- Which import source this event came from
    event_details JSONB, -- Any additional context (free-form)

    -- Import metadata
    import_batch_id UUID,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for timeline queries
CREATE INDEX IF NOT EXISTS idx_hist_timeline_email ON hist_timeline(email);
CREATE INDEX IF NOT EXISTS idx_hist_timeline_event_type ON hist_timeline(event_type);
CREATE INDEX IF NOT EXISTS idx_hist_timeline_event_date ON hist_timeline(event_date);

-- =============================================================================
-- TABLE: hist_import_logs
-- =============================================================================
-- Audit log of all imports
-- Tracks when we imported data, from what source, and any errors/warnings

CREATE TABLE IF NOT EXISTS hist_import_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Import details
    source_file TEXT NOT NULL, -- Filename of the CSV/export
    source_type TEXT NOT NULL, -- 'google_sheets', 'airtable', 'stripe', 'denefits'

    -- Results
    rows_processed INTEGER,
    rows_imported INTEGER,
    rows_skipped INTEGER,
    rows_updated INTEGER,

    -- Error tracking
    errors JSONB, -- Array of error messages
    warnings JSONB, -- Array of warnings (e.g., "missing phone for 5 contacts")

    -- Timestamps
    import_started_at TIMESTAMPTZ DEFAULT NOW(),
    import_completed_at TIMESTAMPTZ,

    -- User/context
    imported_by TEXT, -- Who ran the import (for auditing)
    notes TEXT
);

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Function to update the updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_hist_contacts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at on hist_contacts
DROP TRIGGER IF EXISTS trigger_hist_contacts_updated_at ON hist_contacts;
CREATE TRIGGER trigger_hist_contacts_updated_at
    BEFORE UPDATE ON hist_contacts
    FOR EACH ROW
    EXECUTE FUNCTION update_hist_contacts_updated_at();

-- =============================================================================
-- VIEWS FOR COMMON QUERIES (will be created in next migration)
-- =============================================================================
-- See: 20250511_create_historical_views.sql

-- =============================================================================
-- NOTES
-- =============================================================================
-- 1. All historical tables are prefixed with "hist_" to distinguish from live system
-- 2. Email is the primary key for hist_contacts (only reliable common field)
-- 3. Phone numbers should be normalized to digits-only during import
-- 4. Dates are stored as TIMESTAMPTZ for consistency with live system
-- 5. JSONB fields allow flexible storage of unexpected data
-- 6. Indexes are optimized for analysis queries (grouping, filtering, time-series)
-- 7. All imports are logged in hist_import_logs for auditing and debugging
