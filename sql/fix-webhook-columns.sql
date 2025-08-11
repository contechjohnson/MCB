-- Fix column names to match what the webhook is sending (all lowercase)
-- PostgreSQL automatically lowercases unquoted column names

-- First, check if tags column exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'contacts' 
                   AND column_name = 'tags') THEN
        ALTER TABLE contacts ADD COLUMN tags TEXT;
    END IF;
END $$;

-- Add any other missing columns that the webhook expects
DO $$ 
BEGIN
    -- Add lowercase funnel progression columns if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'contacts' 
                   AND column_name = 'lead_contact') THEN
        ALTER TABLE contacts ADD COLUMN lead_contact BOOLEAN DEFAULT FALSE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'contacts' 
                   AND column_name = 'lead') THEN
        ALTER TABLE contacts ADD COLUMN lead BOOLEAN DEFAULT FALSE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'contacts' 
                   AND column_name = 'sent_email_magnet') THEN
        ALTER TABLE contacts ADD COLUMN sent_email_magnet BOOLEAN DEFAULT FALSE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'contacts' 
                   AND column_name = 'opened_email_magnet') THEN
        ALTER TABLE contacts ADD COLUMN opened_email_magnet BOOLEAN DEFAULT FALSE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'contacts' 
                   AND column_name = 'sent_link') THEN
        ALTER TABLE contacts ADD COLUMN sent_link BOOLEAN DEFAULT FALSE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'contacts' 
                   AND column_name = 'clicked_link') THEN
        ALTER TABLE contacts ADD COLUMN clicked_link BOOLEAN DEFAULT FALSE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'contacts' 
                   AND column_name = 'ready_to_book') THEN
        ALTER TABLE contacts ADD COLUMN ready_to_book BOOLEAN DEFAULT FALSE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'contacts' 
                   AND column_name = 'booked') THEN
        ALTER TABLE contacts ADD COLUMN booked BOOLEAN DEFAULT FALSE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'contacts' 
                   AND column_name = 'attended') THEN
        ALTER TABLE contacts ADD COLUMN attended BOOLEAN DEFAULT FALSE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'contacts' 
                   AND column_name = 'sent_package') THEN
        ALTER TABLE contacts ADD COLUMN sent_package BOOLEAN DEFAULT FALSE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'contacts' 
                   AND column_name = 'bought_package') THEN
        ALTER TABLE contacts ADD COLUMN bought_package BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- Migrate data from uppercase columns to lowercase if they exist
UPDATE contacts SET
    lead_contact = COALESCE(lead_contact, "LEAD_CONTACT", FALSE),
    lead = COALESCE(lead, "LEAD", FALSE),
    sent_email_magnet = COALESCE(sent_email_magnet, "SENT_EMAIL_MAGNET", FALSE),
    opened_email_magnet = COALESCE(opened_email_magnet, "OPENED_EMAIL_MAGNET", FALSE),
    sent_link = COALESCE(sent_link, "SENT_LINK", FALSE),
    clicked_link = COALESCE(clicked_link, "CLICKED_LINK", FALSE),
    ready_to_book = COALESCE(ready_to_book, "READY_TO_BOOK", FALSE),
    booked = COALESCE(booked, "BOOKED", FALSE),
    attended = COALESCE(attended, "ATTENDED", FALSE),
    sent_package = COALESCE(sent_package, "SENT_PACKAGE", FALSE),
    bought_package = COALESCE(bought_package, "BOUGHT_PACKAGE", FALSE)
WHERE 
    "LEAD_CONTACT" IS NOT NULL OR
    "LEAD" IS NOT NULL OR
    "SENT_EMAIL_MAGNET" IS NOT NULL OR
    "OPENED_EMAIL_MAGNET" IS NOT NULL OR
    "SENT_LINK" IS NOT NULL OR
    "CLICKED_LINK" IS NOT NULL OR
    "READY_TO_BOOK" IS NOT NULL OR
    "BOOKED" IS NOT NULL OR
    "ATTENDED" IS NOT NULL OR
    "SENT_PACKAGE" IS NOT NULL OR
    "BOUGHT_PACKAGE" IS NOT NULL;

-- Drop the uppercase columns if they exist
ALTER TABLE contacts 
    DROP COLUMN IF EXISTS "LEAD_CONTACT",
    DROP COLUMN IF EXISTS "LEAD",
    DROP COLUMN IF EXISTS "SENT_EMAIL_MAGNET",
    DROP COLUMN IF EXISTS "OPENED_EMAIL_MAGNET",
    DROP COLUMN IF EXISTS "SENT_LINK",
    DROP COLUMN IF EXISTS "CLICKED_LINK",
    DROP COLUMN IF EXISTS "READY_TO_BOOK",
    DROP COLUMN IF EXISTS "BOOKED",
    DROP COLUMN IF EXISTS "ATTENDED",
    DROP COLUMN IF EXISTS "SENT_PACKAGE",
    DROP COLUMN IF EXISTS "BOUGHT_PACKAGE";

-- Verify the webhook can now insert data
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'contacts' 
AND column_name IN ('tags', 'lead_contact', 'lead', 'sent_link', 'booked', 'attended')
ORDER BY column_name;