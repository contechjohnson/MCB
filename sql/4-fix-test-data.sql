-- STEP 4: Fix test data issues
-- Update stages, last_interaction_date, and verify purchases

-- First, set last_interaction_date for all test contacts
-- This represents their most recent activity
UPDATE contacts
SET last_interaction_date = GREATEST(
    subscription_date,
    COALESCE(first_purchase_date, subscription_date),
    COALESCE(package_purchase_date, subscription_date),
    updated_at
)
WHERE user_id LIKE 'test_%';

-- Update specific stages based on what they've actually done
-- The trigger should handle this, but let's force it
UPDATE contacts
SET stage = 'BOUGHT_PACKAGE'
WHERE user_id LIKE 'test_%' 
  AND bought_package = true;

UPDATE contacts  
SET stage = 'SENT_PACKAGE'
WHERE user_id LIKE 'test_%'
  AND sent_package = true
  AND bought_package = false;

UPDATE contacts
SET stage = 'ATTENDED'
WHERE user_id LIKE 'test_%'
  AND attended = true
  AND sent_package = false
  AND bought_package = false;

-- Check Connor and Lead3 specifically
SELECT 'Connor and Lead3 Status Check:' AS status;
SELECT 
    user_id,
    first_name || ' ' || last_name AS name,
    email_address,
    stage,
    attended,
    sent_package,
    bought_package,
    total_purchased,
    first_purchase_date::date,
    package_purchase_date::date
FROM contacts
WHERE user_id IN ('test_connor', 'test_lead3');

-- Update Connor to show he bought package (based on his $1,930 in purchases)
UPDATE contacts
SET 
    bought_package = true,
    sent_package = true,
    stage = 'BOUGHT_PACKAGE'
WHERE user_id = 'test_connor'
  AND total_purchased > 1400;

-- Update Lead3 - attended but didn't buy package ($1,400 attempted but only $30 actual)
UPDATE contacts
SET 
    bought_package = false,
    stage = 'ATTENDED'
WHERE user_id = 'test_lead3';

-- Update all test contacts' stages based on their actual purchases
UPDATE contacts c
SET 
    bought_package = CASE 
        WHEN c.total_purchased >= 1400 THEN true 
        ELSE false 
    END,
    stage = CASE
        WHEN c.total_purchased >= 1400 THEN 'BOUGHT_PACKAGE'
        WHEN c.attended = true THEN 'ATTENDED'
        WHEN c.booked = true THEN 'BOOKED'
        WHEN c.clicked_link = true THEN 'CLICKED_LINK'
        WHEN c.sent_link = true THEN 'SENT_LINK'
        WHEN c.lead_contact = true THEN 'LEAD_CONTACT'
        WHEN c.lead = true THEN 'LEAD'
        ELSE 'NO_STAGE'
    END
FROM (
    SELECT 
        matched_contact_id,
        SUM(amount) as total_paid
    FROM stripe_webhook_logs
    WHERE matched_contact_id IS NOT NULL
      AND status = 'matched'
    GROUP BY matched_contact_id
) payments
WHERE c.user_id = payments.matched_contact_id
  AND c.user_id LIKE 'test_%';

-- Show updated hot leads (should NOT include people who bought package)
SELECT 'Hot Leads (after fix):' AS status;
SELECT 
    first_name || ' ' || last_name AS name,
    email_address,
    phone_number,
    stage,
    total_purchased,
    CASE 
        WHEN sent_package = true AND bought_package = false THEN '🔥🔥🔥 SENT PACKAGE - NO BUY!'
        WHEN attended = true AND sent_package = false THEN '🔥🔥 ATTENDED - NO PACKAGE!'
        WHEN booked = true AND attended = false THEN '🔥 BOOKED - NO SHOW'
        WHEN clicked_link = true THEN '🟡 CLICKED LINK'
        ELSE '📧 IN FUNNEL'
    END AS priority
FROM contacts
WHERE user_id LIKE 'test_%'
  AND bought_package = false  -- Exclude those who bought
  AND (email_address IS NOT NULL OR phone_number IS NOT NULL)
ORDER BY 
    CASE 
        WHEN sent_package = true THEN 1
        WHEN attended = true THEN 2
        WHEN booked = true THEN 3
        WHEN clicked_link = true THEN 4
        ELSE 5
    END;

-- Show cycle time metrics with proper last_interaction_date
SELECT 'Cycle Time Metrics (with last_interaction_date):' AS status;
SELECT 
    first_name || ' ' || last_name AS name,
    subscription_date::date AS subscribed,
    first_purchase_date::date AS first_purchase,
    package_purchase_date::date AS package_purchase,
    last_interaction_date::date AS last_interaction,
    CASE 
        WHEN first_purchase_date IS NOT NULL AND subscription_date IS NOT NULL 
        THEN EXTRACT(DAY FROM (first_purchase_date - subscription_date)) || ' days'
        ELSE 'N/A'
    END AS subscription_to_first,
    CASE 
        WHEN package_purchase_date IS NOT NULL AND first_purchase_date IS NOT NULL 
        THEN EXTRACT(DAY FROM (package_purchase_date - first_purchase_date)) || ' days'
        ELSE 'N/A'
    END AS first_to_package,
    CASE 
        WHEN package_purchase_date IS NOT NULL AND last_interaction_date IS NOT NULL 
        THEN EXTRACT(DAY FROM (package_purchase_date - last_interaction_date)) || ' days'
        ELSE 'N/A'
    END AS last_contact_to_package,
    CASE 
        WHEN package_purchase_date IS NOT NULL AND subscription_date IS NOT NULL 
        THEN EXTRACT(DAY FROM (package_purchase_date - subscription_date)) || ' days'
        ELSE 'N/A'
    END AS total_engagement_time
FROM contacts
WHERE user_id LIKE 'test_%'
  AND (first_purchase_date IS NOT NULL OR package_purchase_date IS NOT NULL)
ORDER BY total_purchased DESC;

-- Final check of all test contacts
SELECT 'All Test Contacts Final Status:' AS status;
SELECT 
    first_name || ' ' || last_name AS name,
    stage,
    bought_package,
    total_purchased,
    CASE 
        WHEN bought_package = true THEN '✅ COMPLETED JOURNEY'
        WHEN total_purchased > 0 THEN '💵 PARTIAL PURCHASE'
        ELSE '🎯 IN FUNNEL'
    END AS status
FROM contacts
WHERE user_id LIKE 'test_%'
ORDER BY total_purchased DESC;