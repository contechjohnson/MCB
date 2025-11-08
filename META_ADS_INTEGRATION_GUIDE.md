# Meta Ads Integration Guide

**Complete guide to tracking ad performance, creative insights, and emotional transformation messaging**

---

## Overview

This system integrates Meta Ads data with your customer analytics to answer:
- **Which emotional transformations resonate most?** (Confusion→Clarity, Overwhelm→Relief)
- **Do symptom-specific ads have higher ROAS?** (Diastasis, pelvic floor, low milk supply)
- **Which creative formats perform best?** (Video vs image, long vs short copy)
- **What's the true ROAS by campaign?** (Revenue tracked through entire funnel)

---

## What Data We Capture

### Part 1: Ad Performance (All Active Ads)
```javascript
// Fetched from Meta Ads API
{
  ad_id: '120203452767890123',
  ad_name: 'Confusion to Clarity - Diastasis Story',
  campaign_id: 'xxx',
  adset_id: 'xxx',
  status: 'ACTIVE',

  // All-time performance (not just 7 days)
  spend: 1247.38,
  impressions: 45234,
  clicks: 892,
  reach: 32145,
  ctr: 1.97,
  cpc: 1.40,

  // Conversions
  link_clicks: 823,
  landing_page_views: 654,
  leads: 47,
  pixel_leads: 43,

  // Costs
  cost_per_lead: 26.54,
  cost_per_landing_page_view: 1.91
}
```

### Part 2: Creative Intelligence (Emotional Messaging)
```javascript
// Fetched per ad
{
  ad_id: '120203452767890123',
  primary_text: 'From confusion to clarity in just 12 weeks...',
  headline: 'Diastasis recti doesn\'t have to be permanent',
  alternative_copy: 'Variant A: Overwhelmed by conflicting advice? ||| Variant B: Stop guessing...',
  video_id: '1234567890',
  thumbnail_url: 'https://...',
  preview_url: 'https://...',
  post_id: '123456_7891011'
}
```

### Part 3: Revenue Attribution (Your Data)
```javascript
// From contacts table
{
  ad_id: '120203452767890123', // Matched from URL parameter
  revenue: 2075.00,
  purchase_date: '2025-01-15',
  customer_id: 'uuid...'
}
```

---

## Database Schema

### New Tables

```sql
-- Table 1: Meta Ads (Performance Data)
CREATE TABLE meta_ads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ad_id TEXT UNIQUE NOT NULL,
  ad_name TEXT,
  campaign_id TEXT,
  adset_id TEXT,
  status TEXT,
  effective_status TEXT,
  is_active BOOLEAN DEFAULT true,

  -- Dates
  created_time TIMESTAMPTZ,
  updated_time TIMESTAMPTZ,
  date_start DATE,
  date_stop DATE,
  last_synced TIMESTAMPTZ DEFAULT NOW(),

  -- Performance Metrics (All-Time)
  spend DECIMAL(10,2) DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  reach INTEGER DEFAULT 0,
  ctr DECIMAL(5,2) DEFAULT 0,
  cpc DECIMAL(5,2) DEFAULT 0,
  frequency DECIMAL(5,2) DEFAULT 0,

  -- Conversions
  link_clicks INTEGER DEFAULT 0,
  landing_page_views INTEGER DEFAULT 0,
  leads INTEGER DEFAULT 0,
  pixel_leads INTEGER DEFAULT 0,
  video_views INTEGER DEFAULT 0,
  post_engagements INTEGER DEFAULT 0,

  -- Costs
  cost_per_lead DECIMAL(10,2),
  cost_per_landing_page_view DECIMAL(10,2),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table 2: Ad Creatives (Messaging Intelligence)
CREATE TABLE meta_ad_creatives (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ad_id TEXT UNIQUE NOT NULL REFERENCES meta_ads(ad_id),

  -- Copy
  primary_text TEXT,
  headline TEXT,
  alternative_copy TEXT, -- Pipe-separated variants

  -- Media
  video_id TEXT,
  thumbnail_url TEXT,
  preview_url TEXT,
  post_id TEXT,

  -- Emotional Transformation Tags (Auto-Detected)
  transformation_theme TEXT, -- confusion_to_clarity, overwhelm_to_relief, etc.
  symptom_focus TEXT[], -- Array: ['diastasis', 'pelvic_floor', 'low_milk_supply']
  copy_length TEXT, -- short, medium, long
  media_type TEXT, -- video, image, carousel

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table 3: Ad Insights Snapshots (Historical Tracking)
CREATE TABLE meta_ad_insights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ad_id TEXT REFERENCES meta_ads(ad_id),
  snapshot_date DATE NOT NULL,

  -- Daily snapshot of metrics
  spend DECIMAL(10,2),
  impressions INTEGER,
  clicks INTEGER,
  reach INTEGER,
  leads INTEGER,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(ad_id, snapshot_date)
);

-- Indexes
CREATE INDEX idx_meta_ads_ad_id ON meta_ads(ad_id);
CREATE INDEX idx_meta_ads_active ON meta_ads(is_active) WHERE is_active = true;
CREATE INDEX idx_meta_ad_creatives_ad_id ON meta_ad_creatives(ad_id);
CREATE INDEX idx_meta_ad_creatives_transformation ON meta_ad_creatives(transformation_theme);
CREATE INDEX idx_meta_ad_insights_ad_id_date ON meta_ad_insights(ad_id, snapshot_date);
```

