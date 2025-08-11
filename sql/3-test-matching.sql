-- STEP 3: Test the matching between Stripe events and contacts
-- This simulates what the webhook would do

-- First, let's match the events to contacts by email
UPDATE stripe_webhook_logs swl
SET 
    matched_contact_id = c.user_id,
    match_confidence = 100,
    match_method = 'email',
    status = 'matched'
FROM contacts c
WHERE swl.customer_email = c.email_address
  AND swl.event_id LIKE 'evt_test_%'
  AND swl.matched_contact_id IS NULL;

-- Show matching results
SELECT 'Matching results:' AS status;
SELECT 
    swl.customer_name AS stripe_name,
    swl.customer_email AS stripe_email,
    swl.amount,
    swl.status AS event_status,
    c.first_name || ' ' || c.last_name AS matched_contact,
    c.email_address AS contact_email,
    CASE 
        WHEN swl.matched_contact_id IS NOT NULL THEN '✅ MATCHED'
        ELSE '❌ ORPHANED'
    END AS match_status
FROM stripe_webhook_logs swl
LEFT JOIN contacts c ON swl.matched_contact_id = c.user_id
WHERE swl.event_id LIKE 'evt_test_%'
ORDER BY swl.customer_name, swl.created_at;

-- Update contacts with purchase data based on matched events
-- Update first purchase dates
UPDATE contacts c
SET 
    first_purchase_date = subquery.first_purchase,
    first_purchase_amount = subquery.first_amount
FROM (
    SELECT 
        matched_contact_id,
        MIN(created_at) as first_purchase,
        (ARRAY_AGG(amount ORDER BY created_at))[1] as first_amount
    FROM stripe_webhook_logs
    WHERE matched_contact_id IS NOT NULL
      AND status = 'matched'
      AND amount <= 30
    GROUP BY matched_contact_id
) subquery
WHERE c.user_id = subquery.matched_contact_id
  AND c.first_purchase_date IS NULL;

-- Update package purchase dates (amounts > $30)
UPDATE contacts c
SET 
    package_purchase_date = subquery.package_purchase,
    package_purchase_amount = subquery.package_amount
FROM (
    SELECT 
        matched_contact_id,
        MIN(created_at) as package_purchase,
        MAX(amount) as package_amount
    FROM stripe_webhook_logs
    WHERE matched_contact_id IS NOT NULL
      AND status = 'matched'
      AND amount > 30
    GROUP BY matched_contact_id
) subquery
WHERE c.user_id = subquery.matched_contact_id;

-- Update total purchased amounts
UPDATE contacts c
SET total_purchased = subquery.total
FROM (
    SELECT 
        matched_contact_id,
        SUM(amount) as total
    FROM stripe_webhook_logs
    WHERE matched_contact_id IS NOT NULL
      AND status = 'matched'
    GROUP BY matched_contact_id
) subquery
WHERE c.user_id = subquery.matched_contact_id;

-- Show cycle time analytics after matching
SELECT 'Cycle Time Analytics (after matching):' AS status;
SELECT 
    first_name || ' ' || last_name AS name,
    subscription_date::date AS subscribed,
    first_purchase_date::date AS first_purchase,
    package_purchase_date::date AS package,
    total_purchased,
    CASE 
        WHEN first_purchase_date IS NOT NULL AND subscription_date IS NOT NULL 
        THEN EXTRACT(DAY FROM (first_purchase_date - subscription_date)) || ' days'
        ELSE 'N/A'
    END AS days_to_first_purchase,
    CASE 
        WHEN package_purchase_date IS NOT NULL AND first_purchase_date IS NOT NULL 
        THEN EXTRACT(DAY FROM (package_purchase_date - first_purchase_date)) || ' days'
        ELSE 'N/A'
    END AS days_to_package
FROM contacts
WHERE user_id LIKE 'test_%'
  AND total_purchased > 0
ORDER BY total_purchased DESC;

-- Show abandoned checkouts (hot leads)
SELECT 'Abandoned Checkouts (Hot Leads):' AS status;
SELECT 
    customer_name,
    customer_email,
    customer_phone,
    amount AS amount_attempted,
    status,
    abandonment_reason,
    EXTRACT(HOUR FROM (NOW() - abandoned_at)) || ' hours ago' AS time_since,
    CASE 
        WHEN EXTRACT(HOUR FROM (NOW() - abandoned_at)) < 1 THEN '🔥🔥🔥 SUPER HOT'
        WHEN EXTRACT(HOUR FROM (NOW() - abandoned_at)) < 24 THEN '🔥🔥 HOT'
        WHEN EXTRACT(HOUR FROM (NOW() - abandoned_at)) < 72 THEN '🔥 WARM'
        ELSE '🟡 COOLING'
    END AS urgency
FROM stripe_webhook_logs
WHERE event_id LIKE 'evt_test_%'
  AND status IN ('expired', 'bnpl_rejected', 'bnpl_pending')
ORDER BY abandoned_at DESC;

-- Summary statistics
SELECT 'Summary Statistics:' AS status;
SELECT 
    COUNT(DISTINCT matched_contact_id) AS matched_contacts,
    COUNT(DISTINCT CASE WHEN matched_contact_id IS NULL THEN customer_email END) AS orphaned_payments,
    COUNT(*) AS total_events,
    SUM(amount) AS total_revenue,
    AVG(amount) AS avg_transaction
FROM stripe_webhook_logs
WHERE event_id LIKE 'evt_test_%';