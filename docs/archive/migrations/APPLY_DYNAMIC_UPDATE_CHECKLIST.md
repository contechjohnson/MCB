# Dynamic Update Function - Application Checklist

## 📋 Pre-Flight Check

Before you start, make sure you have:
- [ ] Supabase dashboard access: https://supabase.com/dashboard
- [ ] Your project open in Supabase
- [ ] Access to SQL Editor in Supabase
- [ ] Terminal open in this directory

## ✅ Step-by-Step Application

### Step 1: Apply the Migration (5 minutes)

1. **Open Supabase Dashboard**
   - Go to: https://supabase.com/dashboard
   - Click on your MCB project

2. **Open SQL Editor**
   - In left sidebar, click **SQL Editor**
   - Click **+ New Query** button

3. **Copy the Migration SQL**
   - Open file: `migration_update_contact_dynamic.sql`
   - Select ALL the SQL (Cmd+A / Ctrl+A)
   - Copy it (Cmd+C / Ctrl+C)

4. **Paste and Run**
   - Paste into Supabase SQL Editor (Cmd+V / Ctrl+V)
   - Click **Run** button (or press Cmd+Enter / Ctrl+Enter)
   - Wait for success message: "Success. No rows returned"

5. **Verify Function Exists**
   - In SQL Editor, run this query:
   ```sql
   SELECT routine_name
   FROM information_schema.routines
   WHERE routine_name = 'update_contact_dynamic';
   ```
   - Should return: `update_contact_dynamic`

### Step 2: Test the Function (2 minutes)

Run the automated test:

```bash
node test-dynamic-update.js
```

**Expected output:**
```
🧪 Testing dynamic update function...
Step 1: Checking if update_contact_dynamic function exists...
✅ Function exists!

Step 2: Creating test contact...
✅ Created contact: [uuid]

Step 3: Testing dynamic update...
✅ Update successful!

Step 4: Verifying update...
✅ Updated contact data: [data]
📊 Verification: 7/7 checks passed
✅ All tests passed!

Step 5: Testing partial update...
✅ Partial update successful!
✅ Final contact state: [data]
✅ Partial update preserved existing fields!

Step 6: Cleaning up test data...
✅ Test contact deleted

✨ All tests complete!
```

**If you get errors:**
- "Function does not exist" → Go back to Step 1, migration didn't apply
- "Error creating contact" → Check Supabase connection
- Type casting errors → Run the test again (might be a one-time issue)

### Step 3: Update Your Webhook Code (10 minutes)

**Option A: Use the example template**

1. Copy `webhook-example-with-dynamic-update.ts`
2. Replace your existing webhook handler
3. Adjust field mappings to match your payload structure

**Option B: Update existing webhooks manually**

Find all instances where you do:
```javascript
await supabase.from('contacts').update({ ... })
```

Replace with:
```javascript
await supabase.rpc('update_contact_dynamic', {
  contact_id: contactId,
  update_data: { ... }
})
```

### Step 4: Deploy and Test (5 minutes)

1. **Deploy to Vercel**
   ```bash
   git add .
   git commit -m "Add dynamic update function to webhooks"
   git push origin main
   ```

2. **Wait for deployment** (check Vercel dashboard)

3. **Test with real webhook**
   - Trigger a ManyChat event
   - Check Vercel logs
   - Verify data in Supabase

## 🎯 Success Criteria

You're done when:
- [ ] `node test-dynamic-update.js` shows all tests passing
- [ ] Your webhooks are updated to use `rpc('update_contact_dynamic')`
- [ ] Real webhook triggers successfully update contacts
- [ ] No "column does not exist" errors in logs
- [ ] Data shows up correctly in Supabase

## 🚨 Rollback Plan

If something goes wrong:

**To remove the function:**
```sql
DROP FUNCTION IF EXISTS update_contact_dynamic(UUID, JSONB);
DROP FUNCTION IF EXISTS test_update_contact_dynamic();
```

**To revert webhook code:**
```bash
git revert HEAD
git push origin main
```

## 📚 Reference Files

Keep these handy:

1. **Quick Reference:** `DYNAMIC_UPDATE_SUMMARY.md`
2. **Visual Guide:** `DYNAMIC_UPDATE_FLOW.md`
3. **Detailed Instructions:** `MIGRATION_INSTRUCTIONS.md`
4. **Code Example:** `webhook-example-with-dynamic-update.ts`
5. **Test Script:** `test-dynamic-update.js`

## 💡 Tips

**Tip 1: Start with one webhook**
Don't update all webhooks at once. Start with ManyChat, verify it works, then update others.

**Tip 2: Test locally first**
Use `npm run dev` to test webhooks locally before deploying to production.

**Tip 3: Check logs**
Always check Vercel logs after the first real webhook to verify everything is working.

**Tip 4: Keep old code commented**
When updating webhooks, comment out the old code instead of deleting it. You can remove it later once you're confident the new code works.

## ❓ Quick Troubleshooting

| Problem | Solution |
|---------|----------|
| Function not found | Apply migration in Supabase SQL Editor |
| Type casting error | Use `.toISOString()` for dates |
| Contact not updating | Check `contactId` is correct UUID |
| Updates not visible | Hard refresh Supabase dashboard |
| Webhook returns 500 | Check Vercel logs for exact error |

## 🎉 Next Steps After Success

Once everything is working:

1. **Document the pattern** - Add comments to your code
2. **Update other webhooks** - Apply to GHL, Stripe webhooks
3. **Monitor for a few days** - Make sure no errors crop up
4. **Clean up old code** - Remove commented-out old code
5. **Celebrate** - You've solved the schema cache problem! 🎊

## 📞 Need Help?

If you get stuck:
1. Check the logs in Vercel
2. Check the data in Supabase
3. Re-run `node test-dynamic-update.js`
4. Read `MIGRATION_INSTRUCTIONS.md` for detailed usage
5. Check `DYNAMIC_UPDATE_FLOW.md` to understand how it works

---

**Ready to start?** Go to Step 1 and apply the migration!
