# Source Field Conventions

**Last Updated:** January 7, 2025
**Purpose:** Document how the `source` field works and naming conventions

---

## 🎯 Purpose of Source Field

The `source` field tracks where a contact originated from. It's used for:
- Reporting (filter by traffic source)
- Attribution analysis (which channels drive conversions)
- Historical data distinction (`_historical` suffix)

**Database Column:** `contacts.source` (text, nullable)

---

## 📋 Source Field Format

### Live Traffic (Current/Future)

Format: `{platform}_{qualifier}` (optional qualifier)

**Examples:**
- `instagram` - Instagram DM traffic
- `instagram_lm` - Instagram lead magnet traffic
- `facebook` - Facebook Messenger traffic
- `website` - Direct website form submissions
- `tiktok` - TikTok traffic (future)
- `youtube` - YouTube traffic (future)

**Flexible:** New sources can be added anytime without code changes

### Historical Data (Imported)

Format: `{original_source}_historical`

**Examples:**
- `instagram_historical` - Old Instagram contacts
- `website_historical` - Old website contacts
- `unknown_historical` - Source was missing/unclear

**Purpose:** Distinguish imported data from live webhook data

---

## 🔧 How Source is Set

### ManyChat Webhook (`/api/manychat`)

```typescript
// Priority order:
1. customFields.source (if provided by ManyChat)
2. customFields.Source (capitalized variant)
3. Default: 'instagram'

// Example ManyChat custom field:
{
  "custom_fields": {
    "source": "instagram_lm"  // ← You can set this in ManyChat
  }
}
```

**To set a custom source:**
1. In ManyChat, create custom field called `source`
2. Set value based on entry point (e.g., `instagram_lm` for lead magnet)
3. Webhook will use this value instead of default

---

### GoHighLevel Webhook (`/api/ghl-webhook`)

```typescript
// Priority order:
1. customData.source (if provided in form submission)
2. Inferred from presence of MC_ID/AD_ID:
   - Has MC_ID or AD_ID? → 'instagram'
   - Neither? → 'website'

// Example GHL form submission:
{
  "customData": {
    "source": "instagram_lm",  // ← Can be set in hidden field
    "MC_ID": "123456"
  }
}
```

**To set a custom source:**
1. Add hidden field `source` to GHL form
2. Pass via URL parameter or pre-fill
3. Webhook will use this value

---

### Stripe Webhook (`/api/stripe-webhook`)

Source is NOT set by Stripe webhook. Contact must already exist.
Payment links to existing contact by email.

---

### Historical Import (`scripts/import-historical-contacts.js`)

```typescript
// Appends "_historical" to original source
function markAsHistorical(source) {
  if (!source || source.trim() === '') {
    return 'unknown_historical';
  }
  if (source.includes('_historical')) {
    return source;  // Already marked
  }
  return `${source}_historical`;  // Append suffix
}
```

---

## 🔍 Filtering by Source

### Exclude Historical Data

Used in weekly reports and analysis to focus on live traffic:

```typescript
// Next.js API route
const { data: contacts } = await supabaseAdmin
  .from('contacts')
  .select('*')
  .not('source', 'like', '%_historical%');  // Exclude all historical

// SQL
SELECT * FROM contacts
WHERE source NOT LIKE '%_historical%';
```

### Include Only Historical Data

Used for analyzing imported data:

```typescript
const { data: contacts } = await supabaseAdmin
  .from('contacts')
  .select('*')
  .like('source', '%_historical%');  // Only historical

// SQL
SELECT * FROM contacts
WHERE source LIKE '%_historical%';
```

### Filter by Specific Source

```typescript
// Instagram lead magnet only
const { data } = await supabaseAdmin
  .from('contacts')
  .select('*')
  .eq('source', 'instagram_lm');

// Instagram (all variants)
const { data } = await supabaseAdmin
  .from('contacts')
  .select('*')
  .like('source', 'instagram%');
```

---

## ✅ Current Sources in Use

As of January 7, 2025:

| Source | Count | Type | Description |
|--------|-------|------|-------------|
| `instagram` | ~147 | Live | ManyChat DM traffic (default) |
| `instagram_lm` | TBD | Live | Lead magnet traffic (new) |
| `website` | ~6 | Live | Direct GHL form submissions |
| `instagram_historical` | ~500+ | Historical | Imported Airtable data |
| `website_historical` | TBD | Historical | Imported website contacts |

**Note:** Exact counts in `CURRENT_STATUS_REPORT.md`

---

## 🚀 Adding New Sources

### For Live Traffic

**No code changes needed!** Just set the source value in your platform:

**ManyChat:**
1. Create custom field `source`
2. Set value (e.g., `facebook`, `tiktok_lm`)
3. Webhook automatically uses it

**GoHighLevel:**
1. Add hidden field `source` to form
2. Pre-fill or pass via URL parameter
3. Webhook automatically uses it

**Example URL with source:**
```
https://your-ghl-form.com?source=instagram_lm&MC_ID=123456
```

