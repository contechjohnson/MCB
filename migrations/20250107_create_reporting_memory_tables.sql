-- Reporting Memory Tables
-- Purpose: Store week-to-week context for AI-powered reporting
-- Created: 2025-01-07

-- Weekly Snapshots (high-level summary of each week)
CREATE TABLE IF NOT EXISTS weekly_snapshots (
  week_ending DATE PRIMARY KEY,
  total_contacts INTEGER NOT NULL,
  total_qualified INTEGER,
  qualify_rate DECIMAL(5,2),
  total_bookings INTEGER,
  total_shows INTEGER,
  total_purchases INTEGER,
  total_revenue DECIMAL(10,2),
  total_spend DECIMAL(10,2),
  roas DECIMAL(5,2),

  -- Top performers
  top_ad_by_volume TEXT,
  top_ad_by_quality TEXT,
  top_ad_by_roas TEXT,

  -- Recommendations & actions
  recommendations_given TEXT[], -- What we told Eric to do
  actions_taken TEXT[], -- What was actually done (filled in next week)

  -- Key insights
  insights TEXT, -- Main learnings from this week

  -- Metadata
  report_sent_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE weekly_snapshots IS 'Weekly summary for AI memory - tracks recommendations and outcomes';

-- A/B Tests Tracking
CREATE TABLE IF NOT EXISTS ab_tests (
  test_id SERIAL PRIMARY KEY,
  test_name TEXT NOT NULL,
  hypothesis TEXT,

  -- Variants
  variant_a_description TEXT,
  variant_a_ad_ids TEXT[], -- Ad IDs in control group
  variant_b_description TEXT,
  variant_b_ad_ids TEXT[], -- Ad IDs in test group

  -- Test parameters
  metric_tracked TEXT, -- qualify_rate, roas, conversion_rate, etc.
  target_sample_size INTEGER,

  -- Timeline
  started_at DATE,
  ended_at DATE,

  -- Results
  status TEXT CHECK (status IN ('planning', 'running', 'complete', 'cancelled')),
  winner TEXT CHECK (winner IN ('variant_a', 'variant_b', 'no_difference', NULL)),
  variant_a_result DECIMAL(10,2),
  variant_b_result DECIMAL(10,2),
  confidence_level DECIMAL(5,2), -- Statistical confidence (e.g., 95.0)
  result_summary TEXT,

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE ab_tests IS 'A/B test tracking for ad creative, bot flow, and offer tests';

-- Ad Performance Weekly (detailed ad-level tracking)
CREATE TABLE IF NOT EXISTS ad_performance_weekly (
  week_ending DATE NOT NULL,
  ad_id TEXT NOT NULL,
  ad_name TEXT,

  -- Volume metrics
  contacts INTEGER DEFAULT 0,
  qualified INTEGER DEFAULT 0,
  qualify_rate DECIMAL(5,2),

  -- Conversion metrics
  bookings INTEGER DEFAULT 0,
  shows INTEGER DEFAULT 0,
  purchases INTEGER DEFAULT 0,

  -- Financial metrics
  revenue DECIMAL(10,2) DEFAULT 0,
  spend DECIMAL(10,2) DEFAULT 0,
  roas DECIMAL(5,2),
  cost_per_lead DECIMAL(10,2),
  cost_per_customer DECIMAL(10,2),

  -- Creative metadata (for pattern analysis)
  transformation_theme TEXT,
  symptom_focus TEXT[],

  -- Flags
  is_new_this_week BOOLEAN DEFAULT FALSE,
  was_scaled_this_week BOOLEAN DEFAULT FALSE,
  was_paused_this_week BOOLEAN DEFAULT FALSE,

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),

  PRIMARY KEY (week_ending, ad_id)
);

COMMENT ON TABLE ad_performance_weekly IS 'Weekly ad performance snapshots for trend analysis';

-- Theme Performance Weekly (rollup by emotional theme)
CREATE TABLE IF NOT EXISTS theme_performance_weekly (
  week_ending DATE NOT NULL,
  transformation_theme TEXT NOT NULL,

  -- Aggregate metrics
  total_ads INTEGER,
  total_contacts INTEGER,
  total_qualified INTEGER,
  avg_qualify_rate DECIMAL(5,2),
  total_purchases INTEGER,
  total_revenue DECIMAL(10,2),
  total_spend DECIMAL(10,2),
  avg_roas DECIMAL(5,2),

  -- Week-over-week changes
  contacts_change_pct DECIMAL(5,2),
  qualify_rate_change_pct DECIMAL(5,2),
  roas_change_pct DECIMAL(5,2),

  created_at TIMESTAMP DEFAULT NOW(),

  PRIMARY KEY (week_ending, transformation_theme)
);

COMMENT ON TABLE theme_performance_weekly IS 'Weekly theme performance for identifying winning emotional hooks';

-- Report Metadata (track what was sent to Eric)
CREATE TABLE IF NOT EXISTS reports_sent (
  report_id SERIAL PRIMARY KEY,
  week_ending DATE NOT NULL,
  sent_to TEXT, -- email address
  subject_line TEXT,

  -- Report sections included
  sections_included TEXT[], -- ['executive_summary', 'top_performers', 'ab_tests', etc.]

  -- Key highlights
  top_recommendation TEXT, -- Main action item
  primary_insight TEXT, -- Main learning

  -- Metadata
  sent_at TIMESTAMP DEFAULT NOW(),
  opened_at TIMESTAMP, -- If we track email opens
  clicked_at TIMESTAMP, -- If Eric clicks links in report

  -- Full report content (for reference)
  report_html TEXT,
  report_markdown TEXT
);

COMMENT ON TABLE reports_sent IS 'Archive of all reports sent for historical reference';

-- Indexes for performance
CREATE INDEX idx_weekly_snapshots_week ON weekly_snapshots(week_ending DESC);
CREATE INDEX idx_ab_tests_status ON ab_tests(status) WHERE status = 'running';
CREATE INDEX idx_ad_performance_weekly_week ON ad_performance_weekly(week_ending DESC);
CREATE INDEX idx_ad_performance_weekly_ad ON ad_performance_weekly(ad_id);
CREATE INDEX idx_theme_performance_weekly_week ON theme_performance_weekly(week_ending DESC);
CREATE INDEX idx_reports_sent_week ON reports_sent(week_ending DESC);

-- Function: Calculate week-over-week changes
CREATE OR REPLACE FUNCTION fn_calculate_wow_changes(
  p_week_ending DATE
)
RETURNS TABLE (
  metric TEXT,
  current_value DECIMAL,
  previous_value DECIMAL,
  change_value DECIMAL,
  change_pct DECIMAL
) AS $$
DECLARE
  v_prev_week_ending DATE;
BEGIN
  -- Get previous week
  v_prev_week_ending := p_week_ending - INTERVAL '7 days';

  -- Compare metrics
  RETURN QUERY
  WITH current AS (
    SELECT
      total_contacts,
      total_qualified,
      qualify_rate,
      total_revenue,
      total_spend,
      roas
    FROM weekly_snapshots
    WHERE week_ending = p_week_ending
  ),
  previous AS (
    SELECT
      total_contacts,
      total_qualified,
      qualify_rate,
      total_revenue,
      total_spend,
      roas
    FROM weekly_snapshots
    WHERE week_ending = v_prev_week_ending
  )
  SELECT
    'contacts'::TEXT,
    c.total_contacts::DECIMAL,
    p.total_contacts::DECIMAL,
    (c.total_contacts - p.total_contacts)::DECIMAL,
    CASE WHEN p.total_contacts > 0
      THEN ((c.total_contacts - p.total_contacts)::DECIMAL / p.total_contacts * 100)
      ELSE NULL
    END
  FROM current c, previous p

  UNION ALL

  SELECT
    'qualify_rate'::TEXT,
    c.qualify_rate::DECIMAL,
    p.qualify_rate::DECIMAL,
    (c.qualify_rate - p.qualify_rate)::DECIMAL,
    CASE WHEN p.qualify_rate > 0
      THEN ((c.qualify_rate - p.qualify_rate) / p.qualify_rate * 100)
      ELSE NULL
    END
  FROM current c, previous p

  UNION ALL

  SELECT
    'revenue'::TEXT,
    c.total_revenue::DECIMAL,
    p.total_revenue::DECIMAL,
    (c.total_revenue - p.total_revenue)::DECIMAL,
    CASE WHEN p.total_revenue > 0
      THEN ((c.total_revenue - p.total_revenue) / p.total_revenue * 100)
      ELSE NULL
    END
  FROM current c, previous p

  UNION ALL

  SELECT
    'roas'::TEXT,
    c.roas::DECIMAL,
    p.roas::DECIMAL,
    (c.roas - p.roas)::DECIMAL,
    CASE WHEN p.roas > 0
      THEN ((c.roas - p.roas) / p.roas * 100)
      ELSE NULL
    END
  FROM current c, previous p;

END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION fn_calculate_wow_changes IS 'Calculate week-over-week changes for key metrics';

-- Function: Get AI memory context for weekly report
CREATE OR REPLACE FUNCTION fn_get_report_memory(
  p_week_ending DATE
)
RETURNS JSON AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'last_week', (
      SELECT json_build_object(
        'week_ending', week_ending,
        'total_contacts', total_contacts,
        'qualify_rate', qualify_rate,
        'total_revenue', total_revenue,
        'roas', roas,
        'top_ad_by_volume', top_ad_by_volume,
        'top_ad_by_quality', top_ad_by_quality,
        'recommendations_given', recommendations_given,
        'insights', insights
      )
      FROM weekly_snapshots
      WHERE week_ending = p_week_ending - INTERVAL '7 days'
    ),
    'running_ab_tests', (
      SELECT json_agg(
        json_build_object(
          'test_name', test_name,
          'hypothesis', hypothesis,
          'variant_a', variant_a_description,
          'variant_b', variant_b_description,
          'metric', metric_tracked,
          'started_at', started_at,
          'days_running', CURRENT_DATE - started_at
        )
      )
      FROM ab_tests
      WHERE status = 'running'
    ),
    'historical_patterns', (
      SELECT json_build_object(
        'avg_qualify_rate_4wk', AVG(qualify_rate),
        'avg_roas_4wk', AVG(roas),
        'total_revenue_4wk', SUM(total_revenue),
        'top_theme_4wk', (
          SELECT transformation_theme
          FROM theme_performance_weekly
          WHERE week_ending >= p_week_ending - INTERVAL '28 days'
          GROUP BY transformation_theme
          ORDER BY AVG(avg_qualify_rate) DESC
          LIMIT 1
        )
      )
      FROM weekly_snapshots
      WHERE week_ending >= p_week_ending - INTERVAL '28 days'
        AND week_ending < p_week_ending
    ),
    'last_3_recommendations', (
      SELECT json_agg(
        json_build_object(
          'week', week_ending,
          'recommendations', recommendations_given,
          'actions_taken', actions_taken
        )
      )
      FROM (
        SELECT week_ending, recommendations_given, actions_taken
        FROM weekly_snapshots
        WHERE week_ending < p_week_ending
        ORDER BY week_ending DESC
        LIMIT 3
      ) recent
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION fn_get_report_memory IS 'Get all context needed for AI to write weekly report';
