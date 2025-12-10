-- Migration: Create event analytics views and functions
-- Created: 2025-12-10
-- Purpose: Analytics infrastructure for querying funnel_events table
--
-- This migration creates views, functions, and materialized views that power:
-- - /funnel slash command (conversion funnel analysis)
-- - /web-analytics agent (natural language queries)
-- - Weekly reports (automated email summaries)
-- - Contact debugging (event timelines)
--
-- Prerequisites:
-- - 20251210_001_create_funnel_events.sql must be run first
--
-- Performance notes:
-- - Views are calculated on-demand (flexible but slower for large datasets)
-- - Materialized views are pre-computed (fast but require refresh)
-- - Functions are optimized with proper indexes

-- ================================================================
-- VIEW: funnel_conversion_by_events
-- ================================================================
-- Purpose: Funnel conversion metrics from events (replaces timestamp-based queries)
-- Usage: SELECT * FROM funnel_conversion_by_events WHERE tenant_id = 'uuid';

CREATE OR REPLACE VIEW funnel_conversion_by_events AS
SELECT
  tenant_id,
  event_type,
  COUNT(DISTINCT contact_id) as unique_contacts,
  COUNT(*) as total_events,
  MIN(event_timestamp) as first_event_at,
  MAX(event_timestamp) as last_event_at
FROM funnel_events
WHERE event_timestamp >= NOW() - INTERVAL '30 days'
GROUP BY tenant_id, event_type;

COMMENT ON VIEW funnel_conversion_by_events IS
'Last 30 days funnel conversion metrics. Shows unique contacts and total events by type per tenant.';

-- ================================================================
-- FUNCTION: get_contact_event_timeline
-- ================================================================
-- Purpose: Get chronological event timeline for a specific contact (debugging)
-- Usage: SELECT * FROM get_contact_event_timeline('contact-uuid');

CREATE OR REPLACE FUNCTION get_contact_event_timeline(p_contact_id UUID)
RETURNS TABLE(
  event_id UUID,
  event_type TEXT,
  event_timestamp TIMESTAMPTZ,
  source TEXT,
  event_data JSONB,
  days_since_previous NUMERIC,
  hours_since_previous NUMERIC
) AS $$
SELECT
  e.id as event_id,
  e.event_type,
  e.event_timestamp,
  e.source,
  e.event_data,
  ROUND(
    EXTRACT(EPOCH FROM (e.event_timestamp - LAG(e.event_timestamp) OVER (ORDER BY e.event_timestamp))) / 86400.0,
    1
  ) as days_since_previous,
  ROUND(
    EXTRACT(EPOCH FROM (e.event_timestamp - LAG(e.event_timestamp) OVER (ORDER BY e.event_timestamp))) / 3600.0,
    1
  ) as hours_since_previous
FROM funnel_events e
WHERE e.contact_id = p_contact_id
ORDER BY e.event_timestamp;
$$ LANGUAGE sql STABLE;

COMMENT ON FUNCTION get_contact_event_timeline IS
'Returns chronological event timeline for a contact with time deltas between events. Perfect for debugging contact journeys.';

-- ================================================================
-- FUNCTION: get_funnel_metrics
-- ================================================================
-- Purpose: Get funnel conversion metrics for a tenant in a date range
-- Usage: SELECT * FROM get_funnel_metrics('tenant-uuid', '2025-11-01', '2025-12-01');

