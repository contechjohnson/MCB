# ManyChat Webhook Setup (Copy-Paste Guide)

**What we're doing:** Making ManyChat send data to your database when specific things happen in the bot.

**Difficulty:** Medium (requires editing bot flows)

---

## Option 1: Direct Webhook (More Control)

### Step 1: Get Your Webhook URL

**Local testing:**
```
http://localhost:3001/api/manychat
```

**Production (after deploying to Vercel):**
```
https://mcb-dun.vercel.app/api/manychat
```

---

### Step 2: Add Webhook Actions to Your Bot Flow

You need to add 4 webhook actions at specific points in your conversation flow:

#### Webhook 1: Contact Created (When they first message)

**Where:** Very beginning of your bot flow, right after someone sends first message

**Action:** Add "External Request" block

**Settings:**
- Method: `POST`
- URL: `https://mcb-dun.vercel.app/api/manychat`
- Headers: `Content-Type: application/json`
- Body (copy exactly):
```json
{
  "subscriber_id": "{{subscriber_id}}",
  "event_type": "contact_created"
}
```

---

#### Webhook 2: DM Qualified (After BOTH questions answered)

**Where:** After they answer your FINAL qualification question (Q2)

**Action:** Add "External Request" block

**Settings:**
- Method: `POST`
- URL: `https://mcb-dun.vercel.app/api/manychat`
- Headers: `Content-Type: application/json`
- Body (copy exactly):
```json
{
  "subscriber_id": "{{subscriber_id}}",
  "event_type": "dm_qualified"
}
```

**Important:** Only fire this AFTER they've answered BOTH questions, not after each one.

---

#### Webhook 3: Link Sent (When bot sends booking link)

**Where:** Right after the message that contains your booking link

**Action:** Add "External Request" block

**Settings:**
- Method: `POST`
- URL: `https://mcb-dun.vercel.app/api/manychat`
- Headers: `Content-Type: application/json`
- Body (copy exactly):
```json
{
  "subscriber_id": "{{subscriber_id}}",
  "event_type": "link_sent"
}
```

---

#### Webhook 4: Link Clicked (When they click the link)

**Where:** This is trickier - you need to track link clicks

**Two ways to do this:**

**Option A: Use ManyChat's built-in link tracking**
1. Use a ManyChat dynamic link instead of direct URL
2. Set up trigger: "User clicked button"
3. Add webhook action there

**Option B: Use URL with tracking parameter**
1. Your booking link: `https://yourbooking.com/?mc_id={{subscriber_id}}`
2. On your booking page, add pixel that fires webhook
3. Or use Make.com (see Option 2 below)

**Webhook Settings:**
- Method: `POST`
- URL: `https://mcb-dun.vercel.app/api/manychat`
- Headers: `Content-Type: application/json`
- Body (copy exactly):
```json
{
  "subscriber_id": "{{subscriber_id}}",
  "event_type": "link_clicked"
}
```

---

### Step 3: Test It

1. Message your bot from a test account
2. Go through the full flow
3. Check your database:

```sql
SELECT * FROM contacts WHERE MC_ID IS NOT NULL ORDER BY created_at DESC;
```

You should see:
- `subscribe_date` populated (after first message)
- `DM_qualified_date` populated (after questions)
- `link_send_date` populated (after link sent)
- `link_click_date` populated (if they clicked)

---

## Option 2: Use Make.com (EASIER - RECOMMENDED)

**Why this is easier:** Make.com can watch for ManyChat events and format the webhook for you.

### Step 1: Create Make.com Scenario

1. Go to Make.com → Create new scenario
2. Name it: "ManyChat to Database"

### Step 2: Add ManyChat Trigger

**Module:** ManyChat → Watch Custom Fields

**Settings:**
- Connect your ManyChat account
- Choose trigger: "Subscriber updated"
- Filters: You can filter by specific custom field changes

### Step 3: Add Router (to handle different events)

**Module:** Router

**Create 4 routes:**

#### Route 1: Contact Created
- **Filter:** `subscriber.last_input_text` exists (they sent first message)
- **Webhook:** HTTP → Make a request
  - URL: `https://mcb-dun.vercel.app/api/manychat`
  - Method: POST
  - Headers: `Content-Type: application/json`
  - Body:
  ```json
  {
    "subscriber_id": "{{subscriber.id}}",
    "event_type": "contact_created"
  }
  ```

#### Route 2: DM Qualified
- **Filter:** `custom_field.Q2` is not empty (both questions answered)
- **Webhook:** Same as above but:
  ```json
  {
    "subscriber_id": "{{subscriber.id}}",
    "event_type": "dm_qualified"
  }
  ```

#### Route 3: Link Sent
- **Filter:** `last_interaction.button` contains "booking" (or whatever your button text is)
- **Webhook:** Same format, event_type: "link_sent"

#### Route 4: Link Clicked
- **Filter:** `custom_field.link_clicked` = true (set this custom field when they click)
- **Webhook:** Same format, event_type: "link_clicked"

### Step 4: Activate Scenario

Turn it on and test!

---

## Which Option Should You Use?

**Use Direct Webhooks if:**
- You want full control
- You're comfortable editing ManyChat flows
- You want it to work without Make.com

**Use Make.com if:**
- You want easier setup
- You're already using Make.com
- You want to see webhook activity in a visual dashboard
- You want to easily modify logic later

---

## Testing Checklist

- [ ] Test account messages bot → Contact created in database
- [ ] Answer both qualification questions → DM_qualified_date updated
- [ ] Bot sends link → link_send_date updated
- [ ] Click the link → link_click_date updated
- [ ] Check `webhook_logs` table for any errors

---

## Troubleshooting

**Webhook not firing:**
1. Check ManyChat flow is published (not draft)
2. Verify webhook URL is correct (no typos)
3. Check `webhook_logs` table in Supabase for errors

**Data not updating:**
1. Make sure `MANYCHAT_API_KEY` is set in `.env.local`
2. Check server logs (Vercel logs if deployed)
3. Verify subscriber_id is being sent correctly

**Can't find subscriber in database:**
1. ManyChat API might be rate limited
2. Subscriber might not have email yet
3. Check `webhook_logs.status = 'error'` for details

---

## Need Help?

1. Check `webhook_logs` table first
2. Look for `status = 'error'` and read `error_message`
3. Verify payload being sent matches examples above
