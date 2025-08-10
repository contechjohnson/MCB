-- Fix DM Started timestamps for all contacts
-- Every contact in the system has started a DM, so set dm_started_at to created_at if null

-- Update all contacts without dm_started_at
UPDATE contacts
SET dm_started_at = COALESCE(dm_started_at, created_at, last_igfb_interaction_at, NOW())
WHERE dm_started_at IS NULL
  AND mcid NOT LIKE 'test_%';

-- Also fix lead_captured_at for contacts with email
UPDATE contacts
SET lead_captured_at = COALESCE(lead_captured_at, created_at, NOW()),
    stage = CASE 
      WHEN stage = 'new' THEN 'lead'
      ELSE stage
    END
WHERE email IS NOT NULL 
  AND email != ''
  AND lead_captured_at IS NULL
  AND mcid NOT LIKE 'test_%';

-- Get summary stats
SELECT 
  COUNT(*) as total_contacts,
  COUNT(dm_started_at) as dm_started,
  COUNT(lead_captured_at) as leads_captured,
  COUNT(email) as has_email,
  ROUND(100.0 * COUNT(dm_started_at) / COUNT(*), 2) as dm_started_pct,
  ROUND(100.0 * COUNT(lead_captured_at) / COUNT(*), 2) as lead_captured_pct
FROM contacts
WHERE mcid NOT LIKE 'test_%';