# Google Sheet to Supabase Migration Mapping

## Your Sheet Columns → Our Supabase Fields

### Core Identity Fields
- **User ID** → `mcid` (primary key)
- **First Name + Last Name** → `name`
- **Instagram Name** → `username` (when channel='ig')
- **Facebook Name** → `username` (when channel='fb')
- **Email Address** → `email`
- **Phone Number** → `phone`

### Channel & Timing
- **IG or FB** → `channel`
- **Last IG Interaction** → `last_igfb_interaction_at` (when IG)
- **Last FB Interaction** → `last_igfb_interaction_at` (when FB)
- **Subscription Date** → `created_at`

### Stage & Progression
- **Stage** → `stage` (parse: "Clicked Link (Stage 5 of 12)" → "qualified")
- **Sent Link** (TRUE) → set `dm_started_at`
- **Sent Downsell** (TRUE) → set `dm_started_at`
- **Clicked Link** (TRUE) → set `booking_shown_at`
- **Clicked Downsell** (TRUE) → set `booking_shown_at`
- **Clicked Booking** (TRUE) → set `booking_clicked_at`
- **Booked** (TRUE) → set `booked_at`
- **Attended** (TRUE) → set `attended_at`
- **Bought Package** (TRUE) → set `purchased_at`
- **Total Purchased** → `purchase_amount_cents` (multiply by 100)

### Client-Specific Fields
- **Symptoms** → `symptoms`
- **Months PP** → `months_postpartum`
- **Objections** → `objections_json` (as array)

### Tags & Attribution
- **Trigger Word TAGs** → `trigger_tag` (first one)
- **AB - Test Tags** → `ab_variant` (extract A/B)
- **PAID VS ORGANIC** → `acquisition_source`
- **Ad_Id** → `attribution_json.ad_id`

### Thread & Conversation
- **Thread ID** → `custom_json.thread_id`

### Social Metrics (store in custom_json)
- **IG Follower** → `custom_json.ig_follower`
- **FB Page Follower** → `custom_json.fb_follower`
- **IG Comment Count** → `custom_json.ig_comment_count`
- **FB Comment Count** → `custom_json.fb_comment_count`

## Fields We Don't Need to Import
- Has Symptoms Value (derived)
- Has Months Value (derived)
- Added To Cart (not in our funnel)
- DATE TIME HELPER (calculated)
- IG Post Comments (text field, not needed)
- FB Post Comments (text field, not needed)

## New Fields to Generate
- `conversation_history` → Empty array []
- `total_messages` → 0 (will be updated by webhook)
- `tags` → Parse from trigger/AB/source tags
- `lead_captured_at` → Set if email exists
- `last_mc_interaction_at` → Use latest interaction date
- `updated_at` → Current timestamp