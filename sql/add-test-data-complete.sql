-- Comprehensive test data for contacts and Stripe events
-- This creates contacts at different stages and matching Stripe events

-- First, create test contacts at different funnel stages
INSERT INTO contacts (
    user_id,
    mcid,
    first_name,
    last_name,
    email_address,
    phone_number,
    instagram_name,
    facebook_name,
    lead,
    lead_contact,
    sent_link,
    clicked_link,
    booked,
    attended,
    sent_package,
    bought_package,
    subscription_date,
    created_at,
    updated_at
) VALUES 
-- Stage: BOUGHT_PACKAGE - Completed full journey
(
    'test_bought_' || gen_random_uuid()::text,
    'mc_test_bought',
    'Emily',
    'Success',
    'emily.success@example.com',
    '+1234567890',
    'emily_success',
    'Emily Success',
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    NOW() - INTERVAL '30 days',
    NOW() - INTERVAL '30 days',
    NOW()
),
-- Stage: SENT_PACKAGE - Got package but hasn't bought (HOT LEAD!)
(
    'test_sent_pkg_' || gen_random_uuid()::text,
    'mc_test_sent_pkg',
    'Michael',
    'AlmostThere',
    'michael.almost@example.com',
    '+1234567891',
    'michael_almost',
    'Michael Almost',
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    false,  -- Didn't buy!
    NOW() - INTERVAL '25 days',
    NOW() - INTERVAL '25 days',
    NOW() - INTERVAL '2 days'
),
-- Stage: ATTENDED - Attended call but no package (HOT LEAD!)
(
    'test_attended_' || gen_random_uuid()::text,
    'mc_test_attended',
    'Sarah',
    'Interested',
    'sarah.interested@example.com',
    '+1234567892',
    'sarah_int',
    'Sarah Interested',
    true,
    true,
    true,
    true,
    true,
    true,
    false,
    false,
    NOW() - INTERVAL '20 days',
    NOW() - INTERVAL '20 days',
    NOW() - INTERVAL '5 days'
),
-- Stage: BOOKED - Booked but didn't attend (WARM LEAD)
(
    'test_booked_' || gen_random_uuid()::text,
    'mc_test_booked',
    'David',
    'NoShow',
    'david.noshow@example.com',
    '+1234567893',
    'david_ns',
    'David NoShow',
    true,
    true,
    true,
    true,
    true,
    false,  -- Didn't attend
    false,
    false,
    NOW() - INTERVAL '15 days',
    NOW() - INTERVAL '15 days',
    NOW() - INTERVAL '7 days'
),
-- Stage: CLICKED_LINK - Clicked but didn't book
(
    'test_clicked_' || gen_random_uuid()::text,
    'mc_test_clicked',
    'Jessica',
    'Curious',
    'jessica.curious@example.com',
    '+1234567894',
    'jess_curious',
    'Jessica Curious',
    true,
    true,
    true,
    true,
    false,  -- Didn't book
    false,
    false,
    false,
    NOW() - INTERVAL '10 days',
    NOW() - INTERVAL '10 days',
    NOW() - INTERVAL '8 days'
),
-- Stage: SENT_LINK - Got link but didn't click
(
    'test_sent_link_' || gen_random_uuid()::text,
    'mc_test_sent_link',
    'Robert',
    'Passive',
    'robert.passive@example.com',
    '+1234567895',
    'rob_passive',
    'Robert Passive',
    true,
    true,
    true,
    false,  -- Didn't click
    false,
    false,
    false,
    false,
    NOW() - INTERVAL '8 days',
    NOW() - INTERVAL '8 days',
    NOW() - INTERVAL '8 days'
),
-- Stage: LEAD_CONTACT - Has contact info
(
    'test_lead_contact_' || gen_random_uuid()::text,
    'mc_test_lead_contact',
    'Linda',
    'Prospect',
    'linda.prospect@example.com',
    '+1234567896',
    'linda_prospect',
    'Linda Prospect',
    true,
    true,
    false,
    false,
    false,
    false,
    false,
    false,
    NOW() - INTERVAL '5 days',
    NOW() - INTERVAL '5 days',
    NOW() - INTERVAL '5 days'
),
-- Stage: LEAD - Basic lead, no contact
(
    'test_lead_' || gen_random_uuid()::text,
    'mc_test_lead',
    'James',
    'Basic',
    null,  -- No email
    null,  -- No phone
    'james_basic',
    'James Basic',
    true,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    NOW() - INTERVAL '3 days',
    NOW() - INTERVAL '3 days',
    NOW() - INTERVAL '3 days'
)
ON CONFLICT (user_id) DO NOTHING;

