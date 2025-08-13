-- Add booking_date field to contacts table for tracking when appointments are scheduled
-- This captures the actual appointment date/time from GoHighLevel

ALTER TABLE public.contacts 
ADD COLUMN IF NOT EXISTS booking_date TIMESTAMPTZ;

-- Add index for booking date queries
CREATE INDEX IF NOT EXISTS idx_contacts_booking_date ON public.contacts(booking_date);

-- Add comment for clarity
COMMENT ON COLUMN public.contacts.booking_date IS 'The scheduled date and time of the booked appointment from GoHighLevel';