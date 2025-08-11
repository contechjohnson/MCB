-- Consolidate everything into stripe_webhook_logs table
-- Add columns needed for abandoned checkout tracking

-- Add missing columns to stripe_webhook_logs if they don't exist
ALTER TABLE stripe_webhook_logs 
ADD COLUMN IF NOT EXISTS customer_phone TEXT,
ADD COLUMN IF NOT EXISTS payment_method_type TEXT,
ADD COLUMN IF NOT EXISTS abandonment_reason TEXT,
ADD COLUMN IF NOT EXISTS abandoned_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS converted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'usd';

-- Update the status column to include all statuses
ALTER TABLE stripe_webhook_logs 
DROP CONSTRAINT IF EXISTS stripe_webhook_logs_status_check;

ALTER TABLE stripe_webhook_logs
ADD CONSTRAINT stripe_webhook_logs_status_check 
CHECK (status IN ('matched', 'orphaned', 'refunded', 'failed', 'pending', 'expired', 'unhandled', 'converted', 'bnpl_pending', 'bnpl_rejected'));

-- Drop old views first to avoid conflicts
DROP VIEW IF EXISTS hot_abandoned_leads CASCADE;
DROP VIEW IF EXISTS abandoned_to_converted CASCADE;
DROP VIEW IF EXISTS abandonment_analytics CASCADE;

-- Create view for hot abandoned leads using stripe_webhook_logs
CREATE VIEW hot_abandoned_leads AS
SELECT 
    swl.id,
    swl.checkout_session_id,
    swl.customer_email,
    swl.customer_name,
    swl.customer_phone,
    swl.amount AS amount_attempted,
    swl.status,
    swl.abandonment_reason,
    swl.payment_method_type,
    swl.created_at,
    swl.abandoned_at,
    -- Calculate hours since abandonment
    EXTRACT(EPOCH FROM (NOW() - COALESCE(swl.abandoned_at, swl.created_at))) / 3600 AS hours_since_abandoned,
    -- Include contact info if matched
    swl.matched_contact_id,
    c.first_name,
    c.last_name,
    c.phone_number,
    c.instagram_name,
    c.facebook_name
FROM stripe_webhook_logs swl
LEFT JOIN contacts c ON swl.matched_contact_id = c.user_id
WHERE swl.status IN ('expired', 'failed', 'bnpl_rejected', 'bnpl_pending')
    AND swl.converted_at IS NULL
    AND swl.customer_email IS NOT NULL
ORDER BY swl.created_at DESC;

-- Create view for conversion tracking (abandonments that later converted)
CREATE VIEW abandoned_to_converted AS
SELECT 
    checkout_session_id,
    customer_email,
    customer_name,
    amount AS amount_attempted,
    status AS initial_status,
    abandonment_reason,
    abandoned_at,
    converted_at,
    EXTRACT(EPOCH FROM (converted_at - abandoned_at)) / 3600 AS hours_to_conversion
FROM stripe_webhook_logs
WHERE converted_at IS NOT NULL
    AND abandoned_at IS NOT NULL
ORDER BY converted_at DESC;

-- Create analytics view for abandonment metrics
CREATE VIEW abandonment_analytics AS
SELECT 
    DATE_TRUNC('day', created_at) AS date,
    COUNT(CASE WHEN status IN ('expired', 'failed', 'bnpl_rejected', 'bnpl_pending') THEN 1 END) AS total_abandonments,
    COUNT(CASE WHEN status = 'expired' THEN 1 END) AS expired_checkouts,
    COUNT(CASE WHEN status IN ('failed', 'bnpl_rejected') THEN 1 END) AS failed_payments,
    COUNT(CASE WHEN status = 'bnpl_rejected' THEN 1 END) AS bnpl_rejections,
    COUNT(CASE WHEN converted_at IS NOT NULL THEN 1 END) AS recovered_sales,
    SUM(CASE WHEN status IN ('expired', 'failed', 'bnpl_rejected', 'bnpl_pending') THEN amount ELSE 0 END) AS total_value_at_risk,
    SUM(CASE WHEN converted_at IS NOT NULL THEN amount ELSE 0 END) AS recovered_value,
    ROUND(100.0 * COUNT(CASE WHEN converted_at IS NOT NULL THEN 1 END) / 
          NULLIF(COUNT(CASE WHEN status IN ('expired', 'failed', 'bnpl_rejected', 'bnpl_pending') THEN 1 END), 0), 1) AS recovery_rate
FROM stripe_webhook_logs
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY date DESC;

-- Drop the abandoned_checkouts table if it exists (we don't need it anymore)
DROP TABLE IF EXISTS abandoned_checkouts CASCADE;

-- Quick check
SELECT 'Consolidated into single stripe_webhook_logs table!' AS status;