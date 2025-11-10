# Insert Missed Stripe Payment - Instructions

## Summary

A Stripe `charge.succeeded` event was missed by the webhook. This document provides instructions to manually insert the payment into the database.

## Payment Details

- **Event ID**: evt_3SRZFLCZF69l9Gkp0arGlxqB
- **Charge ID**: ch_3SRZFLCZF69l9Gkp0CVayALS
- **Email**: thetarrynleethomas@gmail.com
- **Amount**: $1,196.00
- **Phone**: 6029357075
- **Payment Date**: 2025-11-09 09:17:28 UTC
- **Package**: Returning Mom - Paid in Full

---

## Option 1: Automated Transaction (Recommended)

**File**: `scripts/insert-missed-payment-transaction.sql`

This is the easiest method. It:
- Checks if payment already exists (aborts if it does)
- Finds the contact by email
- Inserts the payment
- Updates the contact (if found)
- Shows verification results

### Steps:

1. Open Supabase Dashboard → SQL Editor
2. Copy the contents of `insert-missed-payment-transaction.sql`
3. Paste into SQL Editor
4. Click "Run"
5. Check the results at the bottom

**Expected Output**:
```
NOTICE: Contact found: <uuid>
NOTICE: Payment inserted successfully
NOTICE: Contact updated successfully

[Table showing the inserted payment record]
```

**If contact not found**:
```
NOTICE: No contact found with email: thetarrynleethomas@gmail.com
NOTICE: Payment will be inserted as orphaned
NOTICE: Payment inserted successfully

[Table showing orphaned payment with contact_id = NULL]
```

---

## Option 2: Step-by-Step (Manual)

**File**: `scripts/insert-missed-payment.sql`

Use this if you want more control or want to verify each step.

### Steps:

1. **Check if payment exists**:
   ```sql
   SELECT * FROM payments
   WHERE payment_event_id = 'evt_3SRZFLCZF69l9Gkp0arGlxqB';
   ```
   - If returns a row: Payment already exists, stop here
   - If returns no rows: Continue

2. **Find contact**:
   ```sql
   SELECT id, first_name, last_name, email_primary, stage
   FROM contacts
   WHERE email_primary ILIKE 'thetarrynleethomas@gmail.com'
      OR email_booking ILIKE 'thetarrynleethomas@gmail.com'
      OR email_payment ILIKE 'thetarrynleethomas@gmail.com';
   ```
   - Copy the `id` value
   - If no rows: Contact doesn't exist (payment will be orphaned)

3. **Insert payment**:
   - Open `insert-missed-payment.sql`
   - Replace `'CONTACT_ID_HERE'` with the actual UUID from step 2
   - Or use `NULL` if no contact was found
   - Run the INSERT query

4. **Update contact** (only if contact was found):
   - Replace `'CONTACT_ID_HERE'` with the actual UUID
   - Run the UPDATE query

5. **Verify**:
   - Run the verification query at the end of the file

---

## Option 3: Node.js Script (If Network Access Available)

**File**: `scripts/insert-missed-payment.js`

**Note**: This requires network access to Supabase and may not work in sandboxed environments.

```bash
node scripts/insert-missed-payment.js
```

The script will:
- Check if payment exists
- Find contact by email
- Insert payment record
- Update contact if found
- Display detailed results

---

## What Gets Updated

### Payments Table
New record with:
- `payment_source`: 'stripe'
- `payment_type`: 'buy_in_full'
- `amount`: 1196.00
- `status`: 'succeeded'
- `payment_date`: 2025-11-09T09:17:28Z
- `contact_id`: UUID or NULL (if orphaned)

### Contacts Table (if found)
Updated fields:
- `stage`: 'purchased'
- `purchase_date`: 2025-11-09T09:17:28Z
- `purchase_amount`: 1196.00
- `phone`: 6029357075 (only if currently NULL)
- `updated_at`: NOW()

---

## Verification Queries

### Check payment was inserted:
```sql
SELECT * FROM payments
WHERE payment_event_id = 'evt_3SRZFLCZF69l9Gkp0arGlxqB';
```

### Check contact was updated:
```sql
SELECT id, first_name, last_name, email_primary, stage, purchase_date, purchase_amount
FROM contacts
WHERE email_primary ILIKE 'thetarrynleethomas@gmail.com'
   OR email_booking ILIKE 'thetarrynleethomas@gmail.com'
   OR email_payment ILIKE 'thetarrynleethomas@gmail.com';
```

### Check linkage:
```sql
SELECT
  p.payment_event_id,
  p.amount,
  p.contact_id IS NOT NULL as is_linked,
  c.first_name,
  c.last_name,
  c.stage
FROM payments p
LEFT JOIN contacts c ON p.contact_id = c.id
WHERE p.payment_event_id = 'evt_3SRZFLCZF69l9Gkp0arGlxqB';
```

---

## Troubleshooting

### "Payment already exists"
- The payment has already been inserted
- No action needed
- Verify with: `SELECT * FROM payments WHERE payment_event_id = 'evt_3SRZFLCZF69l9Gkp0arGlxqB';`

### "No contact found"
- The email address doesn't match any contact in the database
- Payment will be orphaned (contact_id = NULL)
- This is okay - the payment is still recorded
- The contact might be created later by a different webhook

### "Duplicate key error"
- Payment already exists
- Use verification queries to check current state

### "Foreign key constraint error"
- Invalid contact_id provided
- Double-check the UUID from the contact lookup
- Or use NULL to create orphaned payment

---

## Files Created

1. **insert-missed-payment-transaction.sql** - Automated transaction (recommended)
2. **insert-missed-payment.sql** - Step-by-step manual SQL
3. **insert-missed-payment.js** - Node.js script (may not work in sandboxed env)
4. **INSERT_MISSED_PAYMENT_INSTRUCTIONS.md** - This file

---

## Next Steps After Insertion

1. Verify payment was inserted correctly
2. Verify contact was updated (if found)
3. Check if payment is linked or orphaned
4. Update any reports or dashboards that might need refreshing
5. Investigate why the webhook missed this event (check webhook logs)

---

## Questions?

- Check `DATABASE_SCHEMA.md` for schema details
- Check `CLAUDE.md` for general project guidance
- Check `CURRENT_STATUS.md` for system status
