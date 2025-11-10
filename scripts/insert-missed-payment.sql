-- Insert missed payment from charge.succeeded event (Nov 9, 2025)
-- Run this in Supabase SQL Editor

-- Step 1: Find contact by email
DO $$
DECLARE
  v_contact_id UUID;
  v_total_amount NUMERIC;
BEGIN
  -- Find contact (will be NULL if not found)
  SELECT find_contact_by_email('thetarrynleethomas@gmail.com') INTO v_contact_id;

  IF v_contact_id IS NULL THEN
    RAISE NOTICE 'No contact found for email thetarrynleethomas@gmail.com - creating orphan payment';
  ELSE
    RAISE NOTICE 'Contact found: %', v_contact_id;
  END IF;

  -- Insert payment
  INSERT INTO payments (
    contact_id,
    payment_event_id,
    payment_source,
    payment_type,
    customer_email,
    customer_name,
    customer_phone,
    amount,
    currency,
    status,
    payment_date,
    stripe_event_type,
    raw_payload
  ) VALUES (
    v_contact_id,
    'evt_3SRZFLCZF69l9Gkp0arGlxqB',
    'stripe',
    'buy_in_full',
    'thetarrynleethomas@gmail.com',
    '',
    '6029357075',
    1196.00,
    'usd',
    'paid',
    '2025-11-09T09:17:28Z'::TIMESTAMPTZ,
    'charge.succeeded',
    jsonb_build_object(
      'id', 'evt_3SRZFLCZF69l9Gkp0arGlxqB',
      'type', 'charge.succeeded',
      'charge_id', 'ch_3SRZFLCZF69l9Gkp0CVayALS',
      'amount', 119600,
      'metadata', jsonb_build_object(
        'package_id', '5',
        'patient_id', '1420',
        'package_name', 'Returning Mom - Paid in Full'
      )
    )
  );

  RAISE NOTICE 'Payment inserted successfully!';

  -- If contact found, update their purchase info
  IF v_contact_id IS NOT NULL THEN
    -- Calculate total from all payments
    SELECT COALESCE(SUM(amount), 0)
    INTO v_total_amount
    FROM payments
    WHERE contact_id = v_contact_id
      AND status IN ('paid', 'active');

    -- Update contact
    PERFORM update_contact_dynamic(
      v_contact_id,
      jsonb_build_object(
        'email_payment', 'thetarrynleethomas@gmail.com',
        'purchase_date', '2025-11-09T09:17:28Z',
        'purchase_amount', v_total_amount,
        'stage', 'purchased'
      )
    );

    RAISE NOTICE 'Contact updated with purchase: $%', v_total_amount;
  END IF;
END $$;

-- Verify insertion
SELECT
  id,
  contact_id,
  customer_email,
  amount,
  payment_date,
  stripe_event_type
FROM payments
WHERE payment_event_id = 'evt_3SRZFLCZF69l9Gkp0arGlxqB';
