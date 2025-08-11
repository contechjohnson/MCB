-- STEP 2: Create Stripe webhook events to test matching
-- Each contact will have at least $1,400 in total purchases

-- Clear any existing test events
DELETE FROM stripe_webhook_logs WHERE event_id LIKE 'evt_test_%';

-- Create Stripe events for each contact
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

-- 1. EMILY SUCCESS - Full journey ($30 discovery + $1,400 package = $1,430)
(
    'evt_test_emily_1',
    'checkout.session.completed',
    'cs_test_emily_discovery',
    'orphaned',  -- Will test matching
    'emily.success@example.com',
    'Emily Success',
    30.00,
    'card',
    NOW() - INTERVAL '28 days',
    '{"test": true, "description": "Emily discovery call"}'::jsonb
),
(
    'evt_test_emily_2',
    'checkout.session.completed',
    'cs_test_emily_package',
    'orphaned',  -- Will test matching
    'emily.success@example.com',
    'Emily Success',
    1400.00,
    'card',
    NOW() - INTERVAL '22 days',
    '{"test": true, "description": "Emily package purchase"}'::jsonb
),

-- 2. MICHAEL ALMOSTTHERE - Discovery + Package attempt ($30 + $1,400 attempted = $1,430)
(
    'evt_test_michael_1',
    'checkout.session.completed',
    'cs_test_michael_discovery',
    'orphaned',
    'michael.almost@example.com',
    'Michael AlmostThere',
    30.00,
    'card',
    NOW() - INTERVAL '20 days',
    '{"test": true, "description": "Michael discovery call"}'::jsonb
),
(
    'evt_test_michael_2',
    'checkout.session.completed',
    'cs_test_michael_package',
    'orphaned',
    'michael.almost@example.com',
    'Michael AlmostThere',
    1400.00,
    'card',
    NOW() - INTERVAL '10 days',
    '{"test": true, "description": "Michael package purchase"}'::jsonb
),

-- 3. SARAH INTERESTED - Discovery + Upsell ($30 + $1,400 = $1,430)
(
    'evt_test_sarah_1',
    'checkout.session.completed',
    'cs_test_sarah_discovery',
    'orphaned',
    'sarah.interested@example.com',
    'Sarah Interested',
    30.00,
    'card',
    NOW() - INTERVAL '15 days',
    '{"test": true, "description": "Sarah discovery call"}'::jsonb
),
(
    'evt_test_sarah_2',
    'checkout.session.completed',
    'cs_test_sarah_intensive',
    'orphaned',
    'sarah.interested@example.com',
    'Sarah Interested',
    1400.00,
    'card',
    NOW() - INTERVAL '10 days',
    '{"test": true, "description": "Sarah intensive program"}'::jsonb
),

-- 4. DAVID NOSHOW - Multiple attempts totaling $1,400+
(
    'evt_test_david_1',
    'checkout.session.completed',
    'cs_test_david_first',
    'orphaned',
    'david.noshow@example.com',
    'David NoShow',
    500.00,
    'card',
    NOW() - INTERVAL '12 days',
    '{"test": true, "description": "David first payment"}'::jsonb
),
(
    'evt_test_david_2',
    'checkout.session.completed',
    'cs_test_david_second',
    'orphaned',
    'david.noshow@example.com',
    'David NoShow',
    900.00,
    'card',
    NOW() - INTERVAL '8 days',
    '{"test": true, "description": "David second payment"}'::jsonb
);

-- Add abandoned checkout events for some contacts
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

-- 5. JESSICA CURIOUS - BNPL rejected for $1,400
(
    'evt_test_jessica_bnpl',
    'checkout.session.async_payment_failed',
    'cs_test_jessica_bnpl',
    'bnpl_rejected',
    'jessica.curious@example.com',
    'Jessica Curious',
    '+14155551005',
    1400.00,
    'afterpay',
    'buy_now_pay_later_declined',
    NOW() - INTERVAL '6 days',
    NOW() - INTERVAL '6 days',
    '{"test": true, "description": "Jessica BNPL rejected"}'::jsonb
),

