# Directive: Weekly & Monthly Reports

> Two activity-based reports showing funnel performance and ad metrics.

**Status:** Active
**Scripts:** `execution/weekly-report.js`, `execution/monthly-report.js`
**Related:** `analytics.md`, `meta-ads-sync.md`

---

## Overview

**Two reports, simple activity-based metrics:**

| Report | Schedule | Scope | Script |
|--------|----------|-------|--------|
| Weekly | Every Thursday 5 PM EST | Single week snapshot | `weekly-report.js` |
| Monthly | 1st of month 9 AM EST | 4-week overview | `monthly-report.js` |

**Funnel Stages (from funnel_events):**
1. Leads (`contact_subscribed` + `contact_created` events)
2. Qualified (`dm_qualified` event)
3. Link Sent (`link_sent` event)
4. Link Clicked (`link_clicked` event)
5. Form Submitted (`form_submitted` event)
6. Meeting Held (`appointment_held` event) - Note: Only Calendly funnel, Jane skips this
7. Purchased (`purchase_completed` + `payment_plan_created` events)

**Architecture:** Events-first (Dec 2025) - queries `funnel_events` table, NOT contact date columns.

---

## Commands

| Intent | Command |
|--------|---------|
| Send weekly report | `node execution/weekly-report.js` |
| Send monthly report | `node execution/monthly-report.js` |
| Sync Meta Ads first | `node execution/sync-meta-ads.js` |

---

## Weekly Report

**What it shows:**
- This week's funnel (7 stages, horizontal bar chart)
- Key metrics: Leads, Meeting Held, Purchased
- Revenue breakdown: Cash Collected, Projected Revenue
- Revenue detail: Stripe (full), $100 Deposits (count), BNPL Recurring
- Ad spend, CPL, CPA, ROAS
- Top 3 performing ads (by meetings held)

**Schedule:** Every Thursday at 5 PM EST
**Cron:** `0 22 * * 4` (10 PM UTC = 5 PM EST)

---

## Monthly Report (4-Week Overview)

**What it shows:**
- Revenue breakdown: Cash Collected, Projected Revenue
- Revenue detail: Stripe (full), $100 Deposits (count), BNPL Recurring
- Revenue trend chart (4 weeks)
- Funnel chart (7 stages, 4-week totals)
- Week-by-week breakdown table
- Ad metrics (CPL, CPA, ROAS)
- Conversion rates

**Schedule:** 1st of each month at 9 AM EST
**Cron:** `0 14 1 * *` (2 PM UTC = 9 AM EST)

---

## How Metrics Are Calculated

### Funnel (Events-First Architecture)
Each metric counts DISTINCT contacts with that event in the date range:
```sql
SELECT COUNT(DISTINCT contact_id)
FROM funnel_events
WHERE event_type = 'form_submitted'
  AND event_timestamp BETWEEN start_date AND end_date
```

Event types:
- **Leads:** `contact_subscribed` OR `contact_created`
- **Qualified:** `dm_qualified`
- **Link Sent:** `link_sent`
- **Link Clicked:** `link_clicked`
- **Form Submitted:** `form_submitted`
- **Meeting Held:** `appointment_held` (not `meeting_held`)
- **Purchased:** `purchase_completed` OR `payment_plan_created`

### Revenue Breakdown
Revenue metrics from `payments` table using `payment_category`:

**Cash Collected** = Actual money in bank:
- Stripe full purchases (`payment_category = 'full_purchase'`)
- Stripe $100 deposits (`payment_category = 'deposit'`)
- Denefits downpayments (`payment_category = 'downpayment'`)
- Denefits recurring (`payment_category = 'recurring'`)

**Projected Revenue** = Total value from this period's efforts:
- Stripe full purchases (`payment_category = 'full_purchase'`)
- Denefits contract value (`payment_category = 'payment_plan'`)

**Email breakdown row shows:**
- Stripe (full purchases only)
- $100 Deposits (Stripe deposit count and total)
- BNPL Recurring (Denefits monthly installments)

### Ad Metrics
- **Ad Spend:** From `meta_ad_insights` table (7-day rolling spend)
- **CPL:** Ad Spend / Leads
- **CPA:** Ad Spend / Purchased
- **ROAS:** Revenue / Ad Spend

---

## Charts (QuickChart.io)

Both reports use QuickChart.io for email-safe images:
- Horizontal bar chart for funnel
- Vertical bar chart for revenue trend

**Why QuickChart?** Email clients strip SVG. QuickChart generates images via URL.

**Colors:**
- Primary: `#2563eb` (blue)
- Success: `#059669` (green)
- Funnel gradient: `#3b82f6` → `#065f46`

---

## Cron Setup (Vercel)

In `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/weekly-report",
      "schedule": "0 22 * * 4"
    },
    {
      "path": "/api/cron/monthly-report",
      "schedule": "0 14 1 * *"
    }
  ]
}
```

---

## Filter Rules

Always exclude:
```sql
WHERE source != 'instagram_historical'
```

This removes 537 imported historical contacts.

---

## Email Configuration

- **Service:** Resend API
- **From:** Clara Analytics <onboarding@resend.dev>
- **To:** connor@columnline.com (configurable)

---

## Self-Annealing Log

| Date | Issue | Resolution |
|------|-------|------------|
| 2025-12-06 | SVG charts not rendering in email | Switched to QuickChart.io |
| 2025-12-06 | Week labels said "Week 1-5" | Changed to date-based labels |
| 2025-12-06 | Cohort analysis showed wrong purchase counts | Simplified to pure activity-based |
| 2025-12-06 | "Meeting Booked" not useful | Removed, only track "Meeting Held" |
| 2025-12-06 | Too complex with cohort vs activity | Two simple reports, both activity-based |
| 2025-12-25 | Reports showed wrong lead/purchase counts | Production code wasn't deployed; backfilled events from webhook_logs |
| 2025-12-25 | Missing revenue breakdown | Added cash collected (Stripe), projected (Denefits), deposits (downpayments) |
| 2025-12-25 | `meeting_held` not in event constraint | Changed to `appointment_held` |
| 2025-12-25 | Funnel chart out of order, missing link_sent | Fixed order: Lead → Qualified → Link Sent → Clicked → Form → Meeting → Purchase |
| 2025-12-25 | `payment_category` null for all payments | Query by `payment_source` (stripe/denefits) instead |
| 2025-12-25 | Gmail collapsing email sections | `...` in ad names (e.g., "Ad ...500065") triggered Gmail's quoted content detection. Fixed by using "Ad #500065" |
| 2025-12-25 | Revenue breakdown needed Stripe deposits | Separated queries: Stripe full purchases vs $100 deposits. Email shows "$100 Deposits: $X (count)" instead of BNPL deposits |

### Key Learning

**KEEP IT SIMPLE.** Don't overcomplicate with cohort analysis. Just answer:
- "What happened this week?"
- "What happened this month?"

Each metric queries its own date field. Period.

---

## Related

- `directives/meta-ads-sync.md` - Ad data sync
- `directives/analytics.md` - Query patterns