CREATE OR REPLACE FUNCTION get_funnel_metrics(
  p_tenant_id UUID,
  p_start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
  p_end_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE(
  event_type TEXT,
  unique_contacts BIGINT,
  total_events BIGINT,
  conversion_from_top NUMERIC,
  avg_time_to_next_stage INTERVAL
) AS $$
WITH event_stats AS (
  SELECT
    event_type,
    COUNT(DISTINCT contact_id) as unique_contacts,
    COUNT(*) as total_events
  FROM funnel_events
  WHERE tenant_id = p_tenant_id
    AND event_timestamp >= p_start_date
    AND event_timestamp < p_end_date
  GROUP BY event_type
),
funnel_top AS (
  SELECT MAX(unique_contacts) as top_count
  FROM event_stats
)
SELECT
  es.event_type,
  es.unique_contacts,
  es.total_events,
  ROUND(100.0 * es.unique_contacts / NULLIF(ft.top_count, 0), 1) as conversion_from_top,
  NULL::INTERVAL as avg_time_to_next_stage  -- TODO: Calculate stage progression times
FROM event_stats es
CROSS JOIN funnel_top ft
ORDER BY es.unique_contacts DESC;
$$ LANGUAGE sql STABLE;

COMMENT ON FUNCTION get_funnel_metrics IS
'Calculates funnel conversion metrics for a tenant in a date range. Returns event counts and conversion percentages.';

-- ================================================================
-- FUNCTION: get_event_counts_by_source
-- ================================================================
-- Purpose: Attribution analysis - which sources drive which events
-- Usage: SELECT * FROM get_event_counts_by_source('tenant-uuid', 'last 7 days');

CREATE OR REPLACE FUNCTION get_event_counts_by_source(
  p_tenant_id UUID,
  p_lookback_interval INTERVAL DEFAULT INTERVAL '7 days'
)
RETURNS TABLE(
  source TEXT,
  event_type TEXT,
  unique_contacts BIGINT,
  total_events BIGINT
) AS $$
SELECT
  source,
  event_type,
  COUNT(DISTINCT contact_id) as unique_contacts,
  COUNT(*) as total_events
FROM funnel_events
WHERE tenant_id = p_tenant_id
  AND event_timestamp >= NOW() - p_lookback_interval
GROUP BY source, event_type
ORDER BY source, total_events DESC;
$$ LANGUAGE sql STABLE;

COMMENT ON FUNCTION get_event_counts_by_source IS
'Source attribution analysis. Shows which sources (manychat, ghl, stripe) drive which events.';

-- ================================================================
-- FUNCTION: get_contact_event_sequence
-- ================================================================
-- Purpose: Get ordered event sequence for funnel stage analysis
-- Usage: SELECT * FROM get_contact_event_sequence('tenant-uuid') WHERE event_count > 3;

CREATE OR REPLACE FUNCTION get_contact_event_sequence(
  p_tenant_id UUID,
  p_lookback_interval INTERVAL DEFAULT INTERVAL '30 days'
)
RETURNS TABLE(
  contact_id UUID,
  event_sequence TEXT[],
  event_count INTEGER,
  first_event_at TIMESTAMPTZ,
  last_event_at TIMESTAMPTZ,
  funnel_duration_days NUMERIC
) AS $$
SELECT
  e.contact_id,
  ARRAY_AGG(e.event_type ORDER BY e.event_timestamp) as event_sequence,
  COUNT(*)::INTEGER as event_count,
  MIN(e.event_timestamp) as first_event_at,
  MAX(e.event_timestamp) as last_event_at,
  ROUND(
    EXTRACT(EPOCH FROM (MAX(e.event_timestamp) - MIN(e.event_timestamp))) / 86400.0,
    1
  ) as funnel_duration_days
FROM funnel_events e
WHERE e.tenant_id = p_tenant_id
  AND e.event_timestamp >= NOW() - p_lookback_interval
GROUP BY e.contact_id
ORDER BY event_count DESC, last_event_at DESC;
$$ LANGUAGE sql STABLE;

COMMENT ON FUNCTION get_contact_event_sequence IS
'Returns event sequences for each contact. Useful for identifying common conversion paths and drop-off points.';

-- ================================================================
-- MATERIALIZED VIEW: daily_event_rollup
-- ================================================================
-- Purpose: Pre-computed daily event aggregations for fast reporting
-- Note: Must be refreshed regularly (e.g., daily cron job)

CREATE MATERIALIZED VIEW IF NOT EXISTS daily_event_rollup AS
SELECT
  tenant_id,
  DATE(event_timestamp) as event_date,
  event_type,
  source,
  COUNT(*) as event_count,
  COUNT(DISTINCT contact_id) as unique_contacts,
  COUNT(*) FILTER (WHERE created_by = 'webhook') as webhook_events,
  COUNT(*) FILTER (WHERE created_by = 'migration') as migrated_events
FROM funnel_events
GROUP BY tenant_id, DATE(event_timestamp), event_type, source;

-- Index for fast queries
CREATE INDEX IF NOT EXISTS idx_daily_rollup_tenant_date
ON daily_event_rollup (tenant_id, event_date DESC);

CREATE INDEX IF NOT EXISTS idx_daily_rollup_event_type
ON daily_event_rollup (event_type, event_date DESC);

COMMENT ON MATERIALIZED VIEW daily_event_rollup IS
'Daily aggregated event metrics. Refreshed daily for fast reporting. Use: REFRESH MATERIALIZED VIEW daily_event_rollup;';

-- ================================================================
-- FUNCTION: refresh_daily_rollup
-- ================================================================
-- Purpose: Refresh materialized view (call from cron or manually)
-- Usage: SELECT refresh_daily_rollup();

CREATE OR REPLACE FUNCTION refresh_daily_rollup()
RETURNS TEXT AS $$
DECLARE
  v_start_time TIMESTAMP := clock_timestamp();
  v_duration NUMERIC;
BEGIN
  REFRESH MATERIALIZED VIEW daily_event_rollup;

  v_duration := EXTRACT(EPOCH FROM (clock_timestamp() - v_start_time));

  RETURN format('Refreshed daily_event_rollup in %s seconds', ROUND(v_duration, 2));
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION refresh_daily_rollup IS
'Refreshes daily_event_rollup materialized view. Should be called daily via cron.';

-- ================================================================
-- FUNCTION: get_weekly_summary
-- ================================================================
-- Purpose: Weekly summary metrics for automated reports
-- Usage: SELECT * FROM get_weekly_summary('tenant-uuid');

CREATE OR REPLACE FUNCTION get_weekly_summary(
  p_tenant_id UUID,
  p_week_offset INTEGER DEFAULT 0  -- 0 = current week, -1 = last week, etc.
)
RETURNS TABLE(
  metric_name TEXT,
  metric_value NUMERIC,
  previous_week_value NUMERIC,
  week_over_week_change NUMERIC,
  week_over_week_pct NUMERIC
) AS $$
WITH week_range AS (
  SELECT
    DATE_TRUNC('week', NOW() + (p_week_offset * INTERVAL '1 week'))::TIMESTAMPTZ as week_start,
    DATE_TRUNC('week', NOW() + (p_week_offset * INTERVAL '1 week'))::TIMESTAMPTZ + INTERVAL '7 days' as week_end,
    DATE_TRUNC('week', NOW() + ((p_week_offset - 1) * INTERVAL '1 week'))::TIMESTAMPTZ as prev_week_start,
    DATE_TRUNC('week', NOW() + ((p_week_offset - 1) * INTERVAL '1 week'))::TIMESTAMPTZ + INTERVAL '7 days' as prev_week_end
),
current_week AS (
  SELECT
    'new_subscribers' as metric,
    COUNT(DISTINCT contact_id) as value
  FROM funnel_events, week_range
  WHERE tenant_id = p_tenant_id
    AND event_type = 'contact_subscribed'
    AND event_timestamp >= week_start
    AND event_timestamp < week_end

  UNION ALL

  SELECT
    'dm_qualified' as metric,
    COUNT(DISTINCT contact_id) as value
  FROM funnel_events, week_range
  WHERE tenant_id = p_tenant_id
    AND event_type = 'dm_qualified'
    AND event_timestamp >= week_start
    AND event_timestamp < week_end

  UNION ALL

  SELECT
    'meetings_booked' as metric,
    COUNT(DISTINCT contact_id) as value
  FROM funnel_events, week_range
  WHERE tenant_id = p_tenant_id
    AND event_type = 'appointment_scheduled'
    AND event_timestamp >= week_start
    AND event_timestamp < week_end

  UNION ALL

  SELECT
    'meetings_held' as metric,
    COUNT(DISTINCT contact_id) as value
  FROM funnel_events, week_range
  WHERE tenant_id = p_tenant_id
    AND event_type = 'appointment_held'
    AND event_timestamp >= week_start
    AND event_timestamp < week_end

  UNION ALL

  SELECT
    'purchases' as metric,
    COUNT(DISTINCT contact_id) as value
  FROM funnel_events, week_range
  WHERE tenant_id = p_tenant_id
    AND event_type = 'purchase_completed'
    AND event_timestamp >= week_start
    AND event_timestamp < week_end

  UNION ALL

  SELECT
    'revenue' as metric,
    COALESCE(SUM((event_data->>'amount')::NUMERIC), 0) as value
  FROM funnel_events, week_range
  WHERE tenant_id = p_tenant_id
    AND event_type = 'purchase_completed'
    AND event_timestamp >= week_start
    AND event_timestamp < week_end
),
previous_week AS (
  SELECT
    'new_subscribers' as metric,
    COUNT(DISTINCT contact_id) as value
  FROM funnel_events, week_range
  WHERE tenant_id = p_tenant_id
    AND event_type = 'contact_subscribed'
    AND event_timestamp >= prev_week_start
    AND event_timestamp < prev_week_end

  UNION ALL

  SELECT
    'dm_qualified' as metric,
    COUNT(DISTINCT contact_id) as value
  FROM funnel_events, week_range
  WHERE tenant_id = p_tenant_id
    AND event_type = 'dm_qualified'
    AND event_timestamp >= prev_week_start
    AND event_timestamp < prev_week_end

  UNION ALL

  SELECT
    'meetings_booked' as metric,
    COUNT(DISTINCT contact_id) as value
  FROM funnel_events, week_range
  WHERE tenant_id = p_tenant_id
    AND event_type = 'appointment_scheduled'
    AND event_timestamp >= prev_week_start
    AND event_timestamp < prev_week_end

  UNION ALL

  SELECT
    'meetings_held' as metric,
    COUNT(DISTINCT contact_id) as value
  FROM funnel_events, week_range
  WHERE tenant_id = p_tenant_id
    AND event_type = 'appointment_held'
    AND event_timestamp >= prev_week_start
    AND event_timestamp < prev_week_end

  UNION ALL

  SELECT
    'purchases' as metric,
    COUNT(DISTINCT contact_id) as value
  FROM funnel_events, week_range
  WHERE tenant_id = p_tenant_id
    AND event_type = 'purchase_completed'
    AND event_timestamp >= prev_week_start
    AND event_timestamp < prev_week_end

  UNION ALL

  SELECT
    'revenue' as metric,
    COALESCE(SUM((event_data->>'amount')::NUMERIC), 0) as value
  FROM funnel_events, week_range
  WHERE tenant_id = p_tenant_id
    AND event_type = 'purchase_completed'
    AND event_timestamp >= prev_week_start
    AND event_timestamp < prev_week_end
)
SELECT
  cw.metric as metric_name,
  cw.value as metric_value,
  pw.value as previous_week_value,
  cw.value - pw.value as week_over_week_change,
  CASE
    WHEN pw.value = 0 THEN NULL
    ELSE ROUND(100.0 * (cw.value - pw.value) / NULLIF(pw.value, 0), 1)
  END as week_over_week_pct
FROM current_week cw
LEFT JOIN previous_week pw ON cw.metric = pw.metric
ORDER BY
  CASE cw.metric
    WHEN 'new_subscribers' THEN 1
    WHEN 'dm_qualified' THEN 2
    WHEN 'meetings_booked' THEN 3
    WHEN 'meetings_held' THEN 4
    WHEN 'purchases' THEN 5
    WHEN 'revenue' THEN 6
  END;
$$ LANGUAGE sql STABLE;

COMMENT ON FUNCTION get_weekly_summary IS
'Weekly summary metrics with week-over-week comparison. Used for automated weekly reports.';

-- ================================================================
-- VERIFICATION
-- ================================================================

-- Test get_contact_event_timeline
DO $$
DECLARE
  v_test_contact_id UUID;
BEGIN
  SELECT contact_id INTO v_test_contact_id
  FROM funnel_events
  LIMIT 1;

  IF v_test_contact_id IS NOT NULL THEN
    RAISE NOTICE 'Sample event timeline for contact %:', v_test_contact_id;
    PERFORM * FROM get_contact_event_timeline(v_test_contact_id);
  END IF;
END $$;

-- Test get_funnel_metrics
DO $$
DECLARE
  v_test_tenant_id UUID;
BEGIN
  SELECT DISTINCT tenant_id INTO v_test_tenant_id
  FROM funnel_events
  LIMIT 1;

  IF v_test_tenant_id IS NOT NULL THEN
    RAISE NOTICE 'Sample funnel metrics for tenant %:', v_test_tenant_id;
    PERFORM * FROM get_funnel_metrics(v_test_tenant_id);
  END IF;
END $$;

-- Show view samples
SELECT 'funnel_conversion_by_events' as view_name, COUNT(*) as row_count
FROM funnel_conversion_by_events
UNION ALL
SELECT 'daily_event_rollup', COUNT(*)
FROM daily_event_rollup;

-- ================================================================
-- CLEANUP (if needed)
-- ================================================================

-- To rollback this migration:
-- DROP VIEW IF EXISTS funnel_conversion_by_events;
-- DROP FUNCTION IF EXISTS get_contact_event_timeline;
-- DROP FUNCTION IF EXISTS get_funnel_metrics;
-- DROP FUNCTION IF EXISTS get_event_counts_by_source;
-- DROP FUNCTION IF EXISTS get_contact_event_sequence;
-- DROP FUNCTION IF EXISTS get_weekly_summary;
-- DROP FUNCTION IF EXISTS refresh_daily_rollup;
-- DROP MATERIALIZED VIEW IF EXISTS daily_event_rollup;
