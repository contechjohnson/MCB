---
name: funnel-report
description: Generate comprehensive funnel/revenue report with full attribution breakdown. Use when asked for "funnel report", "full report", "revenue breakdown", "attribution report", "purchase breakdown", or "meetings by funnel".
---

# Funnel Report Skill

Generate comprehensive funnel/revenue report with full attribution breakdown.

## Usage

```
/funnel-report                    # Current week (Mon-Sun)
/funnel-report last 7 days        # Last 7 days
/funnel-report last 30 days       # Last 30 days
/funnel-report january 2026       # Specific month
```

## What This Report Shows

1. **Form Submissions by Funnel** - Who submitted discovery forms and from which funnel
2. **Meetings Held by Funnel** - Meetings with inferred source for unknowns
3. **New Buyers by Funnel** - Actual new purchases (excluding recurring)
4. **Purchase Type Breakdown** - Full Pay vs Deposit vs BNPL
5. **Revenue Summary** - Cash Collected vs Projected Revenue
6. **Attribution Notes** - Caveats about data quality

## Implementation

Use the analytics-agent or supabase-expert subagent to run these queries.

### 1. Form Submissions by Funnel

```sql
SELECT
  CASE
    WHEN COALESCE(c.tags->>'funnel', '') != '' THEN c.tags->>'funnel'
    WHEN c.mc_id IS NOT NULL THEN 'ManyChat (no form)'
    WHEN c.ad_id IS NOT NULL THEN 'Direct Ad (no form)'
    ELSE 'Other/Unknown'
  END as funnel,
  COUNT(DISTINCT fe.contact_id) as form_submissions
FROM funnel_events fe
JOIN contacts c ON fe.contact_id = c.id
WHERE fe.event_type = 'form_submitted'
  AND fe.event_timestamp >= '[START_DATE]'
  AND fe.event_timestamp < '[END_DATE]'
  AND c.source != 'instagram_historical'
GROUP BY
  CASE
    WHEN COALESCE(c.tags->>'funnel', '') != '' THEN c.tags->>'funnel'
    WHEN c.mc_id IS NOT NULL THEN 'ManyChat (no form)'
    WHEN c.ad_id IS NOT NULL THEN 'Direct Ad (no form)'
    ELSE 'Other/Unknown'
  END
ORDER BY form_submissions DESC;
```

### 2. Meetings Held by Funnel

```sql
WITH meeting_contacts AS (
  SELECT DISTINCT fe.contact_id
  FROM funnel_events fe
  JOIN contacts c ON fe.contact_id = c.id
  WHERE fe.event_type = 'appointment_held'
    AND fe.event_timestamp >= '[START_DATE]'
    AND fe.event_timestamp < '[END_DATE]'
    AND c.source != 'instagram_historical'
)
SELECT
  CASE
    WHEN COALESCE(c.tags->>'funnel', '') != '' THEN c.tags->>'funnel'
    WHEN c.mc_id IS NOT NULL THEN 'ManyChat (no form)'
    WHEN c.ad_id IS NOT NULL THEN 'Direct Ad (no form)'
    ELSE 'Other/Unknown'
  END as funnel,
  COUNT(DISTINCT mc.contact_id) as meetings
FROM meeting_contacts mc
JOIN contacts c ON mc.contact_id = c.id
GROUP BY
  CASE
    WHEN COALESCE(c.tags->>'funnel', '') != '' THEN c.tags->>'funnel'
    WHEN c.mc_id IS NOT NULL THEN 'ManyChat (no form)'
    WHEN c.ad_id IS NOT NULL THEN 'Direct Ad (no form)'
    ELSE 'Other/Unknown'
  END
ORDER BY meetings DESC;
```

### 3. New Buyers by Funnel (Excluding Recurring)