### For Historical Imports

When importing new historical data:

```javascript
// In import script
const source = `${originalSource}_historical`;

await supabaseAdmin.from('contacts').insert({
  // ... other fields
  source: source  // e.g., 'facebook_historical'
});
```

---

## 📊 Reporting Considerations

### Weekly Reports

**Current behavior:**
- Excludes `%_historical%` sources
- Focuses on live webhook traffic only
- See: `app/api/reports/weekly-data/route.ts:45`

**If you want to include historical:**
```typescript
// Remove this filter:
.not('source', 'like', '%_historical%')

// Or make it conditional:
const includeHistorical = searchParams.get('include_historical') === 'true';
if (!includeHistorical) {
  query = query.not('source', 'like', '%_historical%');
}
```

### Analytics Views

Database views automatically separate by source:

```sql
-- See: migrations/20250107_create_analytics_views.sql
CREATE VIEW v_contact_summary AS
SELECT
  COUNT(DISTINCT id) FILTER (WHERE source LIKE '%_historical%') as historical_contacts,
  COUNT(DISTINCT id) FILTER (WHERE source NOT LIKE '%_historical%') as live_contacts,
  ...
```

---

## 🐛 Troubleshooting

### Issue: All contacts showing 'instagram' source

**Cause:** Custom field not being sent in webhook
**Solution:**
1. Check ManyChat custom field exists and is populated
2. Check webhook payload includes `custom_fields.source`
3. Verify field name is lowercase `source` not `Source`

### Issue: Historical contacts not being filtered

**Cause:** Source doesn't have `_historical` suffix
**Solution:**
1. Check import script appended `_historical`
2. Run update query if needed:
   ```sql
   UPDATE contacts
   SET source = source || '_historical'
   WHERE created_at < '2025-01-01'
   AND source NOT LIKE '%_historical%';
   ```

### Issue: Want to rename source values

**Safe to do:** Source field is just text, can be updated anytime

```sql
-- Example: Rename 'instagram' to 'instagram_dm'
UPDATE contacts
SET source = 'instagram_dm'
WHERE source = 'instagram'
AND source NOT LIKE '%_historical%';
```

**No code changes needed** - reports and filters work with any source value

---

## 🔐 Best Practices

### ✅ Do's

- ✅ Use lowercase for consistency (`instagram`, not `Instagram`)
- ✅ Use underscores for qualifiers (`instagram_lm`, not `instagram-lm`)
- ✅ Keep names short and descriptive
- ✅ Document new sources in this file
- ✅ Test filtering logic after adding new sources

### ❌ Don'ts

- ❌ Hardcode source checks in multiple places (use filters)
- ❌ Use spaces in source values (`instagram lm` → `instagram_lm`)
- ❌ Mix capitalization (`Instagram` vs `instagram`)
- ❌ Forget to append `_historical` for imported data
- ❌ Use special characters except underscore

---

## 📝 Code References

**Where source is set:**
- `app/api/manychat/route.ts:259` - ManyChat default + custom field
- `app/api/ghl-webhook/route.ts:248` - GHL inference logic
- `scripts/import-historical-contacts.js:54` - Historical marking

**Where source is filtered:**
- `app/api/reports/weekly-data/route.ts:45` - Weekly reports
- `scripts/weekly-report-ai.js:149` - AI report generation
- `scripts/eric-weekly-report.js:27` - Legacy report
- `scripts/check-ad-performance.js:17` - Ad analysis

**Where source is analyzed:**
- `migrations/20250107_create_analytics_views.sql` - Database views
- `scripts/analyze-historical-data.js:17` - Historical analysis

---

## 🔄 Future Considerations

### Potential New Sources

- `facebook` - Facebook Messenger
- `tiktok` - TikTok DMs
- `youtube` - YouTube comments/DMs
- `email` - Email newsletter signups
- `referral` - Referral program traffic
- `organic` - Organic social traffic
- `paid_search` - Google/Bing ads
- `partnership` - Partner referrals

### Enhanced Tracking

Consider adding `source_detail` field for sub-categories:

```typescript
{
  source: 'instagram_lm',
  source_detail: 'sleep_guide_pdf'  // Which lead magnet
}
```

Or use structured format:

```typescript
{
  source: 'instagram',
  source_type: 'lead_magnet',
  source_campaign: 'sleep_guide_jan_2025'
}
```

**Current:** Single `source` field is sufficient
**Future:** Can add more fields if needed without breaking existing logic

---

## 📚 Related Documentation

- **System Architecture:** `SYSTEM_ARCHITECTURE.md` (data flow)
- **Database Schema:** `DATABASE_SCHEMA.md` (contacts table structure)
- **Webhook Guide:** `WEBHOOK_GUIDE.md` (webhook implementations)
- **Current Status:** `CURRENT_STATUS.md` (current source breakdown)

---

**Last Updated:** January 7, 2025
**Maintained By:** Connor Johnson / AI Agents
**Update Trigger:** When adding new sources or changing conventions
