# Automation Inventory - Pre-Migration Checklist

**Purpose:** Document all existing automations so we can disable them during/after migration.

**Last Updated:** 2024-12-07

---

## Make.com Scenarios

| Scenario | Purpose | Status | Disable When? |
|----------|---------|--------|---------------|
| CLARA (A) - Chatbot | Chatbot variant A | ACTIVE | After MCB chatbot tested |
| CLARA (B) - Chatbot | Chatbot variant B | ACTIVE | After MCB chatbot tested |
| Denefits Relay | Forwards Denefits webhooks to MCB | ACTIVE | Keep (low complexity) |
| *(add others)* | | | |

**Make.com Dashboard:** https://us1.make.com/

---

## ManyChat Configurations

### Webhook URLs (External Request blocks)
| Flow/Automation | Current URL | New MCB URL |
|-----------------|-------------|-------------|
| Chatbot webhook | Make.com URL | `https://mcb-dun.vercel.app/api/webhooks/ppcu/chatbot` |
| *(add others)* | | |

### Custom Fields Used by Chatbot
- `chatbot_AB` - A/B test assignment
- `Conversation ID` - OpenAI thread ID
- `Cody > Response` - AI response text
- `Symptoms` - Extracted symptoms
- `Months Postpartum` - Extracted value
- `Intending to send link` - Boolean
- `Intend to send PDF` - Boolean
- `Intend to send lead magnet` - Boolean
- `Already Booked` - Boolean
- `Email` - Captured email

### Flows Triggered by Chatbot
- Response flow (sends AI message)
- Booking link flow
- PDF flow
- Lead magnet flow

**ManyChat Dashboard:** https://manychat.com/

---

## GoHighLevel

### Webhook URLs
| Trigger | Current Destination | Status |
|---------|---------------------|--------|
| Opportunity created | MCB `/api/webhooks/ppcu/ghl` | ACTIVE |
| Meeting completed | MCB `/api/webhooks/ppcu/ghl` | ACTIVE |
| *(add others)* | | |

**GHL Dashboard:** https://app.gohighlevel.com/

---

## Stripe

### Webhook Endpoints
| Event | Destination | Status |
|-------|-------------|--------|
| checkout.session.completed | MCB `/api/webhooks/ppcu/stripe` | ACTIVE |
| checkout.session.created | MCB `/api/webhooks/ppcu/stripe` | ACTIVE |
| charge.refunded | MCB `/api/webhooks/ppcu/stripe` | ACTIVE |

**Stripe Dashboard:** https://dashboard.stripe.com/webhooks

---

## Perspective (Funnel Pages)

### Webhook URLs
| Form/Page | Destination | Status |
|-----------|-------------|--------|
| Main funnel | MCB `/api/webhooks/ppcu/perspective` | ACTIVE |
| *(add others)* | | |

**Perspective Dashboard:** *(add URL)*

---

## Denefits

### Webhook Flow
```
Denefits → Make.com (relay) → MCB /api/webhooks/ppcu/denefits
```

**Note:** Denefits webhooks go through Make.com relay. Keep this for now.

---

## OpenAI

### Assistants
| Assistant ID | Name | Used By | Migrate To |
|--------------|------|---------|------------|
| `asst_hcEPqg9xnhkeE7699BHYwsBi` | CLARA (A) | Make.com | MCB chatbot_configs |
| *(variant B assistant ID)* | CLARA (B) | Make.com | MCB chatbot_configs |

**OpenAI Dashboard:** https://platform.openai.com/assistants

---

## Migration Checklist

### Phase 1: Shadow Mode
- [ ] Apply MCB database migrations
- [ ] Extract CLARA prompts from OpenAI
- [ ] Insert prompts into `chatbot_configs`
- [ ] Add Meta CAPI credentials
- [ ] Test MCB chatbot with test subscriber

### Phase 2: Dual Running
- [ ] Configure ManyChat to send to BOTH Make.com AND MCB
- [ ] Compare responses (MCB logs only, doesn't send)
- [ ] Verify field updates match

### Phase 3: Cutover
- [ ] Point ManyChat webhook to MCB only
- [ ] Monitor for 24-48 hours
- [ ] Disable Make.com CLARA scenarios
- [ ] *(Keep Denefits relay active)*

### Phase 4: Cleanup
- [ ] Archive Make.com scenarios (don't delete yet)
- [ ] Document any remaining Make.com dependencies
- [ ] Update this inventory

---

## Rollback Plan

If MCB chatbot fails:

1. **ManyChat:** Change webhook URL back to Make.com (< 2 min)
2. **Make.com:** Re-enable CLARA scenarios (< 1 min)
3. **No data loss:** Both systems update same ManyChat fields

---

## Notes

*(Add any notes about specific configurations, gotchas, or things to remember)*


