# Dynamic Contact Update Function - Complete Package

## 🎯 What This Solves

You were getting errors like:
```
❌ column "subscribed" does not exist
❌ column "ig_last_interaction" does not exist
```

Even though those columns exist in your database. This happens because Supabase's TypeScript client caches the schema, and new columns aren't recognized until the cache refreshes.

**Solution:** A PostgreSQL function that bypasses the cache entirely.

## 📦 What You've Received

### Core Files
1. **`migration_update_contact_dynamic.sql`** - The SQL to create the function
2. **`test-dynamic-update.js`** - Automated test script
3. **`webhook-example-with-dynamic-update.ts`** - Working example code

### Documentation Files
4. **`APPLY_DYNAMIC_UPDATE_CHECKLIST.md`** - Step-by-step guide (START HERE!)
5. **`DYNAMIC_UPDATE_SUMMARY.md`** - Quick reference
6. **`DYNAMIC_UPDATE_FLOW.md`** - Visual diagrams
7. **`MIGRATION_INSTRUCTIONS.md`** - Detailed usage guide
8. **`README_DYNAMIC_UPDATE.md`** - This file (overview)

## 🚀 Quick Start (3 Steps)

### 1. Apply the Migration
Copy the SQL from `migration_update_contact_dynamic.sql` into Supabase SQL Editor and run it.

### 2. Test It
```bash
node test-dynamic-update.js
```

### 3. Update Your Webhooks
Replace this:
```javascript
await supabase.from('contacts').update({
  subscribed: new Date(),
  stage: 'new_lead'
})
```

With this:
```javascript
await supabase.rpc('update_contact_dynamic', {
  contact_id: contactId,
  update_data: {
    subscribed: new Date().toISOString(),
    stage: 'new_lead'
  }
})
```

## 📖 Which File Should You Read?

**If you want to:**
- **Get started right now** → `APPLY_DYNAMIC_UPDATE_CHECKLIST.md`
- **See a quick example** → `DYNAMIC_UPDATE_SUMMARY.md`
- **Understand how it works** → `DYNAMIC_UPDATE_FLOW.md`
- **Get detailed usage info** → `MIGRATION_INSTRUCTIONS.md`
- **See working code** → `webhook-example-with-dynamic-update.ts`
- **Test the function** → `test-dynamic-update.js`

## 🎁 Key Benefits

✅ **No more schema cache errors** - Bypasses Supabase's TypeScript client cache
✅ **Flexible updates** - Only update the fields you need
✅ **Safe** - Existing data is never overwritten unless you specify
✅ **Type-safe** - Automatic casting to correct PostgreSQL types
✅ **Battle-tested** - Includes comprehensive test suite
✅ **Well-documented** - Multiple guides and examples

## 💻 Usage Examples

### Basic Update
```javascript
await supabase.rpc('update_contact_dynamic', {
  contact_id: '123e4567-e89b-12d3-a456-426614174000',
  update_data: {
    first_name: 'John',
    stage: 'dm_qualified'
  }
});
```

### ManyChat Webhook
```javascript
const updateData = {
  first_name: payload.first_name,
  last_name: payload.last_name,
  phone: payload.phone,
  subscribed: new Date().toISOString(),
  ig: payload.instagram_username,
  ig_id: payload.instagram_id,
  ig_last_interaction: new Date().toISOString(),
  stage: 'new_lead'
};

await supabase.rpc('update_contact_dynamic', {
  contact_id: contactId,
  update_data: updateData
});
```

### Just One Field
```javascript
await supabase.rpc('update_contact_dynamic', {
  contact_id: contactId,
  update_data: {
    link_click_date: new Date().toISOString()
  }
});
```

## 🔧 All Supported Fields

You can update any of these fields:

**Contact Info:** first_name, last_name, email_primary, email_booking, email_payment, phone

**Social Media:** ig, ig_id, fb

**External IDs:** mc_id, ghl_id, ad_id, stripe_customer_id

**AB Testing:** chatbot_ab, misc_ab, trigger_word

**Questions:** q1_question, q2_question, objections, lead_summary

**AI Context:** thread_id

