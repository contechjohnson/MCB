-- ============================================================
-- ADVANCED ANALYTICS VIEWS FOR POSTPARTUM CARE USA
-- Created: January 7, 2025
-- Purpose: Comprehensive analytics for weekly email reports
-- ============================================================

-- ============================================================
-- VIEW 1: Weekly Performance Summary
-- ============================================================
CREATE OR REPLACE VIEW v_weekly_performance AS
SELECT
  DATE_TRUNC('week', subscribe_date) as week_start,
  DATE_TRUNC('week', subscribe_date) + INTERVAL '6 days' as week_end,

  -- Contact metrics
  COUNT(DISTINCT id) as total_contacts,
  COUNT(DISTINCT id) FILTER (WHERE source LIKE '%_historical%') as historical_contacts,
  COUNT(DISTINCT id) FILTER (WHERE source NOT LIKE '%_historical%') as live_contacts,
  COUNT(DISTINCT id) FILTER (WHERE ad_id IS NOT NULL) as paid_contacts,
  COUNT(DISTINCT id) FILTER (WHERE ad_id IS NULL) as organic_contacts,

  -- Funnel metrics
  COUNT(DISTINCT id) FILTER (WHERE dm_qualified_date IS NOT NULL) as qualified,
  COUNT(DISTINCT id) FILTER (WHERE link_click_date IS NOT NULL) as clicked_link,
  COUNT(DISTINCT id) FILTER (WHERE form_submit_date IS NOT NULL) as submitted_form,
  COUNT(DISTINCT id) FILTER (WHERE appointment_date IS NOT NULL) as booked_meeting,
  COUNT(DISTINCT id) FILTER (WHERE appointment_held_date IS NOT NULL) as attended_meeting,
  COUNT(DISTINCT id) FILTER (WHERE checkout_started IS NOT NULL) as started_checkout,
  COUNT(DISTINCT id) FILTER (WHERE purchase_date IS NOT NULL) as purchased,

  -- Revenue metrics
  COALESCE(SUM(purchase_amount), 0) as total_revenue,
  ROUND(AVG(purchase_amount) FILTER (WHERE purchase_amount IS NOT NULL), 2) as avg_order_value,

  -- Conversion rates
  ROUND(100.0 * COUNT(*) FILTER (WHERE dm_qualified_date IS NOT NULL) /
    NULLIF(COUNT(*), 0), 1) as qualification_rate,
  ROUND(100.0 * COUNT(*) FILTER (WHERE appointment_date IS NOT NULL) /
    NULLIF(COUNT(*), 0), 1) as booking_rate,
  ROUND(100.0 * COUNT(*) FILTER (WHERE appointment_held_date IS NOT NULL) /
    NULLIF(COUNT(*) FILTER (WHERE appointment_date IS NOT NULL), 0), 1) as show_rate,
  ROUND(100.0 * COUNT(*) FILTER (WHERE purchase_date IS NOT NULL) /
    NULLIF(COUNT(*), 0), 1) as overall_conversion_rate,
  ROUND(100.0 * COUNT(*) FILTER (WHERE purchase_date IS NOT NULL) /
    NULLIF(COUNT(*) FILTER (WHERE appointment_held_date IS NOT NULL), 0), 1) as close_rate

FROM contacts
WHERE subscribe_date IS NOT NULL
GROUP BY DATE_TRUNC('week', subscribe_date)
ORDER BY week_start DESC;

COMMENT ON VIEW v_weekly_performance IS 'Weekly summary of contacts, funnel progression, revenue, and conversion rates';