-- 6. ROBERT PASSIVE - BNPL pending for $1,400
(
    'evt_test_robert_bnpl',
    'checkout.session.completed',
    'cs_test_robert_bnpl',
    'bnpl_pending',
    'robert.passive@example.com',
    'Robert Passive',
    '+14155551006',
    1400.00,
    'klarna',
    'buy_now_pay_later_pending',
    NOW() - INTERVAL '3 hours',
    NOW() - INTERVAL '3 hours',
    '{"test": true, "description": "Robert BNPL pending"}'::jsonb
),

-- 7. LINDA PROSPECT - Expired checkout for $1,400
(
    'evt_test_linda_expired',
    'checkout.session.expired',
    'cs_test_linda_expired',
    'expired',
    'linda.prospect@example.com',
    'Linda Prospect',
    '+14155551007',
    1400.00,
    'card',
    'checkout_timeout',
    NOW() - INTERVAL '4 days',
    NOW() - INTERVAL '4 days',
    '{"test": true, "description": "Linda checkout expired"}'::jsonb
);

-- Add events for Connor Johnson
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
    'evt_test_connor_1',
    'checkout.session.completed',
    'cs_test_connor_discovery',
    'orphaned',
    'con.tech.johnson@gmail.com',
    'Connor Johnson',
    30.00,
    'card',
    NOW() - INTERVAL '30 days',
    '{"test": true, "description": "Connor discovery"}'::jsonb
),
(
    'evt_test_connor_2',
    'checkout.session.completed',
    'cs_test_connor_package',
    'orphaned',
    'con.tech.johnson@gmail.com',
    'Connor Johnson',
    1400.00,
    'card',
    NOW() - INTERVAL '25 days',
    '{"test": true, "description": "Connor package"}'::jsonb
),
(
    'evt_test_connor_3',
    'checkout.session.completed',
    'cs_test_connor_addon',
    'orphaned',
    'con.tech.johnson@gmail.com',
    'Connor Johnson',
    500.00,
    'card',
    NOW() - INTERVAL '15 days',
    '{"test": true, "description": "Connor add-on service"}'::jsonb
);

-- Add events for Lead3
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
-- First an abandoned attempt
(
    'evt_test_lead3_abandoned',
    'checkout.session.expired',
    'cs_test_lead3_expired',
    'expired',
    'lead3@example.com',
    'Lead3 FromManyChat',
    1400.00,
    'card',
    'checkout_timeout',
    NOW() - INTERVAL '10 days',
    NOW() - INTERVAL '10 days',
    '{"test": true, "description": "Lead3 abandoned"}'::jsonb
);

-- Then successful purchases
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
    'evt_test_lead3_success',
    'checkout.session.completed',
    'cs_test_lead3_success',
    'orphaned',
    'lead3@example.com',
    'Lead3 FromManyChat',
    1400.00,
    'card',
    NOW() - INTERVAL '7 days',
    '{"test": true, "description": "Lead3 successful after follow-up"}'::jsonb
);

-- Show all test events created
SELECT 'Stripe test events created:' AS status;
SELECT 
    event_id,
    customer_name,
    customer_email,
    amount,
    status,
    event_type,
    created_at::date
FROM stripe_webhook_logs
WHERE event_id LIKE 'evt_test_%'
ORDER BY customer_name, created_at;

-- Show total amounts per customer
SELECT 'Total amounts per customer (for matching test):' AS status;
SELECT 
    customer_email,
    customer_name,
    COUNT(*) as num_events,
    SUM(CASE WHEN status NOT IN ('expired', 'bnpl_rejected') THEN amount ELSE 0 END) as total_paid,
    SUM(amount) as total_attempted
FROM stripe_webhook_logs
WHERE event_id LIKE 'evt_test_%'
GROUP BY customer_email, customer_name
ORDER BY customer_name;