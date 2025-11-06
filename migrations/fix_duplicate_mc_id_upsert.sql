-- Migration: Fix duplicate mc_id error by using UPSERT
-- Purpose: Handle race conditions when multiple webhooks arrive for the same contact
-- Created: Nov 6, 2025
--
-- ISSUE: When a contact triggers multiple ManyChat webhooks in quick succession
-- (e.g., completing form, booking meeting), both webhooks try to create the contact
-- and one fails with "duplicate key value violates unique constraint"
--
-- SOLUTION: Use INSERT ... ON CONFLICT to gracefully handle duplicates

-- Drop the old function
DROP FUNCTION IF EXISTS create_contact_with_mc_id(TEXT, TIMESTAMPTZ, TEXT);

-- Create the new UPSERT version
CREATE OR REPLACE FUNCTION create_contact_with_mc_id(
  mc_id TEXT,
  sub_date TIMESTAMPTZ,
  contact_stage TEXT
)
RETURNS UUID AS $$
DECLARE
  result_id UUID;
BEGIN
  -- Try to insert, but if mc_id already exists, just return the existing ID
  INSERT INTO contacts (MC_ID, subscribe_date, stage, created_at, updated_at)
  VALUES (mc_id, sub_date, contact_stage, NOW(), NOW())
  ON CONFLICT (MC_ID)
  DO UPDATE SET
    -- Update the subscribe_date and stage if they're NULL or older
    subscribe_date = CASE
      WHEN contacts.subscribe_date IS NULL OR contacts.subscribe_date > EXCLUDED.subscribe_date
      THEN EXCLUDED.subscribe_date
      ELSE contacts.subscribe_date
    END,
    stage = CASE
      WHEN contacts.stage IS NULL
      THEN EXCLUDED.stage
      ELSE contacts.stage
    END,
    updated_at = NOW()
  RETURNING id INTO result_id;

  -- If we didn't get an ID from the INSERT (shouldn't happen, but safety check)
  IF result_id IS NULL THEN
    SELECT id INTO result_id FROM contacts WHERE MC_ID = mc_id LIMIT 1;
  END IF;

  RETURN result_id;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION create_contact_with_mc_id(TEXT, TIMESTAMPTZ, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION create_contact_with_mc_id(TEXT, TIMESTAMPTZ, TEXT) TO service_role;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Migration complete: create_contact_with_mc_id now handles duplicates gracefully';
END $$;
