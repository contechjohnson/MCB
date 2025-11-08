# Field Mapping Issue Report - CRITICAL

**Date:** January 7, 2025
**Status:** 🔴 CRITICAL - Historical data has incorrect field mappings
**Affected Records:** ~537 historical contacts

---

## 🚨 PROBLEM SUMMARY

The historical data import has **SWAPPED** Q1 and Q2 fields, and the `chatbot_ab` field contains symptoms instead of A/B test variants.

### What's Wrong:

| Database Column | Currently Has | Should Have |
|----------------|---------------|-------------|
| `q1_question` | **Symptoms** (e.g., "Exhaustion", "Brain fog") | **Months postpartum** (e.g., "12", "24") |
| `q2_question` | **Months postpartum** (e.g., "4", "3.5") | **Symptoms** (e.g., "Exhaustion, brain fog") |
| `chatbot_ab` | **Symptoms** (e.g., "overstimulated", "rage", "brain fog") | **A/B variant** ("A-OCT30" or "B-OCT30") |
| `objections` | Sometimes has symptoms | Should be objections only |

---

## 📊 DATA QUALITY ANALYSIS

### Live Data (Non-Historical): ✅ **CORRECT**
```
Q1: 72, 17, 2, 12, 4 (months postpartum) ✅
Q2: "Anxiety, inflammation, stress..." (symptoms) ✅
Chatbot AB: "A - OCT30", "B - OCT30" ✅
Objections: Actual objections ✅
```

### Historical Data (_historical): ❌ **INCORRECT**
```
Q1: "Rage and difficulty losing weight" (symptoms) ❌
Q2: "3.5" (months postpartum) ❌
Chatbot AB: "overstimulated", "rage", "brain fog" ❌
Objections: Sometimes has symptoms ❌
```

---

## 🔍 ROOT CAUSE

**File:** `scripts/prepare-migration-data.js`
**Lines:** 236-238 (Airtable mapping), 322-324 (Supabase mapping)

### Incorrect Code (Line 236-238):
```javascript
q1_question: row.SEGMENT_SYMPTOMS || null,    // ❌ Maps symptoms to Q1
q2_question: row.SEGMENT_MONTHS || null,      // ❌ Maps months to Q2
objections: row.SEGMENT_OBJECTIONS || null,
chatbot_ab: row.AB_TEST || null,              // ❌ AB_TEST column contains symptoms!
```

### Correct Mapping Should Be:
```javascript
q1_question: row.SEGMENT_MONTHS || null,      // ✅ Q1 = Months postpartum
q2_question: row.SEGMENT_SYMPTOMS || null,    // ✅ Q2 = Symptoms
objections: row.SEGMENT_OBJECTIONS || null,
chatbot_ab: row.CHATBOT_AB || null,           // ✅ Need to find correct AB test column
```

---

## 🧪 EVIDENCE

### Chatbot AB Value Distribution:
```
"A - OCT30": 227 contacts ✅ Valid
"B - OCT30": 206 contacts ✅ Valid

// Invalid values (symptoms):
"brain fog": 5 ❌
"hair loss": 4 ❌
"fatigue": 3 ❌
"irritability": 3 ❌
"mood swings": 3 ❌
"overstimulated": 1 ❌
"rage": 1 ❌
... (100+ more symptom values) ❌
```

### Q1 Field Analysis (100 contacts sampled):
- Contains symptom keywords: **3** ❌
- Looks correct (numbers): **97** ✅

**BUT:** Live data is correct, historical data is wrong!

### Objections Field Analysis (100 contacts sampled):
- Contains symptom keywords: **4** ❌
- Looks correct: **96** ✅

---

## 💥 IMPACT

### Critical Issues:
1. **Q1/Q2 analysis is backwards** - Any reporting using "months postpartum" is using symptom data instead
2. **Chatbot A/B testing analysis is polluted** - 100+ invalid values mixed with 433 valid values
3. **Can't filter by months postpartum** - The data is in Q2 field instead of Q1
4. **Can't analyze symptoms correctly** - The data is in Q1 field instead of Q2

### What's NOT Affected:
- ✅ Attribution tracking (MC_ID, GHL_ID, emails)
- ✅ Purchase data
- ✅ Date tracking (subscribe_date, purchase_date, etc.)
- ✅ Stage tracking
- ✅ Live data (non-historical)

---

## 🔧 FIX STRATEGY

### Option 1: Update Existing Historical Records (RECOMMENDED ✅)

