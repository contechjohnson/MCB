-- ============================================================
-- META ADS INTEGRATION - DATABASE SCHEMA
-- Created: January 7, 2025
-- Purpose: Track ad performance, creative intelligence, and ROAS
-- ============================================================

-- ============================================================
-- TABLE 1: Meta Ads (Performance Data)
-- Stores all ad performance metrics from Meta Ads API
-- ============================================================
CREATE TABLE IF NOT EXISTS meta_ads (
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

  -- Performance Metrics (All-Time Cumulative)
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

COMMENT ON TABLE meta_ads IS 'Meta Ads performance data synced from Meta Ads API';
COMMENT ON COLUMN meta_ads.ad_id IS 'Meta Ad ID (matches ad_id in contacts table for attribution)';
COMMENT ON COLUMN meta_ads.spend IS 'All-time ad spend in USD';
COMMENT ON COLUMN meta_ads.last_synced IS 'Last time data was synced from Meta API';

-- ============================================================
-- TABLE 2: Ad Creatives (Messaging Intelligence)
-- Stores creative copy and auto-detects emotional themes
-- ============================================================
CREATE TABLE IF NOT EXISTS meta_ad_creatives (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ad_id TEXT UNIQUE NOT NULL,

  -- Copy
  primary_text TEXT,
  headline TEXT,
  alternative_copy TEXT, -- Pipe-separated variants (|||)

  -- Media
  video_id TEXT,
  thumbnail_url TEXT,
  preview_url TEXT,
  post_id TEXT,

  -- Auto-Detected Intelligence
  transformation_theme TEXT, -- confusion_to_clarity, overwhelm_to_relief, etc.
  symptom_focus TEXT[], -- Array: ['diastasis', 'pelvic_floor', 'low_milk_supply']
  copy_length TEXT, -- short, medium, long
  media_type TEXT, -- video, image, carousel

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  FOREIGN KEY (ad_id) REFERENCES meta_ads(ad_id) ON DELETE CASCADE
);

COMMENT ON TABLE meta_ad_creatives IS 'Ad creative data with emotional transformation detection';
COMMENT ON COLUMN meta_ad_creatives.transformation_theme IS 'Auto-detected emotional transformation (confusion_to_clarity, overwhelm_to_relief, etc.)';
COMMENT ON COLUMN meta_ad_creatives.symptom_focus IS 'Auto-detected symptom keywords (diastasis, pelvic_floor, low_milk_supply, etc.)';

-- ============================================================
-- TABLE 3: Ad Insights Snapshots (Historical Tracking)
-- Daily snapshots for trend analysis
-- ============================================================
CREATE TABLE IF NOT EXISTS meta_ad_insights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ad_id TEXT NOT NULL,
  snapshot_date DATE NOT NULL,

  -- Daily snapshot of key metrics
  spend DECIMAL(10,2) DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  reach INTEGER DEFAULT 0,
  leads INTEGER DEFAULT 0,
  ctr DECIMAL(5,2) DEFAULT 0,
  cpc DECIMAL(5,2) DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  FOREIGN KEY (ad_id) REFERENCES meta_ads(ad_id) ON DELETE CASCADE,
  UNIQUE(ad_id, snapshot_date)
);

