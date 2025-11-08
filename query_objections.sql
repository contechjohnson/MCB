-- Query all contacts with objections (excluding historical data)
-- Run this in Supabase SQL Editor and export results as CSV

SELECT 
  id,
  first_name,
  last_name,
  email_primary,
  source,
  stage,
  objections,
  chatbot_ab,
  trigger_word,
  created_at,
  dm_qualified_date
FROM contacts
WHERE objections IS NOT NULL
  AND source != 'instagram_historical'
ORDER BY created_at DESC;

-- Expected: Less than 300 rows based on user estimate
