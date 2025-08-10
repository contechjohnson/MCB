# MCB Database Schema Documentation

## Overview
The MCB system uses a single `contacts` table to track all user interactions, funnel progression, and conversation data. The schema is designed to match the exact structure of the original spreadsheet data while adding real-time tracking capabilities.

## Table: contacts

### Primary Key
- `user_id` (TEXT) - ManyChat subscriber ID

### Contact Information
- `first_name` (TEXT)
- `last_name` (TEXT)
- `instagram_name` (TEXT)
- `facebook_name` (TEXT)
- `email_address` (TEXT)
- `phone_number` (TEXT)

### Timestamps
- `subscription_date` (TIMESTAMPTZ) - When they first subscribed
- `last_ig_interaction` (TIMESTAMPTZ) - Last Instagram interaction
- `last_fb_interaction` (TIMESTAMPTZ) - Last Facebook interaction
- `date_time_helper` (TIMESTAMPTZ) - Auto-updated on any change
- `created_at` (TIMESTAMPTZ) - Record creation
- `updated_at` (TIMESTAMPTZ) - Last update
- `summary_updated_at` (TIMESTAMPTZ) - When summary was last generated

### Stage & Funnel Progression

#### Stage Field
- `stage` (TEXT) - Current stage in the funnel
  - Allowed values: `NO_STAGE`, `UNKNOWN_OUTBOUND`, `LEAD_CONTACT`, `LEAD`, `SENT_LINK`, `CLICKED_LINK`, `READY_TO_BOOK`, `BOOKED`, `ATTENDED`, `SENT_PACKAGE`, `BOUGHT_PACKAGE`
  - Auto-updates based on boolean flags via database trigger

#### Boolean Progression Flags
These match ManyChat's MCB custom fields exactly:
- `LEAD_CONTACT` (BOOLEAN) - Have contact info (email/phone)
- `LEAD` (BOOLEAN) - Answered symptom/months questions
- `SENT_EMAIL_MAGNET` (BOOLEAN) - Lead magnet email sent
- `OPENED_EMAIL_MAGNET` (BOOLEAN) - Lead magnet email opened
- `SENT_LINK` (BOOLEAN) - Booking link sent
- `CLICKED_LINK` (BOOLEAN) - Clicked the booking link
- `READY_TO_BOOK` (BOOLEAN) - Ready to book (manual flag)
- `BOOKED` (BOOLEAN) - Appointment booked
- `ATTENDED` (BOOLEAN) - Showed up to appointment
- `SENT_PACKAGE` (BOOLEAN) - Package/offer sent
- `BOUGHT_PACKAGE` (BOOLEAN) - Made a purchase

### Health/Symptom Data
- `symptoms` (TEXT) - Reported symptoms
- `months_pp` (INTEGER) - Months postpartum
- `objections` (TEXT) - Sales objections
- `has_symptoms_value` (BOOLEAN) - Has provided symptoms
- `has_months_value` (BOOLEAN) - Has provided months postpartum

### Conversation Summary
- `summary` (TEXT) - AI-generated summary of conversation for sales reps
- `thread_id` (TEXT) - ManyChat conversation/thread ID

### Purchase Data
- `total_purchased` (DECIMAL) - Total purchase amount
- `ad_id` (TEXT) - Facebook Ad ID for attribution

### Social Engagement
- `ig_post_comments` (TEXT)
- `ig_comment_count` (INTEGER)
- `ig_follower` (BOOLEAN)
- `fb_post_comments` (TEXT)
- `fb_comment_count` (INTEGER)
- `fb_page_follower` (BOOLEAN)

### Attribution
- `ig_or_fb` (TEXT) - Channel: 'Instagram', 'Facebook', or 'Both'
- `trigger_word_tags` (TEXT) - Keywords that triggered the bot
- `ab_test_tags` (TEXT) - A/B test variant
- `paid_vs_organic` (TEXT) - 'PAID' or 'ORGANIC'

## Stage Update Logic

The `update_contact_stage()` trigger automatically sets the stage based on the highest progression boolean that is TRUE:

1. **BOUGHT_PACKAGE** - If `BOUGHT_PACKAGE = TRUE`
2. **SENT_PACKAGE** - If `SENT_PACKAGE = TRUE`
3. **ATTENDED** - If `ATTENDED = TRUE`
4. **BOOKED** - If `BOOKED = TRUE`
5. **READY_TO_BOOK** - If `READY_TO_BOOK = TRUE`
6. **CLICKED_LINK** - If `CLICKED_LINK = TRUE`
7. **SENT_LINK** - If `SENT_LINK = TRUE`
8. **LEAD** - If `LEAD = TRUE` OR has symptoms/months data
9. **LEAD_CONTACT** - If `LEAD_CONTACT = TRUE` OR has email/phone
10. **UNKNOWN_OUTBOUND** - If user exists but no other data
11. **NO_STAGE** - Default/fallback

## ManyChat Integration

### Webhook Mapping
The webhook at `/api/ai-router` maps ManyChat custom fields to database columns:

```
MCB_LEAD_CONTACT → LEAD_CONTACT
MCB_LEAD → LEAD
MCB_SENT_EMAIL_MAGNET → SENT_EMAIL_MAGNET
MCB_OPENED_EMAIL_MAGNET → OPENED_EMAIL_MAGNET
MCB_SENT_LINK → SENT_LINK
MCB_CLICKED_LINK → CLICKED_LINK
MCB_READY_TO_BOOK → READY_TO_BOOK
MCB_BOOKED → BOOKED
MCB_ATTENDED → ATTENDED
MCB_SENT_PACKAGE → SENT_PACKAGE
MCB_BOUGHT_PACKAGE → BOUGHT_PACKAGE
```

### Summary Generation Flow
1. ManyChat sends contact data with `thread_id`
2. System stores/updates contact in database
3. Separate process can query thread conversation history
4. AI generates summary and updates `summary` field
5. Sales reps can view summary when reaching out

## Indexes for Performance
- User ID lookup
- Stage filtering
- Funnel boolean flags
- Attribution fields
- Thread ID for conversation lookup

## Views

### vw_daily_metrics
Aggregates funnel metrics by day, channel, source, and A/B test variant:
- Total contacts
- Counts for each funnel stage
- Revenue totals

## Usage Examples

### Get contacts at specific stage
```sql
SELECT * FROM contacts WHERE stage = 'BOOKED';
```

### Get conversion metrics
```sql
SELECT * FROM calculate_funnel_metrics();
```

### Find contacts ready for outreach
```sql
SELECT user_id, first_name, email_address, summary 
FROM contacts 
WHERE CLICKED_LINK = TRUE 
  AND BOOKED = FALSE
  AND email_address IS NOT NULL;
```

### Update summary for a contact
```sql
UPDATE contacts 
SET summary = 'Generated summary text...', 
    summary_updated_at = NOW()
WHERE user_id = '12345';
```