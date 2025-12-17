-- ============================================================
-- Add Centner Wellness Integration Credentials
-- Date: December 11, 2025
-- Purpose: Configure ManyChat, GHL, Stripe, and Instagram integrations for Centner tenant
-- ============================================================

-- Centner tenant_id: 4b8c38aa-969f-4fb6-846e-f59436bda9d4

-- ManyChat integration
INSERT INTO tenant_integrations (tenant_id, provider, credentials, is_active)
VALUES (
  '4b8c38aa-969f-4fb6-846e-f59436bda9d4',
  'manychat',
  jsonb_build_object(
    'api_key', '[USER_PROVIDED_MANYCHAT_API_KEY]',
    'bot_id', '[USER_PROVIDED_MANYCHAT_BOT_ID]'
  ),
  true
)
ON CONFLICT (tenant_id, provider) DO UPDATE
SET
  credentials = EXCLUDED.credentials,
  is_active = EXCLUDED.is_active,
  updated_at = now();

-- GoHighLevel integration
INSERT INTO tenant_integrations (tenant_id, provider, credentials, is_active)
VALUES (
  '4b8c38aa-969f-4fb6-846e-f59436bda9d4',
  'ghl',
  jsonb_build_object(
    'api_key', '[USER_PROVIDED_GHL_API_KEY]',
    'location_id', '[USER_PROVIDED_GHL_LOCATION_ID]'
  ),
  true
)
ON CONFLICT (tenant_id, provider) DO UPDATE
SET
  credentials = EXCLUDED.credentials,
  is_active = EXCLUDED.is_active,
  updated_at = now();

-- Stripe integration
INSERT INTO tenant_integrations (tenant_id, provider, credentials, webhook_secret, is_active)
VALUES (
  '4b8c38aa-969f-4fb6-846e-f59436bda9d4',
  'stripe',
  jsonb_build_object(
    'secret_key', '[USER_PROVIDED_STRIPE_SECRET_KEY]'
  ),
  '[USER_PROVIDED_STRIPE_WEBHOOK_SECRET]',
  true
)
ON CONFLICT (tenant_id, provider) DO UPDATE
SET
  credentials = EXCLUDED.credentials,
  webhook_secret = EXCLUDED.webhook_secret,
  is_active = EXCLUDED.is_active,
  updated_at = now();

-- Instagram Business API (for content reach metrics)
INSERT INTO tenant_integrations (tenant_id, provider, credentials, is_active)
VALUES (
  '4b8c38aa-969f-4fb6-846e-f59436bda9d4',
  'instagram',
  jsonb_build_object(
    'access_token', '[USER_PROVIDED_INSTAGRAM_ACCESS_TOKEN]',
    'business_account_id', '[USER_PROVIDED_INSTAGRAM_BUSINESS_ACCOUNT_ID]'
  ),
  true
)
ON CONFLICT (tenant_id, provider) DO UPDATE
SET
  credentials = EXCLUDED.credentials,
  is_active = EXCLUDED.is_active,
  updated_at = now();

-- ============================================================
-- INSTRUCTIONS FOR USER:
-- ============================================================
-- Before applying this migration, replace the placeholders:
--
-- ManyChat:
--   - [USER_PROVIDED_MANYCHAT_API_KEY]: Get from ManyChat Settings > API & Webhooks
--   - [USER_PROVIDED_MANYCHAT_BOT_ID]: Get from ManyChat Settings > API & Webhooks
--
-- GoHighLevel:
--   - [USER_PROVIDED_GHL_API_KEY]: Get from GHL Settings > API Keys
--   - [USER_PROVIDED_GHL_LOCATION_ID]: Get from GHL account
--
-- Stripe:
--   - [USER_PROVIDED_STRIPE_SECRET_KEY]: Get from Stripe Dashboard > Developers > API Keys
--   - [USER_PROVIDED_STRIPE_WEBHOOK_SECRET]: Get after creating webhook endpoint
--
-- Instagram:
--   - [USER_PROVIDED_INSTAGRAM_ACCESS_TOKEN]: Get from Facebook Graph API
--   - [USER_PROVIDED_INSTAGRAM_BUSINESS_ACCOUNT_ID]: Get from Instagram Business Account
-- ============================================================