-- ============================================================
-- VIEW 2: Funnel Metrics (Detailed Breakdown)
-- ============================================================
CREATE OR REPLACE VIEW v_funnel_metrics AS
WITH funnel_stages AS (
  SELECT
    id,
    source,
    ad_id IS NOT NULL as is_paid,
    chatbot_ab,
    subscribe_date IS NOT NULL as stage_subscribed,
    dm_qualified_date IS NOT NULL as stage_qualified,
    link_send_date IS NOT NULL as stage_link_sent,
    link_click_date IS NOT NULL as stage_link_clicked,
    form_submit_date IS NOT NULL as stage_form_submitted,
    appointment_date IS NOT NULL as stage_meeting_booked,
    appointment_held_date IS NOT NULL as stage_meeting_held,
    checkout_started IS NOT NULL as stage_checkout_started,
    purchase_date IS NOT NULL as stage_purchased
  FROM contacts
  WHERE subscribe_date IS NOT NULL
)
SELECT
  source,
  CASE WHEN is_paid THEN 'Paid' ELSE 'Organic' END as traffic_type,
  chatbot_ab,

  -- Stage counts
  COUNT(*) as entered_funnel,
  COUNT(*) FILTER (WHERE stage_qualified) as qualified,
  COUNT(*) FILTER (WHERE stage_link_sent) as link_sent,
  COUNT(*) FILTER (WHERE stage_link_clicked) as link_clicked,
  COUNT(*) FILTER (WHERE stage_form_submitted) as form_submitted,
  COUNT(*) FILTER (WHERE stage_meeting_booked) as meeting_booked,
  COUNT(*) FILTER (WHERE stage_meeting_held) as meeting_held,
  COUNT(*) FILTER (WHERE stage_checkout_started) as checkout_started,
  COUNT(*) FILTER (WHERE stage_purchased) as purchased,

  -- Conversion rates (stage to stage)
  ROUND(100.0 * COUNT(*) FILTER (WHERE stage_qualified) / NULLIF(COUNT(*), 0), 1) as qualify_rate,
  ROUND(100.0 * COUNT(*) FILTER (WHERE stage_link_clicked) / NULLIF(COUNT(*) FILTER (WHERE stage_link_sent), 0), 1) as click_rate,
  ROUND(100.0 * COUNT(*) FILTER (WHERE stage_form_submitted) / NULLIF(COUNT(*) FILTER (WHERE stage_link_clicked), 0), 1) as form_submit_rate,
  ROUND(100.0 * COUNT(*) FILTER (WHERE stage_meeting_booked) / NULLIF(COUNT(*) FILTER (WHERE stage_form_submitted), 0), 1) as booking_rate,
  ROUND(100.0 * COUNT(*) FILTER (WHERE stage_meeting_held) / NULLIF(COUNT(*) FILTER (WHERE stage_meeting_booked), 0), 1) as show_rate,
  ROUND(100.0 * COUNT(*) FILTER (WHERE stage_purchased) / NULLIF(COUNT(*) FILTER (WHERE stage_meeting_held), 0), 1) as close_rate,
  ROUND(100.0 * COUNT(*) FILTER (WHERE stage_purchased) / NULLIF(COUNT(*), 0), 1) as overall_conversion

FROM funnel_stages
GROUP BY source, is_paid, chatbot_ab
ORDER BY COUNT(*) DESC;

COMMENT ON VIEW v_funnel_metrics IS 'Detailed funnel conversion rates by source, traffic type, and A/B test variant';

-- ============================================================
-- VIEW 3: Revenue Breakdown
-- ============================================================
CREATE OR REPLACE VIEW v_revenue_breakdown AS
SELECT
  DATE_TRUNC('week', p.payment_date) as week_start,

  -- Payment source breakdown
  COUNT(*) FILTER (WHERE p.payment_source = 'stripe') as stripe_payments,
  COUNT(*) FILTER (WHERE p.payment_source = 'denefits') as denefits_payments,
  SUM(p.amount) FILTER (WHERE p.payment_source = 'stripe') as stripe_revenue,
  SUM(p.amount) FILTER (WHERE p.payment_source = 'denefits') as denefits_revenue,

  -- Payment type breakdown
  COUNT(*) FILTER (WHERE p.payment_type = 'buy_in_full') as buy_in_full_count,
  COUNT(*) FILTER (WHERE p.payment_type = 'buy_now_pay_later') as bnpl_count,
  SUM(p.amount) FILTER (WHERE p.payment_type = 'buy_in_full') as buy_in_full_revenue,
  SUM(p.amount) FILTER (WHERE p.payment_type = 'buy_now_pay_later') as bnpl_revenue,

  -- Overall metrics
  COUNT(*) as total_payments,
  COUNT(DISTINCT p.contact_id) as unique_customers,
  SUM(p.amount) as total_revenue,
  ROUND(AVG(p.amount), 2) as avg_order_value,
  MIN(p.amount) as min_order,
  MAX(p.amount) as max_order,

  -- Orphan tracking
  COUNT(*) FILTER (WHERE p.contact_id IS NULL) as orphan_payments,
  SUM(p.amount) FILTER (WHERE p.contact_id IS NULL) as orphan_revenue,
  ROUND(100.0 * COUNT(*) FILTER (WHERE p.contact_id IS NULL) / NULLIF(COUNT(*), 0), 1) as orphan_rate

