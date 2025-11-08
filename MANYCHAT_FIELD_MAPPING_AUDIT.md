# ManyChat Field Mapping Audit

**Date:** January 7, 2025
**Purpose:** Document how ManyChat custom fields are mapped to database columns
**Location:** `app/api/manychat/route.ts` (lines 239-344)

---

## 🎯 Executive Summary

**Overall Status:** ✅ Mapping is well-structured and flexible

**Key Strengths:**
- Fallback patterns for field name variations (e.g., `AD_ID` OR `ADID`)
- Flexible source field (no longer hardcoded)
- Date fields mapped from ManyChat custom fields
- Question fields updated on every event

**Potential Improvements:**
- Missing `ig_id` mapping (field exists in schema but not used)
- No mapping for `followed_date` (field exists in schema)
- Some fields have multiple fallback names, could document which ones ManyChat actually uses

---

## 📊 Complete Field Mapping (Line 239-344)

### Base Data Fields (Always Updated)

These fields are updated on **every webhook event** (lines 243-261):

| Database Column | ManyChat Source | Fallback Options | Notes |
|----------------|-----------------|------------------|-------|
| `first_name` | `manychatData.first_name` | - | From subscriber object |
| `last_name` | `manychatData.last_name` | - | From subscriber object |
| `email_primary` | `manychatData.email` | → `customFields['custom field email']`<br>→ `customFields.MCB_SEARCH_EMAIL` | 3 fallback options |
| `phone` | `manychatData.phone` | → `manychatData.whatsapp_phone` | WhatsApp as backup |
| `IG` | `manychatData.ig_username` | → `manychatData.instagram_username` | Instagram handle |
| `ig_id` | `manychatData.ig_id` | - | ⚠️ Mapped but ManyChat may not provide this |
| `FB` | `manychatData.name` | - | Facebook name |
| `AD_ID` | `customFields.AD_ID` | → `customFields.ADID` | Facebook Ad ID |
| `chatbot_AB` | `customFields.chatbot_AB` | → `customFields['Chatbot AB Test']` | A/B test variant |
| `thread_ID` | `customFields.thread_id` | → `customFields['Conversation ID']` | OpenAI thread |
| `trigger_word` | `customFields.trigger_word` | → `customFields['All Tags']` | Trigger keyword |
| `subscribed` | `manychatData.subscribed` | - | Subscription status |
| `ig_last_interaction` | `manychatData.ig_last_interaction` | - | Last interaction time |
| `source` | `customFields.source` | → `customFields.Source`<br>→ `'instagram'` (default) | ✅ Now flexible! |

---

### Question Fields (Always Updated)

These fields are updated on **every webhook event** (lines 264-268):

| Database Column | ManyChat Source | Fallback Options | Notes |
|----------------|-----------------|------------------|-------|
| `Q1_question` | `customFields['Months Postpartum']` | → `customFields['How Far Postpartum']` | Qualification Q1 |
| `Q2_question` | `customFields.Symptoms` | - | Qualification Q2 |
| `objections` | `customFields.Objections` | - | Objections for data mining |

**Why update every time:** Answers might change if user goes through flow again

---

### Date Fields (If Available from ManyChat)

These are mapped **if ManyChat provides them** (lines 273-293):

| Database Column | ManyChat Custom Field | Notes |
|----------------|----------------------|-------|
| `link_send_date` | `DATE_LINK_SENT` | When booking link sent |
| `link_click_date` | `DATE_LINK_CLICKED` | When they clicked link |
| `form_submit_date` | `DATE_FORM_FILLED` | When form submitted |
| `DM_qualified_date` | `DATE_DM_QUALIFIED` | When both questions answered |
| `appointment_date` | `DATE_MEETING_BOOKED` | When meeting booked |
| `appointment_held_date` | `DATE_MEETING_HELD` | When meeting held |

**Fallback behavior:** If ManyChat doesn't provide these dates, webhook uses `new Date().toISOString()` based on event type

**Example:**
- Event: `link_sent` → Sets `link_send_date` to current timestamp
- Event with `DATE_LINK_SENT` custom field → Uses ManyChat's timestamp instead

---

### Event-Specific Fields

These fields are only set for specific event types:

#### `contact_created` Event (lines 297-304)
```typescript
{
  ...baseData,
  ...questionFields,
  ...dateFields,
  subscribe_date: new Date().toISOString(),
  stage: 'new_lead'
}
```

