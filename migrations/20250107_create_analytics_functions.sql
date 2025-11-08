-- ============================================================
-- ANALYTICS RPC FUNCTIONS FOR POSTPARTUM CARE USA
-- Created: January 7, 2025
-- Purpose: Helper functions for weekly report generation
-- ============================================================

-- ============================================================
-- FUNCTION 1: Get Weekly Report Data
-- Returns comprehensive metrics for a date range
-- ============================================================
CREATE OR REPLACE FUNCTION fn_get_weekly_report(
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ
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

    -- Weekly performance metrics
    'weekly_performance', (
      SELECT json_agg(row_to_json(t))
      FROM (
        SELECT * FROM v_weekly_performance
        WHERE week_start >= start_date AND week_start <= end_date
        ORDER BY week_start DESC
      ) t
    ),

    -- Funnel metrics
    'funnel_metrics', (
      SELECT json_agg(row_to_json(t))
      FROM (
        SELECT * FROM v_funnel_metrics
        LIMIT 20
      ) t
    ),

    -- Revenue breakdown
    'revenue_breakdown', (
      SELECT json_agg(row_to_json(t))
      FROM (
        SELECT * FROM v_revenue_breakdown
        WHERE week_start >= start_date AND week_start <= end_date
        ORDER BY week_start DESC
      ) t
    ),

    -- Timing analysis
    'timing_analysis', (
      SELECT json_agg(row_to_json(t))
      FROM (
        SELECT * FROM v_timing_analysis
        WHERE week_start >= start_date AND week_start <= end_date
        ORDER BY week_start DESC
      ) t
    ),

    -- Attribution summary (last 90 days)
    'attribution_summary', (
      SELECT json_agg(row_to_json(t))
      FROM (
        SELECT * FROM v_attribution_summary
        ORDER BY total_revenue DESC
        LIMIT 20
      ) t
    ),

    -- Top symptoms/insights (last 90 days)
    'symptom_performance', (
      SELECT json_agg(row_to_json(t))
      FROM (
        SELECT * FROM v_symptom_performance
        ORDER BY intent_score DESC
        LIMIT 15
      ) t
    ),

    -- Data quality
    'data_quality', (
      SELECT row_to_json(t)
      FROM (SELECT * FROM v_data_quality) t
    ),

    -- Summary stats for the week
    'summary', json_build_object(
      'total_contacts', (
        SELECT COUNT(*) FROM contacts
        WHERE subscribe_date >= start_date AND subscribe_date <= end_date
      ),
      'total_revenue', (
        SELECT COALESCE(SUM(amount), 0) FROM payments
        WHERE payment_date >= start_date AND payment_date <= end_date
          AND status IN ('paid', 'active')
          AND payment_type != 'refund'
      ),
      'total_customers', (
        SELECT COUNT(DISTINCT id) FROM contacts
        WHERE purchase_date >= start_date AND purchase_date <= end_date
      ),
      'avg_order_value', (
        SELECT ROUND(AVG(amount), 2) FROM payments
        WHERE payment_date >= start_date AND payment_date <= end_date
          AND status IN ('paid', 'active')
          AND payment_type != 'refund'
      )
    )
  ) INTO result;

  RETURN result;
END;
$$;

COMMENT ON FUNCTION fn_get_weekly_report IS 'Returns comprehensive weekly analytics data as JSON for a given date range';

