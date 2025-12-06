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

**Funnel Stages (in order):**
1. Leads (subscribe_date)
2. Qualified (dm_qualified_date)
3. Link Clicked (link_click_date)
4. Form Submitted (form_submit_date)
5. Meeting Held (appointment_held_date)
6. Purchased (purchase_date)

**Note:** We do NOT track "Meeting Booked" - only "Meeting Held" matters.

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
- This week's funnel (horizontal bar chart)
- Key metrics: Leads, Purchased, Revenue
- Ad spend, CPL, CPA, ROAS
- Top 3 performing ads (by lead count)

**Schedule:** Every Thursday at 5 PM EST
**Cron:** `0 22 * * 4` (10 PM UTC = 5 PM EST)

---

## Monthly Report (4-Week Overview)

**What it shows:**
- Revenue trend chart (4 weeks)
- Funnel chart (4-week totals)
- Week-by-week breakdown table
- Ad metrics (CPL, CPA, ROAS)
- Conversion rates

**Schedule:** 1st of each month at 9 AM EST
**Cron:** `0 14 1 * *` (2 PM UTC = 9 AM EST)

---

## How Metrics Are Calculated

### Funnel (Activity-Based)
Each metric counts events that happened in the date range:
- **Leads:** `subscribe_date` in range
- **Qualified:** `dm_qualified_date` in range
- **Link Clicked:** `link_click_date` in range
- **Form Submitted:** `form_submit_date` in range
- **Meeting Held:** `appointment_held_date` in range
- **Purchased:** `purchase_date` in range

### Revenue
Sum of `payments.amount` where `payment_date` in range.

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

### Key Learning

**KEEP IT SIMPLE.** Don't overcomplicate with cohort analysis. Just answer:
- "What happened this week?"
- "What happened this month?"

Each metric queries its own date field. Period.

---

## Related

- `directives/meta-ads-sync.md` - Ad data sync
- `directives/analytics.md` - Query patterns
