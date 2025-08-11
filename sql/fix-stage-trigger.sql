-- Fix the stage update trigger to properly order stages
-- LEAD_CONTACT should come AFTER LEAD in the funnel

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
  -- LEAD_CONTACT comes AFTER LEAD in the funnel
  ELSIF NEW.LEAD_CONTACT = TRUE OR (NEW.LEAD = TRUE AND (NEW.email_address IS NOT NULL OR NEW.phone_number IS NOT NULL)) THEN
    NEW.stage := 'LEAD_CONTACT';  -- Lead with contact info
  ELSIF NEW.LEAD = TRUE OR NEW.has_symptoms_value = TRUE OR NEW.has_months_value = TRUE THEN
    NEW.stage := 'LEAD';  -- Basic lead (no contact info yet)
  -- Check if we have names to distinguish between UNKNOWN_OUTBOUND and NO_STAGE
  ELSIF (NEW.first_name IS NULL AND NEW.last_name IS NULL AND NEW.instagram_name IS NULL AND NEW.facebook_name IS NULL) THEN
    NEW.stage := 'NO_STAGE';  -- No name info at all
  ELSE
    NEW.stage := 'UNKNOWN_OUTBOUND';  -- We contacted them but no response
  END IF;

  -- Also update the updated_at timestamp
  NEW.updated_at := NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Quick check
SELECT 'Stage trigger updated - LEAD comes before LEAD_CONTACT now' AS status;