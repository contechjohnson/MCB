-- Fix Connor Johnson duplicate issue and update purchase status

-- First, check what we have
SELECT 'Current Connor Johnson records:' AS status;
SELECT 
    user_id,
    first_name,
    last_name,
    email_address,
    stage,
    attended,
    sent_package,
    bought_package,
    total_purchased,
    first_purchase_date,
    package_purchase_date
FROM contacts
WHERE email_address = 'con.tech.johnson@gmail.com'
   OR user_id LIKE '%connor%'
ORDER BY created_at;

-- Update the REAL Connor (the one with actual purchases) based on total_purchased
UPDATE contacts
SET 
    bought_package = true,
    sent_package = true,
    attended = true,
    booked = true,
    clicked_link = true,
    sent_link = true,
    lead_contact = true,
    lead = true,
    stage = 'BOUGHT_PACKAGE'
WHERE email_address = 'con.tech.johnson@gmail.com'
  AND total_purchased >= 1400;

-- Also update any contact with significant purchases
UPDATE contacts
SET 
    bought_package = true,
    sent_package = true,
    attended = true,
    booked = true,
    clicked_link = true,
    sent_link = true,
    lead_contact = true,
    lead = true,
    stage = 'BOUGHT_PACKAGE'
WHERE total_purchased >= 1400
  AND bought_package = false;

-- Update contacts with smaller purchases (discovery calls)
UPDATE contacts
SET 
    attended = true,
    booked = true,
    clicked_link = true,
    sent_link = true,
    lead_contact = true,
    lead = true,
    stage = CASE 
        WHEN bought_package = true THEN 'BOUGHT_PACKAGE'
        WHEN sent_package = true THEN 'SENT_PACKAGE'
        ELSE 'ATTENDED'
    END
WHERE total_purchased > 0
  AND total_purchased < 1400
  AND attended = false;

-- Delete test Connor if real Connor exists
DELETE FROM contacts
WHERE user_id = 'test_connor'
  AND EXISTS (
    SELECT 1 FROM contacts 
    WHERE email_address = 'con.tech.johnson@gmail.com' 
    AND user_id != 'test_connor'
  );

-- Show updated status
SELECT 'Updated Connor Johnson status:' AS status;
SELECT 
    user_id,
    first_name || ' ' || last_name AS name,
    email_address,
    stage,
    total_purchased,
    CASE 
        WHEN bought_package = true THEN '✅ BOUGHT PACKAGE'
        WHEN attended = true THEN '🎯 ATTENDED'
        ELSE '📧 IN FUNNEL'
    END AS status
FROM contacts
WHERE email_address = 'con.tech.johnson@gmail.com'
   OR (first_name = 'Connor' AND last_name = 'Johnson');

-- Check all contacts with purchases to ensure proper status
SELECT 'All contacts with purchases:' AS status;
SELECT 
    first_name || ' ' || last_name AS name,
    email_address,
    total_purchased,
    stage,
    bought_package,
    attended,
    CASE 
        WHEN total_purchased >= 1400 AND bought_package = false THEN '❌ NEEDS FIX'
        WHEN total_purchased >= 1400 AND bought_package = true THEN '✅ CORRECT'
        WHEN total_purchased > 0 AND attended = false THEN '⚠️ CHECK'
        ELSE '✓ OK'
    END AS validation
FROM contacts
WHERE total_purchased > 0
ORDER BY total_purchased DESC;