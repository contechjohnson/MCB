-- Fix the channel constraint to allow 'test' values for testing
ALTER TABLE contacts 
DROP CONSTRAINT IF EXISTS contacts_channel_check;

ALTER TABLE contacts 
ADD CONSTRAINT contacts_channel_check 
CHECK (channel IN ('ig', 'fb', 'test'));