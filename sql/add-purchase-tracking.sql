-- Add columns for tracking purchase dates and cycle times
-- This enables business analytics on customer journey timing

-- Add purchase date tracking columns
ALTER TABLE contacts 
ADD COLUMN IF NOT EXISTS first_purchase_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS first_purchase_amount DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS package_purchase_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS package_purchase_amount DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS last_interaction_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS subscription_date TIMESTAMPTZ;

-- Set subscription_date to created_at for existing records if not set
UPDATE contacts 
SET subscription_date = created_at 
WHERE subscription_date IS NULL AND created_at IS NOT NULL;

-- Create indexes for better query performance on date columns
CREATE INDEX IF NOT EXISTS idx_contacts_first_purchase_date ON contacts(first_purchase_date);
CREATE INDEX IF NOT EXISTS idx_contacts_package_purchase_date ON contacts(package_purchase_date);
CREATE INDEX IF NOT EXISTS idx_contacts_subscription_date ON contacts(subscription_date);
CREATE INDEX IF NOT EXISTS idx_contacts_last_interaction_date ON contacts(last_interaction_date);

-- Create a view for cycle time analytics
CREATE OR REPLACE VIEW cycle_time_analytics AS
SELECT 
    user_id,
    first_name,
    last_name,
    subscription_date,
    first_purchase_date,
    package_purchase_date,
    last_interaction_date,
    
    -- Calculate cycle times in days
    CASE 
        WHEN first_purchase_date IS NOT NULL AND subscription_date IS NOT NULL 
        THEN EXTRACT(EPOCH FROM (first_purchase_date - subscription_date)) / 86400
        ELSE NULL 
    END AS days_to_first_purchase,
    
    CASE 
        WHEN package_purchase_date IS NOT NULL AND first_purchase_date IS NOT NULL 
        THEN EXTRACT(EPOCH FROM (package_purchase_date - first_purchase_date)) / 86400
        ELSE NULL 
    END AS days_first_to_package,
    
    CASE 
        WHEN package_purchase_date IS NOT NULL AND last_interaction_date IS NOT NULL 
        THEN EXTRACT(EPOCH FROM (package_purchase_date - last_interaction_date)) / 86400
        ELSE NULL 
    END AS days_last_contact_to_package,
    
    CASE 
        WHEN last_interaction_date IS NOT NULL AND subscription_date IS NOT NULL 
        AND (first_purchase_date IS NOT NULL OR package_purchase_date IS NOT NULL)
        THEN EXTRACT(EPOCH FROM (last_interaction_date - subscription_date)) / 86400
        ELSE NULL 
    END AS days_engaged_for_buyers,
    
    -- Purchase status flags
    CASE WHEN first_purchase_date IS NOT NULL THEN TRUE ELSE FALSE END AS has_first_purchase,
    CASE WHEN package_purchase_date IS NOT NULL THEN TRUE ELSE FALSE END AS has_package_purchase,
    
    -- Month for grouping
    DATE_TRUNC('month', subscription_date) AS subscription_month,
    DATE_TRUNC('month', first_purchase_date) AS first_purchase_month,
    DATE_TRUNC('month', package_purchase_date) AS package_purchase_month
    
FROM contacts
WHERE subscription_date IS NOT NULL;

-- Create monthly aggregates view
CREATE OR REPLACE VIEW monthly_cycle_metrics AS
SELECT 
    DATE_TRUNC('month', subscription_date) AS month,
    
    -- Average cycle times
    ROUND(AVG(days_to_first_purchase)::numeric, 1) AS avg_days_to_first_purchase,
    ROUND(AVG(days_first_to_package)::numeric, 1) AS avg_days_first_to_package,
    ROUND(AVG(days_last_contact_to_package)::numeric, 1) AS avg_days_last_contact_to_package,
    ROUND(AVG(days_engaged_for_buyers)::numeric, 1) AS avg_days_engaged,
    
    -- Median cycle times (more robust to outliers)
    ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY days_to_first_purchase)::numeric, 1) AS median_days_to_first_purchase,
    ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY days_first_to_package)::numeric, 1) AS median_days_first_to_package,
    
    -- Counts
    COUNT(*) AS total_subscriptions,
    COUNT(first_purchase_date) AS total_first_purchases,
    COUNT(package_purchase_date) AS total_package_purchases,
    
    -- Conversion rates
    ROUND(100.0 * COUNT(first_purchase_date) / NULLIF(COUNT(*), 0), 1) AS first_purchase_rate,
    ROUND(100.0 * COUNT(package_purchase_date) / NULLIF(COUNT(*), 0), 1) AS package_purchase_rate
    
FROM cycle_time_analytics
WHERE subscription_date >= NOW() - INTERVAL '12 months'
    AND days_to_first_purchase < 365  -- Exclude outliers
    AND days_first_to_package < 365
GROUP BY DATE_TRUNC('month', subscription_date)
ORDER BY month DESC;

-- Verify the new columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'contacts' 
AND column_name IN ('first_purchase_date', 'package_purchase_date', 'last_interaction_date', 'subscription_date')
ORDER BY column_name;