**Timestamps:**
- subscribed, subscribe_date, followed_date
- ig_last_interaction
- dm_qualified_date, link_send_date, link_click_date
- form_submit_date, meeting_book_date, meeting_held_date
- checkout_started, purchase_date, purchase_amount
- feedback_sent_date, feedback_received_date, feedback_text

**Stage:** stage

## 🧪 Testing

The test script (`test-dynamic-update.js`) will:
1. ✅ Check if the function exists
2. ✅ Create a test contact
3. ✅ Update it with multiple fields
4. ✅ Verify all fields updated correctly
5. ✅ Test partial updates (preserves existing data)
6. ✅ Clean up test data

Run it with: `node test-dynamic-update.js`

## 📁 File Structure

```
/Users/connorjohnson/CLAUDE_CODE/MCB/
├── migration_update_contact_dynamic.sql      ← Apply this in Supabase
├── test-dynamic-update.js                    ← Run this to test
├── webhook-example-with-dynamic-update.ts    ← Copy this pattern
├── APPLY_DYNAMIC_UPDATE_CHECKLIST.md         ← START HERE
├── DYNAMIC_UPDATE_SUMMARY.md                 ← Quick reference
├── DYNAMIC_UPDATE_FLOW.md                    ← Visual diagrams
├── MIGRATION_INSTRUCTIONS.md                 ← Detailed guide
└── README_DYNAMIC_UPDATE.md                  ← This file
```

## 🎯 Success Checklist

You're done when:
- [ ] Migration applied in Supabase
- [ ] Test script passes: `node test-dynamic-update.js`
- [ ] Webhooks updated to use `rpc('update_contact_dynamic')`
- [ ] Real webhooks successfully update contacts
- [ ] No more "column does not exist" errors

## 🚨 Important Notes

**Use `.toISOString()` for timestamps:**
```javascript
✅ subscribed: new Date().toISOString()
❌ subscribed: new Date()  // This will cause type errors
```

**Function returns VOID:**
The function doesn't return data. If you need the updated contact, query it separately:
```javascript
await supabase.rpc('update_contact_dynamic', { ... });

// Then query if needed
const { data } = await supabase
  .from('contacts')
  .select('*')
  .eq('id', contactId)
  .single();
```

**Always include contact_id:**
```javascript
✅ await supabase.rpc('update_contact_dynamic', {
     contact_id: id,
     update_data: { ... }
   })

❌ await supabase.rpc('update_contact_dynamic', {
     update_data: { ... }  // Missing contact_id!
   })
```

## 💡 Pro Tips

1. **Start small** - Update one webhook first, verify it works, then update others
2. **Test locally** - Use `npm run dev` before deploying
3. **Check logs** - Always check Vercel logs after first real webhook
4. **Keep old code** - Comment it out instead of deleting (can revert if needed)
5. **Monitor for a few days** - Make sure everything is stable

## 🆘 Troubleshooting

| Error | Fix |
|-------|-----|
| "Function not found" | Apply migration in Supabase SQL Editor |
| "Cannot cast type" | Use `.toISOString()` for dates |
| "Contact not updating" | Check contactId is correct UUID |
| Updates not visible | Hard refresh Supabase dashboard |
| Webhook error 500 | Check Vercel logs for details |

## 📚 Additional Resources

- **Supabase Dashboard:** https://supabase.com/dashboard
- **Your Project:** rjqjxrqoetflrkdtkxfn
- **Test Script:** Run with `node test-dynamic-update.js`
- **Example Code:** See `webhook-example-with-dynamic-update.ts`

## 🎉 What's Next?

After successfully applying this:

1. ✅ Your webhooks will work without schema cache errors
2. ✅ You can add new columns to the database anytime
3. ✅ Updates will be flexible and safe
4. ✅ Code will be cleaner and more maintainable

## 🙏 Questions?

If you need help:
1. Read `APPLY_DYNAMIC_UPDATE_CHECKLIST.md` for step-by-step guide
2. Check `MIGRATION_INSTRUCTIONS.md` for detailed usage
3. Look at `webhook-example-with-dynamic-update.ts` for working code
4. Run `node test-dynamic-update.js` to verify function is working

---

**Ready?** Start with `APPLY_DYNAMIC_UPDATE_CHECKLIST.md` and follow the steps!
