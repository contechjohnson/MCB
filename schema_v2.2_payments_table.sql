-- MCB Schema v2.2 - Unified Payments Table
-- Replaces stripe_events with a universal payments table
-- Handles both Stripe (buy in full) and Denefits (buy now pay later)

-- ====================
-- Drop old stripe_events table
-- ====================

DROP TABLE IF EXISTS stripe_events CASCADE;

-- ====================
-- Create unified payments table
-- ====================

CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Link to contact (NULL = orphan payment)
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,

  -- Payment identification
  payment_event_id TEXT UNIQUE NOT NULL,    -- Stripe event_id OR Denefits contract_code
  payment_source TEXT NOT NULL,             -- 'stripe' or 'denefits'
  payment_type TEXT NOT NULL,               -- 'buy_in_full' or 'buy_now_pay_later'

  -- Customer info (for matching)
  customer_email TEXT,
  customer_name TEXT,
  customer_phone TEXT,

  -- Amount details
  amount DECIMAL(10, 2) NOT NULL,           -- Total amount (in dollars)
  currency TEXT DEFAULT 'usd',

  -- Payment status
  status TEXT NOT NULL,                     -- 'paid', 'pending', 'refunded', 'failed', 'active'
  payment_date TIMESTAMPTZ NOT NULL,        -- When payment was made/contract created

  -- Stripe-specific fields
  stripe_event_type TEXT,                   -- 'checkout.session.completed', 'charge.refunded', etc.
  stripe_customer_id TEXT,                  -- Stripe customer ID
  stripe_session_id TEXT,                   -- Checkout session ID

  -- Denefits-specific fields
  denefits_contract_id INTEGER,             -- Denefits contract ID number
  denefits_contract_code TEXT,              -- Contract code (e.g., "BRPVPS136294")
  denefits_financed_amount DECIMAL(10, 2),  -- Amount financed
  denefits_downpayment DECIMAL(10, 2),      -- Downpayment amount
  denefits_recurring_amount DECIMAL(10, 2), -- Monthly payment amount
  denefits_num_payments INTEGER,            -- Number of payments
  denefits_remaining_payments INTEGER,      -- Payments remaining

  -- Raw data for debugging
  raw_payload JSONB NOT NULL,               -- Full event/webhook payload

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Indexes for fast queries
  CONSTRAINT valid_payment_source CHECK (payment_source IN ('stripe', 'denefits')),
  CONSTRAINT valid_payment_type CHECK (payment_type IN ('buy_in_full', 'buy_now_pay_later'))
);

-- ====================
-- Indexes for performance
-- ====================

-- Contact lookups
CREATE INDEX idx_payments_contact_id ON payments(contact_id) WHERE contact_id IS NOT NULL;

-- Orphan payment queries
CREATE INDEX idx_payments_orphans ON payments(customer_email) WHERE contact_id IS NULL;

-- Payment source/type analytics
CREATE INDEX idx_payments_source ON payments(payment_source);
CREATE INDEX idx_payments_type ON payments(payment_type);
CREATE INDEX idx_payments_status ON payments(status);

-- Email matching (for retroactive linking)
CREATE INDEX idx_payments_email ON payments(customer_email) WHERE customer_email IS NOT NULL;

-- Date-based queries
CREATE INDEX idx_payments_date ON payments(payment_date);
CREATE INDEX idx_payments_created ON payments(created_at);

