-- MCB Updated Schema - Matches exact spreadsheet structure
-- Drop existing table to start fresh
DROP TABLE IF EXISTS public.contacts CASCADE;
DROP VIEW IF EXISTS public.vw_funnel_daily CASCADE;

-- Create new contacts table matching spreadsheet columns exactly
CREATE TABLE public.contacts (
  -- Primary identifier
  user_id TEXT PRIMARY KEY, -- ManyChat subscriber ID
  
  -- Basic contact info
  first_name TEXT,
  last_name TEXT,
  instagram_name TEXT,
  facebook_name TEXT,
  email_address TEXT,
  phone_number TEXT,
  
  -- Subscription and interaction dates
  subscription_date TIMESTAMPTZ,
  last_ig_interaction TIMESTAMPTZ,
  last_fb_interaction TIMESTAMPTZ,
  
  -- Stage tracking
  stage TEXT CHECK (stage IN ('NO_STAGE', 'UNKNOWN_OUTBOUND', 'LEAD_CONTACT', 'LEAD', 'SENT_LINK', 'CLICKED_LINK', 'READY_TO_BOOK', 'BOOKED', 'ATTENDED', 'SENT_PACKAGE', 'BOUGHT_PACKAGE')),
  
  -- Health/symptom data
  symptoms TEXT,
  months_pp INTEGER, -- Months postpartum
  objections TEXT,
  has_symptoms_value BOOLEAN DEFAULT FALSE,
  has_months_value BOOLEAN DEFAULT FALSE,
  
  -- Funnel progression booleans (matching MCB field names exactly)
  LEAD_CONTACT BOOLEAN DEFAULT FALSE,
  LEAD BOOLEAN DEFAULT FALSE,
  SENT_EMAIL_MAGNET BOOLEAN DEFAULT FALSE,
  OPENED_EMAIL_MAGNET BOOLEAN DEFAULT FALSE,
  SENT_LINK BOOLEAN DEFAULT FALSE,
  CLICKED_LINK BOOLEAN DEFAULT FALSE,
  READY_TO_BOOK BOOLEAN DEFAULT FALSE,
  BOOKED BOOLEAN DEFAULT FALSE,
  ATTENDED BOOLEAN DEFAULT FALSE,
  SENT_PACKAGE BOOLEAN DEFAULT FALSE,
  BOUGHT_PACKAGE BOOLEAN DEFAULT FALSE,
  
  -- Conversation summary for sales reps
  summary TEXT,
  summary_updated_at TIMESTAMPTZ,
  
  -- Purchase data
  total_purchased DECIMAL(10,2) DEFAULT 0,
  
  -- Social engagement metrics
  ig_post_comments TEXT,
  ig_comment_count INTEGER DEFAULT 0,
  ig_follower BOOLEAN DEFAULT FALSE,
  fb_post_comments TEXT,
  fb_comment_count INTEGER DEFAULT 0,
  fb_page_follower BOOLEAN DEFAULT FALSE,
  
  -- Helper fields
  date_time_helper TIMESTAMPTZ,
  ig_or_fb TEXT CHECK (ig_or_fb IN ('Instagram', 'Facebook', 'Both')),
  
  -- Attribution and testing
  trigger_word_tags TEXT,
  ab_test_tags TEXT,
  paid_vs_organic TEXT CHECK (paid_vs_organic IN ('PAID', 'ORGANIC')),
  
  -- Thread and ad tracking
  thread_id TEXT,
  ad_id TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_contacts_user_id ON public.contacts(user_id);
CREATE INDEX idx_contacts_stage ON public.contacts(stage);
CREATE INDEX idx_contacts_subscription_date ON public.contacts(subscription_date);
CREATE INDEX idx_contacts_sent_link ON public.contacts(SENT_LINK);
CREATE INDEX idx_contacts_clicked_link ON public.contacts(CLICKED_LINK);  
CREATE INDEX idx_contacts_booked ON public.contacts(BOOKED);
CREATE INDEX idx_contacts_bought_package ON public.contacts(BOUGHT_PACKAGE);
CREATE INDEX idx_contacts_ig_or_fb ON public.contacts(ig_or_fb);
CREATE INDEX idx_contacts_paid_vs_organic ON public.contacts(paid_vs_organic);
CREATE INDEX idx_contacts_ab_test ON public.contacts(ab_test_tags);
CREATE INDEX idx_contacts_thread_id ON public.contacts(thread_id);

-- Function to calculate funnel metrics
CREATE OR REPLACE FUNCTION public.calculate_funnel_metrics()
RETURNS TABLE (
  metric_name TEXT,
  count_value BIGINT,
  percentage NUMERIC(5,2)
) LANGUAGE SQL AS $$
WITH counts AS (
  SELECT 
    COUNT(*) AS total_contacts,
    COUNT(*) FILTER (WHERE SENT_LINK = TRUE) AS sent_link_count,
    COUNT(*) FILTER (WHERE CLICKED_LINK = TRUE) AS clicked_link_count,
    COUNT(*) FILTER (WHERE BOOKED = TRUE) AS booked_count,
    COUNT(*) FILTER (WHERE ATTENDED = TRUE) AS attended_count,
    COUNT(*) FILTER (WHERE BOUGHT_PACKAGE = TRUE) AS bought_package_count
  FROM public.contacts
)
SELECT 'Total Contacts' AS metric_name, 
       total_contacts AS count_value,
       100.0 AS percentage
FROM counts
UNION ALL
SELECT 'Sent Link',
       sent_link_count,
       CASE WHEN total_contacts > 0 
            THEN ROUND(100.0 * sent_link_count / total_contacts, 2) 
            ELSE 0 END
FROM counts
UNION ALL
SELECT 'Clicked Link',
       clicked_link_count,
       CASE WHEN sent_link_count > 0 
            THEN ROUND(100.0 * clicked_link_count / sent_link_count, 2) 
            ELSE 0 END
FROM counts
UNION ALL
SELECT 'Booked',
       booked_count,
       CASE WHEN clicked_link_count > 0 
            THEN ROUND(100.0 * booked_count / clicked_link_count, 2) 
            ELSE 0 END
FROM counts
UNION ALL
SELECT 'Attended',
       attended_count,
       CASE WHEN booked_count > 0 
            THEN ROUND(100.0 * attended_count / booked_count, 2) 
            ELSE 0 END
FROM counts
UNION ALL
SELECT 'Bought Package',
       bought_package_count,
       CASE WHEN attended_count > 0 
            THEN ROUND(100.0 * bought_package_count / attended_count, 2) 
            ELSE 0 END
FROM counts;
$$;

-- Function to update stage based on progression
CREATE OR REPLACE FUNCTION public.update_contact_stage()
RETURNS TRIGGER AS $$
BEGIN
  -- Update stage based on funnel progression (check booleans in order)
  IF NEW.BOUGHT_PACKAGE = TRUE THEN
    NEW.stage := 'BOUGHT_PACKAGE';
  ELSIF NEW.SENT_PACKAGE = TRUE THEN
    NEW.stage := 'SENT_PACKAGE';
  ELSIF NEW.ATTENDED = TRUE THEN
    NEW.stage := 'ATTENDED';
  ELSIF NEW.BOOKED = TRUE THEN
    NEW.stage := 'BOOKED';
  ELSIF NEW.READY_TO_BOOK = TRUE THEN
    NEW.stage := 'READY_TO_BOOK';
  ELSIF NEW.CLICKED_LINK = TRUE THEN
    NEW.stage := 'CLICKED_LINK';
  ELSIF NEW.SENT_LINK = TRUE THEN
    NEW.stage := 'SENT_LINK';
  ELSIF NEW.LEAD = TRUE OR NEW.has_symptoms_value = TRUE OR NEW.has_months_value = TRUE THEN
    NEW.stage := 'LEAD';  -- They answered symptoms or months questions
  ELSIF NEW.LEAD_CONTACT = TRUE OR NEW.email_address IS NOT NULL OR NEW.phone_number IS NOT NULL THEN
    NEW.stage := 'LEAD_CONTACT';  -- We have their contact info
  ELSIF NEW.user_id IS NOT NULL THEN
    NEW.stage := 'UNKNOWN_OUTBOUND';
  ELSE
    NEW.stage := 'NO_STAGE';
  END IF;
  
  -- Update the timestamp helper
  NEW.date_time_helper := NOW();
  NEW.updated_at := NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update stage
CREATE TRIGGER update_stage_trigger
BEFORE INSERT OR UPDATE ON public.contacts
FOR EACH ROW
EXECUTE FUNCTION public.update_contact_stage();

-- View for daily metrics (simplified)
CREATE OR REPLACE VIEW public.vw_daily_metrics AS
SELECT 
  DATE(subscription_date) as date,
  ig_or_fb as channel,
  paid_vs_organic as source,
  ab_test_tags,
  COUNT(*) as total_contacts,
  COUNT(*) FILTER (WHERE SENT_LINK = TRUE) as sent_link_count,
  COUNT(*) FILTER (WHERE CLICKED_LINK = TRUE) as clicked_link_count,
  COUNT(*) FILTER (WHERE BOOKED = TRUE) as booked_count,
  COUNT(*) FILTER (WHERE ATTENDED = TRUE) as attended_count,
  COUNT(*) FILTER (WHERE BOUGHT_PACKAGE = TRUE) as bought_package_count,
  SUM(total_purchased) as revenue
FROM public.contacts
GROUP BY 1, 2, 3, 4
ORDER BY 1 DESC;

-- Grant permissions
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "Service role full access" ON public.contacts
  FOR ALL USING (auth.role() = 'service_role');

-- Anonymous can read for dashboard
CREATE POLICY "Anonymous read access" ON public.contacts
  FOR SELECT USING (true);

-- Grant permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.contacts TO anon;
GRANT SELECT ON public.vw_daily_metrics TO anon;
GRANT EXECUTE ON FUNCTION public.calculate_funnel_metrics TO anon;
GRANT ALL PRIVILEGES ON public.contacts TO service_role;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'New schema created successfully!';
  RAISE NOTICE 'Table: contacts with exact spreadsheet columns';
  RAISE NOTICE 'Triggers: Auto-update stage based on progression';
  RAISE NOTICE 'Views: Daily metrics aggregation';
END
$$;