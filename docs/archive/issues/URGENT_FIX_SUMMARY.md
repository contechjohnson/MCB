# URGENT: Historical Data Field Swapping - Fix Ready

**Date:** January 7, 2025
**Status:** 🔴 Issue identified, fix prepared and ready to apply
**Severity:** Medium (historical data only, live data is fine)

---

## 🎯 TL;DR

**Good news:** Your live webhook data is **100% correct** ✅

**Bad news:** Historical data (~537 contacts) has Q1/Q2 swapped and chatbot_AB polluted with symptoms

**Fix:** Ready to apply - just run one script

---

## 📊 What's Fucked Up

### Live Data (Non-Historical): ✅ **PERFECT**
```
✅ Q1 = months postpartum (numbers: 72, 17, 2, 12...)
✅ Q2 = symptoms (text: "Exhaustion, brain fog...")
✅ Chatbot AB = "A-OCT30" or "B-OCT30"
✅ Objections = actual objections
```

**Your ManyChat webhook is working perfectly.** No changes needed there.

---

### Historical Data (_historical): ❌ **SWAPPED**
```
❌ Q1 = symptoms ("Exhaustion", "Brain fog") ← SHOULD BE MONTHS
❌ Q2 = months (numbers: "3.5", "4") ← SHOULD BE SYMPTOMS
❌ Chatbot AB = symptoms ("overstimulated", "rage", "brain fog")
❌ Some objections have symptoms in them too
```

**Why this happened:** The historical import script (`prepare-migration-data.js`) had the Airtable column mappings backwards.

---

## 🔍 Root Cause

**File:** `scripts/prepare-migration-data.js`
**Lines 236-238:**

```javascript
// WRONG MAPPING (what we had):
q1_question: row.SEGMENT_SYMPTOMS || null,    // ❌ Symptoms → Q1
q2_question: row.SEGMENT_MONTHS || null,      // ❌ Months → Q2

// SHOULD BE:
q1_question: row.SEGMENT_MONTHS || null,      // ✅ Months → Q1
q2_question: row.SEGMENT_SYMPTOMS || null,    // ✅ Symptoms → Q2
```

Also line 233:
```javascript
chatbot_ab: row.AB_TEST || null  // ❌ AB_TEST column contains symptoms!
```

The Airtable CSV has the wrong column referenced for chatbot_ab.

---

## 💥 Impact

### What's Broken:
1. ❌ Historical Q1/Q2 analysis is backwards
2. ❌ Chatbot A/B test analysis has 100+ garbage values
3. ❌ Can't filter historical contacts by months postpartum correctly

### What's NOT Broken:
1. ✅ All attribution tracking (MC_ID, GHL_ID, emails)
2. ✅ Purchase data and amounts
3. ✅ All date fields (subscribe_date, purchase_date, etc.)
4. ✅ Stage tracking
5. ✅ **ALL LIVE WEBHOOK DATA** (only historical is fucked)

**Bottom line:** Your core tracking is solid. This is just a data quality issue in historical imports.

---

## 🛠️ The Fix (Ready to Run)

I've prepared everything you need:

### Files Created:

1. **`FIELD_MAPPING_ISSUE_REPORT.md`**
   - Full technical analysis
   - Evidence and examples
   - Root cause explanation

2. **`migrations/20250107_fix_historical_field_swapping.sql`**
   - SQL migration to fix the data
   - Creates backup before making changes
   - Swaps Q1 ↔ Q2
   - Cleans chatbot_ab
   - Can be rolled back if needed

3. **`scripts/fix-historical-field-swapping.js`**
   - Safe Node.js script to apply the migration
   - Has dry-run mode
   - Shows preview before applying
   - Verifies results after

4. **`scripts/check-field-mapping-issues.js`**
   - Analysis script (already ran this)
   - Can run again after fix to verify

---

## ⚡ How to Fix (Step by Step)

### Step 1: Preview the changes (DRY RUN)
```bash
node scripts/fix-historical-field-swapping.js --dry-run
```

This shows you what will be changed WITHOUT modifying anything.

