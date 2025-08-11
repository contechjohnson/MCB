-- Add test Stripe events specifically for Connor Johnson and Lead3

-- First check if these contacts exist
SELECT 'Checking for existing contacts:' AS status;
SELECT user_id, first_name, last_name, email_address 
FROM contacts 
WHERE email_address IN ('con.tech.johnson@gmail.com', 'lead3@example.com')
   OR first_name IN ('Connor', 'Lead3');

-- Add Connor Johnson if doesn't exist
INSERT INTO contacts (
    user_id,
    mcid,
    first_name,
    last_name,
    email_address,
    phone_number,
    instagram_name,
    lead,
    lead_contact,
    sent_link,
    clicked_link,
    booked,
    attended,
    subscription_date,
    created_at
) VALUES (
    'connor_' || gen_random_uuid()::text,
    'mc_connor',
    'Connor',
    'Johnson',
    'con.tech.johnson@gmail.com',
    '+1234567899',
    'connor_johnson',
    true,
    true,
    true,
    true,
    true,
    true,
    NOW() - INTERVAL '25 days',
    NOW() - INTERVAL '25 days'
) ON CONFLICT (email_address) DO NOTHING;

-- Add Lead3 if doesn't exist (update existing if needed)
UPDATE contacts 
SET email_address = 'lead3@example.com'
WHERE first_name = 'Lead3' AND email_address IS NULL;

-- Add Stripe events for Connor
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
-- Connor - Discovery call
(
    'evt_connor_disc_' || extract(epoch from now())::text,
    'checkout.session.completed',
    'cs_connor_discovery',
    'matched',
    'con.tech.johnson@gmail.com',
    'Connor Johnson',
    30.00,
    'card',
    NOW() - INTERVAL '15 days',
    '{"test": true, "description": "Connor discovery call"}'::jsonb
),
-- Connor - Package purchase
(
    'evt_connor_pkg_' || extract(epoch from now())::text,
    'checkout.session.completed',
    'cs_connor_package',
    'matched',
    'con.tech.johnson@gmail.com',
    'Connor Johnson',
    1400.00,
    'card',
    NOW() - INTERVAL '7 days',
    '{"test": true, "description": "Connor package purchase $1400"}'::jsonb
);

-- Add Stripe events for Lead3
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
-- Lead3 - Abandoned checkout first
(
    'evt_lead3_abandon_' || extract(epoch from now())::text,
    'checkout.session.expired',
    'cs_lead3_expired',
    'expired',
    'lead3@example.com',
    'Lead3 FromManyChat',
    30.00,
    'card',
    'checkout_timeout',
    NOW() - INTERVAL '5 days',
    NOW() - INTERVAL '5 days',
    '{"test": true, "description": "Lead3 abandoned checkout"}'::jsonb
);

-- Then successful purchase after follow-up
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
    'evt_lead3_success_' || extract(epoch from now())::text,
    'checkout.session.completed',
    'cs_lead3_success',
    'matched',
    'lead3@example.com',
    'Lead3 FromManyChat',
    30.00,
    'card',
    NOW() - INTERVAL '2 days',
    '{"test": true, "description": "Lead3 successful after follow-up"}'::jsonb
);

-- Update the abandoned checkout to show it converted
UPDATE stripe_webhook_logs
SET converted_at = NOW() - INTERVAL '2 days'
WHERE checkout_session_id = 'cs_lead3_expired';

-- Update Connor's contact record
UPDATE contacts 
SET 
    first_purchase_date = NOW() - INTERVAL '15 days',
    first_purchase_amount = 30.00,
    package_purchase_date = NOW() - INTERVAL '7 days',
    package_purchase_amount = 1400.00,
    total_purchased = 1430.00,
    bought_package = true,
    sent_package = true
WHERE email_address = 'con.tech.johnson@gmail.com';

-- Update Lead3's contact record
UPDATE contacts
SET 
    first_purchase_date = NOW() - INTERVAL '2 days',
    first_purchase_amount = 30.00,
    total_purchased = 30.00,
    attended = true
WHERE email_address = 'lead3@example.com' OR first_name = 'Lead3';

-- Match the Stripe events to contacts
UPDATE stripe_webhook_logs swl
SET matched_contact_id = c.user_id
FROM contacts c
WHERE swl.customer_email = c.email_address
  AND swl.matched_contact_id IS NULL;

-- Show results
SELECT 'Connor and Lead3 events added. Checking cycle times:' AS status;

SELECT 
    first_name,
    last_name,
    email_address,
    subscription_date::date AS subscribed,
    first_purchase_date::date AS first_purchase,
    package_purchase_date::date AS package_purchase,
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