COMMENT ON TABLE meta_ad_insights IS 'Daily performance snapshots for trend tracking';

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_meta_ads_ad_id ON meta_ads(ad_id);
CREATE INDEX IF NOT EXISTS idx_meta_ads_active ON meta_ads(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_meta_ads_campaign ON meta_ads(campaign_id);
CREATE INDEX IF NOT EXISTS idx_meta_ads_adset ON meta_ads(adset_id);

CREATE INDEX IF NOT EXISTS idx_meta_ad_creatives_ad_id ON meta_ad_creatives(ad_id);
CREATE INDEX IF NOT EXISTS idx_meta_ad_creatives_transformation ON meta_ad_creatives(transformation_theme);
CREATE INDEX IF NOT EXISTS idx_meta_ad_creatives_symptom ON meta_ad_creatives USING GIN(symptom_focus);

CREATE INDEX IF NOT EXISTS idx_meta_ad_insights_ad_id_date ON meta_ad_insights(ad_id, snapshot_date);
CREATE INDEX IF NOT EXISTS idx_meta_ad_insights_date ON meta_ad_insights(snapshot_date);

-- ============================================================
-- ANALYTICS VIEWS
-- ============================================================

-- VIEW 1: ROAS by Transformation Theme
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

COMMENT ON VIEW v_ad_roas_by_theme IS 'ROAS analysis by emotional transformation theme';

-- VIEW 2: Symptom Performance
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

COMMENT ON VIEW v_symptom_ad_performance IS 'Performance analysis by symptom focus (diastasis, pelvic_floor, etc.)';

-- VIEW 3: Top Performing Ads
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
  a.frequency,

  -- Media
  c.video_id,
  c.thumbnail_url,
  c.preview_url

FROM meta_ads a
JOIN meta_ad_creatives c ON a.ad_id = c.ad_id
LEFT JOIN contacts co ON co.ad_id = a.ad_id
WHERE a.is_active = true
  AND a.spend > 100 -- Only ads with meaningful spend
GROUP BY a.ad_id, a.ad_name, c.transformation_theme, c.symptom_focus,
         c.primary_text, c.headline, a.spend, a.leads, a.cost_per_lead,
         a.ctr, a.cpc, a.frequency, c.video_id, c.thumbnail_url, c.preview_url
ORDER BY roas DESC NULLS LAST
LIMIT 20;

COMMENT ON VIEW v_top_performing_ads IS 'Top 20 ads by ROAS (minimum $100 spend)';

-- VIEW 4: Creative Format Performance
CREATE OR REPLACE VIEW v_creative_format_performance AS
SELECT
  CASE
    WHEN c.video_id IS NOT NULL THEN 'video'
    ELSE 'image'
  END as media_type,
  c.copy_length,
  COUNT(DISTINCT a.ad_id) as total_ads,
  SUM(a.spend) as total_spend,
  SUM(a.leads) as total_leads,

  -- Revenue
  COUNT(DISTINCT co.id) FILTER (WHERE co.purchase_date IS NOT NULL) as customers,
  COALESCE(SUM(co.purchase_amount), 0) as total_revenue,
  ROUND(COALESCE(SUM(co.purchase_amount), 0) / NULLIF(SUM(a.spend), 0), 2) as roas,

  -- Engagement
  ROUND(AVG(a.ctr), 2) as avg_ctr,
  ROUND(AVG(a.cpc), 2) as avg_cpc,
  ROUND(AVG(a.cost_per_lead), 2) as avg_cost_per_lead

FROM meta_ads a
JOIN meta_ad_creatives c ON a.ad_id = c.ad_id
LEFT JOIN contacts co ON co.ad_id = a.ad_id
WHERE a.is_active = true
GROUP BY
  CASE WHEN c.video_id IS NOT NULL THEN 'video' ELSE 'image' END,
  c.copy_length
ORDER BY roas DESC NULLS LAST;

COMMENT ON VIEW v_creative_format_performance IS 'Performance by creative format (video vs image, copy length)';

-- VIEW 5: Daily Ad Spend Trends
CREATE OR REPLACE VIEW v_daily_ad_spend AS
SELECT
  snapshot_date,
  COUNT(DISTINCT ad_id) as active_ads,
  SUM(spend) as total_spend,
  SUM(impressions) as total_impressions,
  SUM(clicks) as total_clicks,
  SUM(leads) as total_leads,
  ROUND(AVG(ctr), 2) as avg_ctr,
  ROUND(AVG(cpc), 2) as avg_cpc
FROM meta_ad_insights
WHERE snapshot_date >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY snapshot_date
ORDER BY snapshot_date DESC;

COMMENT ON VIEW v_daily_ad_spend IS 'Daily ad spend and performance trends (last 90 days)';

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Function: Get ad performance summary
CREATE OR REPLACE FUNCTION fn_get_ad_performance_summary(
  start_date DATE DEFAULT CURRENT_DATE - INTERVAL '7 days',
  end_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'period', json_build_object(
      'start_date', start_date,
      'end_date', end_date
    ),

    -- ROAS by theme
    'roas_by_theme', (
      SELECT json_agg(row_to_json(t))
      FROM (SELECT * FROM v_ad_roas_by_theme) t
    ),

    -- Symptom performance
    'symptom_performance', (
      SELECT json_agg(row_to_json(t))
      FROM (SELECT * FROM v_symptom_ad_performance) t
    ),

    -- Top ads
    'top_ads', (
      SELECT json_agg(row_to_json(t))
      FROM (SELECT * FROM v_top_performing_ads LIMIT 10) t
    ),

    -- Creative format performance
    'format_performance', (
      SELECT json_agg(row_to_json(t))
      FROM (SELECT * FROM v_creative_format_performance) t
    ),

    -- Daily spend trend
    'daily_spend', (
      SELECT json_agg(row_to_json(t))
      FROM (
        SELECT * FROM v_daily_ad_spend
        WHERE snapshot_date >= start_date AND snapshot_date <= end_date
        ORDER BY snapshot_date DESC
      ) t
    ),

    -- Summary totals
    'summary', json_build_object(
      'total_active_ads', (SELECT COUNT(*) FROM meta_ads WHERE is_active = true),
      'total_spend', (SELECT SUM(spend) FROM meta_ads WHERE is_active = true),
      'total_leads', (SELECT SUM(leads) FROM meta_ads WHERE is_active = true),
      'total_customers', (SELECT COUNT(DISTINCT id) FROM contacts WHERE ad_id IS NOT NULL AND purchase_date IS NOT NULL),
      'total_revenue', (SELECT COALESCE(SUM(purchase_amount), 0) FROM contacts WHERE ad_id IS NOT NULL AND purchase_date IS NOT NULL),
      'overall_roas', (
        SELECT ROUND(
          COALESCE(SUM(co.purchase_amount), 0) / NULLIF(SUM(a.spend), 0), 2
        )
        FROM meta_ads a
        LEFT JOIN contacts co ON co.ad_id = a.ad_id AND co.purchase_date IS NOT NULL
        WHERE a.is_active = true
      )
    )
  ) INTO result;

  RETURN result;
END;
$$;

COMMENT ON FUNCTION fn_get_ad_performance_summary IS 'Returns comprehensive ad performance data as JSON';

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_meta_ads_updated_at
  BEFORE UPDATE ON meta_ads
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_meta_ad_creatives_updated_at
  BEFORE UPDATE ON meta_ad_creatives
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- SAMPLE QUERIES FOR TESTING
-- ============================================================

-- Get ROAS by transformation theme
-- SELECT * FROM v_ad_roas_by_theme;

-- Get symptom performance
-- SELECT * FROM v_symptom_ad_performance;

-- Get top 10 performing ads
-- SELECT * FROM v_top_performing_ads LIMIT 10;

-- Get ad performance summary
-- SELECT fn_get_ad_performance_summary(CURRENT_DATE - INTERVAL '30 days', CURRENT_DATE);

-- Find ads with specific transformation theme
-- SELECT a.*, c.primary_text, c.headline
-- FROM meta_ads a
-- JOIN meta_ad_creatives c ON a.ad_id = c.ad_id
-- WHERE c.transformation_theme = 'confusion_to_clarity'
-- ORDER BY a.spend DESC;
