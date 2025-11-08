-- Migration: Fix Historical Data Field Swapping
-- Date: January 7, 2025
-- Issue: Q1 and Q2 were swapped during historical import
--        chatbot_ab contains symptoms instead of AB test variants
--
-- SAFETY: Creates backup table before making changes
-- IMPACT: Only affects historical data (source LIKE '%_historical%')
-- SAFE TO RUN: Does not touch live webhook data

-- ====================
-- STEP 1: Create backup
-- ====================

CREATE TABLE IF NOT EXISTS contacts_backup_20250107 AS
SELECT * FROM contacts WHERE source LIKE '%_historical%';

COMMENT ON TABLE contacts_backup_20250107 IS 'Backup before fixing Q1/Q2 swap and chatbot_ab cleanup';

-- ====================
-- STEP 2: Swap Q1 and Q2 for historical contacts
-- ====================

-- Current state:
--   q1_question = symptoms (WRONG)
--   q2_question = months postpartum (WRONG)
--
-- Desired state:
--   q1_question = months postpartum (CORRECT)
--   q2_question = symptoms (CORRECT)

-- We need to use a temporary column to swap values
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS temp_q1_swap TEXT;

-- Copy Q1 to temp
UPDATE contacts
SET temp_q1_swap = q1_question
WHERE source LIKE '%_historical%';

-- Move Q2 to Q1 (months postpartum → Q1)
UPDATE contacts
SET q1_question = q2_question
WHERE source LIKE '%_historical%';

-- Move old Q1 (stored in temp) to Q2 (symptoms → Q2)
UPDATE contacts
SET q2_question = temp_q1_swap
WHERE source LIKE '%_historical%';

-- Remove temp column
ALTER TABLE contacts DROP COLUMN temp_q1_swap;

-- ====================
-- STEP 3: Clean up chatbot_ab field
-- ====================

-- Set chatbot_ab to NULL where it contains symptoms
-- Valid values are: "A-OCT30", "B-OCT30", "A - OCT30", "B - OCT30"
-- Everything else is invalid (symptoms like "rage", "brain fog", etc.)

UPDATE contacts
SET chatbot_ab = NULL,
    updated_at = NOW()
WHERE source LIKE '%_historical%'
  AND chatbot_ab IS NOT NULL
  AND chatbot_ab NOT SIMILAR TO '[AB]( )?-? ?OCT30';

-- ====================
-- STEP 4: Normalize chatbot_ab spacing
-- ====================

-- Standardize "A - OCT30" and "B - OCT30" to "A-OCT30" and "B-OCT30"
UPDATE contacts
SET chatbot_ab = REPLACE(chatbot_ab, ' - ', '-'),
    updated_at = NOW()
WHERE source LIKE '%_historical%'
  AND chatbot_ab IS NOT NULL;

-- ====================
-- STEP 5: Clean up objections that clearly are symptoms
-- ====================

-- Only clean obvious symptom keywords (fatigue, exhaustion, brain fog)
-- Leave ambiguous ones for manual review

UPDATE contacts
SET objections = NULL,
    updated_at = NOW()
WHERE source LIKE '%_historical%'
  AND objections IS NOT NULL
  AND (
    objections ILIKE '%exhaustion%' OR
    objections ILIKE '%fatigue%' OR
    objections ILIKE '%brain fog%' OR
    objections ILIKE '%tired%' OR
    objections ILIKE '%mood swing%' OR
    objections ILIKE '%anxiety%' AND NOT objections ILIKE '%about%'
  );

-- ====================
-- VERIFICATION QUERIES
-- ====================

-- Run these after migration to verify:

-- 1. Check Q1 values (should be numbers or NULL)
-- SELECT q1_question, COUNT(*) FROM contacts WHERE source LIKE '%_historical%' GROUP BY q1_question ORDER BY COUNT(*) DESC LIMIT 20;

-- 2. Check Q2 values (should be symptoms or NULL)
-- SELECT LEFT(q2_question, 50) as q2_sample, COUNT(*) FROM contacts WHERE source LIKE '%_historical%' GROUP BY q2_question ORDER BY COUNT(*) DESC LIMIT 20;

-- 3. Check chatbot_ab values (should only be A-OCT30, B-OCT30, or NULL)
-- SELECT chatbot_ab, COUNT(*) FROM contacts WHERE source LIKE '%_historical%' GROUP BY chatbot_ab ORDER BY COUNT(*) DESC;

-- 4. Verify backup was created
-- SELECT COUNT(*) FROM contacts_backup_20250107;

-- ====================
-- ROLLBACK (if needed)
-- ====================

-- If something goes wrong, restore from backup:
/*
UPDATE contacts c
SET
  q1_question = b.q1_question,
  q2_question = b.q2_question,
  chatbot_ab = b.chatbot_ab,
  objections = b.objections,
  updated_at = b.updated_at
FROM contacts_backup_20250107 b
WHERE c.id = b.id;
*/

-- ====================
-- CLEANUP (after verifying)
-- ====================

-- Once verified, you can drop the backup table:
-- DROP TABLE contacts_backup_20250107;

COMMENT ON TABLE contacts_backup_20250107 IS 'Backup created 2025-01-07 before fixing Q1/Q2 swap. Safe to drop after verification.';
