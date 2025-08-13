# Weekly Business Metrics Tracker - Implementation Plan

## Overview
Build a weekly metrics dashboard that tracks key business KPIs from lead generation through sales, including ad spend ROI calculations.

## Data Architecture

### Data Sources & Availability

| Metric | Data Source | Status | Notes |
|--------|------------|--------|-------|
| **Scheduled DCs** | `contacts.booked = true` | ✅ Ready | Filter by `booking_date` for week |
| **Arrived DCs** | `contacts.attended = true` | ✅ Ready | Use GHL webhook `attended` stage |
| **Show Rate** | Calculation | ✅ Ready | `arrived / scheduled * 100` |
| **Closed** | `contacts.sent_package = true` | ✅ Ready | Package sent after call |
| **Close Rate** | Calculation | ✅ Ready | `closed / arrived * 100` |
| **Ad Spend** | Make.com webhook | 🔧 Setup Required | Daily Meta ad spend via webhook |
| **Ad Attributed DCs** | `contacts.paid_vs_organic = 'PAID'` | ⚠️ Needs Enhancement | Add "how_found_us" from GHL |
| **Ad Attributed Sales** | `contacts.bought_package = true AND paid_vs_organic = 'PAID'` | ✅ Ready | |
| **ROAS (Direct)** | Calculation | ✅ Ready | `ad_attributed_sales / ad_spend` |
| **Total Company Sales** | `contacts.total_purchased` or Stripe | ✅ Ready | Sum all purchases |
| **ROAS (Total)** | Calculation | ✅ Ready | `total_sales / ad_spend` |
| **Marketing Spend** | Manual Input | ❌ Owner Provides | Total marketing budget |
| **CAC** | Calculation | ⚠️ Partial | `marketing_spend / new_customers` |

## Database Schema Updates

### 1. Add "How Found Us" to Contacts
```sql
-- Add field for GHL "how did they find you" data
ALTER TABLE public.contacts 
ADD COLUMN IF NOT EXISTS how_found_us VARCHAR(255),
ADD COLUMN IF NOT EXISTS lead_source VARCHAR(100);

-- Update attribution logic
UPDATE public.contacts 
SET paid_vs_organic = 'PAID'
WHERE how_found_us ILIKE '%ad%' 
   OR how_found_us ILIKE '%facebook%'
   OR how_found_us ILIKE '%instagram%'
   OR trigger_word_tags IN ('55', 'expert', 'heal');
```

### 2. Ad Spend Tracking Table
```sql
CREATE TABLE IF NOT EXISTS public.ad_spend_daily (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  platform VARCHAR(50) DEFAULT 'meta',
  campaign_name VARCHAR(255),
  ad_account_id VARCHAR(100),
  spend DECIMAL(10,2) NOT NULL,
  impressions INT,
  clicks INT,
  conversions INT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ad_spend_date ON public.ad_spend_daily(date);
```

### 3. Weekly Metrics Snapshot Table
```sql
CREATE TABLE IF NOT EXISTS public.weekly_metrics (
  id SERIAL PRIMARY KEY,
  week_ending DATE NOT NULL UNIQUE,
  
  -- Core Metrics
  scheduled_dcs INT DEFAULT 0,
  arrived_dcs INT DEFAULT 0,
  show_rate DECIMAL(5,2),
  closed INT DEFAULT 0,
  close_rate DECIMAL(5,2),
  
  -- Ad Performance
  ad_spend DECIMAL(10,2),
  ad_attributed_dcs INT DEFAULT 0,
  ad_attributed_sales DECIMAL(10,2),
  ad_attributed_sales_count INT DEFAULT 0,
  roas_direct DECIMAL(5,2),
  
  -- Company Performance
  total_company_sales DECIMAL(10,2),
  total_sales_count INT DEFAULT 0,
  roas_total DECIMAL(5,2),
  
  -- Cost Metrics
  marketing_spend DECIMAL(10,2), -- Manual input
  cac DECIMAL(10,2),
  
  -- Metadata
  data_complete BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_weekly_metrics_week ON public.weekly_metrics(week_ending);
```

## Implementation Steps

### Phase 1: GHL Webhook Updates
**File:** `/app/api/ghl-webhook/route.ts`

Add to webhook processing:
```typescript
// Extract "how found us" field
const howFoundUs = payload.how_found_us || payload.lead_source || payload.referral_source;

// Update attribution logic
const isPaidLead = 
  howFoundUs?.toLowerCase().includes('ad') ||
  howFoundUs?.toLowerCase().includes('facebook') ||
  howFoundUs?.toLowerCase().includes('instagram') ||
  triggerWords.includes('55') ||
  triggerWords.includes('expert') ||
  triggerWords.includes('heal');

updateData.how_found_us = howFoundUs;
updateData.paid_vs_organic = isPaidLead ? 'PAID' : 'ORGANIC';
```

### Phase 2: Ad Spend Webhook
**New File:** `/app/api/ad-spend-webhook/route.ts`

Receives daily ad spend from Make.com:
```typescript
// Expected payload from Make.com
{
  "date": "2024-01-15",
  "spend": 523.45,
  "impressions": 12543,
  "clicks": 234,
  "campaign_name": "January Launch",
  "ad_account_id": "act_123456789"
}
```

### Phase 3: Weekly Metrics Calculator
**New File:** `/app/api/calculate-weekly-metrics/route.ts`

Runs every Saturday night (or on-demand):
1. Calculate week_ending date
2. Query contacts for the week
3. Sum ad spend for the week
4. Calculate all metrics
5. Upsert to weekly_metrics table

### Phase 4: Dashboard Page
**New File:** `/app/weekly-tracker/page.tsx`

