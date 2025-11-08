# A/B Testing Quick Start Guide

**Purpose:** How to set up, track, and analyze A/B tests for continuous improvement

---

## 🎯 What to A/B Test

### 1. Ad Creative Tests (Highest Impact)

**Emotional Theme Test**
```
Hypothesis: "Overwhelm to Relief" outperforms "Confusion to Clarity"
Variant A: Confusion to Clarity messaging
Variant B: Overwhelm to Relief messaging
Metric: Qualify rate
Sample: 100 contacts per variant
Duration: 1 week
```

**Hook Variant Test**
```
Hypothesis: Specific symptoms mentioned > generic validation
Variant A: "Your doctor says it's normal... but it's NOT"
Variant B: "Chronic fatigue, mom brain, low libido - your doctor says
           it's normal... but as postpartum experts, we disagree"
Metric: Qualify rate
Sample: 100 contacts per variant
Duration: 1 week
```

**Media Type Test**
```
Hypothesis: Video ads qualify better than carousels
Variant A: Static carousel
Variant B: Video (VSL or b-roll)
Metric: Qualify rate + CPL (cost per lead)
Sample: 200 impressions per variant
Duration: 3 days
```

### 2. Bot Flow Tests (Medium Impact)

**Question Order Test**
```
Hypothesis: Asking symptoms first filters faster than timeline first
Variant A: Current flow (timeline → symptoms → trigger word)
Variant B: New flow (symptoms → timeline → trigger word)
Metric: Qualify rate + drop-off rate
Sample: 100 contacts per variant
Duration: 1 week
```

**Qualification Criteria Test**
```
Hypothesis: 3 questions is optimal (not too strict, not too loose)
Variant A: 3 qualifying questions
Variant B: 5 qualifying questions
Metric: Qualify rate + conversion rate (qualified → purchased)
Sample: 100 contacts per variant
Duration: 2 weeks (need time for conversions)
```

### 3. Offer Tests (Lower Impact, But Important)

**Price Anchor Test**
```
Hypothesis: Monthly payment option increases bookings
Variant A: $2,997 upfront only
Variant B: $2,997 upfront OR $997/mo × 3
Metric: Booking rate
Sample: 50 form fills per variant
Duration: 2 weeks
```

**Urgency Test**
```
Hypothesis: Scarcity increases booking rate
Variant A: No urgency ("Book your assessment")
Variant B: Urgency ("Only 3 spots left this week")
Metric: Booking rate
Sample: 50 form fills per variant
Duration: 1 week
```

---

## 📝 How to Set Up a Test

### Step 1: Define the Test

**Use this template:**
```markdown
### Test: [Short name]
**Hypothesis:** [What you think will happen and why]
**Variant A (Control):** [What you're currently doing]
**Variant B (Test):** [What you want to try]
**Metric:** [What you're measuring - qualify rate, ROAS, etc.]
**Sample Size:** [How many contacts/impressions needed]
**Duration:** [How long to run - days/weeks]
**Success Criteria:** [What result means we scale Variant B]
```

**Example:**
```markdown
### Test: Overwhelm Hook Variants
**Hypothesis:** Calling out specific symptoms will improve qualify rate by 10%
**Variant A (Control):** "Your doctor says it's normal... but it's NOT"
**Variant B (Test):** "Chronic fatigue, mom brain, low libido - your doctor says
                      it's normal... but we disagree"
**Metric:** Qualify rate
**Sample Size:** 100 contacts per variant (200 total)
**Duration:** 7 days
**Success Criteria:** Variant B qualifies ≥10% better than A with 90% confidence
```

### Step 2: Create Test Variants in Meta Ads

**For ad creative tests:**
1. Duplicate existing ad (becomes Variant A - control)
2. Create new ad with test variant (Variant B)
3. Name them clearly: "MC [#] - [Description] - Variant A/B"
4. Set equal budgets ($50/day each)
5. Launch at same time

**Example naming:**
```
Variant A: MC70 - Overwhelm Hook Generic - Variant A
Variant B: MC71 - Overwhelm Hook Specific Symptoms - Variant B
```

### Step 3: Track in Database