FROM payments p
WHERE p.status IN ('paid', 'active')
  AND p.payment_type != 'refund'
  AND p.payment_date IS NOT NULL
GROUP BY DATE_TRUNC('week', p.payment_date)
ORDER BY week_start DESC;

COMMENT ON VIEW v_revenue_breakdown IS 'Weekly revenue by payment source, type, and customer metrics';

-- ============================================================
-- VIEW 4: Timing Analysis
-- ============================================================
CREATE OR REPLACE VIEW v_timing_analysis AS
SELECT
  DATE_TRUNC('week', subscribe_date) as week_start,

  -- Average time to purchase (in days)
  ROUND(AVG(EXTRACT(EPOCH FROM (purchase_date - subscribe_date))/86400) FILTER (WHERE purchase_date IS NOT NULL), 1) as avg_days_subscribe_to_purchase,

  -- Average time to booking (in days)
  ROUND(AVG(EXTRACT(EPOCH FROM (appointment_date - subscribe_date))/86400) FILTER (WHERE appointment_date IS NOT NULL), 1) as avg_days_subscribe_to_booking,

  -- Link engagement timing (in hours)
  ROUND(AVG(EXTRACT(EPOCH FROM (link_click_date - link_send_date))/3600) FILTER (WHERE link_click_date IS NOT NULL AND link_send_date IS NOT NULL), 1) as avg_hours_link_send_to_click,

  -- Form submission timing (in hours)
  ROUND(AVG(EXTRACT(EPOCH FROM (form_submit_date - link_click_date))/3600) FILTER (WHERE form_submit_date IS NOT NULL AND link_click_date IS NOT NULL), 1) as avg_hours_click_to_form,

  -- Booking timing (in hours)
  ROUND(AVG(EXTRACT(EPOCH FROM (appointment_date - form_submit_date))/3600) FILTER (WHERE appointment_date IS NOT NULL AND form_submit_date IS NOT NULL), 1) as avg_hours_form_to_booking,

  -- Meeting held timing (in days)
  ROUND(AVG(EXTRACT(EPOCH FROM (appointment_held_date - appointment_date))/86400) FILTER (WHERE appointment_held_date IS NOT NULL AND appointment_date IS NOT NULL), 1) as avg_days_booking_to_meeting,

  -- Close timing (in days)
  ROUND(AVG(EXTRACT(EPOCH FROM (purchase_date - appointment_held_date))/86400) FILTER (WHERE purchase_date IS NOT NULL AND appointment_held_date IS NOT NULL), 1) as avg_days_meeting_to_purchase,

  -- Checkout timing (in hours)
  ROUND(AVG(EXTRACT(EPOCH FROM (purchase_date - checkout_started))/3600) FILTER (WHERE purchase_date IS NOT NULL AND checkout_started IS NOT NULL), 1) as avg_hours_checkout_to_purchase,

  -- Counts for sample size reference
  COUNT(*) FILTER (WHERE purchase_date IS NOT NULL) as purchases_this_week,
  COUNT(*) FILTER (WHERE appointment_date IS NOT NULL) as bookings_this_week

FROM contacts
WHERE subscribe_date IS NOT NULL
GROUP BY DATE_TRUNC('week', subscribe_date)
ORDER BY week_start DESC;

COMMENT ON VIEW v_timing_analysis IS 'Average time spent in each stage of the customer journey';

