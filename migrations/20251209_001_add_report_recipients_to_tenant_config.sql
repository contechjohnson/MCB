/**
 * Migration: Add report_recipients to tenant config
 *
 * Stores email recipient lists in tenant config JSONB for automated reports.
 * This allows each tenant to have their own report distribution list.
 */

-- Update PPCU tenant config with report recipients
UPDATE tenants
SET config = config || jsonb_build_object(
  'report_recipients', jsonb_build_array(
    'eric@ppcareusa.com',
    'connor@columnline.com',
    'yulia@theadgirls.com',
    'hannah@theadgirls.com',
    'jennifer@theadgirls.com',
    'team@theadgirls.com',
    'courtney@theadgirls.com',
    'kristen@columnline.com'
  )
)
WHERE slug = 'ppcu';

-- Update Centner (placeholder for when they're ready)
UPDATE tenants
SET config = config || jsonb_build_object(
  'report_recipients', jsonb_build_array(
    'connor@columnline.com'
  )
)
WHERE slug = 'centner';

-- Update Columnline (internal)
UPDATE tenants
SET config = config || jsonb_build_object(
  'report_recipients', jsonb_build_array(
    'connor@columnline.com'
  )
)
WHERE slug = 'columnline';

-- Verify
SELECT slug, name, config->'report_recipients' as recipients
FROM tenants
ORDER BY slug;
