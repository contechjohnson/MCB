-- Migration: Historical Data Analysis Views
-- Purpose: Pre-built SQL views for common analysis questions
-- Created: 2025-05-11
--
-- These views make it easy to query historical data without writing complex SQL
-- Run queries like: SELECT * FROM v_funnel_summary;

-- =============================================================================
-- VIEW: v_funnel_summary
-- =============================================================================
-- Shows overall funnel conversion rates
-- How many contacts reached each stage, and what % converted

CREATE OR REPLACE VIEW v_funnel_summary AS
SELECT
    COUNT(*) as total_contacts,
    COUNT(*) FILTER (WHERE reached_stage IN ('qualified', 'booked', 'attended', 'purchased')) as qualified_count,
    COUNT(*) FILTER (WHERE reached_stage IN ('booked', 'attended', 'purchased')) as booked_count,
    COUNT(*) FILTER (WHERE reached_stage IN ('attended', 'purchased')) as attended_count,
    COUNT(*) FILTER (WHERE has_purchase = TRUE) as purchased_count,

    -- Conversion rates
    ROUND(100.0 * COUNT(*) FILTER (WHERE reached_stage IN ('qualified', 'booked', 'attended', 'purchased')) / NULLIF(COUNT(*), 0), 2) as qualified_rate,
    ROUND(100.0 * COUNT(*) FILTER (WHERE reached_stage IN ('booked', 'attended', 'purchased')) / NULLIF(COUNT(*), 0), 2) as booked_rate,
    ROUND(100.0 * COUNT(*) FILTER (WHERE reached_stage IN ('attended', 'purchased')) / NULLIF(COUNT(*), 0), 2) as attended_rate,
    ROUND(100.0 * COUNT(*) FILTER (WHERE has_purchase = TRUE) / NULLIF(COUNT(*), 0), 2) as purchase_rate,

    -- Conversion from stage to stage
    ROUND(100.0 * COUNT(*) FILTER (WHERE reached_stage IN ('booked', 'attended', 'purchased')) / NULLIF(COUNT(*) FILTER (WHERE reached_stage IN ('qualified', 'booked', 'attended', 'purchased')), 0), 2) as qualified_to_booked_rate,
    ROUND(100.0 * COUNT(*) FILTER (WHERE reached_stage IN ('attended', 'purchased')) / NULLIF(COUNT(*) FILTER (WHERE reached_stage IN ('booked', 'attended', 'purchased')), 0), 2) as booked_to_attended_rate,
    ROUND(100.0 * COUNT(*) FILTER (WHERE has_purchase = TRUE) / NULLIF(COUNT(*) FILTER (WHERE reached_stage IN ('attended', 'purchased')), 0), 2) as attended_to_purchase_rate

FROM hist_contacts
WHERE is_suspicious = FALSE; -- Exclude flagged bad data

-- =============================================================================
-- VIEW: v_revenue_attribution
-- =============================================================================
-- Shows revenue breakdown by paid vs organic, and by trigger word
-- Helps answer: "Which marketing sources generate the most revenue?"

CREATE OR REPLACE VIEW v_revenue_attribution AS
SELECT
    c.ad_type,
    c.trigger_word,
    COUNT(DISTINCT c.email) as contact_count,
    COUNT(DISTINCT c.email) FILTER (WHERE c.has_purchase = TRUE) as purchaser_count,
    ROUND(100.0 * COUNT(DISTINCT c.email) FILTER (WHERE c.has_purchase = TRUE) / NULLIF(COUNT(DISTINCT c.email), 0), 2) as conversion_rate,
    COUNT(p.id) as total_payments, -- Multiple payments per customer possible
    COALESCE(SUM(p.amount), 0) as total_revenue,
    ROUND(COALESCE(SUM(p.amount) / NULLIF(COUNT(DISTINCT c.email) FILTER (WHERE c.has_purchase = TRUE), 0), 0), 2) as avg_order_value,
    ROUND(COALESCE(SUM(p.amount) / NULLIF(COUNT(DISTINCT c.email), 0), 0), 2) as revenue_per_lead

FROM hist_contacts c
LEFT JOIN hist_payments p ON c.email = p.email AND p.payment_type != 'refund'
WHERE c.is_suspicious = FALSE

GROUP BY c.ad_type, c.trigger_word
ORDER BY total_revenue DESC NULLS LAST;

