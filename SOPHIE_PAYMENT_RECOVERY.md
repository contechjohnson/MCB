# Sophie's Payment Recovery - Nov 5, 2025

## Summary

Successfully recovered and manually reprocessed Sophie's Stripe payment that was received via webhook but not processed due to the old `stripe_events` table schema.

## The Issue

- Sophie's payment webhook was received on Nov 5, 2025 at 2:04 PM UTC
- Webhook was logged in `webhook_logs` table with status "received"
- Payment was NOT processed into the `payments` table because:
  - Stripe webhook was still using old `stripe_events` table
  - Code had not been updated to use new `payments` table

## The Fix

1. **Retrieved webhook log data**:
   - Found Sophie's `checkout.session.completed` event in `webhook_logs`
   - Event ID: `evt_1SQ7KACZF69l9GkpkKPMdoLO`

2. **Extracted payment details**:
   - Customer: Sophi Timm
   - Email: sophimaureen@gmail.com
   - Phone: +13096966541
   - Amount: $2,250.00
   - Status: paid
   - Payment Date: 2025-11-05 14:04:34 UTC
   - Stripe Session ID: `cs_live_a1SC0bWy0gwaeG2HUe01W3RoMDk32wPlcYgZVfb13mulvUoEJh2D1ozEib`

3. **Manually inserted into payments table**:
   - Payment ID: `b94d7cda-66ca-4624-b8a0-257a5b9cdbf8`
   - Payment Source: `stripe`
   - Payment Type: `buy_in_full`
   - Status: `paid`
   - Contact ID: NULL (orphan - no contact exists yet)

## Current Status

✅ **Payment is now in the database**
- Payment successfully inserted into `payments` table
- All fields populated correctly
- Raw webhook payload preserved for reference

⚠️ **Payment is orphaned**
- No contact record exists for sophimaureen@gmail.com
- Payment will remain with `contact_id = NULL` until:
  1. Contact is created via ManyChat webhook
  2. Contact is created via GHL webhook
  3. Contact is created manually
  4. Orphan linking function is run

## SQL Commands Used

### Query webhook logs
```sql
SELECT * FROM webhook_logs
WHERE source = 'stripe'
  AND event_type = 'checkout.session.completed'
ORDER BY created_at DESC
LIMIT 10;
```

### Insert payment
```sql
INSERT INTO payments (
  payment_event_id,
  payment_source,
  payment_type,
  customer_email,
  customer_name,
  customer_phone,
  amount,
  status,
  payment_date,
  stripe_event_type,
  stripe_customer_id,
  stripe_session_id,
  raw_payload
) VALUES (
  'evt_1SQ7KACZF69l9GkpkKPMdoLO',
  'stripe',
  'buy_in_full',
  'sophimaureen@gmail.com',
  'Sophi Timm',
  '+13096966541',
  2250.00,
  'paid',
  '2025-11-05T14:04:34Z',
  'checkout.session.completed',
  NULL,
  'cs_live_a1SC0bWy0gwaeG2HUe01W3RoMDk32wPlcYgZVfb13mulvUoEJh2D1ozEib',
  '{...full event payload...}'
);
```

### Verify payment
```sql
SELECT
  id,
  payment_event_id,
  payment_source,
  customer_email,
  customer_name,
  amount,
  status,
  payment_date,
  contact_id,
  created_at
FROM payments
WHERE customer_email = 'sophimaureen@gmail.com';
```

### Check for contact
```sql
SELECT
  id,
  first_name,
  last_name,
  email_primary,
  email_booking,
  email_payment
FROM contacts
WHERE email_primary ILIKE 'sophimaureen@gmail.com'
   OR email_booking ILIKE 'sophimaureen@gmail.com'
   OR email_payment ILIKE 'sophimaureen@gmail.com';
```

## Next Steps

### Option 1: Create Contact Manually
```sql
INSERT INTO contacts (
  first_name,
  last_name,
  email_primary,
  phone
) VALUES (
  'Sophi',
  'Timm',
  'sophimaureen@gmail.com',
  '+13096966541'
) RETURNING id;

-- Then link the payment
UPDATE payments
SET contact_id = '<returned_id>'
WHERE id = 'b94d7cda-66ca-4624-b8a0-257a5b9cdbf8';
```

### Option 2: Wait for Webhook
- ManyChat or GHL will create contact when Sophie interacts
- Automatic orphan linking will connect payment to contact

### Option 3: Use Orphan Linking Function
```sql
-- After contact is created
SELECT link_orphan_payments('sophimaureen@gmail.com');
```

## Files Created

- `/scripts/retrieve-sophie-payment.js` - Initial script to find payment
- `/scripts/debug-webhook-logs.js` - Debug webhook_logs structure
- `/scripts/check-webhook-log-schema.js` - Examine log entry schema
- `/scripts/insert-sophie-payment.js` - Manual payment insertion
- `/scripts/verify-sophie-payment.js` - Verify payment in database

## Lessons Learned

1. **Webhook logging worked perfectly**
   - Webhook was received and logged correctly
   - `webhook_logs` table preserved full payload

2. **Processing failed silently**
   - Stripe webhook was still using old `stripe_events` table
   - No error was logged (should add better error handling)

3. **Recovery was straightforward**
   - All data preserved in `webhook_logs`
   - Easy to extract and reprocess

4. **Orphan payments are fine**
   - Payment doesn't need immediate contact link
   - Can be linked retroactively when contact is created

## Verification

✅ Payment is in database
✅ All fields populated correctly
✅ Raw payload preserved
✅ Ready for contact linking when Sophie's contact is created

**Payment ID**: `b94d7cda-66ca-4624-b8a0-257a5b9cdbf8`
**Status**: Successfully recovered and stored
