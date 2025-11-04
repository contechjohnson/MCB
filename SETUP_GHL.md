# GoHighLevel Webhook Setup (Copy-Paste Guide)

**What we're doing:** Making GHL send data when someone books a meeting or their status changes.

**Difficulty:** Easy (GHL has built-in webhook features)

---

## Step 1: Get Your Webhook URL

**Production (use this one):**
```
https://your-app-name.vercel.app/api/ghl-webhook
```

Replace `your-app-name` with your actual Vercel app name.

---

## Step 2: Create Workflow in GHL

### A. For New Bookings

1. Go to **Automation → Workflows**
2. Click **"Create Workflow"**
3. Name it: `New Booking to Database`

**Trigger:**
- Type: **Opportunity**
- Event: **Opportunity Created**
- (Or you can use "Appointment Scheduled" if you prefer)

**Action:**
1. Click **+ (Add Action)**
2. Choose **Custom Webhook**

**Webhook Settings:**
- Method: `POST`
- Webhook URL: `https://your-app-name.vercel.app/api/ghl-webhook`

**Request Body (copy exactly):**
```json
{
  "type": "OpportunityCreate",
  "contact_id": "{{contact.id}}",
  "email": "{{contact.email}}",
  "phone": "{{contact.phone}}",
  "first_name": "{{contact.first_name}}",
  "last_name": "{{contact.last_name}}",
  "opportunity_stage": "{{opportunity.pipeline_stage}}",
  "appointment_start_time": "{{appointment.start_time}}"
}
```

**Save & Activate!**

---

### B. For Meeting Attended / Status Changes

1. Create **another workflow**
2. Name it: `Meeting Status Update to Database`

**Trigger:**
- Type: **Opportunity**
- Event: **Opportunity Stage Changed**

**Filter (optional but recommended):**
- Only when stage changes to:
  - "Meeting Attended" / "Show"
  - "Package Sent"
  - "Closed Won" (if you track that)

**Action:**
1. Add **Custom Webhook**

**Webhook Settings:**
- Method: `POST`
- Webhook URL: `https://your-app-name.vercel.app/api/ghl-webhook`

**Request Body (copy exactly):**
```json
{
  "type": "OpportunityStageUpdate",
  "contact_id": "{{contact.id}}",
  "email": "{{contact.email}}",
  "phone": "{{contact.phone}}",
  "first_name": "{{contact.first_name}}",
  "last_name": "{{contact.last_name}}",
  "opportunity_stage": "{{opportunity.pipeline_stage}}",
  "appointment_start_time": "{{appointment.start_time}}"
}
```

**Save & Activate!**

---

## Step 3: Test It

### Test New Booking
1. Create a test contact in GHL
2. Create an opportunity/appointment for them
3. Check your database:

```sql
SELECT * FROM contacts WHERE GHL_ID IS NOT NULL ORDER BY created_at DESC;
```

You should see:
- New contact with `GHL_ID`
- `email_booking` = their email
- `meeting_book_date` = when they booked
- `stage` = "meeting_booked"

### Test Status Change
1. Change the opportunity stage to "Attended" or "Show"
2. Check database again:

```sql
SELECT GHL_ID, stage, meeting_held_date
FROM contacts
WHERE GHL_ID = 'the_test_contact_id';
```

You should see:
- `meeting_held_date` updated
- `stage` = "meeting_held"

---

## Alternative: Use Make.com (If GHL Webhooks Don't Work)

Some GHL accounts have issues with custom webhooks. If that's you, use Make.com:

### Step 1: Create Make.com Scenario

1. Go to Make.com → Create new scenario
2. Name it: "GHL to Database"

### Step 2: Add GHL Trigger

**Module:** GoHighLevel → Watch Opportunities

**Settings:**
- Connect your GHL account
- Trigger: New opportunity created OR Opportunity updated
- Choose your pipeline

### Step 3: Add Webhook Action

**Module:** HTTP → Make a request

**Settings:**
- URL: `https://your-app-name.vercel.app/api/ghl-webhook`
- Method: POST
- Headers: `Content-Type: application/json`
- Body Type: Raw

**Body (copy this):**
```json
{
  "type": "{{if(opportunity.justCreated; "OpportunityCreate"; "OpportunityStageUpdate")}}",
  "contact_id": "{{contact.id}}",
  "email": "{{contact.email}}",
  "phone": "{{contact.phone}}",
  "first_name": "{{contact.firstName}}",
  "last_name": "{{contact.lastName}}",
  "opportunity_stage": "{{opportunity.pipelineStage}}",
  "appointment_start_time": "{{appointment.startTime}}"
}
```

### Step 4: Add Router (Optional)

If you want different behavior for different stages:

**Router with 3 routes:**
1. **New Booking** - Filter: `opportunity.justCreated = true`
2. **Meeting Attended** - Filter: `opportunity.pipelineStage` contains "attended" or "show"
3. **Package Sent** - Filter: `opportunity.pipelineStage` contains "package"

Each route sends the same webhook but you can add additional logic if needed.

---

## What Gets Tracked

### When someone books:
- ✅ Contact created (if new) OR linked to existing ManyChat contact
- ✅ `GHL_ID` assigned
- ✅ `email_booking` = their email
- ✅ `phone` = their phone (normalized)
- ✅ `meeting_book_date` = appointment time
- ✅ `stage` = "meeting_booked"

### When they attend:
- ✅ `meeting_held_date` = now
- ✅ `stage` = "meeting_held"

### If they came from ManyChat first:
- ✅ All their ManyChat data (DM qualified, questions, etc.) is preserved
- ✅ `GHL_ID` is added to their existing record
- ✅ Timeline shows full journey: DM → Questions → Link → Booking → Meeting

---

## Common GHL Stage Names

Make sure your webhook fires for these stage names (adjust based on YOUR pipeline):

**Booking stages:**
- "Appointment Scheduled"
- "Meeting Booked"
- "Call Scheduled"

**Attended stages:**
- "Meeting Attended"
- "Show"
- "Showed Up"
- "Completed Call"

**Package sent stages:**
- "Package Sent"
- "Proposal Sent"
- "Quote Sent"

**Update the workflow filters to match YOUR stage names!**

---

## Testing Checklist

- [ ] Test contact books appointment → Contact in database with GHL_ID
- [ ] Test status change to "Attended" → meeting_held_date updated
- [ ] Test status change to "Package Sent" → stage updated
- [ ] Test direct booking (no ManyChat) → New contact created
- [ ] Test ManyChat contact booking → GHL_ID added to existing record
- [ ] Check `webhook_logs` table for any errors

---

## Troubleshooting

**Workflow not firing:**
1. Make sure workflow is **Active** (not Draft)
2. Check workflow trigger matches your pipeline
3. Test with a real appointment, not just contact creation

**Contact not found/created:**
1. Verify email is being sent in webhook payload
2. Check `webhook_logs.payload` to see what GHL is actually sending
3. Make sure contact has an email (required for matching)

**Duplicate contacts created:**
- Shouldn't happen! Check that email matching is working
- Verify `find_contact_smart` function exists in Supabase
- Check `webhook_logs.error_message` for details

**Phone numbers look weird:**
- That's okay! The webhook normalizes them automatically
- Format is: `+1` + 10 digits (US numbers)
- Other countries keep their country code

---

## Need Help?

1. Check the **workflow execution history** in GHL
2. Check `webhook_logs` table in Supabase
3. Look for `status = 'error'` and read `error_message`
4. Verify the contact has an email (required for matching)