#### `dm_qualified` Event (lines 306-315)
```typescript
{
  ...baseData,
  ...questionFields,
  ...dateFields,
  lead_summary: customFields['Cody > Response'],
  DM_qualified_date: new Date().toISOString(),
  stage: 'DM_qualified'
}
```

**Special field:**
| Database Column | ManyChat Source | Event Required |
|----------------|-----------------|----------------|
| `lead_summary` | `customFields['Cody > Response']` | `dm_qualified` only |

#### `link_sent` Event (lines 317-324)
```typescript
{
  ...baseData,
  ...questionFields,
  ...dateFields,
  link_send_date: new Date().toISOString(),
  stage: 'landing_link_sent'
}
```

#### `link_clicked` Event (lines 326-333)
```typescript
{
  ...baseData,
  ...questionFields,
  ...dateFields,
  link_click_date: new Date().toISOString(),
  stage: 'landing_link_clicked'
}
```

#### `contact_update` or Unknown Event (lines 336-342)
```typescript
{
  ...baseData,
  ...questionFields,
  ...dateFields,
  lead_summary: customFields['Cody > Response']
}
```

---

## ⚠️ Fields in Schema But NOT Mapped

These fields exist in the database schema but are **NOT** mapped from ManyChat:

| Database Column | Why Not Mapped | Should We Map It? |
|----------------|----------------|-------------------|
| `followed_date` | Not provided by ManyChat | ❌ No - Can't track follower date via ManyChat API |
| `MISC_AB` | No ManyChat custom field for this | ⚠️ Maybe - If you add MISC A/B tests in future |
| `checkout_started` | Handled by Stripe webhook | ✅ Correct - Stripe owns this |
| `purchase_date` | Handled by Stripe/Denefits | ✅ Correct - Payment webhooks own this |
| `purchase_amount` | Handled by Stripe/Denefits | ✅ Correct - Payment webhooks own this |
| `feedback_sent_date` | Not applicable to ManyChat | ✅ Correct - Future feature |
| `feedback_received_date` | Not applicable to ManyChat | ✅ Correct - Future feature |
| `feedback_text` | Not applicable to ManyChat | ✅ Correct - Future feature |
| `meeting_book_date` | ⚠️ Mapped as `appointment_date` | ⚠️ Schema mismatch? |
| `meeting_held_date` | ✅ Mapped as `appointment_held_date` | ✅ Correct |

**Note:** There's a potential naming inconsistency:
- Schema has: `meeting_book_date` (line 69 in schema)
- Webhook maps to: `appointment_date` (line 288 in route.ts)
- These should probably be the same column name

---

## 🔍 Potential Issues & Recommendations

### Issue 1: `meeting_book_date` vs `appointment_date`

**Problem:** Schema defines `meeting_book_date`, but webhook maps to `appointment_date`

**Impact:** Medium - If schema doesn't have `appointment_date` column, this mapping fails silently

**Recommendation:** Check if schema has both columns or rename one to match

**Code location:** `app/api/manychat/route.ts:288`

---

### Issue 2: `ig_id` May Not Be Provided by ManyChat

**Problem:** Webhook maps `manychatData.ig_id` but ManyChat may not provide this field

**Impact:** Low - Field will just be null, no errors

**Recommendation:** Verify if ManyChat actually provides `ig_id` in subscriber data

**Code location:** `app/api/manychat/route.ts:249`

---

### Issue 3: Multiple Fallback Field Names

**Problem:** Some fields have multiple fallback names (e.g., `AD_ID` OR `ADID`)

**Impact:** None - This is actually good for flexibility

**Recommendation:** Document which field name ManyChat actually uses so you can simplify in future

**Examples:**
- `AD_ID` → `ADID`
- `chatbot_AB` → `Chatbot AB Test`
- `thread_id` → `Conversation ID`
- `Months Postpartum` → `How Far Postpartum`

---

### Issue 4: No Validation of Custom Field Values

**Problem:** No validation that custom fields contain expected data types

**Impact:** Low - Database will accept any text, but could cause issues in reports

**Example:** If `AD_ID` contains non-numeric value, might break ad performance queries

**Recommendation:** Consider adding validation in future if data quality becomes an issue

---

## ✅ What's Working Well

### 1. Flexible Source Field ✅
```typescript
source: customFields.source || customFields.Source || 'instagram'
```
- No longer hardcoded
- Supports variations like `instagram_lm`
- User can add new sources without code changes

### 2. Multiple Email Fallbacks ✅
```typescript
email_primary: manychatData.email || customFields['custom field email'] || customFields.MCB_SEARCH_EMAIL
```
- Checks ManyChat profile email first
- Falls back to custom field variants
- Ensures email is captured from somewhere

