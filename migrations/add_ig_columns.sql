-- Migration: Add Instagram tracking columns
-- Created: 2025-11-05
-- Adds: subscribed, ig_last_interaction, ig_id columns

-- Add the three new columns
ALTER TABLE contacts
  ADD COLUMN subscribed TIMESTAMPTZ,
  ADD COLUMN ig_last_interaction TIMESTAMPTZ,
  ADD COLUMN ig_id BIGINT;

-- Add indexes for the new columns (for fast lookups)
CREATE INDEX idx_contacts_ig_id ON contacts(ig_id) WHERE ig_id IS NOT NULL;
CREATE INDEX idx_contacts_subscribed ON contacts(subscribed) WHERE subscribed IS NOT NULL;
CREATE INDEX idx_contacts_ig_last_interaction ON contacts(ig_last_interaction) WHERE ig_last_interaction IS NOT NULL;

-- Add helpful comments
COMMENT ON COLUMN contacts.subscribed IS 'ManyChat original subscribe timestamp (when they first subscribed to bot)';
COMMENT ON COLUMN contacts.ig_last_interaction IS 'Last Instagram interaction timestamp from ManyChat';
COMMENT ON COLUMN contacts.ig_id IS 'Instagram user ID (numeric, from ManyChat)';
