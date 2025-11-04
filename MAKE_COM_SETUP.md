# Make.com Setup Guide (Alternative to Direct Webhooks)

**Use Make.com when:**
- Platform webhooks aren't working
- You want visual debugging
- You need to transform data before sending
- You want centralized monitoring

**Cost:** Free tier = 1,000 operations/month (usually enough for testing)

---

## Setup Overview

You'll create 3 separate scenarios (one for each platform):

1. **ManyChat → Database** (watches ManyChat events)
2. **GHL → Database** (watches GHL opportunities)
3. **Stripe → Database** (watches Stripe payments)

---

## Scenario 1: ManyChat → Database

### Step 1: Create New Scenario

1. Go to [Make.com](https://www.make.com)
2. Click **Create a new scenario**
3. Name it: `ManyChat to MCB Database`

### Step 2: Add ManyChat Trigger

**Click the + button → Search "ManyChat"**

**Module:** ManyChat → Watch Subscribers

**Settings:**
- **Connection:** Click "Add" and connect your ManyChat account
- **Page:** Select your Facebook page
- **Limit:** 10 (how many to process per run)

**Click OK**

### Step 3: Add Router

**Click the wrench icon → Add Router**

This splits the flow into 4 routes (one per event type).

### Step 4: Create 4 Routes

#### Route 1: Contact Created

**Filter:**
- Label: "New Contact"
- Condition: `{{subscriber.last_interaction}}` exists

**Add HTTP Module:**
- Module: HTTP → Make a request
- URL: `https://your-app-name.vercel.app/api/manychat`
- Method: POST
- Headers:
  ```
  Content-Type: application/json
  ```
- Body type: Raw
- Request content:
  ```json
  {
    "subscriber_id": "{{subscriber.id}}",
    "event_type": "contact_created"
  }
  ```

#### Route 2: DM Qualified

**Filter:**
- Label: "DM Qualified"
- Condition: `{{subscriber.customFields.Q2}}` is not empty
  (Adjust field name to match YOUR custom fields)

**Add HTTP Module:** (same settings as Route 1)
- Body:
  ```json
  {
    "subscriber_id": "{{subscriber.id}}",
    "event_type": "dm_qualified"
  }
  ```

#### Route 3: Link Sent

**Filter:**
- Label: "Link Sent"
- Condition: `{{subscriber.customFields.link_sent}}` = true
  (You'll need to set this custom field in ManyChat when link is sent)

**Add HTTP Module:**
- Body:
  ```json
  {
    "subscriber_id": "{{subscriber.id}}",
    "event_type": "link_sent"
  }
  ```

#### Route 4: Link Clicked

**Filter:**
- Label: "Link Clicked"
- Condition: `{{subscriber.customFields.link_clicked}}` = true
  (Set this when they click your booking link)

**Add HTTP Module:**
- Body:
  ```json
  {
    "subscriber_id": "{{subscriber.id}}",
    "event_type": "link_clicked"
  }
  ```

### Step 5: Schedule & Activate

**Bottom of page:**
- Schedule: Every 15 minutes (or less for real-time)
- Click **Activate scenario**

---

## Scenario 2: GHL → Database

### Step 1: Create New Scenario

Name it: `GoHighLevel to MCB Database`

### Step 2: Add GHL Trigger

**Module:** GoHighLevel → Watch Opportunities

**Settings:**
- **Connection:** Connect your GHL account
- **Trigger:** Opportunity Created OR Opportunity Updated
- **Limit:** 10

### Step 3: Add Router (Optional)

You can use a router to handle different stages differently, or just send all events.

**Simple version (no router):**

### Step 4: Add HTTP Module

**Module:** HTTP → Make a request

**Settings:**
- URL: `https://your-app-name.vercel.app/api/ghl-webhook`
- Method: POST
- Headers:
  ```
  Content-Type: application/json
  ```
- Body type: Raw
- Request content:
  ```json
  {
    "type": "{{if(opportunity.isNew; "OpportunityCreate"; "OpportunityStageUpdate")}}",
    "contact_id": "{{contact.id}}",
    "email": "{{contact.email}}",
    "phone": "{{contact.phone}}",
    "first_name": "{{contact.firstName}}",
    "last_name": "{{contact.lastName}}",
    "opportunity_stage": "{{opportunity.pipelineStage}}",
    "appointment_start_time": "{{appointment.startTime}}"
  }
  ```

**Advanced version (with router):**

Create routes for:
1. New booking (opportunity just created)
2. Meeting attended (stage changed to "attended")
3. Package sent (stage changed to "package")

Each route sends same webhook but you can add filters.

### Step 5: Activate

- Schedule: Immediate (runs when GHL event happens)
- Click **Activate scenario**

---

## Scenario 3: Stripe → Database

### Step 1: Create New Scenario

Name it: `Stripe to MCB Database`

### Step 2: Add Stripe Trigger

**Module:** Stripe → Watch Events

**Settings:**
- **Connection:** Connect your Stripe account
- **Event types:** Select:
  - checkout.session.completed
  - checkout.session.expired
  - charge.refunded
- **Limit:** 10

### Step 3: Add HTTP Module

**Module:** HTTP → Make a request

**Settings:**
- URL: `https://your-app-name.vercel.app/api/stripe-webhook`
- Method: POST
- Headers:
  ```
  Content-Type: application/json
  stripe-signature: {{event.id}}
  ```

  **Note:** Make.com can't properly sign Stripe webhooks, so your endpoint will need adjustment.

**Alternative (Recommended):** Don't use Make.com for Stripe, use direct webhook.

**But if you must:**

You'll need to modify `/api/stripe-webhook/route.ts` to accept Make.com requests:

```typescript
// Add this check before signature verification
const isMakeCom = request.headers.get('user-agent')?.includes('Integromat');

if (isMakeCom) {
  // Skip signature verification for Make.com
  event = JSON.parse(body);
} else {
  // Normal signature verification
  event = stripe.webhooks.constructEvent(...);
}
```

**Honestly, just use direct Stripe webhook - it's easier!**

---

## Make.com vs Direct Webhooks

### Make.com Pros ✅
- Visual flow builder
- Easy to debug (see each step)
- Can add filters and conditions
- Centralized monitoring
- Can retry failed operations
- Can add data transformations

### Make.com Cons ❌
- Costs operations (1,000/month free)
- Adds latency (15 min polling vs instant webhook)
- Dependency on Make.com (if down, webhooks stop)
- Can't properly verify Stripe signatures
- More complex to set up initially

### Recommendation

**Use Make.com for:**
- ManyChat (if bot flows are too complex)
- GHL (if custom webhooks aren't working)

**Use Direct Webhooks for:**
- Stripe (signature verification required)
- Any real-time requirements
- Production systems (more reliable)

---

## Make.com Debugging

### Check Scenario History

1. Open your scenario
2. Click **History** (bottom)
3. See each execution:
   - ✅ Green = Success
   - ❌ Red = Failed
   - ⚠️ Yellow = Warning

### Click on Execution to See:
- Input data received
- Each module's output
- Error messages
- Execution time

### Common Issues

**"No new records"**
- Make.com hasn't detected changes yet
- Run manually: Click "Run once"
- Check your trigger filter

**"HTTP 400/500 error"**
- Check webhook URL is correct
- Verify JSON body is valid
- Check environment variables are set

**"Rate limit exceeded"**
- You hit Make.com's operation limit
- Upgrade plan or reduce polling frequency

---

## Cost Estimation

**Free tier:** 1,000 operations/month

**What counts as an operation:**
- Each trigger check = 1 op
- Each module in flow = 1 op

**Example scenario (ManyChat with router + 4 routes):**
- Trigger: 1 op
- Router: 1 op
- Each route: 1 op each (4 total)
- **Total per execution: ~6 ops**

**If running every 15 minutes:**
- 96 executions/day
- 2,880 executions/month
- ~17,280 operations/month

**You'll need paid plan for real use!**

**Paid plans start at $9/month for 10,000 ops**

---

## Hybrid Approach (Best of Both)

**Recommended setup:**

1. **Stripe:** Direct webhook (instant, secure)
2. **GHL:** Direct webhook (built-in to GHL)
3. **ManyChat:** Make.com (easier to manage bot complexity)

This gives you:
- ✅ Real-time payments (Stripe)
- ✅ Real-time bookings (GHL)
- ✅ Flexible ManyChat tracking (Make.com)
- ✅ Lower operation cost (only 1 platform using Make)

---

## Testing Make.com Scenarios

### 1. Run Manually
- Click "Run once" to test immediately
- Don't wait for schedule

### 2. Check Output
- Each module shows data in/out
- Verify JSON is formatted correctly

### 3. Check Database
```sql
SELECT * FROM webhook_logs
WHERE source = 'manychat'  -- or 'ghl'
ORDER BY created_at DESC
LIMIT 10;
```

### 4. Verify Contact Created/Updated
```sql
SELECT * FROM contacts
ORDER BY updated_at DESC
LIMIT 5;
```

---

## Make.com Templates (Copy These)

### Template 1: Simple ManyChat
```
Trigger: ManyChat Watch Subscribers
↓
HTTP: POST to /api/manychat
Body: {
  "subscriber_id": "{{subscriber.id}}",
  "event_type": "contact_created"
}
```

### Template 2: Simple GHL
```
Trigger: GHL Watch Opportunities
↓
HTTP: POST to /api/ghl-webhook
Body: {
  "type": "OpportunityCreate",
  "contact_id": "{{contact.id}}",
  "email": "{{contact.email}}"
}
```

---

## When to Upgrade

**Stick with free tier if:**
- Testing only
- Low volume (<100 contacts/month)

**Upgrade to paid if:**
- Production use
- >100 contacts/month
- Need faster polling (<15 min)
- Need more complex scenarios

---

## Final Recommendation

**Start with direct webhooks** (follow the setup guides).

**Switch to Make.com only if:**
- You can't get direct webhooks working
- You need visual debugging
- You're comfortable paying $9-29/month
- You want centralized monitoring

**Don't use Make.com for Stripe** - signature verification is important for security.

---

Need help? Check Make.com's scenario history first - it shows exactly what data is being sent/received!