-- ============================================================
-- VIEW 5: Attribution Summary
-- ============================================================
CREATE OR REPLACE VIEW v_attribution_summary AS
SELECT
  COALESCE(ad_id, 'organic') as ad_campaign,
  source,
  trigger_word,
  chatbot_ab,

  -- Contact metrics
  COUNT(DISTINCT id) as total_contacts,
  COUNT(DISTINCT id) FILTER (WHERE dm_qualified_date IS NOT NULL) as qualified_contacts,
  COUNT(DISTINCT id) FILTER (WHERE appointment_date IS NOT NULL) as booked_meetings,
  COUNT(DISTINCT id) FILTER (WHERE appointment_held_date IS NOT NULL) as held_meetings,
  COUNT(DISTINCT id) FILTER (WHERE purchase_date IS NOT NULL) as customers,

  -- Revenue metrics
  COALESCE(SUM(purchase_amount), 0) as total_revenue,
  ROUND(AVG(purchase_amount) FILTER (WHERE purchase_amount IS NOT NULL), 2) as avg_order_value,
  ROUND(COALESCE(SUM(purchase_amount) / NULLIF(COUNT(DISTINCT id), 0), 0), 2) as revenue_per_lead,

  -- Conversion rates
  ROUND(100.0 * COUNT(*) FILTER (WHERE dm_qualified_date IS NOT NULL) / NULLIF(COUNT(*), 0), 1) as qualification_rate,
  ROUND(100.0 * COUNT(*) FILTER (WHERE appointment_date IS NOT NULL) / NULLIF(COUNT(*), 0), 1) as booking_rate,
  ROUND(100.0 * COUNT(*) FILTER (WHERE appointment_held_date IS NOT NULL) / NULLIF(COUNT(*) FILTER (WHERE appointment_date IS NOT NULL), 0), 1) as show_rate,
  ROUND(100.0 * COUNT(*) FILTER (WHERE purchase_date IS NOT NULL) / NULLIF(COUNT(*), 0), 1) as conversion_rate,

  -- Timing
  ROUND(AVG(EXTRACT(EPOCH FROM (purchase_date - subscribe_date))/86400) FILTER (WHERE purchase_date IS NOT NULL AND subscribe_date IS NOT NULL), 1) as avg_days_to_purchase

FROM contacts
WHERE subscribe_date >= NOW() - INTERVAL '90 days'  -- Last 90 days
GROUP BY ad_id, source, trigger_word, chatbot_ab
HAVING COUNT(*) >= 3  -- Minimum sample size
ORDER BY total_revenue DESC, total_contacts DESC;

COMMENT ON VIEW v_attribution_summary IS 'Performance by attribution dimensions (ad, source, trigger word, A/B test)';

-- ============================================================
-- VIEW 6: Symptom Performance (Customer Insights)
-- ============================================================
CREATE OR REPLACE VIEW v_symptom_performance AS
SELECT
  q1_question as months_postpartum,
  q2_question as symptoms,
  objections as common_objections,

  -- Volume metrics
  COUNT(*) as contact_count,
  COUNT(*) FILTER (WHERE dm_qualified_date IS NOT NULL) as qualified_count,
  COUNT(*) FILTER (WHERE appointment_date IS NOT NULL) as booking_count,
  COUNT(*) FILTER (WHERE purchase_date IS NOT NULL) as purchase_count,

  -- Revenue metrics
  COALESCE(SUM(purchase_amount), 0) as total_revenue,
  ROUND(AVG(purchase_amount) FILTER (WHERE purchase_amount IS NOT NULL), 2) as avg_order_value,

  -- Conversion rates
  ROUND(100.0 * COUNT(*) FILTER (WHERE purchase_date IS NOT NULL) / NULLIF(COUNT(*), 0), 1) as conversion_rate,
  ROUND(100.0 * COUNT(*) FILTER (WHERE appointment_date IS NOT NULL) / NULLIF(COUNT(*), 0), 1) as booking_rate,

  -- Intent scoring (higher conversion + higher AOV = higher intent)
  ROUND(
    (100.0 * COUNT(*) FILTER (WHERE purchase_date IS NOT NULL) / NULLIF(COUNT(*), 0)) *
    (COALESCE(AVG(purchase_amount) FILTER (WHERE purchase_amount IS NOT NULL), 0) / 3000.0),
  1) as intent_score

FROM contacts
WHERE subscribe_date >= NOW() - INTERVAL '90 days'
  AND (q1_question IS NOT NULL OR q2_question IS NOT NULL OR objections IS NOT NULL)
GROUP BY q1_question, q2_question, objections
HAVING COUNT(*) >= 3  -- Minimum sample size
ORDER BY intent_score DESC, total_revenue DESC;