---

## Emotional Transformation Detection

**Auto-tagging creative themes:**

```javascript
function detectTransformationTheme(primaryText, headline) {
  const text = `${primaryText} ${headline}`.toLowerCase();

  const themes = {
    'confusion_to_clarity': [
      'confusion', 'confused', 'clarity', 'clear', 'understand',
      'finally understand', 'makes sense', 'figured out'
    ],
    'overwhelm_to_relief': [
      'overwhelm', 'overwhelmed', 'relief', 'relieved', 'stress',
      'anxiety', 'calm', 'peace', 'breathe', 'relax'
    ],
    'pain_to_comfort': [
      'pain', 'painful', 'hurt', 'ache', 'discomfort',
      'relief', 'comfortable', 'healed', 'better'
    ],
    'isolation_to_community': [
      'alone', 'isolated', 'lonely', 'community', 'support',
      'not alone', 'together', 'connect', 'belong'
    ],
    'shame_to_confidence': [
      'shame', 'embarrassed', 'ashamed', 'confidence', 'confident',
      'proud', 'empowered', 'strong', 'brave'
    ],
    'doubt_to_trust': [
      'doubt', 'uncertain', 'unsure', 'trust', 'believe',
      'faith', 'confident', 'sure', 'certain'
    ]
  };

  for (const [theme, keywords] of Object.entries(themes)) {
    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        return theme;
      }
    }
  }

  return 'general';
}

function detectSymptomFocus(primaryText, headline) {
  const text = `${primaryText} ${headline}`.toLowerCase();
  const symptoms = [];

  const symptomKeywords = {
    'diastasis': ['diastasis', 'ab separation', 'stomach gap', 'core gap'],
    'pelvic_floor': ['pelvic floor', 'leaking', 'incontinence', 'weak pelvic'],
    'low_milk_supply': ['milk supply', 'low supply', 'breastfeeding', 'nursing'],
    'pain': ['pain', 'painful', 'hurt', 'ache', 'sore'],
    'weight': ['weight', 'lose weight', 'belly fat', 'postpartum body'],
    'energy': ['tired', 'exhausted', 'energy', 'fatigue', 'sleep']
  };

  for (const [symptom, keywords] of Object.entries(symptomKeywords)) {
    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        symptoms.push(symptom);
        break;
      }
    }
  }

  return symptoms;
}
```

---

## Analytics Views

### View 1: Ad ROAS by Transformation Theme

```sql
CREATE OR REPLACE VIEW v_ad_roas_by_theme AS
SELECT
  c.transformation_theme,
  COUNT(DISTINCT a.ad_id) as total_ads,
  SUM(a.spend) as total_spend,
  SUM(a.leads) as total_leads,

  -- Revenue from contacts (joined by ad_id)
  COUNT(DISTINCT co.id) FILTER (WHERE co.purchase_date IS NOT NULL) as customers,
  COALESCE(SUM(co.purchase_amount), 0) as total_revenue,

  -- ROAS
  ROUND(COALESCE(SUM(co.purchase_amount), 0) / NULLIF(SUM(a.spend), 0), 2) as roas,

  -- CPL and CPA
  ROUND(SUM(a.spend) / NULLIF(SUM(a.leads), 0), 2) as cost_per_lead,
  ROUND(SUM(a.spend) / NULLIF(COUNT(DISTINCT co.id) FILTER (WHERE co.purchase_date IS NOT NULL), 0), 2) as cost_per_acquisition,

  -- Conversion rates
  ROUND(100.0 * SUM(a.leads) / NULLIF(SUM(a.clicks), 0), 2) as click_to_lead_rate,
  ROUND(100.0 * COUNT(DISTINCT co.id) FILTER (WHERE co.purchase_date IS NOT NULL) / NULLIF(SUM(a.leads), 0), 2) as lead_to_customer_rate

FROM meta_ads a
JOIN meta_ad_creatives c ON a.ad_id = c.ad_id
LEFT JOIN contacts co ON co.ad_id = a.ad_id
WHERE a.is_active = true
GROUP BY c.transformation_theme
ORDER BY roas DESC NULLS LAST;
```

