-- Add test Stripe events to verify matching and cycle time analytics

-- First, let's check what contacts we have to match against
SELECT user_id, first_name, last_name, email_address, subscription_date, first_purchase_date, package_purchase_date
FROM contacts 
WHERE email_address IN ('con.tech.johnson@gmail.com', 'lead3@example.com')
   OR first_name LIKE '%Connor%'
   OR first_name = 'Lead3';

-- Add test events for Connor Johnson
-- Successful payment (first purchase - $25)
INSERT INTO stripe_webhook_logs (
    event_id,
    event_type,
    checkout_session_id,
    status,
    customer_email,
    customer_name,
    amount,
    payment_method_type,
    created_at,
    raw_event
) VALUES 
(
    'evt_test_connor_1_' || extract(epoch from now())::text,
    'checkout.session.completed',
    'cs_test_connor_1',
    'matched',
    'con.tech.johnson@gmail.com',
    'Connor Johnson',
    25.00,
    'card',
    NOW() - INTERVAL '5 days',
    '{"test": true, "description": "First purchase - discovery call"}'::jsonb
),
-- Successful package purchase ($497) - 3 days after first purchase
(
    'evt_test_connor_2_' || extract(epoch from now())::text,
    'checkout.session.completed', 
    'cs_test_connor_2',
    'matched',
    'con.tech.johnson@gmail.com',
    'Connor Johnson',
    497.00,
    'card',
    NOW() - INTERVAL '2 days',
    '{"test": true, "description": "Package purchase"}'::jsonb
);

-- Add test events for Lead3 FromManyChat
-- First an abandoned checkout (expired without email)
INSERT INTO stripe_webhook_logs (
    event_id,
    event_type,
    checkout_session_id,
    status,
    customer_email,
    customer_name,
    amount,
    payment_method_type,
    abandonment_reason,
    abandoned_at,
    created_at,
    raw_event
) VALUES
(
    'evt_test_lead3_1_' || extract(epoch from now())::text,
    'checkout.session.expired',
    'cs_test_lead3_expired',
    'expired',
    'lead3@example.com',
    'Lead3 FromManyChat',
    30.00,
    'card',
    'checkout_timeout',
    NOW() - INTERVAL '3 days',
    NOW() - INTERVAL '3 days',
    '{"test": true, "description": "Abandoned checkout - expired"}'::jsonb
),
-- Then a successful payment after follow-up
(
    'evt_test_lead3_2_' || extract(epoch from now())::text,
    'checkout.session.completed',
    'cs_test_lead3_success',
    'matched',
    'lead3@example.com',
    'Lead3 FromManyChat',
    30.00,
    'card',
    NOW() - INTERVAL '1 day',
    '{"test": true, "description": "Successful after follow-up"}'::jsonb
);

-- Add a BNPL pending event for testing
INSERT INTO stripe_webhook_logs (
    event_id,
    event_type,
    checkout_session_id,
    status,
    customer_email,
    customer_name,
    customer_phone,
    amount,
    payment_method_type,
    abandonment_reason,
    abandoned_at,
    created_at,
    raw_event
) VALUES
(
    'evt_test_bnpl_' || extract(epoch from now())::text,
    'checkout.session.completed',
    'cs_test_bnpl_pending',
    'bnpl_pending',
    'sarah@example.com',
    'Sarah Johnson',
    '+1234567890',
    150.00,
    'klarna',
    'buy_now_pay_later_pending',
    NOW() - INTERVAL '6 hours',
    NOW() - INTERVAL '6 hours',
    '{"test": true, "description": "BNPL pending approval"}'::jsonb
);

-- Update the contacts to reflect these purchases if matching works
-- This simulates what the webhook would do
UPDATE contacts 
SET 
    first_purchase_date = NOW() - INTERVAL '5 days',
    first_purchase_amount = 25.00,
    package_purchase_date = NOW() - INTERVAL '2 days',
    package_purchase_amount = 497.00,
    total_purchased = 522.00,
    attended = true,
    bought_package = true,
    sent_package = true
WHERE email_address = 'con.tech.johnson@gmail.com';

UPDATE contacts
SET 
    first_purchase_date = NOW() - INTERVAL '1 day',
    first_purchase_amount = 30.00,
    total_purchased = 30.00,
    attended = true
WHERE email_address = 'lead3@example.com' OR first_name = 'Lead3';

-- Check the results
SELECT 'Test events added! Checking matches:' AS status;

SELECT 
    swl.customer_name,
    swl.customer_email,
    swl.amount,
    swl.status,
    swl.matched_contact_id,
    c.first_name || ' ' || c.last_name AS matched_contact_name
FROM stripe_webhook_logs swl
LEFT JOIN contacts c ON swl.matched_contact_id = c.user_id
WHERE swl.event_id LIKE 'evt_test_%'
ORDER BY swl.created_at DESC;

-- Check cycle time analytics for these contacts
SELECT 'Cycle time analytics:' AS status;

SELECT 
    first_name,
    last_name,
    subscription_date,
    first_purchase_date,
    package_purchase_date,
    CASE 
        WHEN first_purchase_date IS NOT NULL AND subscription_date IS NOT NULL 
        THEN EXTRACT(DAY FROM (first_purchase_date - subscription_date)) || ' days'
        ELSE 'N/A'
    END AS time_to_first_purchase,
    CASE 
        WHEN package_purchase_date IS NOT NULL AND first_purchase_date IS NOT NULL 
        THEN EXTRACT(DAY FROM (package_purchase_date - first_purchase_date)) || ' days'
        ELSE 'N/A'
    END AS time_to_package,
    total_purchased
FROM contacts
WHERE email_address IN ('con.tech.johnson@gmail.com', 'lead3@example.com')
   OR first_name IN ('Connor', 'Lead3');