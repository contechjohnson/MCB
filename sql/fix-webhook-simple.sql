-- Simple fix to ensure all required columns exist in lowercase
-- This is what the webhook expects

-- Add tags column if missing
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS tags TEXT;

-- Add lowercase funnel progression columns if missing
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS lead_contact BOOLEAN DEFAULT FALSE;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS lead BOOLEAN DEFAULT FALSE;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS sent_email_magnet BOOLEAN DEFAULT FALSE;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS opened_email_magnet BOOLEAN DEFAULT FALSE;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS sent_link BOOLEAN DEFAULT FALSE;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS clicked_link BOOLEAN DEFAULT FALSE;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS ready_to_book BOOLEAN DEFAULT FALSE;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS booked BOOLEAN DEFAULT FALSE;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS attended BOOLEAN DEFAULT FALSE;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS sent_package BOOLEAN DEFAULT FALSE;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS bought_package BOOLEAN DEFAULT FALSE;

-- Verify columns were created
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'contacts' 
AND column_name IN ('tags', 'lead_contact', 'lead', 'sent_link', 'booked', 'attended', 'bought_package')
ORDER BY column_name;