```sql
WITH new_buyers AS (
  SELECT DISTINCT contact_id
  FROM payments
  WHERE payment_date >= '[START_DATE]'
    AND payment_date < '[END_DATE]'
    AND (
      (payment_source = 'stripe' AND payment_category IN ('full_purchase', 'deposit'))
      OR (payment_source = 'denefits' AND payment_category IN ('payment_plan', 'downpayment'))
    )
)
SELECT
  CASE
    WHEN COALESCE(c.tags->>'funnel', '') != '' THEN c.tags->>'funnel'
    WHEN c.mc_id IS NOT NULL THEN 'ManyChat (no form)'
    WHEN c.ad_id IS NOT NULL THEN 'Direct Ad (no form)'
    ELSE 'Other/Unknown'
  END as funnel,
  COUNT(DISTINCT nb.contact_id) as new_buyers
FROM new_buyers nb
JOIN contacts c ON nb.contact_id = c.id
GROUP BY
  CASE
    WHEN COALESCE(c.tags->>'funnel', '') != '' THEN c.tags->>'funnel'
    WHEN c.mc_id IS NOT NULL THEN 'ManyChat (no form)'
    WHEN c.ad_id IS NOT NULL THEN 'Direct Ad (no form)'
    ELSE 'Other/Unknown'
  END
ORDER BY new_buyers DESC;
```

### 4. Purchase Type Breakdown

```sql
SELECT
  CASE
    WHEN payment_source = 'stripe' AND payment_category = 'full_purchase' THEN 'Stripe Full Pay'
    WHEN payment_source = 'stripe' AND payment_category = 'deposit' THEN 'Stripe $100 Deposit'
    WHEN payment_source = 'denefits' AND payment_category = 'payment_plan' THEN 'Denefits BNPL (new)'
    WHEN payment_source = 'denefits' AND payment_category = 'downpayment' THEN 'Denefits Downpayment'
    WHEN payment_source = 'denefits' AND payment_category = 'recurring' THEN 'Denefits Recurring'
    ELSE 'Other'
  END as payment_type,
  COUNT(DISTINCT contact_id) as unique_contacts,
  COUNT(*) as transactions,
  SUM(amount) as total_amount
FROM payments
WHERE payment_date >= '[START_DATE]'
  AND payment_date < '[END_DATE]'
GROUP BY
  CASE
    WHEN payment_source = 'stripe' AND payment_category = 'full_purchase' THEN 'Stripe Full Pay'
    WHEN payment_source = 'stripe' AND payment_category = 'deposit' THEN 'Stripe $100 Deposit'
    WHEN payment_source = 'denefits' AND payment_category = 'payment_plan' THEN 'Denefits BNPL (new)'
    WHEN payment_source = 'denefits' AND payment_category = 'downpayment' THEN 'Denefits Downpayment'
    WHEN payment_source = 'denefits' AND payment_category = 'recurring' THEN 'Denefits Recurring'
    ELSE 'Other'
  END
ORDER BY total_amount DESC;
```

### 5. Revenue Summary

```sql
SELECT
  -- Cash Collected (actual money in bank)
  COALESCE(SUM(CASE
    WHEN payment_source = 'stripe' AND payment_category IN ('full_purchase', 'deposit') THEN amount
    WHEN payment_source = 'denefits' AND payment_category IN ('downpayment', 'recurring') THEN amount
    ELSE 0
  END), 0) as cash_collected,

  -- Projected Revenue (total value from this period's efforts)
  COALESCE(SUM(CASE
    WHEN payment_source = 'stripe' AND payment_category = 'full_purchase' THEN amount
    WHEN payment_source = 'denefits' AND payment_category = 'payment_plan' THEN amount
    ELSE 0
  END), 0) as projected_revenue,

  -- Breakdown
  COALESCE(SUM(CASE WHEN payment_source = 'stripe' AND payment_category = 'full_purchase' THEN amount ELSE 0 END), 0) as stripe_full,
  COALESCE(SUM(CASE WHEN payment_source = 'stripe' AND payment_category = 'deposit' THEN amount ELSE 0 END), 0) as stripe_deposits,
  COALESCE(SUM(CASE WHEN payment_source = 'denefits' AND payment_category = 'payment_plan' THEN amount ELSE 0 END), 0) as denefits_contracts,
  COALESCE(SUM(CASE WHEN payment_source = 'denefits' AND payment_category IN ('downpayment', 'recurring') THEN amount ELSE 0 END), 0) as denefits_cash
FROM payments
WHERE payment_date >= '[START_DATE]'
  AND payment_date < '[END_DATE]';
```