COMMENT ON VIEW v_symptom_performance IS 'Conversion and revenue by customer symptoms, timeline, and objections';

-- ============================================================
-- VIEW 7: Data Quality Dashboard
-- ============================================================
CREATE OR REPLACE VIEW v_data_quality AS
SELECT
  COUNT(*) as total_contacts,

  -- ID Coverage
  COUNT(mc_id) as has_mc_id,
  COUNT(ghl_id) as has_ghl_id,
  COUNT(CASE WHEN mc_id IS NOT NULL AND ghl_id IS NOT NULL THEN 1 END) as has_both_ids,
  COUNT(ad_id) as has_ad_id,
  COUNT(stripe_customer_id) as has_stripe_id,

  -- Linkage rates
  ROUND(100.0 * COUNT(CASE WHEN mc_id IS NOT NULL AND ghl_id IS NOT NULL THEN 1 END) /
    NULLIF(COUNT(mc_id), 0), 1) as mc_to_ghl_linkage_rate,

  -- Personal info coverage
  COUNT(email_primary) as has_email_primary,
  COUNT(email_booking) as has_email_booking,
  COUNT(email_payment) as has_email_payment,
  COUNT(phone) as has_phone,
  COUNT(first_name) as has_first_name,
  COUNT(last_name) as has_last_name,

  -- Attribution coverage
  COUNT(trigger_word) as has_trigger_word,
  COUNT(chatbot_ab) as has_ab_test,
  COUNT(q1_question) as has_q1,
  COUNT(q2_question) as has_q2,

  -- Timeline coverage
  COUNT(subscribe_date) as has_subscribe_date,
  COUNT(dm_qualified_date) as has_qualified_date,
  COUNT(appointment_date) as has_booking_date,
  COUNT(appointment_held_date) as has_meeting_date,
  COUNT(purchase_date) as has_purchase_date,

  -- Historical vs Live
  COUNT(*) FILTER (WHERE source LIKE '%_historical%') as historical_contacts,
  COUNT(*) FILTER (WHERE source NOT LIKE '%_historical%') as live_contacts,

  -- Percentages
  ROUND(100.0 * COUNT(mc_id) / COUNT(*), 1) as mc_id_pct,
  ROUND(100.0 * COUNT(ghl_id) / COUNT(*), 1) as ghl_id_pct,
  ROUND(100.0 * COUNT(ad_id) / COUNT(*), 1) as ad_id_pct,
  ROUND(100.0 * COUNT(q1_question) / COUNT(*), 1) as symptom_data_pct,
  ROUND(100.0 * COUNT(*) FILTER (WHERE source LIKE '%_historical%') / COUNT(*), 1) as historical_pct

FROM contacts;

COMMENT ON VIEW v_data_quality IS 'Data completeness and quality metrics for monitoring';

-- ============================================================
-- Grant permissions (if using RLS)
-- ============================================================
-- GRANT SELECT ON v_weekly_performance TO authenticated;
-- GRANT SELECT ON v_funnel_metrics TO authenticated;
-- GRANT SELECT ON v_revenue_breakdown TO authenticated;
-- GRANT SELECT ON v_timing_analysis TO authenticated;
-- GRANT SELECT ON v_attribution_summary TO authenticated;
-- GRANT SELECT ON v_symptom_performance TO authenticated;
-- GRANT SELECT ON v_data_quality TO authenticated;

-- ============================================================
-- Verification queries (comment out after testing)
-- ============================================================

-- Test weekly performance view
-- SELECT * FROM v_weekly_performance ORDER BY week_start DESC LIMIT 4;

-- Test funnel metrics view
-- SELECT * FROM v_funnel_metrics ORDER BY entered_funnel DESC LIMIT 10;

-- Test revenue breakdown view
-- SELECT * FROM v_revenue_breakdown ORDER BY week_start DESC LIMIT 4;

-- Test timing analysis view
-- SELECT * FROM v_timing_analysis ORDER BY week_start DESC LIMIT 4;

-- Test attribution summary view
-- SELECT * FROM v_attribution_summary ORDER BY total_revenue DESC LIMIT 10;

-- Test symptom performance view
-- SELECT * FROM v_symptom_performance ORDER BY intent_score DESC LIMIT 10;

-- Test data quality view
-- SELECT * FROM v_data_quality;