-- =============================================================================
-- VIEW: v_conversion_over_time
-- =============================================================================
-- Shows monthly cohorts: contacts created per month vs purchases per month
-- Helps answer: "How did conversion rates change over time?"

CREATE OR REPLACE VIEW v_conversion_over_time AS
SELECT
    DATE_TRUNC('month', c.first_seen) as month,
    COUNT(DISTINCT c.email) as contacts_created,
    COUNT(DISTINCT c.email) FILTER (WHERE c.has_purchase = TRUE) as contacts_purchased,
    ROUND(100.0 * COUNT(DISTINCT c.email) FILTER (WHERE c.has_purchase = TRUE) / NULLIF(COUNT(DISTINCT c.email), 0), 2) as conversion_rate,
    COALESCE(SUM(p.amount), 0) as revenue,
    ROUND(COALESCE(SUM(p.amount) / NULLIF(COUNT(DISTINCT c.email), 0), 0), 2) as revenue_per_contact

FROM hist_contacts c
LEFT JOIN hist_payments p ON c.email = p.email AND p.payment_type != 'refund'
WHERE c.is_suspicious = FALSE
    AND c.first_seen IS NOT NULL

GROUP BY DATE_TRUNC('month', c.first_seen)
ORDER BY month;

-- =============================================================================
-- VIEW: v_time_to_purchase
-- =============================================================================
-- For contacts who purchased: how long did it take from first contact to purchase?
-- Helps answer: "What's the typical sales cycle length?"

CREATE OR REPLACE VIEW v_time_to_purchase AS
SELECT
    email,
    first_name,
    last_name,
    ad_type,
    trigger_word,
    first_seen,
    purchase_date,
    EXTRACT(DAY FROM (purchase_date - first_seen)) as days_to_purchase,
    EXTRACT(HOUR FROM (purchase_date - first_seen)) as hours_to_purchase

FROM hist_contacts
WHERE has_purchase = TRUE
    AND first_seen IS NOT NULL
    AND purchase_date IS NOT NULL
    AND is_suspicious = FALSE
    AND purchase_date >= first_seen -- Sanity check: purchase can't be before first contact

ORDER BY purchase_date DESC;

-- =============================================================================
-- VIEW: v_time_to_purchase_summary
-- =============================================================================
-- Statistical summary of time-to-purchase
-- Shows min, max, avg, median

CREATE OR REPLACE VIEW v_time_to_purchase_summary AS
SELECT
    COUNT(*) as total_purchases,
    ROUND(MIN(EXTRACT(DAY FROM (purchase_date - first_seen))), 1) as min_days,
    ROUND(MAX(EXTRACT(DAY FROM (purchase_date - first_seen))), 1) as max_days,
    ROUND(AVG(EXTRACT(DAY FROM (purchase_date - first_seen))), 1) as avg_days,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(DAY FROM (purchase_date - first_seen))) as median_days,
    PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY EXTRACT(DAY FROM (purchase_date - first_seen))) as p25_days,
    PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY EXTRACT(DAY FROM (purchase_date - first_seen))) as p75_days

FROM hist_contacts
WHERE has_purchase = TRUE
    AND first_seen IS NOT NULL
    AND purchase_date IS NOT NULL
    AND is_suspicious = FALSE
    AND purchase_date >= first_seen;

-- =============================================================================
-- VIEW: v_payment_breakdown
-- =============================================================================
-- Shows payment type breakdown (Stripe vs Denefits, full vs BNPL)

CREATE OR REPLACE VIEW v_payment_breakdown AS
SELECT
    source,
    payment_type,
    COUNT(*) as payment_count,
    COUNT(DISTINCT email) as unique_customers,
    SUM(amount) as total_revenue,
    ROUND(AVG(amount), 2) as avg_payment,
    MIN(amount) as min_payment,
    MAX(amount) as max_payment

FROM hist_payments
WHERE is_suspicious = FALSE
    AND payment_type != 'refund' -- Exclude refunds from revenue calc

GROUP BY source, payment_type
ORDER BY total_revenue DESC;

-- =============================================================================
-- VIEW: v_data_quality_report
-- =============================================================================
-- Shows completeness of data for each field
-- Helps identify which fields are most/least reliable

