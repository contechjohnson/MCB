-- Transaction to Insert Missed Stripe Payment
-- Run this in Supabase SQL Editor

BEGIN;

-- Find contact by email and store in temp variable
DO $$
DECLARE
  v_contact_id UUID;
  v_contact_exists BOOLEAN;
  v_payment_exists BOOLEAN;
BEGIN
  -- Check if payment already exists
  SELECT EXISTS (
    SELECT 1 FROM payments
    WHERE payment_event_id = 'evt_3SRZFLCZF69l9Gkp0arGlxqB'
  ) INTO v_payment_exists;

  IF v_payment_exists THEN
    RAISE NOTICE 'Payment already exists with event_id: evt_3SRZFLCZF69l9Gkp0arGlxqB';
    RAISE EXCEPTION 'Aborting: Payment already exists';
  END IF;

  -- Find contact by email
  SELECT id INTO v_contact_id
  FROM contacts
  WHERE email_primary ILIKE 'thetarrynleethomas@gmail.com'
     OR email_booking ILIKE 'thetarrynleethomas@gmail.com'
     OR email_payment ILIKE 'thetarrynleethomas@gmail.com'
  LIMIT 1;

  IF v_contact_id IS NULL THEN
    RAISE NOTICE 'No contact found with email: thetarrynleethomas@gmail.com';
    RAISE NOTICE 'Payment will be inserted as orphaned';
  ELSE
    RAISE NOTICE 'Contact found: %', v_contact_id;
  END IF;

  -- Insert payment
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
    v_contact_id,
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
  );

  RAISE NOTICE 'Payment inserted successfully';

  -- Update contact if found
  IF v_contact_id IS NOT NULL THEN
    UPDATE contacts
    SET
      stage = 'purchased',
      purchase_date = '2025-11-09T09:17:28Z',
      purchase_amount = 1196.00,
      phone = COALESCE(phone, '6029357075'),
      updated_at = NOW()
    WHERE id = v_contact_id;

    RAISE NOTICE 'Contact updated successfully';
  END IF;

END $$;

COMMIT;

-- Verify the insertion
SELECT
  p.id as payment_id,
  p.payment_event_id,
  p.amount,
  p.status,
  p.payment_date,
  p.contact_id,
  p.customer_email,
  c.first_name,
  c.last_name,
  c.email_primary,
  c.stage,
  c.purchase_amount
FROM payments p
LEFT JOIN contacts c ON p.contact_id = c.id
WHERE p.payment_event_id = 'evt_3SRZFLCZF69l9Gkp0arGlxqB';