-- Now add matching Stripe events for these contacts
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
-- Emily Success - Discovery call + Package purchase
(
    'evt_emily_1_' || extract(epoch from now())::text,
    'checkout.session.completed',
    'cs_emily_discovery',
    'matched',
    'emily.success@example.com',
    'Emily Success',
    30.00,
    'card',
    NOW() - INTERVAL '28 days',
    '{"test": true, "description": "Discovery call payment"}'::jsonb
),
(
    'evt_emily_2_' || extract(epoch from now())::text,
    'checkout.session.completed',
    'cs_emily_package',
    'matched',
    'emily.success@example.com',
    'Emily Success',
    1400.00,
    'card',
    NOW() - INTERVAL '20 days',
    '{"test": true, "description": "Package purchase - $1400"}'::jsonb
),
-- Michael AlmostThere - Discovery call only (no package yet - HOT!)
(
    'evt_michael_1_' || extract(epoch from now())::text,
    'checkout.session.completed',
    'cs_michael_discovery',
    'matched',
    'michael.almost@example.com',
    'Michael AlmostThere',
    30.00,
    'card',
    NOW() - INTERVAL '15 days',
    '{"test": true, "description": "Discovery call - attended but no package"}'::jsonb
),
-- Sarah Interested - Discovery call payment
(
    'evt_sarah_1_' || extract(epoch from now())::text,
    'checkout.session.completed',
    'cs_sarah_discovery',
    'matched',
    'sarah.interested@example.com',
    'Sarah Interested',
    30.00,
    'card',
    NOW() - INTERVAL '10 days',
    '{"test": true, "description": "Discovery call - attended"}'::jsonb
);

-- Add some abandoned checkout events
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
-- David NoShow - Started checkout but expired
(
    'evt_david_abandoned_' || extract(epoch from now())::text,
    'checkout.session.expired',
    'cs_david_expired',
    'expired',
    'david.noshow@example.com',
    'David NoShow',
    '+1234567893',
    30.00,
    'card',
    'checkout_timeout',
    NOW() - INTERVAL '7 days',
    NOW() - INTERVAL '7 days',
    '{"test": true, "description": "Started checkout but expired"}'::jsonb
),
-- Jessica Curious - BNPL rejected
(
    'evt_jessica_bnpl_' || extract(epoch from now())::text,
    'checkout.session.async_payment_failed',
    'cs_jessica_bnpl',
    'bnpl_rejected',
    'jessica.curious@example.com',
    'Jessica Curious',
    '+1234567894',
    1400.00,
    'afterpay',
    'buy_now_pay_later_declined',
    NOW() - INTERVAL '4 days',
    NOW() - INTERVAL '4 days',
    '{"test": true, "description": "BNPL rejected for package"}'::jsonb
),
-- Robert Passive - Currently has BNPL pending
(
    'evt_robert_bnpl_pending_' || extract(epoch from now())::text,
    'checkout.session.completed',
    'cs_robert_bnpl',
    'bnpl_pending',
    'robert.passive@example.com',
    'Robert Passive',
    '+1234567895',
    1400.00,
    'klarna',
    'buy_now_pay_later_pending',
    NOW() - INTERVAL '2 hours',
    NOW() - INTERVAL '2 hours',
    '{"test": true, "description": "BNPL pending approval"}'::jsonb
);

-- Update contacts with purchase data to match the events
UPDATE contacts 
SET 
    first_purchase_date = NOW() - INTERVAL '28 days',
    first_purchase_amount = 30.00,
    package_purchase_date = NOW() - INTERVAL '20 days',
    package_purchase_amount = 1400.00,
    total_purchased = 1430.00
WHERE email_address = 'emily.success@example.com';

UPDATE contacts
SET 
    first_purchase_date = NOW() - INTERVAL '15 days',
    first_purchase_amount = 30.00,
    total_purchased = 30.00
WHERE email_address = 'michael.almost@example.com';

UPDATE contacts
SET 
    first_purchase_date = NOW() - INTERVAL '10 days',
    first_purchase_amount = 30.00,
    total_purchased = 30.00
WHERE email_address = 'sarah.interested@example.com';

-- Verify the test data
SELECT 'Test contacts created at different stages:' AS status;
SELECT 
    first_name || ' ' || last_name AS name,
    email_address,
    stage,
    CASE 
        WHEN bought_package THEN 'Purchased'
        WHEN sent_package THEN '🔥🔥🔥 SENT PACKAGE - NO BUY'
        WHEN attended THEN '🔥🔥 ATTENDED - NO PACKAGE'
        WHEN booked THEN '🔥 BOOKED - NO SHOW'
        WHEN clicked_link THEN 'CLICKED - NO BOOK'
        WHEN sent_link THEN 'SENT LINK - NO CLICK'
        WHEN lead_contact THEN 'HAS CONTACT INFO'
        WHEN lead THEN 'BASIC LEAD'
        ELSE 'UNKNOWN'
    END AS status
FROM contacts
WHERE mcid LIKE 'mc_test_%'
ORDER BY 
    CASE 
        WHEN bought_package THEN 8
        WHEN sent_package THEN 7
        WHEN attended THEN 6
        WHEN booked THEN 5
        WHEN clicked_link THEN 4
        WHEN sent_link THEN 3
        WHEN lead_contact THEN 2
        WHEN lead THEN 1
        ELSE 0
    END DESC;

-- Check Stripe events
SELECT 'Stripe events created:' AS status;
SELECT 
    customer_name,
    customer_email,
    amount,
    status,
    abandonment_reason,
    created_at
FROM stripe_webhook_logs
WHERE event_id LIKE 'evt_%test%' OR event_id LIKE 'evt_emily%' OR event_id LIKE 'evt_michael%'
ORDER BY created_at DESC
LIMIT 20;