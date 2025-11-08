-- Fix find_contact_smart to use lowercase column names (actual schema)
CREATE OR REPLACE FUNCTION find_contact_smart(
  search_ghl_id TEXT DEFAULT NULL,
  search_mc_id TEXT DEFAULT NULL,
  search_email TEXT DEFAULT NULL,
  search_phone TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  result UUID;
BEGIN
  -- Try ghl_id first (most reliable) - LOWERCASE
  IF search_ghl_id IS NOT NULL THEN
    SELECT id INTO result FROM contacts WHERE ghl_id = search_ghl_id LIMIT 1;
    IF result IS NOT NULL THEN RETURN result; END IF;
  END IF;

  -- Try mc_id - LOWERCASE
  IF search_mc_id IS NOT NULL THEN
    SELECT id INTO result FROM contacts WHERE mc_id = search_mc_id LIMIT 1;
    IF result IS NOT NULL THEN RETURN result; END IF;
  END IF;

  -- Try email (all fields)
  IF search_email IS NOT NULL THEN
    SELECT id INTO result FROM contacts
    WHERE email_primary ILIKE search_email
       OR email_booking ILIKE search_email
       OR email_payment ILIKE search_email
    LIMIT 1;
    IF result IS NOT NULL THEN RETURN result; END IF;
  END IF;

  -- Try phone
  IF search_phone IS NOT NULL THEN
    SELECT id INTO result FROM contacts WHERE phone = search_phone LIMIT 1;
    IF result IS NOT NULL THEN RETURN result; END IF;
  END IF;

  -- No match found
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