Features:
- Table view with weeks as columns
- Editable marketing_spend field
- Auto-calculated metrics
- Export to CSV
- Trend visualizations

## Metric Calculations

### Week Definition
- Week ends on Saturday
- Metrics calculated for Saturday to Saturday period
- Example: Week ending Aug 3 = July 28 - Aug 3

### Attribution Logic
Contact is "Ad Attributed" if ANY of these are true:
1. `paid_vs_organic = 'PAID'`
2. `how_found_us` contains: 'ad', 'facebook', 'instagram', 'meta'
3. `trigger_word_tags` contains: '55', 'expert', 'heal'

### Key Calculations
```sql
-- Scheduled DCs (booked in the week)
SELECT COUNT(*) FROM contacts 
WHERE booked = true 
  AND booking_date >= week_start 
  AND booking_date < week_end;

-- Arrived DCs (attended in the week)
SELECT COUNT(*) FROM contacts 
WHERE attended = true 
  AND updated_at >= week_start 
  AND updated_at < week_end;

-- Ad Attributed Sales
SELECT SUM(total_purchased) FROM contacts 
WHERE bought_package = true 
  AND paid_vs_organic = 'PAID'
  AND updated_at >= week_start 
  AND updated_at < week_end;

-- ROAS Calculations
roas_direct = ad_attributed_sales / ad_spend
roas_total = total_company_sales / ad_spend
```

## API Endpoints

### 1. POST /api/ad-spend-webhook
- Receives daily ad spend from Make.com
- Validates and stores in ad_spend_daily table
- Returns success/failure status

### 2. GET /api/weekly-tracker-data
- Query params: `?weeks=4` (number of weeks to show)
- Returns weekly_metrics data
- Includes calculated fields

### 3. POST /api/calculate-weekly-metrics
- Body: `{ "week_ending": "2024-08-03" }`
- Calculates and stores metrics for specified week
- Can be triggered manually or via cron

### 4. PATCH /api/weekly-metrics/:week_ending
- Updates manual fields (marketing_spend, notes)
- Recalculates dependent metrics (CAC)

## Dashboard UI Design

```
Weekly Business Metrics
[Export CSV] [Refresh Data] [Add Manual Entry]

Week Ending:                3-Aug    10-Aug   17-Aug   24-Aug   [Avg]
----------------------------------------------------------------
FUNNEL METRICS
Scheduled DCs                  45       52       48       50      48.8
Arrived DCs                    38       44       41       43      41.5
Show Rate                    84.4%    84.6%    85.4%    86.0%    85.1%
Closed                         12       15       14       16      14.3
Close Rate                   31.6%    34.1%    34.1%    37.2%    34.3%

AD PERFORMANCE
Ad Spend                   $3,245   $3,512   $3,380   $3,445   $3,396
Ad Attributed DCs              32       38       35       37      35.5
Ad Attributed Sales        $24,500  $28,900  $26,700  $29,200  $27,325
ROAS (direct)                7.5x     8.2x     7.9x     8.5x     8.0x

COMPANY METRICS
Total Company Sales        $32,450  $38,200  $35,600  $37,800  $36,013
ROAS (total)                10.0x    10.9x    10.5x    11.0x    10.6x
Marketing Spend*           $4,500   $4,500   $4,500   $4,500   $4,500
CAC                          $375     $300     $321     $281     $315

* Editable field
```

## Tomorrow's Implementation Order

### Morning (Setup - 1 hour)
1. ✅ Run SQL migrations (create tables)
2. ✅ Update GHL webhook with how_found_us field
3. ✅ Test GHL webhook with new field

### Afternoon (Core Logic - 2 hours)
1. 🔧 Build ad-spend-webhook endpoint
2. 🔧 Build calculate-weekly-metrics function
3. 🔧 Test metric calculations with real data

### Evening (Dashboard - 2 hours)
1. 📊 Create weekly-tracker page
2. 📊 Add data table component
3. 📊 Add CSV export functionality
4. 📊 Deploy and test

## Testing Checklist

- [ ] GHL webhook captures how_found_us field
- [ ] Ad spend webhook accepts Make.com payload
- [ ] Weekly metrics calculate correctly
- [ ] Show rate and close rate percentages accurate
- [ ] ROAS calculations handle division by zero
- [ ] Dashboard loads historical data
- [ ] CSV export includes all fields
- [ ] Manual marketing_spend updates trigger CAC recalc

## Make.com Webhook Setup

1. Create new scenario in Make.com
2. Add Facebook Ads module
3. Set trigger: Daily at 11:55 PM
4. Add HTTP module to POST to:
   ```
   https://mcb-dun.vercel.app/api/ad-spend-webhook
   ```
5. Map fields:
   - date: {{formatDate(now; "YYYY-MM-DD")}}
   - spend: {{facebook.spend}}
   - impressions: {{facebook.impressions}}
   - clicks: {{facebook.clicks}}
   - campaign_name: {{facebook.campaign_name}}

## Notes & Considerations

1. **Attribution Conflicts**: If both trigger_word and how_found_us exist, trigger_word takes precedence
2. **Orphaned Payments**: Include in total_company_sales even if contact not found
3. **Week Boundaries**: Use Saturday 11:59 PM as week end
4. **Missing Data**: Show "-" for missing ad spend, "Manual Required" for marketing spend
5. **Historical Data**: Backfill from earliest booking_date in contacts table

## Future Enhancements

1. **Multi-channel Attribution**: Track Google Ads, TikTok, etc.
2. **Cohort Analysis**: Track customer LTV by acquisition week
3. **Predictive Metrics**: Forecast next week based on trends
4. **Automated Alerts**: Notify when ROAS drops below threshold
5. **A/B Test Tracking**: Compare performance by campaign/creative