**Pros:**
- Preserves all attribution data
- Doesn't break existing relationships
- Can be done with UPDATE queries

**Cons:**
- Need to swap Q1 ↔ Q2 for all historical contacts
- Need to clean up chatbot_ab field

**SQL to fix:**
```sql
-- Step 1: Swap Q1 and Q2 for historical contacts
UPDATE contacts
SET
  q1_question = q2_question,  -- Move months to Q1
  q2_question = q1_question   -- Move symptoms to Q2
WHERE source LIKE '%_historical%';

-- Step 2: Set chatbot_ab to NULL where it contains symptoms
UPDATE contacts
SET chatbot_ab = NULL
WHERE source LIKE '%_historical%'
  AND chatbot_ab IS NOT NULL
  AND chatbot_ab NOT IN ('A-OCT30', 'B-OCT30', 'A - OCT30', 'B - OCT30');

-- Step 3: Clean up objections that contain symptoms (optional)
-- This requires manual review
```

### Option 2: Re-run Import with Fixed Script

**Pros:**
- Starts clean with correct mappings
- Can fix chatbot_ab column reference

**Cons:**
- Need to delete existing historical data first
- Might lose any manual corrections

---

## ✅ RECOMMENDED FIX (Step by Step)

### Step 1: Fix the preparation script
**File:** `scripts/prepare-migration-data.js`

**Change lines 236-238:**
```javascript
// FROM:
q1_question: row.SEGMENT_SYMPTOMS || null,
q2_question: row.SEGMENT_MONTHS || null,
objections: row.SEGMENT_OBJECTIONS || null,

// TO:
q1_question: row.SEGMENT_MONTHS || null,      // ✅ Q1 = Months postpartum
q2_question: row.SEGMENT_SYMPTOMS || null,    // ✅ Q2 = Symptoms
objections: row.SEGMENT_OBJECTIONS || null,
```

**Change lines 322-324 (Supabase mapping):**
```javascript
// FROM:
q1_question: row.symptoms || null,
q2_question: row.months_pp || null,

// TO:
q1_question: row.months_pp || null,           // ✅ Q1 = Months postpartum
q2_question: row.symptoms || null,            // ✅ Q2 = Symptoms
```

**Fix chatbot_ab mapping (line 233):**
Need to investigate Airtable CSV to find correct column name.

### Step 2: Fix existing historical data in database

Create a migration script to swap the fields:

```sql
-- Backup first (just in case)
CREATE TABLE contacts_backup_20250107 AS SELECT * FROM contacts WHERE source LIKE '%_historical%';

-- Swap Q1 and Q2
UPDATE contacts
SET
  q1_question = q2_question,
  q2_question = q1_question
WHERE source LIKE '%_historical%';

-- Clean chatbot_ab
UPDATE contacts
SET chatbot_ab = NULL
WHERE source LIKE '%_historical%'
  AND chatbot_ab IS NOT NULL
  AND chatbot_ab NOT LIKE 'A%OCT30'
  AND chatbot_ab NOT LIKE 'B%OCT30';
```

### Step 3: Verify the fix

Run analysis script again to confirm:
```bash
node scripts/check-field-mapping-issues.js
```

Expected output:
```
Q1 Analysis: 0 ❌ (all correct)
Chatbot AB: Only "A-OCT30" and "B-OCT30" values
```

---

## ⚠️ DO NOT DO

❌ **DO NOT** delete historical contacts - they have valuable attribution data
❌ **DO NOT** modify live (non-historical) data - it's already correct
❌ **DO NOT** run the migration script again without fixing it first

---

## 📋 NEXT STEPS

1. **IMMEDIATE:** Fix the database with UPDATE queries (Option 1)
2. **FOLLOW UP:** Fix `prepare-migration-data.js` script for future imports
3. **VERIFY:** Run check script to confirm fix
4. **DOCUMENT:** Update HISTORICAL_DATA_MAPPING.md with correct field mappings

---

## 🔍 INVESTIGATION NEEDED

Need to check Airtable CSV to find correct column for `chatbot_ab`:

```bash
head -1 historical_data/airtable_contacts.csv | tr ',' '\n' | nl
```

Look for column that has "A-OCT30" or "B-OCT30" values, NOT symptoms.

---

**Last Updated:** January 7, 2025
**Status:** Ready for fix - UPDATE queries prepared
**Risk Level:** Low (UPDATE is safe, can be rolled back from backup)
