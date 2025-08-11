-- Clean up expired checkout sessions with no customer info
-- These are just noise - people who started checkout but never entered any details

-- First, let's see what we're about to delete
SELECT COUNT(*), status, event_type
FROM stripe_webhook_logs
WHERE status = 'expired'
  AND customer_email IS NULL
  AND customer_name IS NULL
GROUP BY status, event_type;

-- Delete the empty expired sessions
DELETE FROM stripe_webhook_logs
WHERE status = 'expired'
  AND customer_email IS NULL
  AND customer_name IS NULL;

-- Verify cleanup
SELECT 'Cleaned up empty expired sessions. Remaining expired sessions with customer info:' AS status;

SELECT COUNT(*) as expired_with_info
FROM stripe_webhook_logs
WHERE status = 'expired'
  AND (customer_email IS NOT NULL OR customer_name IS NOT NULL);