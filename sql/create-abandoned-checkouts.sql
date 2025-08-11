-- Create table for tracking abandoned/failed checkout attempts
-- These are HOT LEADS who were ready to pay but didn't complete

CREATE TABLE IF NOT EXISTS abandoned_checkouts (
    id SERIAL PRIMARY KEY,
    checkout_session_id TEXT UNIQUE NOT NULL, -- Stripe's checkout session ID
    customer_email TEXT,
    customer_name TEXT,
    customer_phone TEXT,
    amount_attempted DECIMAL(10,2),
    currency TEXT DEFAULT 'usd',
    
    -- Status tracking
    status TEXT CHECK (status IN ('pending', 'expired', 'failed', 'converted', 'bnpl_pending', 'bnpl_rejected')),
    abandonment_reason TEXT, -- timeout, payment_failed, bnpl_rejected, etc.
    
    -- Link to contact if matched
    matched_contact_id TEXT REFERENCES contacts(user_id),
    match_confidence INTEGER,
    
    -- Payment method details
    payment_method_type TEXT, -- card, affirm, klarna, afterpay, etc.
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    abandoned_at TIMESTAMPTZ,
    converted_at TIMESTAMPTZ, -- If they eventually complete payment
    
    -- Raw Stripe data for debugging
    raw_event JSONB,
    
    -- Indexes for queries
    INDEX idx_abandoned_status (status),
    INDEX idx_abandoned_email (customer_email),
    INDEX idx_abandoned_created (created_at DESC)
);

-- Create view for hot leads (abandoned checkouts that haven't converted)
CREATE OR REPLACE VIEW hot_abandoned_leads AS
SELECT 
    ac.id,
    ac.checkout_session_id,
    ac.customer_email,
    ac.customer_name,
    ac.customer_phone,
    ac.amount_attempted,
    ac.status,
    ac.abandonment_reason,
    ac.payment_method_type,
    ac.created_at,
    ac.abandoned_at,
    -- Calculate hours since abandonment
    EXTRACT(EPOCH FROM (NOW() - COALESCE(ac.abandoned_at, ac.created_at))) / 3600 AS hours_since_abandoned,
    -- Include contact info if matched
    c.user_id,
    c.first_name,
    c.last_name,
    c.phone_number,
    c.ig_username,
    c.fb_username
FROM abandoned_checkouts ac
LEFT JOIN contacts c ON ac.matched_contact_id = c.user_id
WHERE ac.status IN ('expired', 'failed', 'bnpl_rejected')
    AND ac.converted_at IS NULL
    AND ac.customer_email IS NOT NULL
ORDER BY ac.created_at DESC;

-- Create view for conversion tracking (abandonments that later converted)
CREATE OR REPLACE VIEW abandoned_to_converted AS
SELECT 
    checkout_session_id,
    customer_email,
    customer_name,
    amount_attempted,
    status AS initial_status,
    abandonment_reason,
    created_at AS abandoned_at,
    converted_at,
    EXTRACT(EPOCH FROM (converted_at - created_at)) / 3600 AS hours_to_conversion
FROM abandoned_checkouts
WHERE converted_at IS NOT NULL
ORDER BY converted_at DESC;

-- Create analytics view for abandonment metrics
CREATE OR REPLACE VIEW abandonment_analytics AS
SELECT 
    DATE_TRUNC('day', created_at) AS date,
    COUNT(*) AS total_abandonments,
    COUNT(CASE WHEN status = 'expired' THEN 1 END) AS expired_checkouts,
    COUNT(CASE WHEN status = 'failed' THEN 1 END) AS failed_payments,
    COUNT(CASE WHEN status = 'bnpl_rejected' THEN 1 END) AS bnpl_rejections,
    COUNT(CASE WHEN converted_at IS NOT NULL THEN 1 END) AS recovered_sales,
    SUM(amount_attempted) AS total_value_at_risk,
    SUM(CASE WHEN converted_at IS NOT NULL THEN amount_attempted ELSE 0 END) AS recovered_value,
    ROUND(100.0 * COUNT(CASE WHEN converted_at IS NOT NULL THEN 1 END) / NULLIF(COUNT(*), 0), 1) AS recovery_rate
FROM abandoned_checkouts
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY date DESC;

-- Update stripe_webhook_logs to include checkout_session_id
ALTER TABLE stripe_webhook_logs 
ADD COLUMN IF NOT EXISTS checkout_session_id TEXT;

-- Create index for linking events by session
CREATE INDEX IF NOT EXISTS idx_stripe_logs_session ON stripe_webhook_logs(checkout_session_id);

-- Quick check
SELECT 'Abandoned checkouts table created. Ready to track hot leads!' AS status;