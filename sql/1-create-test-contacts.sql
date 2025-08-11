-- STEP 1: Create test contacts at different funnel stages
-- Each will have purchases of at least $1,400

-- Clear any existing test contacts first
DELETE FROM contacts WHERE user_id LIKE 'test_%';

-- Create 8 test contacts at different stages
INSERT INTO contacts (
    user_id,
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
-- 1. BOUGHT_PACKAGE - Emily Success (completed full journey)
(
    'test_001',
    'Emily',
    'Success',
    'emily.success@example.com',
    '+14155551001',
    'emily_success',
    'Emily Success FB',
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    true,  -- Bought package!
    NOW() - INTERVAL '30 days',
    NOW() - INTERVAL '30 days',
    NOW()
),

-- 2. SENT_PACKAGE - Michael AlmostThere (got package but hasn't bought - HOTTEST!)
(
    'test_002',
    'Michael',
    'AlmostThere',
    'michael.almost@example.com',
    '+14155551002',
    'michael_almost',
    'Michael Almost FB',
    true,
    true,
    true,
    true,
    true,
    true,
    true,   -- Sent package
    false,  -- But didn't buy!
    NOW() - INTERVAL '25 days',
    NOW() - INTERVAL '25 days',
    NOW() - INTERVAL '2 days'
),

-- 3. ATTENDED - Sarah Interested (attended but no package yet - VERY HOT!)
(
    'test_003',
    'Sarah',
    'Interested',
    'sarah.interested@example.com',
    '+14155551003',
    'sarah_int',
    'Sarah Interested FB',
    true,
    true,
    true,
    true,
    true,
    true,   -- Attended
    false,  -- No package sent
    false,
    NOW() - INTERVAL '20 days',
    NOW() - INTERVAL '20 days',
    NOW() - INTERVAL '5 days'
),

-- 4. BOOKED - David NoShow (booked but didn't attend - WARM)
(
    'test_004',
    'David',
    'NoShow',
    'david.noshow@example.com',
    '+14155551004',
    'david_ns',
    'David NoShow FB',
    true,
    true,
    true,
    true,
    true,   -- Booked
    false,  -- Didn't attend
    false,
    false,
    NOW() - INTERVAL '15 days',
    NOW() - INTERVAL '15 days',
    NOW() - INTERVAL '7 days'
),

-- 5. CLICKED_LINK - Jessica Curious (clicked but didn't book)
(
    'test_005',
    'Jessica',
    'Curious',
    'jessica.curious@example.com',
    '+14155551005',
    'jess_curious',
    'Jessica Curious FB',
    true,
    true,
    true,
    true,   -- Clicked link
    false,  -- Didn't book
    false,
    false,
    false,
    NOW() - INTERVAL '10 days',
    NOW() - INTERVAL '10 days',
    NOW() - INTERVAL '8 days'
),

-- 6. SENT_LINK - Robert Passive (got link but didn't click)
(
    'test_006',
    'Robert',
    'Passive',
    'robert.passive@example.com',
    '+14155551006',
    'rob_passive',
    'Robert Passive FB',
    true,
    true,
    true,   -- Sent link
    false,  -- Didn't click
    false,
    false,
    false,
    false,
    NOW() - INTERVAL '8 days',
    NOW() - INTERVAL '8 days',
    NOW() - INTERVAL '8 days'
),

-- 7. LEAD_CONTACT - Linda Prospect (has contact info)
(
    'test_007',
    'Linda',
    'Prospect',
    'linda.prospect@example.com',
    '+14155551007',
    'linda_prospect',
    'Linda Prospect FB',
    true,
    true,   -- Has contact info
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

-- 8. LEAD - James Basic (basic lead, no contact yet)
(
    'test_008',
    'James',
    'Basic',
    null,   -- No email yet
    null,   -- No phone yet
    'james_basic',
    'James Basic FB',
    true,   -- Basic lead
    false,  -- No contact info
    false,
    false,
    false,
    false,
    false,
    false,
    NOW() - INTERVAL '3 days',
    NOW() - INTERVAL '3 days',
    NOW() - INTERVAL '3 days'
);

-- Also add Connor Johnson and Lead3
INSERT INTO contacts (
    user_id,
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
    bought_package,
    subscription_date,
    created_at
) VALUES 
(
    'test_connor',
    'Connor',
    'Johnson',
    'con.tech.johnson@gmail.com',
    '+14155551000',
    'connor_johnson',
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    NOW() - INTERVAL '35 days',
    NOW() - INTERVAL '35 days'
),
(
    'test_lead3',
    'Lead3',
    'FromManyChat',
    'lead3@example.com',
    '+14155551099',
    'lead3_manychat',
    true,
    true,
    true,
    true,
    true,
    true,
    false,  -- Attended but didn't buy package
    NOW() - INTERVAL '18 days',
    NOW() - INTERVAL '18 days'
)
ON CONFLICT (user_id) DO UPDATE SET
    email_address = EXCLUDED.email_address,
    phone_number = EXCLUDED.phone_number,
    updated_at = NOW();

-- Verify contacts were created
SELECT 'Test contacts created:' AS status;
SELECT 
    user_id,
    first_name || ' ' || last_name AS name,
    email_address,
    phone_number,
    CASE 
        WHEN bought_package THEN '✅ BOUGHT PACKAGE'
        WHEN sent_package THEN '🔥🔥🔥 SENT PACKAGE (NO BUY)'
        WHEN attended THEN '🔥🔥 ATTENDED (NO PACKAGE)'
        WHEN booked THEN '🔥 BOOKED (NO SHOW)'
        WHEN clicked_link THEN '🟡 CLICKED LINK'
        WHEN sent_link THEN '📧 SENT LINK'
        WHEN lead_contact THEN '📝 HAS CONTACT INFO'
        WHEN lead THEN '👤 BASIC LEAD'
        ELSE '❓ UNKNOWN'
    END AS funnel_stage
FROM contacts
WHERE user_id LIKE 'test_%'
ORDER BY created_at DESC;