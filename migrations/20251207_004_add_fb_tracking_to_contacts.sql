-- Migration: Add Facebook tracking fields to contacts table
-- Created: 2024-12-07
-- Purpose: Store FB click/browser IDs for Meta CAPI attribution

BEGIN;

-- ============================================================
-- ADD COLUMNS: Facebook tracking fields
-- ============================================================

-- Facebook Click ID (from URL parameter when user clicks ad)
ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS fbclid TEXT;

-- Facebook Browser ID (_fbp cookie value)
ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS fbp TEXT;

-- Facebook Click ID Cookie (_fbc cookie value, derived from fbclid)
ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS fbc TEXT;

-- ============================================================
-- INDEXES
-- ============================================================

-- Index for CAPI event creation (finding contacts with FB tracking data)
CREATE INDEX IF NOT EXISTS idx_contacts_fbclid
ON contacts (fbclid)
WHERE fbclid IS NOT NULL;

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON COLUMN contacts.fbclid IS 'Facebook Click ID from ?fbclid= URL parameter when user clicked an ad';
COMMENT ON COLUMN contacts.fbp IS 'Facebook Browser ID from _fbp cookie - persists across sessions';
COMMENT ON COLUMN contacts.fbc IS 'Facebook Click ID Cookie from _fbc cookie - derived from fbclid';

COMMIT;