### 3. Date Field Override Pattern ✅
```typescript
// If ManyChat provides DATE_LINK_SENT, use it
if (customFields.DATE_LINK_SENT) {
  dateFields.link_send_date = customFields.DATE_LINK_SENT;
}
// Otherwise, webhook event creates timestamp
```
- Respects ManyChat's timestamps when available
- Falls back to webhook timestamp
- Best of both worlds

### 4. Question Fields Updated Every Event ✅
- Captures answers even if user goes through flow multiple times
- Ensures latest answers are always stored
- Good for users who change their mind

---

## 📝 ManyChat Custom Fields Reference

**Fields you should create in ManyChat** (if not already created):

### Core Tracking
- `source` - Traffic source (e.g., `instagram_lm`)
- `AD_ID` - Facebook Ad ID for attribution
- `chatbot_AB` - A/B test variant

### Qualification Questions
- `Months Postpartum` (or `How Far Postpartum`)
- `Symptoms`
- `Objections`

### Date Tracking (Optional - webhook can auto-generate)
- `DATE_LINK_SENT`
- `DATE_LINK_CLICKED`
- `DATE_FORM_FILLED`
- `DATE_DM_QUALIFIED`
- `DATE_MEETING_BOOKED`
- `DATE_MEETING_HELD`

### AI Context
- `Cody > Response` - AI-generated lead summary
- `thread_id` (or `Conversation ID`) - OpenAI thread ID

### User Info
- `custom field email` (or `MCB_SEARCH_EMAIL`) - Email backup
- `trigger_word` (or `All Tags`) - Trigger keyword

---

## 🧪 Testing Recommendations

### Test 1: Verify Field Name Variations Work
Send test webhook with different field name formats:
```json
{
  "subscriber": {
    "custom_fields": {
      "AD_ID": "123456789"  // Test standard format
    }
  }
}

{
  "subscriber": {
    "custom_fields": {
      "ADID": "123456789"  // Test fallback format
    }
  }
}
```

### Test 2: Verify Source Field Flexibility
```json
{
  "subscriber": {
    "custom_fields": {
      "source": "instagram_lm"  // Should use this
    }
  }
}

{
  "subscriber": {
    "custom_fields": {
      "Source": "facebook"  // Should use this (capitalized)
    }
  }
}

{
  "subscriber": {
    "custom_fields": {
      // No source field - should default to 'instagram'
    }
  }
}
```

### Test 3: Verify Date Override Works
```json
{
  "event_type": "link_sent",
  "subscriber": {
    "custom_fields": {
      "DATE_LINK_SENT": "2025-01-01T12:00:00Z"  // Should use this date
    }
  }
}

{
  "event_type": "link_sent",
  "subscriber": {
    "custom_fields": {
      // No DATE_LINK_SENT - should use webhook timestamp
    }
  }
}
```

---

## 🔄 Maintenance Checklist

When adding new ManyChat custom fields in the future:

1. ✅ Add field to ManyChat flow
2. ✅ Add mapping in `buildUpdateData()` function
3. ✅ Add to appropriate section (baseData, questionFields, or dateFields)
4. ✅ Consider adding fallback field name if ManyChat naming is inconsistent
5. ✅ Test with real webhook payload
6. ✅ Update this documentation

---

## 📚 Related Documentation

- **Source Field Guide:** `SOURCE_FIELD_CONVENTIONS.md`
- **Database Schema:** `schema_v2.1.sql` (contacts table structure)
- **Webhook Flow:** `WEBHOOK_GUIDE.md`
- **System Architecture:** `SYSTEM_ARCHITECTURE.md`

---

## 🎯 Summary & Action Items

### ✅ Good to Go
- Base data fields are well-mapped with fallbacks
- Question fields update on every event
- Source field is now flexible (no hardcoding)
- Date fields support ManyChat custom fields with webhook fallback

### ⚠️ Check These
- [ ] Verify `meeting_book_date` vs `appointment_date` column name
- [ ] Test if ManyChat provides `ig_id` in subscriber data
- [ ] Document which field name variants ManyChat actually uses

### 💡 Optional Improvements
- [ ] Add validation for `AD_ID` (ensure it's numeric)
- [ ] Add validation for email format
- [ ] Add validation for date format from ManyChat

---

**Last Updated:** January 7, 2025
**Maintained By:** Connor Johnson / AI Agents
**Update Trigger:** When ManyChat fields are added or mapping changes