-- Stripe-specific lookups
CREATE INDEX idx_payments_stripe_customer ON payments(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
CREATE INDEX idx_payments_stripe_session ON payments(stripe_session_id) WHERE stripe_session_id IS NOT NULL;

-- Denefits-specific lookups
CREATE INDEX idx_payments_denefits_contract ON payments(denefits_contract_id) WHERE denefits_contract_id IS NOT NULL;

-- Prevent duplicate processing
CREATE UNIQUE INDEX idx_payments_event_id ON payments(payment_event_id);

-- ====================
-- Helper function: Find payment by email (for retroactive linking)
-- ====================

CREATE OR REPLACE FUNCTION link_orphan_payments(search_email TEXT)
RETURNS INTEGER AS $$
DECLARE
  linked_count INTEGER;
  target_contact_id UUID;
BEGIN
  -- Find contact by email
  SELECT id INTO target_contact_id
  FROM contacts
  WHERE email_primary ILIKE search_email
     OR email_booking ILIKE search_email
     OR email_payment ILIKE search_email
  LIMIT 1;

  IF target_contact_id IS NULL THEN
    RETURN 0;
  END IF;

  -- Link orphan payments
  UPDATE payments
  SET contact_id = target_contact_id,
      updated_at = NOW()
  WHERE customer_email ILIKE search_email
    AND contact_id IS NULL;

  GET DIAGNOSTICS linked_count = ROW_COUNT;

  -- Update contact's total purchase amount
  UPDATE contacts
  SET purchase_amount = (
    SELECT COALESCE(SUM(amount), 0)
    FROM payments
    WHERE contact_id = target_contact_id
      AND status IN ('paid', 'active')
  ),
  updated_at = NOW()
  WHERE id = target_contact_id;

  RETURN linked_count;
END;
$$ LANGUAGE plpgsql;

-- ====================
-- Helper function: Get attribution stats
-- ====================

CREATE OR REPLACE FUNCTION get_attribution_stats()
RETURNS TABLE(
  total_payments BIGINT,
  total_revenue NUMERIC,
  attributed_payments BIGINT,
  attributed_revenue NUMERIC,
  orphan_payments BIGINT,
  orphan_revenue NUMERIC,
  attribution_percentage NUMERIC,
  stripe_payments BIGINT,
  stripe_revenue NUMERIC,
  denefits_payments BIGINT,
  denefits_revenue NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as total_payments,
    COALESCE(SUM(amount), 0) as total_revenue,
    COUNT(*) FILTER (WHERE contact_id IS NOT NULL)::BIGINT as attributed_payments,
    COALESCE(SUM(amount) FILTER (WHERE contact_id IS NOT NULL), 0) as attributed_revenue,
    COUNT(*) FILTER (WHERE contact_id IS NULL)::BIGINT as orphan_payments,
    COALESCE(SUM(amount) FILTER (WHERE contact_id IS NULL), 0) as orphan_revenue,
    ROUND(
      CASE
        WHEN COUNT(*) > 0
        THEN (COUNT(*) FILTER (WHERE contact_id IS NOT NULL)::NUMERIC / COUNT(*)::NUMERIC) * 100
        ELSE 0
      END,
      2
    ) as attribution_percentage,
    COUNT(*) FILTER (WHERE payment_source = 'stripe')::BIGINT as stripe_payments,
    COALESCE(SUM(amount) FILTER (WHERE payment_source = 'stripe'), 0) as stripe_revenue,
    COUNT(*) FILTER (WHERE payment_source = 'denefits')::BIGINT as denefits_payments,
    COALESCE(SUM(amount) FILTER (WHERE payment_source = 'denefits'), 0) as denefits_revenue
  FROM payments
  WHERE status IN ('paid', 'active');
END;
$$ LANGUAGE plpgsql;

-- ====================
-- Comments for documentation
-- ====================

COMMENT ON TABLE payments IS 'Unified payments table tracking both Stripe (buy in full) and Denefits (buy now pay later) transactions';
COMMENT ON COLUMN payments.contact_id IS 'FK to contacts table. NULL = orphan payment (no attribution yet)';
COMMENT ON COLUMN payments.payment_event_id IS 'Unique identifier: Stripe event_id or Denefits contract_code';
COMMENT ON COLUMN payments.payment_type IS 'buy_in_full (Stripe) or buy_now_pay_later (Denefits)';
COMMENT ON COLUMN payments.customer_email IS 'Email used during payment/contract. Used for retroactive matching.';

-- ====================
-- Grant permissions (if using RLS)
-- ====================

-- Service role has full access (for webhooks)
-- Anon role has no direct access (all queries through service role)

COMMENT ON FUNCTION link_orphan_payments IS 'Links orphan payments to a contact when email matches. Returns count of linked payments.';
COMMENT ON FUNCTION get_attribution_stats IS 'Returns complete attribution metrics: total revenue, attribution %, source breakdown';
