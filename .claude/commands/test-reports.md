---
description: Send test weekly and/or monthly email reports
---

Send test report emails to verify the email reports are working correctly.

## Usage

`/test-reports [weekly|monthly|both]`

Default: `both` if no argument provided.

## Commands to Run

Based on the argument:

### Weekly Only
```bash
node execution/weekly-report.js
```

### Monthly Only
```bash
node execution/monthly-report.js
```

### Both (default)
```bash
node execution/weekly-report.js
node execution/monthly-report.js
```

## What to Check

After running, verify in the console output:
- Revenue breakdown: Cash Collected, Projected Revenue, BNPL Deposits
- Funnel counts are UNIQUE contacts per stage
- Email sent confirmation with ID

## Expected Revenue Calculation

| Metric | Formula |
|--------|---------|
| Cash Collected | Stripe + Denefits deposits + monthly installments |
| Projected Revenue | Stripe + Denefits contract value (new BNPL only) |
| Total Revenue | = Projected Revenue (value from period's efforts) |
