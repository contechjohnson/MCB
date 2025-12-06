# Payment Reconciliation Directive

**Purpose:** Verify payments from Stripe/Denefits CSVs exist in database and are properly linked to contacts.

**Trigger:** User says "check payments", "reconcile payments", "did these payments go through", or provides a payment CSV.

**Last Updated:** December 2025

---

## Quick Start

```bash
# Reconcile Stripe payments
node execution/reconcile-payments.js --stripe path/to/stripe.csv

# Reconcile Denefits contracts
node execution/reconcile-payments.js --denefits path/to/denefits.csv

# Reconcile both
node execution/reconcile-payments.js --stripe stripe.csv --denefits denefits.csv

# Use default location (import/ folder)
node execution/reconcile-payments.js --stripe import/stripe_payments.csv
```

Or use slash command:
```
/reconcile-payments
```

---

## What This Does

For each payment in the CSV:

1. **Check if payment exists** in `payments` table (by payment_event_id)
2. **Check if email exists** in `contacts` table
3. **Identify orphan payments** - payment exists but no matching contact
4. **Identify missing payments** - in CSV but not in database
5. **Explain WHY** orphans exist (no email match, different email, etc.)

---

## CSV Formats

### Stripe Export (from Stripe Dashboard)

Download from: Stripe Dashboard → Payments → Export

Key columns:
```
id                    → payment_event_id (ch_xxx or py_xxx)
Customer Email        → primary email to match
email (metadata)      → fallback email (often more complete)
Amount                → payment amount
Status                → Paid, Failed, requires_payment_method
Created date (UTC)    → payment date
```

### Denefits Export

Download from: Denefits Dashboard → Contracts → Export

Key columns:
```
Payment Plan ID           → payment_event_id (e.g., BRKSZJ139062)
Customer Email            → email to match
Customer Name             → for reference
Payment Plan Amount       → total financed amount
Payment Plan Sign Up Date → contract date (MM/DD/YYYY)
Payment Plan Status       → Active, Completed, Overdue, Cancelled
```

---

## Sample Locations

Historical examples are in:
- `historical_data/stripe_unified_payments.csv`
- `historical_data/denefits_contracts.csv`

For new reconciliation, drop files in:
- `import/stripe_payments.csv`
- `import/denefits_contracts.csv`

---

## Output

The script outputs:

```
=== PAYMENT RECONCILIATION REPORT ===
Date: December 6, 2025
Tenant: ppcu

STRIPE PAYMENTS
---------------
Total in CSV: 50
Already in DB: 45
Missing from DB: 5
  - sophimaureen@gmail.com ($2,250) - NOT IN PAYMENTS TABLE
  - (4 more...)

Orphan Analysis (in payments but no contact):
  - 3 payments have no matching contact
  - Reasons:
    - 2: Email not in contacts table
    - 1: Different email used at checkout

DENEFITS CONTRACTS
------------------
Total in CSV: 20
Already in DB: 18
Missing from DB: 2
  - BRKSZJ139062 - bmca233@outlook.com ($3,296)
  - (1 more...)

RECOMMENDATIONS
---------------
1. Import 5 missing Stripe payments
2. Import 2 missing Denefits contracts
3. Investigate 3 orphan payments (no contact match)
```

---

## Common Scenarios

### Scenario 1: Payment in CSV but not in database
**Cause:** Webhook didn't fire or failed silently
**Fix:** Script can auto-import if you add `--import` flag

### Scenario 2: Payment exists but no contact match
**Cause:** Customer used different email at checkout vs ManyChat
**Fix:** Manually link by updating `payments.contact_id` or merge contacts

### Scenario 3: Everything matches
**Result:** You're good! System is working properly.

---

## Troubleshooting

### "Email not found in contacts"
The customer's checkout email doesn't match any contact:
- Check for typos
- Check if they used work vs personal email
- May be a direct purchase (skipped funnel)

### "Different email at checkout"
Customer exists but used different email for payment:
- Cross-reference phone number
- Check name match
- Consider merging contact records

### "Webhook never received"
Payment is in Stripe but not in webhook_logs:
- Check Stripe webhook settings
- Verify endpoint URL is correct
- Check for SSL/firewall issues

---

## Integration with Webhooks

Live payments should come through webhooks automatically:
- Stripe: `/api/webhooks/ppcu/stripe`
- Denefits: `/api/webhooks/ppcu/denefits`

This reconciliation is for:
- Catching missed webhooks
- Historical data import
- Periodic audits
- Troubleshooting payment issues

---

## Self-Annealing Log

### December 2025
- Created directive and script
- Supports both Stripe and Denefits CSV formats
- Multi-tenant aware (uses tenant_id)

---

## Related

- `directives/webhooks.md` - How payments arrive via webhooks
- `execution/reconcile-payments.js` - The actual script
- `historical_data/STRIPE_ANALYSIS.md` - Stripe CSV format details
- `historical_data/DENEFITS_ANALYSIS.md` - Denefits CSV format details
