-- Migration: Create function to insert contact and return ID
-- Purpose: Bypasses Supabase JS client schema cache issues
-- Created: Nov 5, 2025
--
-- This function creates a new contact with MC_ID, subscribe_date, and stage,
-- then returns the generated UUID. This is more reliable than using the
-- Supabase JS client's .insert() which can have schema caching issues.

-- Drop the function if it exists (for clean redeployment)
DROP FUNCTION IF EXISTS create_contact_with_mc_id(TEXT, TIMESTAMPTZ, TEXT);

-- Create the function
CREATE OR REPLACE FUNCTION create_contact_with_mc_id(
  mc_id TEXT,
  sub_date TIMESTAMPTZ,
  contact_stage TEXT
)
RETURNS UUID AS $$
DECLARE
  new_id UUID;
BEGIN
  -- Insert the new contact
  INSERT INTO contacts (MC_ID, subscribe_date, stage, created_at, updated_at)
  VALUES (mc_id, sub_date, contact_stage, NOW(), NOW())
  RETURNING id INTO new_id;

  -- Return the generated UUID
  RETURN new_id;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_contact_with_mc_id(TEXT, TIMESTAMPTZ, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION create_contact_with_mc_id(TEXT, TIMESTAMPTZ, TEXT) TO service_role;

-- Test query (commented out - uncomment to test)
-- SELECT create_contact_with_mc_id('test_mc_123', NOW(), 'new_lead');
