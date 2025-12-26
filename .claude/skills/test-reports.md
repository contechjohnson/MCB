# Test Reports Skill

Send test weekly and/or monthly reports to verify they're working correctly.

## Usage

```
/test-reports weekly     # Send test weekly report
/test-reports monthly    # Send test monthly report
/test-reports both       # Send both reports
```

## What This Does

1. Runs the report script locally (NOT via cron)
2. Sends email to connor@columnline.com
3. Shows console output with metrics

## Commands

### Test Weekly Report
```bash
node execution/weekly-report.js
```

### Test Monthly Report
```bash
node execution/monthly-report.js
```

### Test Both
```bash
node execution/weekly-report.js && node execution/monthly-report.js
```

## Before Testing

Make sure Meta Ads data is synced:
```bash
node execution/sync-meta-ads.js
```

## Expected Output

**Weekly Report:**
- Week date range (e.g., "Dec 19-25")
- Leads, Purchased, Revenue totals
- Ad spend (7-day)
- Email sent confirmation

**Monthly Report:**
- 4-week breakdown
- Revenue trend
- Funnel totals
- Email sent confirmation

## Revenue Metrics Explained

| Metric | Definition | Source |
|--------|------------|--------|
| Cash Collected | Stripe + Denefits deposits + monthly installments | Actual cash in bank |
| Projected Revenue | Stripe + Denefits contract value (new contracts) | Total value from efforts |
| BNPL Deposits | Denefits downpayments only | Subset of Cash Collected |

## Troubleshooting

**Missing revenue?**
- Check `payment_source` values: should be 'stripe' or 'denefits'
- Check `payment_type` for Denefits: 'buy_now_pay_later' or 'monthly_payment'

**Wrong counts?**
- Reports count UNIQUE contacts per stage, not events
- Same contact clicking multiple times = 1 click

**Email not received?**
- Check Resend API key in .env.local
- Check spam folder