## Report Format

Present results in this format:

```markdown
## Funnel Report: [DATE RANGE]

### Form Submissions by Funnel
| Funnel | Forms |
|--------|-------|
| LVNG_TOFMOFBOF_Calendly | 85 |
| LVNG_BOF_JANE | 72 |
| ManyChat (no form) | 15 |

### Meetings Held by Funnel
| Funnel | Meetings |
|--------|----------|
| LVNG_TOFMOFBOF_Calendly | 30 |
| LVNG_BOF_JANE | 18 |
| ManyChat (no form) | 6 |

### New Buyers by Funnel (Excluding Recurring)
| Funnel | Buyers |
|--------|--------|
| LVNG_TOFMOFBOF_Calendly | 12 |
| LVNG_BOF_JANE | 8 |
| ManyChat (no form) | 4 |

### Purchase Type Breakdown
| Type | Contacts | Transactions | Amount |
|------|----------|--------------|--------|
| Stripe Full Pay | 8 | 8 | $X,XXX |
| Stripe $100 Deposit | 14 | 14 | $1,400 |
| Denefits BNPL (new) | 5 | 5 | $X,XXX |
| Denefits Recurring | 21 | 45 | $X,XXX |

### Revenue Summary
- **Cash Collected:** $XX,XXX (Stripe + Denefits cash in bank)
- **Projected Revenue:** $XX,XXX (Stripe full + Denefits contract value)

### Attribution Notes
- "ManyChat (no form)" = Contacts with mc_id but empty funnel tag
- "Direct Ad (no form)" = Contacts with ad_id but no mc_id, empty funnel tag
- Recurring payments are from existing customers, not new buyers
```

## Key Definitions

| Term | Definition |
|------|------------|
| **New Buyer** | Contact who paid for first time (Stripe full/deposit OR Denefits new plan) |
| **Recurring** | Existing Denefits customer making monthly payment |
| **Cash Collected** | Actual money received (Stripe + Denefits deposits + recurring) |
| **Projected Revenue** | Total value from efforts (Stripe full + Denefits contract value) |
| **ManyChat (no form)** | Has mc_id but never submitted Perspective form |
| **Direct Ad (no form)** | Has ad_id, no mc_id, never submitted form |

## Funnel Name Mappings

Known funnel renames (treat as same):
- `LVNG_BOF_Calendly` = `LVNG_TOFMOFBOF_Calendly` (renamed)

## GHL Verification (Optional)

For pipeline meeting counts, use `/ghl-pipelines ppcu` then `/ghl-meetings`:
- Jane meetings: Lead-to-Patient Pipeline > "Scheduled in Jane"
- Calendly meetings: Lead-to-Patient Pipeline > "Scheduled In Calendly"

Supabase is primary source; GHL is for verification only.

## Caveats

1. **Over-attribution to ManyChat**: Contacts created from Stripe webhook (without Perspective form) inherit mc_id if they were ever a ManyChat subscriber. This may over-count ManyChat attribution.

2. **Empty funnel tags**: ~1,593 contacts have empty tags. These are typically:
   - Older leads before tagging was implemented
   - Contacts created from GHL forms (not Perspective)
   - Contacts created from Stripe webhook directly

3. **Recurring vs New**: Always exclude `payment_category = 'recurring'` when counting new buyers.

## Self-Annealing Log

| Date | Issue | Resolution |
|------|-------|------------|
| 2026-01-07 | 39 purchases included recurring | Filter to exclude recurring payments |
| 2026-01-07 | 7 "unknown" buyers | Infer source from mc_id/ad_id |
| 2026-01-07 | Funnel name confusion | Document LVNG_BOF = LVNG_TOFMOFBOF rename |