**Save the test:**
```bash
node -e "
require('dotenv').config({ path: '.env.local' });
const { saveAbTest } = require('./scripts/save-weekly-snapshot');

saveAbTest({
  name: 'Overwhelm Hook Variants',
  hypothesis: 'Specific symptoms will improve qualify rate by 10%',
  variantA: {
    description: 'Generic validation hook',
    adIds: ['120236XXXXXXXXXX'] // Ad ID for Variant A
  },
  variantB: {
    description: 'Specific symptom call-outs',
    adIds: ['120236YYYYYYYYYY'] // Ad ID for Variant B
  },
  metric: 'qualify_rate',
  sampleSize: 200,
  startDate: '2025-11-08',
  status: 'running'
}).then(() => console.log('Test saved!'));
"
```

### Step 4: Monitor Progress

**Daily check:**
```sql
SELECT
  ad_id,
  COUNT(*) as contacts,
  COUNT(*) FILTER (WHERE dm_qualified_date IS NOT NULL) as qualified,
  ROUND(
    COUNT(*) FILTER (WHERE dm_qualified_date IS NOT NULL)::DECIMAL /
    COUNT(*) * 100,
    1
  ) as qualify_rate
FROM contacts
WHERE ad_id IN ('120236XXXXXXXXXX', '120236YYYYYYYYYY')
  AND subscribe_date >= '2025-11-08'
GROUP BY ad_id;
```

**Track in spreadsheet or Notion:**
| Day | Variant A Contacts | Variant A Qualify % | Variant B Contacts | Variant B Qualify % | Leader |
|-----|-------------------|---------------------|-------------------|---------------------|--------|
| 1   | 12                | 75%                 | 15                | 80%                 | B      |
| 2   | 27                | 74%                 | 31                | 82%                 | B      |
| 3   | 43                | 72%                 | 48                | 83%                 | B      |

### Step 5: Analyze Results

**Once you hit sample size (100+ per variant):**

**Statistical significance calculator:**
```javascript
// Simple significance test (use online calculator for precision)
const variantA = { contacts: 102, qualified: 74 }; // 72.5%
const variantB = { contacts: 105, qualified: 87 }; // 82.9%

const diff = (variantB.qualified / variantB.contacts) -
             (variantA.qualified / variantA.contacts);
const improvement = (diff / (variantA.qualified / variantA.contacts)) * 100;

console.log(`Improvement: ${improvement.toFixed(1)}%`); // +14.3%

// For p-value, use: https://www.optimizely.com/sample-size-calculator/
// Input your numbers, check if p < 0.05 (95% confidence)
```

**Decision tree:**
```
IF (Variant B > Variant A) AND (p-value < 0.05):
  → Winner: Variant B
  → Action: Kill Variant A, scale Variant B, apply learning to new ads

ELSE IF (Variant A > Variant B) AND (p-value < 0.05):
  → Winner: Variant A (control wins)
  → Action: Kill Variant B, keep Variant A, test different hypothesis

ELSE:
  → No significant difference
  → Action: Kill both, test new variants
```

### Step 6: Update Database

**Save results:**
```bash
node -e "
require('dotenv').config({ path: '.env.local' });
const { updateAbTestResults } = require('./scripts/save-weekly-snapshot');

updateAbTestResults(1, { // test_id from database
  variantA: { result: 72.5 },
  variantB: { result: 82.9 },
  winner: 'variant_b',
  confidence: 95.0,
  summary: 'Variant B (specific symptoms) beat Variant A (generic) by
           14.3% with 95% confidence. Applied learning to 3 new ads.'
}).then(() => console.log('Results saved!'));
"
```

---

## 📊 Current Tests to Run (Prioritized)

### Week 1: Overwhelm Hook Variants
- **Why:** We know "Overwhelm to Relief" wins, but can we improve it?
- **Variant A:** "Your doctor says it's normal... but it's NOT"
- **Variant B:** "Chronic fatigue, mom brain, low libido - your doctor says it's normal... but we disagree"
- **Expected outcome:** +10-15% qualify rate