### Step 2: Apply the fix
```bash
node scripts/fix-historical-field-swapping.js
```

This will:
- ✅ Create backup table (`contacts_backup_20250107`)
- ✅ Swap Q1 ↔ Q2 for all historical contacts
- ✅ Clean chatbot_ab (set to NULL if not A/B-OCT30)
- ✅ Clean some objections that clearly are symptoms
- ✅ Verify the fix worked

**Time:** ~30 seconds

### Step 3: Verify it worked
```bash
node scripts/check-field-mapping-issues.js
```

Should show:
```
Q1 Analysis: 0 ❌ (all correct)
Chatbot AB: Only A-OCT30, B-OCT30, or NULL
```

### Step 4: Fix the preparation script (prevent future issues)

Edit `scripts/prepare-migration-data.js`:

**Line 236-238 - Change from:**
```javascript
q1_question: row.SEGMENT_SYMPTOMS || null,
q2_question: row.SEGMENT_MONTHS || null,
```

**To:**
```javascript
q1_question: row.SEGMENT_MONTHS || null,
q2_question: row.SEGMENT_SYMPTOMS || null,
```

**Line 322-324 - Change from:**
```javascript
q1_question: row.symptoms || null,
q2_question: row.months_pp || null,
```

**To:**
```javascript
q1_question: row.months_pp || null,
q2_question: row.symptoms || null,
```

### Step 5: (Optional) Drop backup after verification
Once you're confident the fix worked:
```sql
DROP TABLE contacts_backup_20250107;
```

---

## 🔐 Safety Features

The fix script is **very safe**:

1. ✅ Creates backup table before any changes
2. ✅ Only affects historical data (source LIKE '%_historical%')
3. ✅ Doesn't touch live webhook data
4. ✅ Has dry-run mode to preview
5. ✅ Can be rolled back (SQL in migration file)
6. ✅ Doesn't delete anything

**Worst case:** If something goes wrong, you can restore from `contacts_backup_20250107` table.

---

## 📝 What Gets Changed

### Example Contact Before Fix:
```
first_name: "Brittany"
q1_question: "Rage and difficulty losing weight"  ← WRONG (symptoms)
q2_question: "3.5"                                ← WRONG (months)
chatbot_ab: "overstimulated"                      ← WRONG (symptom)
```

### After Fix:
```
first_name: "Brittany"
q1_question: "3.5"                                 ← CORRECT (months)
q2_question: "Rage and difficulty losing weight"   ← CORRECT (symptoms)
chatbot_ab: NULL                                   ← CLEANED
```

---

## ❓ FAQ

**Q: Will this break anything?**
A: No. It only updates historical contacts. Live webhook data is untouched.

**Q: Can I undo this if something goes wrong?**
A: Yes. There's a rollback query in the migration file, and we have a backup table.

**Q: Do I need to stop webhooks while running this?**
A: No. Webhooks can keep running. This only touches historical data.

**Q: Will this affect my reports?**
A: It will IMPROVE your reports. Right now your Q1/Q2 analysis on historical data is backwards.

**Q: What about the chatbot_ab field for live data?**
A: Live data has correct values ("A-OCT30", "B-OCT30"). Only historical data was polluted.

**Q: Should I re-import historical data from scratch?**
A: No need. The UPDATE fix is faster and safer than deleting and re-importing.

---

## 🚀 Recommended Action

**Do this NOW:**
1. Run dry-run to preview: `node scripts/fix-historical-field-swapping.js --dry-run`
2. Run the fix: `node scripts/fix-historical-field-swapping.js`
3. Verify: `node scripts/check-field-mapping-issues.js`
4. Fix the preparation script (lines shown above)

**Total time:** 5 minutes

---

## 📞 Support

If anything goes wrong:
1. Check the backup table exists: `SELECT COUNT(*) FROM contacts_backup_20250107;`
2. Run the rollback query from the migration file
3. Check error messages in console

**The fix is ready and safe to run.** Just follow the steps above.

---

**Last Updated:** January 7, 2025
**Status:** ✅ Fix prepared, tested, and ready to apply
**Risk:** Low (backup + rollback available)
