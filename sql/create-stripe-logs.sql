-- Create a simple Stripe event logging table for debugging and monitoring
-- This helps track all Stripe webhook events, successful matches, and orphaned payments

CREATE TABLE IF NOT EXISTS stripe_webhook_logs (
    id SERIAL PRIMARY KEY,
    event_id TEXT UNIQUE, -- Stripe event ID to prevent duplicates
    event_type TEXT NOT NULL, -- payment_intent.succeeded, checkout.session.completed, etc.
    amount DECIMAL(10,2),
    currency TEXT DEFAULT 'usd',
    customer_email TEXT,
    customer_name TEXT,
    matched_contact_id TEXT REFERENCES contacts(user_id),
    match_confidence INTEGER, -- 0-100 confidence score
    match_method TEXT, -- 'email', 'name_fuzzy', 'not_matched'
    status TEXT CHECK (status IN ('matched', 'orphaned', 'refunded', 'failed')),
    raw_event JSONB, -- Store full Stripe event for debugging
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Indexes for common queries
    INDEX idx_stripe_logs_created_at (created_at DESC),
    INDEX idx_stripe_logs_status (status),
    INDEX idx_stripe_logs_matched_contact (matched_contact_id)
);

-- Create a view for orphaned payments that need manual review
CREATE OR REPLACE VIEW orphaned_payments AS
SELECT 
    id,
    event_id,
    amount,
    customer_email,
    customer_name,
    created_at,
    raw_event->>'description' AS description
FROM stripe_webhook_logs
WHERE status = 'orphaned'
    AND amount > 0
ORDER BY created_at DESC;

-- Create a view for payment analytics
CREATE OR REPLACE VIEW payment_analytics AS
SELECT 
    DATE_TRUNC('day', created_at) AS payment_date,
    COUNT(*) AS total_payments,
    COUNT(CASE WHEN status = 'matched' THEN 1 END) AS matched_payments,
    COUNT(CASE WHEN status = 'orphaned' THEN 1 END) AS orphaned_payments,
    SUM(CASE WHEN status = 'matched' THEN amount ELSE 0 END) AS matched_revenue,
    SUM(CASE WHEN status = 'orphaned' THEN amount ELSE 0 END) AS orphaned_revenue,
    ROUND(AVG(match_confidence)::numeric, 1) AS avg_match_confidence
FROM stripe_webhook_logs
WHERE event_type IN ('payment_intent.succeeded', 'checkout.session.completed')
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY payment_date DESC;

-- Quick check of recent activity
SELECT 
    event_type,
    COUNT(*) as count,
    SUM(amount) as total_amount,
    COUNT(matched_contact_id) as matched_count
FROM stripe_webhook_logs
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY event_type
ORDER BY count DESC;