### View 2: Symptom Performance

```sql
CREATE OR REPLACE VIEW v_symptom_ad_performance AS
SELECT
  symptom,
  COUNT(DISTINCT a.ad_id) as total_ads,
  SUM(a.spend) as total_spend,
  SUM(a.leads) as total_leads,

  -- Revenue
  COUNT(DISTINCT co.id) FILTER (WHERE co.purchase_date IS NOT NULL) as customers,
  COALESCE(SUM(co.purchase_amount), 0) as total_revenue,

  -- ROAS
  ROUND(COALESCE(SUM(co.purchase_amount), 0) / NULLIF(SUM(a.spend), 0), 2) as roas,

  -- Engagement
  ROUND(AVG(a.ctr), 2) as avg_ctr,
  ROUND(AVG(a.cpc), 2) as avg_cpc,

  -- Conversion
  ROUND(100.0 * SUM(a.leads) / NULLIF(SUM(a.clicks), 0), 2) as click_to_lead_rate

FROM meta_ads a
JOIN meta_ad_creatives c ON a.ad_id = c.ad_id
CROSS JOIN UNNEST(c.symptom_focus) AS symptom
LEFT JOIN contacts co ON co.ad_id = a.ad_id
WHERE a.is_active = true
GROUP BY symptom
ORDER BY roas DESC NULLS LAST;
```

### View 3: Top Performing Ads (The Winners)

```sql
CREATE OR REPLACE VIEW v_top_performing_ads AS
SELECT
  a.ad_id,
  a.ad_name,
  c.transformation_theme,
  c.symptom_focus,
  c.primary_text,
  c.headline,

  -- Performance
  a.spend,
  a.leads,
  a.cost_per_lead,

  -- Revenue
  COUNT(DISTINCT co.id) FILTER (WHERE co.purchase_date IS NOT NULL) as customers,
  COALESCE(SUM(co.purchase_amount), 0) as revenue,
  ROUND(COALESCE(SUM(co.purchase_amount), 0) / NULLIF(a.spend, 0), 2) as roas,

  -- Engagement
  a.ctr,
  a.cpc,
  a.frequency

FROM meta_ads a
JOIN meta_ad_creatives c ON a.ad_id = c.ad_id
LEFT JOIN contacts co ON co.ad_id = a.ad_id
WHERE a.is_active = true
  AND a.spend > 100 -- Only ads with meaningful spend
GROUP BY a.ad_id, a.ad_name, c.transformation_theme, c.symptom_focus,
         c.primary_text, c.headline, a.spend, a.leads, a.cost_per_lead,
         a.ctr, a.cpc, a.frequency
ORDER BY roas DESC NULLS LAST
LIMIT 20;
```

---

## Sync Script

**Location:** `scripts/sync-meta-ads.js`

**What it does:**
1. Fetches all active ads (Part 1 script)
2. For each ad, fetches creative data (Part 2 script)
3. Auto-detects transformation themes and symptoms
4. Stores in database
5. Takes daily snapshots for trend tracking

**Run schedule:** Daily at 2am PST (via Vercel cron)

---

## Key Insights You'll Get

### 1. Transformation Theme ROAS
```
Theme                      Ads  Spend      Revenue    ROAS   CPL     CPA
────────────────────────────────────────────────────────────────────────
confusion_to_clarity       12   $4,234.12  $18,675    4.41   $24.18  $353.57
overwhelm_to_relief        8    $3,128.45  $12,450    3.98   $28.92  $391.25
pain_to_comfort            5    $2,156.78  $8,300     3.85   $31.24  $431.20
isolation_to_community     3    $1,892.34  $6,225     3.29   $35.67  $473.06
```

