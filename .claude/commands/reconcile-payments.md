---
description: Reconcile payments from Stripe/Denefits CSVs against database
---

Payment reconciliation for: $ARGUMENTS

## What This Does

Checks if payments from exported CSVs exist in the database and are properly linked to contacts.

## How to Use

1. **Get the CSV files:**
   - Stripe: Dashboard → Payments → Export
   - Denefits: Dashboard → Contracts → Export to CSV

2. **Place files in:**
   - `import/stripe_payments.csv`
   - `import/denefits_contracts.csv`
   - Or specify custom path in arguments

3. **Run reconciliation:**

```bash
# Stripe only
node execution/reconcile-payments.js --stripe import/stripe_payments.csv

# Denefits only
node execution/reconcile-payments.js --denefits import/denefits_contracts.csv

# Both
node execution/reconcile-payments.js --stripe import/stripe_payments.csv --denefits import/denefits_contracts.csv
```

## Arguments

- `stripe [path]` - Reconcile Stripe CSV
- `denefits [path]` - Reconcile Denefits CSV
- `both` - Reconcile both using default paths
- `historical` - Use historical_data/ files for testing

## Example

User: `/reconcile-payments stripe`
→ Runs: `node execution/reconcile-payments.js --stripe import/stripe_payments.csv`

User: `/reconcile-payments historical`
→ Runs against `historical_data/stripe_unified_payments.csv` and `historical_data/denefits_contracts.csv`

## See Also

- `directives/payment-reconciliation.md` - Full documentation
- `historical_data/STRIPE_ANALYSIS.md` - Stripe CSV format
- `historical_data/DENEFITS_ANALYSIS.md` - Denefits CSV format
