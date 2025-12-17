-- ============================================================
-- Add 28-day spend tracking to Meta Ads tables
-- Date: December 11, 2025
-- Purpose: Track 28-day spend alongside 7-day spend for better reporting
-- ============================================================

-- Add spend_28d to meta_ads table
ALTER TABLE meta_ads
ADD COLUMN IF NOT EXISTS spend_28d DECIMAL(10,2);

COMMENT ON COLUMN meta_ads.spend_28d IS 'Last 28 days ad spend in USD (for monthly reporting)';

-- Add spend_28d to meta_ad_insights table
ALTER TABLE meta_ad_insights
ADD COLUMN IF NOT EXISTS spend_28d DECIMAL(10,2);

COMMENT ON COLUMN meta_ad_insights.spend_28d IS 'Last 28 days ad spend in USD at snapshot_date (for monthly reporting)';