### Week 2: Media Type Test
- **Why:** Unknown if video or carousel performs better
- **Variant A:** Static carousel (current best)
- **Variant B:** Video (VSL or Stacia b-roll)
- **Expected outcome:** Video wins on qualify rate, possibly loses on CPL

### Week 3: CTA Variant Test
- **Why:** "See if you qualify" works, but can we do better?
- **Variant A:** "See if you qualify"
- **Variant B:** "Take the assessment"
- **Expected outcome:** Small difference (2-5%), but worth testing

### Week 4: Bot Question Order
- **Why:** Unknown if symptoms-first is better than timeline-first
- **Variant A:** Current flow (timeline → symptoms)
- **Variant B:** New flow (symptoms → timeline)
- **Expected outcome:** Symptoms-first may drop qualify rate but improve conversion

---

## 🎯 How to Apply Learnings

### When Variant B Wins:

1. **Immediate:** Pause Variant A, scale Variant B budget
2. **This week:** Apply winning element to 2-3 existing ads
3. **Next week:** Launch 3-5 new ads with winning pattern
4. **Monitor:** Does the pattern hold at scale?

**Example:**
```
Week 1: Test "Overwhelm Hook Variants"
Week 2: Variant B wins (specific symptoms > generic)
Week 3: Apply to 3 existing "Overwhelm to Relief" ads
Week 4: Launch 5 new ads, all with specific symptoms
Week 5: Monitor - did qualify rate hold? (Yes: keep scaling, No: investigate)
```

### When Control Wins:

1. **Immediate:** Pause test variant, keep control
2. **This week:** Document why test failed (hypothesis was wrong)
3. **Next week:** Test different hypothesis
4. **Never:** Re-test the same losing variant

### When No Difference:

1. **Immediate:** Pause both variants (save budget)
2. **This week:** Analyze why no difference (too similar? wrong metric?)
3. **Next week:** Test more extreme variants

---

## 📈 Tracking Dashboard (Manual for Now)

**Weekly review spreadsheet:**

| Week | Test Name | Status | Variant A Result | Variant B Result | Winner | Applied? |
|------|-----------|--------|------------------|------------------|--------|----------|
| 1    | Overwhelm Hook | Complete | 72.5% qualify | 82.9% qualify | B (+14.3%) | ✅ Yes |
| 2    | Media Type | Running | Day 3/7... | Day 3/7... | TBD | - |
| 3    | CTA Variant | Planning | - | - | - | - |

---

## 🔬 Advanced: Sequential Testing

**Once you have winners:**

**Test 1:** Find winning theme → "Overwhelm to Relief" wins
**Test 2:** Optimize winning theme → Specific symptoms win
**Test 3:** Optimize winning hook → "Chronic fatigue" #1 symptom
**Test 4:** Optimize winning media → Video beats carousel
**Test 5:** Optimize winning video → Stacia b-roll beats VSL

**Result:** Compound improvements
- Week 1: 72% qualify rate (baseline)
- Week 5: 72% × 1.14 × 1.08 × 1.05 × 1.06 = 98% qualify rate

---

## ⚠️ Common Mistakes

1. **Testing too many things at once**
   - ❌ Don't: Change theme + media + CTA in one test
   - ✅ Do: Change one variable at a time

2. **Stopping tests too early**
   - ❌ Don't: Call winner after 20 contacts per variant
   - ✅ Do: Wait for 100+ contacts per variant (unless extreme difference)

3. **Ignoring statistical significance**
   - ❌ Don't: "76% > 74%, Variant B wins!"
   - ✅ Do: Check p-value, ensure 95%+ confidence

4. **Not applying learnings**
   - ❌ Don't: Test, find winner, forget about it
   - ✅ Do: Apply winning pattern to all new ads immediately

5. **Re-testing losing variants**
   - ❌ Don't: "Maybe it'll work this time?"
   - ✅ Do: Test a new hypothesis instead

---

**Next Steps:**
1. Run first test this week (Overwhelm Hook Variants)
2. Track results daily
3. Call winner at 100+ contacts per variant
4. Apply learning to 3 existing ads
5. Launch 5 new ads with winning pattern
6. Move to next test

**The goal: Continuous 5-10% improvements every week through rigorous testing.**
