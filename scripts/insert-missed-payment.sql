-- Insert Missed Stripe Payment
-- Event ID: evt_3SRZFLCZF69l9Gkp0arGlxqB
-- Email: thetarrynleethomas@gmail.com
-- Amount: $1,196.00
-- Date: 2025-11-09T09:17:28Z

-- Step 1: Check if payment already exists
SELECT * FROM payments
WHERE payment_event_id = 'evt_3SRZFLCZF69l9Gkp0arGlxqB';
-- Expected: No rows (if this returns a row, payment already exists)

-- Step 2: Find contact by email
SELECT
  id,
  mc_id,
  ghl_id,
  first_name,
  last_name,
  email_primary,
  email_booking,
  email_payment,
  stage,
  phone,
  purchase_date,
  purchase_amount
FROM contacts
WHERE email_primary ILIKE 'thetarrynleethomas@gmail.com'
   OR email_booking ILIKE 'thetarrynleethomas@gmail.com'
   OR email_payment ILIKE 'thetarrynleethomas@gmail.com';
-- Expected: Should return the contact if exists
-- Copy the 'id' value for use in Step 3

-- Step 3: Insert payment record
-- REPLACE 'CONTACT_ID_HERE' with the actual contact ID from Step 2
-- Or use NULL if no contact was found
INSERT INTO payments (
  payment_source,
  payment_type,
  payment_event_id,
  contact_id,
  customer_email,
  customer_phone,
  amount,
  currency,
  status,
  payment_date,
  stripe_event_type,
  raw_payload
) VALUES (
  'stripe',
  'buy_in_full',
  'evt_3SRZFLCZF69l9Gkp0arGlxqB',
  'CONTACT_ID_HERE', -- Replace with actual UUID or NULL
  'thetarrynleethomas@gmail.com',
  '6029357075',
  1196.00,
  'usd',
  'succeeded',
  '2025-11-09T09:17:28Z',
  'charge.succeeded',
  jsonb_build_object(
    'event_id', 'evt_3SRZFLCZF69l9Gkp0arGlxqB',
    'charge_id', 'ch_3SRZFLCZF69l9Gkp0CVayALS',
    'package', 'Returning Mom - Paid in Full',
    'note', 'Manually inserted from missed charge.succeeded event'
  )
)
RETURNING *;

-- Step 4: Update contact (only if contact was found in Step 2)
-- REPLACE 'CONTACT_ID_HERE' with the actual contact ID
UPDATE contacts
SET
  stage = 'purchased',
  purchase_date = '2025-11-09T09:17:28Z',
  purchase_amount = 1196.00,
  phone = COALESCE(phone, '6029357075'), -- Only set if currently NULL
  updated_at = NOW()
WHERE id = 'CONTACT_ID_HERE'
RETURNING
  id,
  first_name,
  last_name,
  email_primary,
  stage,
  purchase_date,
  purchase_amount;

-- Step 5: Verify insertion
SELECT
  p.id as payment_id,
  p.payment_event_id,
  p.amount,
  p.status,
  p.payment_date,
  p.contact_id,
  c.first_name,
  c.last_name,
  c.email_primary,
  c.stage
FROM payments p
LEFT JOIN contacts c ON p.contact_id = c.id
WHERE p.payment_event_id = 'evt_3SRZFLCZF69l9Gkp0arGlxqB';