**Insight:** "Confusion to Clarity" messaging has highest ROAS (4.41x)

### 2. Symptom-Specific Performance
```
Symptom           Ads  Spend      Revenue    ROAS   CTR    CPC
──────────────────────────────────────────────────────────────
diastasis         15   $5,432.89  $24,900    4.58   2.34%  $1.28
pelvic_floor      10   $3,891.23  $16,600    4.27   2.18%  $1.42
low_milk_supply   7    $2,156.45  $8,300     3.85   1.89%  $1.67
energy            5    $1,234.56  $4,150     3.36   1.72%  $1.89
```

**Insight:** Diastasis-focused ads have highest ROAS (4.58x) and best engagement (2.34% CTR)

### 3. Creative Format Analysis
```
Format                  ROAS   CTR    Avg Lead Cost
────────────────────────────────────────────────────
Video + Long Copy       4.72   2.54%  $22.45
Video + Short Copy      4.18   2.31%  $26.78
Image + Long Copy       3.67   1.98%  $31.24
Image + Short Copy      3.21   1.76%  $35.89
```

**Insight:** Video + Long Copy format wins across all metrics

---

## Weekly Report Additions

Your weekly emails will now include:

### 📈 Ad Performance Highlights
- **Best Performing Theme:** Confusion to Clarity (ROAS: 4.41x)
- **Best Symptom Focus:** Diastasis (ROAS: 4.58x)
- **Top Ad:** "From Confusion to Clarity - Diastasis Story" ($1,247 → $5,175 revenue)

### 🎯 Creative Insights
- Video + Long Copy format outperforming by 42%
- Ads mentioning "12 weeks" have 23% higher CTR
- Emotional transformation copy converts 2.3x better than symptom-only

### 💰 ROAS by Campaign
```
Campaign                           Spend      Revenue    ROAS
──────────────────────────────────────────────────────────────
Diastasis - Confusion to Clarity   $1,247.38  $5,175.00  4.15x
Pelvic Floor - Overwhelm Relief    $892.45    $3,312.50  3.71x
Low Supply - Doubt to Trust        $654.23    $2,075.00  3.17x
```

---

## Environment Variables

Add to `.env.local` and Vercel:

```bash
# Meta Ads API (from your scripts)
META_ACCESS_TOKEN=EAASJdU90pQMBPhRDNv4UcLL1p4HdsNDQNOTsb2HnVyYZBUOinzZAC9yFYssXxYDUq8kYiqoEbrB6nsxshI7cJvrXGabc8qhyZC0sIPsXLiZCju5zq3EZAkdnJnHBhLGpDpWi7ugVNDLJ3AOuaho1nJwp1qCQCUZAGfMhu0z6rz7rnv6hc9wjiAHbTUmWf3RZCnC0gZDZD
META_AD_ACCOUNT_ID=act_199993829749361
META_API_VERSION=v20.0
```

**Note:** These are stored safely in environment variables, never committed to git.

---

## Implementation Checklist

- [ ] Create database tables (meta_ads, meta_ad_creatives, meta_ad_insights)
- [ ] Create analytics views (ROAS by theme, symptom performance, top ads)
- [ ] Build sync script (scripts/sync-meta-ads.js)
- [ ] Set up daily cron job (2am PST)
- [ ] Add ad insights to weekly report template
- [ ] Test with current active ads
- [ ] Run first sync and verify data
- [ ] Review first weekly report with ad insights

---

## Usage

### Manual Sync (Testing)
```bash
node scripts/sync-meta-ads.js
```

### View Ad Performance
```sql
-- ROAS by transformation theme
SELECT * FROM v_ad_roas_by_theme;

-- Symptom performance
SELECT * FROM v_symptom_ad_performance;

-- Top 20 ads
SELECT * FROM v_top_performing_ads;
```

### Generate Report with Ad Insights
```bash
node scripts/generate-weekly-report.js
# Now includes ad performance section
```

---

## Next Steps

1. **Run first sync** - Import current active ads
2. **Review transformation detection** - Verify themes are tagged correctly
3. **Check ROAS calculations** - Ensure revenue attribution is working
4. **Generate first report** - See ad insights in weekly email
5. **Optimize campaigns** - Double down on winning themes/symptoms

---

*Ready to discover which emotional transformations print money.*