-- ============================================================
-- FUNCTION 2: Calculate Month-over-Month Growth
-- ============================================================
CREATE OR REPLACE FUNCTION fn_calculate_mom_growth()
RETURNS TABLE (
  metric_name TEXT,
  current_month NUMERIC,
  previous_month NUMERIC,
  absolute_change NUMERIC,
  percent_change NUMERIC
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH current_month_data AS (
    SELECT
      COUNT(*) as contacts,
      COUNT(*) FILTER (WHERE purchase_date IS NOT NULL) as customers,
      COALESCE(SUM(purchase_amount), 0) as revenue,
      ROUND(AVG(purchase_amount) FILTER (WHERE purchase_amount IS NOT NULL), 2) as aov
    FROM contacts
    WHERE subscribe_date >= DATE_TRUNC('month', NOW())
      AND subscribe_date < DATE_TRUNC('month', NOW()) + INTERVAL '1 month'
  ),
  previous_month_data AS (
    SELECT
      COUNT(*) as contacts,
      COUNT(*) FILTER (WHERE purchase_date IS NOT NULL) as customers,
      COALESCE(SUM(purchase_amount), 0) as revenue,
      ROUND(AVG(purchase_amount) FILTER (WHERE purchase_amount IS NOT NULL), 2) as aov
    FROM contacts
    WHERE subscribe_date >= DATE_TRUNC('month', NOW()) - INTERVAL '1 month'
      AND subscribe_date < DATE_TRUNC('month', NOW())
  )
  SELECT
    'Contacts'::TEXT,
    (SELECT contacts FROM current_month_data)::NUMERIC,
    (SELECT contacts FROM previous_month_data)::NUMERIC,
    ((SELECT contacts FROM current_month_data) - (SELECT contacts FROM previous_month_data))::NUMERIC,
    ROUND(100.0 * ((SELECT contacts FROM current_month_data) - (SELECT contacts FROM previous_month_data)) /
      NULLIF((SELECT contacts FROM previous_month_data), 0), 1)
  UNION ALL
  SELECT
    'Customers'::TEXT,
    (SELECT customers FROM current_month_data)::NUMERIC,
    (SELECT customers FROM previous_month_data)::NUMERIC,
    ((SELECT customers FROM current_month_data) - (SELECT customers FROM previous_month_data))::NUMERIC,
    ROUND(100.0 * ((SELECT customers FROM current_month_data) - (SELECT customers FROM previous_month_data)) /
      NULLIF((SELECT customers FROM previous_month_data), 0), 1)
  UNION ALL
  SELECT
    'Revenue'::TEXT,
    (SELECT revenue FROM current_month_data)::NUMERIC,
    (SELECT revenue FROM previous_month_data)::NUMERIC,
    ((SELECT revenue FROM current_month_data) - (SELECT revenue FROM previous_month_data))::NUMERIC,
    ROUND(100.0 * ((SELECT revenue FROM current_month_data) - (SELECT revenue FROM previous_month_data)) /
      NULLIF((SELECT revenue FROM previous_month_data), 0), 1)
  UNION ALL
  SELECT
    'AOV'::TEXT,
    (SELECT aov FROM current_month_data)::NUMERIC,
    (SELECT aov FROM previous_month_data)::NUMERIC,
    ((SELECT aov FROM current_month_data) - (SELECT aov FROM previous_month_data))::NUMERIC,
    ROUND(100.0 * ((SELECT aov FROM current_month_data) - (SELECT aov FROM previous_month_data)) /
      NULLIF((SELECT aov FROM previous_month_data), 0), 1);
END;
$$;

COMMENT ON FUNCTION fn_calculate_mom_growth IS 'Calculates month-over-month growth for key metrics';

-- ============================================================
-- FUNCTION 3: Get Cohort Analysis
-- ============================================================
CREATE OR REPLACE FUNCTION fn_get_cohort_analysis(cohort_month DATE)
RETURNS TABLE (
  cohort_month DATE,
  cohort_size BIGINT,
  contacts_qualified BIGINT,
  contacts_booked BIGINT,
  contacts_attended BIGINT,
  contacts_purchased BIGINT,
  total_revenue NUMERIC,
  qualification_rate NUMERIC,
  booking_rate NUMERIC,
  show_rate NUMERIC,
  conversion_rate NUMERIC,
  revenue_per_contact NUMERIC,
  avg_days_to_purchase NUMERIC
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    DATE_TRUNC('month', c.subscribe_date)::DATE as cohort_month,
    COUNT(*) as cohort_size,
    COUNT(*) FILTER (WHERE c.dm_qualified_date IS NOT NULL) as contacts_qualified,
    COUNT(*) FILTER (WHERE c.appointment_date IS NOT NULL) as contacts_booked,
    COUNT(*) FILTER (WHERE c.appointment_held_date IS NOT NULL) as contacts_attended,
    COUNT(*) FILTER (WHERE c.purchase_date IS NOT NULL) as contacts_purchased,
    COALESCE(SUM(c.purchase_amount), 0) as total_revenue,
    ROUND(100.0 * COUNT(*) FILTER (WHERE c.dm_qualified_date IS NOT NULL) / NULLIF(COUNT(*), 0), 1) as qualification_rate,
    ROUND(100.0 * COUNT(*) FILTER (WHERE c.appointment_date IS NOT NULL) / NULLIF(COUNT(*), 0), 1) as booking_rate,
    ROUND(100.0 * COUNT(*) FILTER (WHERE c.appointment_held_date IS NOT NULL) / NULLIF(COUNT(*) FILTER (WHERE c.appointment_date IS NOT NULL), 0), 1) as show_rate,
    ROUND(100.0 * COUNT(*) FILTER (WHERE c.purchase_date IS NOT NULL) / NULLIF(COUNT(*), 0), 1) as conversion_rate,
    ROUND(COALESCE(SUM(c.purchase_amount), 0) / NULLIF(COUNT(*), 0), 2) as revenue_per_contact,
    ROUND(AVG(EXTRACT(EPOCH FROM (c.purchase_date - c.subscribe_date))/86400) FILTER (WHERE c.purchase_date IS NOT NULL AND c.subscribe_date IS NOT NULL), 1) as avg_days_to_purchase
  FROM contacts c
  WHERE DATE_TRUNC('month', c.subscribe_date) = cohort_month
  GROUP BY DATE_TRUNC('month', c.subscribe_date);
END;
$$;

COMMENT ON FUNCTION fn_get_cohort_analysis IS 'Returns cohort analysis for a specific month';

-- ============================================================
-- Test queries (comment out after verifying)
-- ============================================================

-- Test weekly report function (last week)
-- SELECT fn_get_weekly_report(
--   NOW() - INTERVAL '7 days',
--   NOW()
-- );

-- Test MoM growth
-- SELECT * FROM fn_calculate_mom_growth();

-- Test cohort analysis (current month)
-- SELECT * FROM fn_get_cohort_analysis(DATE_TRUNC('month', NOW())::DATE);