CREATE OR REPLACE VIEW v_data_quality_report AS
SELECT
    COUNT(*) as total_contacts,
    COUNT(first_name) as has_first_name,
    COUNT(last_name) as has_last_name,
    COUNT(phone) as has_phone,
    COUNT(ad_type) as has_ad_type,
    COUNT(trigger_word) as has_trigger_word,
    COUNT(first_seen) as has_first_seen,
    COUNT(purchase_date) as has_purchase_date,

    -- Percentages
    ROUND(100.0 * COUNT(first_name) / COUNT(*), 1) as first_name_pct,
    ROUND(100.0 * COUNT(last_name) / COUNT(*), 1) as last_name_pct,
    ROUND(100.0 * COUNT(phone) / COUNT(*), 1) as phone_pct,
    ROUND(100.0 * COUNT(ad_type) / COUNT(*), 1) as ad_type_pct,
    ROUND(100.0 * COUNT(trigger_word) / COUNT(*), 1) as trigger_word_pct,
    ROUND(100.0 * COUNT(first_seen) / COUNT(*), 1) as first_seen_pct,
    ROUND(100.0 * COUNT(purchase_date) / COUNT(*), 1) as purchase_date_pct,

    -- Flagged data
    COUNT(*) FILTER (WHERE is_suspicious = TRUE) as suspicious_count,
    ROUND(100.0 * COUNT(*) FILTER (WHERE is_suspicious = TRUE) / COUNT(*), 1) as suspicious_pct

FROM hist_contacts;

-- =============================================================================
-- VIEW: v_top_trigger_words
-- =============================================================================
-- Shows which trigger words (ManyChat keywords) performed best

CREATE OR REPLACE VIEW v_top_trigger_words AS
SELECT
    trigger_word,
    COUNT(*) as contact_count,
    COUNT(*) FILTER (WHERE has_purchase = TRUE) as purchase_count,
    ROUND(100.0 * COUNT(*) FILTER (WHERE has_purchase = TRUE) / NULLIF(COUNT(*), 0), 2) as conversion_rate,
    COALESCE(SUM(p.amount), 0) as total_revenue,
    ROUND(COALESCE(SUM(p.amount) / NULLIF(COUNT(*), 0), 0), 2) as revenue_per_contact

FROM hist_contacts c
LEFT JOIN hist_payments p ON c.email = p.email AND p.payment_type != 'refund'
WHERE c.trigger_word IS NOT NULL
    AND c.is_suspicious = FALSE

GROUP BY trigger_word
HAVING COUNT(*) >= 5 -- Only show trigger words with at least 5 contacts (reduces noise)
ORDER BY total_revenue DESC;

-- =============================================================================
-- VIEW: v_paid_vs_organic
-- =============================================================================
-- Simple comparison: paid traffic vs organic traffic performance

CREATE OR REPLACE VIEW v_paid_vs_organic AS
SELECT
    ad_type,
    COUNT(*) as contact_count,
    COUNT(*) FILTER (WHERE has_purchase = TRUE) as purchase_count,
    ROUND(100.0 * COUNT(*) FILTER (WHERE has_purchase = TRUE) / NULLIF(COUNT(*), 0), 2) as conversion_rate,
    COALESCE(SUM(p.amount), 0) as total_revenue,
    ROUND(COALESCE(SUM(p.amount) / NULLIF(COUNT(*) FILTER (WHERE has_purchase = TRUE), 0), 0), 2) as avg_order_value,
    ROUND(COALESCE(SUM(p.amount) / NULLIF(COUNT(*), 0), 0), 2) as revenue_per_lead

FROM hist_contacts c
LEFT JOIN hist_payments p ON c.email = p.email AND p.payment_type != 'refund'
WHERE c.ad_type IN ('paid', 'organic')
    AND c.is_suspicious = FALSE

GROUP BY ad_type
ORDER BY total_revenue DESC;

-- =============================================================================
-- USAGE EXAMPLES
-- =============================================================================

-- See overall funnel performance:
-- SELECT * FROM v_funnel_summary;

-- See which trigger words generate most revenue:
-- SELECT * FROM v_top_trigger_words;

-- See paid vs organic performance:
-- SELECT * FROM v_paid_vs_organic;

-- See conversion rates over time:
-- SELECT * FROM v_conversion_over_time;

-- See how long it typically takes to convert:
-- SELECT * FROM v_time_to_purchase_summary;

-- See all individual time-to-purchase records:
-- SELECT * FROM v_time_to_purchase LIMIT 100;

-- Check data quality:
-- SELECT * FROM v_data_quality_report;
