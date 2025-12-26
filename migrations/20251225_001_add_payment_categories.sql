-- Migration: Add Payment Categories and New Event Types
-- Date: 2025-12-25
-- Purpose: Enable categorization of payments (deposit, full_purchase, recurring, etc.)
--          and add new event types for deposit_paid and recurring_payment_received

-- ============================================================
-- 1. Add deposit_paid_date to contacts table
-- ============================================================
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS deposit_paid_date TIMESTAMPTZ;

COMMENT ON COLUMN contacts.deposit_paid_date IS 'When $100 deposit was paid (high intent indicator)';

-- ============================================================
-- 2. Add payment_category to payments table
-- ============================================================
ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_category TEXT;

COMMENT ON COLUMN payments.payment_category IS 'Payment categorization: deposit, full_purchase, payment_plan, downpayment, recurring, miscellaneous';

-- Add constraint for valid categories
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payments_category_check'
  ) THEN
    ALTER TABLE payments ADD CONSTRAINT payments_category_check
      CHECK (payment_category IS NULL OR payment_category IN (
        'deposit',           -- $100 Stripe deposits (high intent)
        'full_purchase',     -- >$100 Stripe full payments
        'payment_plan',      -- Denefits contract total (projected revenue)
        'downpayment',       -- Denefits initial downpayment
        'recurring',         -- Denefits monthly installments
        'miscellaneous'      -- <$100 misc payments (dad course, etc.)
      ));
  END IF;
END $$;

-- ============================================================
-- 3. Update funnel_events event_type constraint
-- ============================================================
-- Drop existing constraint if it exists
ALTER TABLE funnel_events DROP CONSTRAINT IF EXISTS funnel_events_event_type_check;

-- Add updated constraint with new event types
ALTER TABLE funnel_events ADD CONSTRAINT funnel_events_event_type_check CHECK (
  event_type IN (
    -- Contact lifecycle
    'contact_subscribed', 'contact_created', 'contact_updated',
    -- DM funnel stages
    'dm_qualified', 'link_sent', 'link_clicked', 'form_submitted',
    -- Appointment stages
    'appointment_scheduled', 'appointment_held', 'appointment_cancelled', 'appointment_rescheduled',
    -- Sales stages
    'package_sent',
    -- Payment events
    'checkout_started', 'purchase_completed', 'payment_refunded',
    'payment_plan_created', 'payment_plan_updated',
    'deposit_paid',                    -- NEW: $100 deposit paid
    'recurring_payment_received',      -- NEW: Denefits monthly payment
    -- Feedback stages
    'feedback_requested', 'feedback_received', 'testimonial_collected',
    -- System events
    'migration_event', 'manual_override'
  )
);

-- ============================================================
-- 4. Create index for payment category queries
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_payments_category
  ON payments(payment_category)
  WHERE payment_category IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payments_category_date
  ON payments(payment_category, payment_date)
  WHERE payment_category IS NOT NULL;

-- ============================================================
-- 5. Add index for deposit_paid_date queries
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_contacts_deposit_paid
  ON contacts(deposit_paid_date)
  WHERE deposit_paid_date IS NOT NULL;

-- ============================================================
-- Verification
-- ============================================================
-- Verify columns were added
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contacts' AND column_name = 'deposit_paid_date'
  ) THEN
    RAISE EXCEPTION 'deposit_paid_date column was not created';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'payment_category'
  ) THEN
    RAISE EXCEPTION 'payment_category column was not created';
  END IF;

  RAISE NOTICE 'Migration 20251225_001_add_payment_categories completed successfully';
END $$;
