# Weekly Insights Framework - What to Track & Report

**Purpose:** Ensure every weekly report delivers actionable business improvements, not just metrics.

---

## Core Principle: Memory → Insights → Action

Each week's report should:
1. **Remember** what we said last week (context)
2. **Compare** this week vs last week (trends)
3. **Identify** what changed and why (insights)
4. **Recommend** specific actions (improvements)

---

## Week-to-Week Tracking Categories

### 1. Volume & Efficiency Metrics

**What to Track:**
- New contacts (week-over-week change %)
- Qualification rate (is it improving or dropping?)
- Attribution coverage (% of contacts with ad_id)
- Bookings, shows, purchases (conversion funnel)

**Memory Questions:**
- Did we scale any ads last week? Did volume increase?
- Did we change bot questions? Did qualify rate change?
- Did we add attribution to more ads? Did coverage improve?

**Insight to Extract:**
```
Example:
Last Week: 188 contacts, 56% qualify rate
This Week: 245 contacts (+30%), 48% qualify rate (-8%)

Insight: "Volume increased 30% after scaling Ad ...200652, but qualify
rate dropped 8%. This suggests the new traffic is less qualified.
Recommendation: Keep scaling but add qualification questions earlier
in the bot flow to filter faster."
```

---

### 2. Ad Performance (The Big One)

**What to Track:**
| Metric | Last Week | This Week | Change | Why It Matters |
|--------|-----------|-----------|--------|----------------|
| **Top ad by volume** | Ad ID, count | Ad ID, count | New leader? | Which ads drive scale |
| **Top ad by qualify rate** | Ad ID, % | Ad ID, % | Better quality? | Which ads drive quality |
| **Top ad by revenue** | Ad ID, $ | Ad ID, $ | Who converts? | Which ads drive $$ |
| **New ads launched** | - | Ad IDs | Test results | Are new variants winning? |
| **Spend by ad** | Ad ID, $ | Ad ID, $ | Budget shifts | Where money is going |

**Memory Questions:**
- What did we recommend scaling last week? How did it perform?
- Did any new ads launch? Are they winning or losing?
- Did spend shift between ads? What was the impact?

**Insight to Extract:**
```
Example:
Last Week: Recommended scaling Ad ...200652 (84.6% qualify rate)
This Week: Ad ...200652 now at 27 contacts (+14), 79% qualify rate (-5.6%)

Insight: "Ad ...200652 scaled successfully (+14 contacts) but qualify
rate dropped from 84.6% to 79% as volume increased. This is normal -
quality often dips slightly at scale. Still outperforming average (56%).
Continue scaling."
```

---

### 3. Creative Theme Performance (A/B Testing)

**What to Track:**
| Theme | # Ads | Total Contacts | Avg Qualify Rate | Revenue | ROAS |
|-------|-------|----------------|------------------|---------|------|
| Overwhelm to Relief | 8 | XXX | XX% | $XXX | X.XX |
| Confusion to Clarity | 26 | XXX | XX% | $XXX | X.XX |
| Pain to Comfort | 2 | XXX | XX% | $XXX | X.XX |

**Memory Questions:**
- Last week we said "Overwhelm to Relief" wins. Is it still winning?
- Did we launch new "Overwhelm to Relief" ads? How are they performing?
- Is "Confusion to Clarity" improving or getting worse?

**Insight to Extract:**
```
Example:
Week 1: "Overwhelm to Relief" = 84.6% qualify, "Confusion to Clarity" = 60%
Week 2: "Overwhelm to Relief" = 78% qualify, "Confusion to Clarity" = 62%

Insight: "Both themes improved as we refined ad copy, but 'Overwhelm
to Relief' still leads by 16%. The gap is narrowing - 'Confusion to
Clarity' improved 2% vs 'Overwhelm' dropped 6.6% (expected at scale).
Recommendation: Keep majority budget on 'Overwhelm to Relief' but test
refined 'Confusion to Clarity' variants."
```

---

### 4. A/B Testing Framework

**Types of Tests to Track:**

#### Ad Creative Tests
- **Theme A vs Theme B** (Overwhelm to Relief vs Confusion to Clarity)
- **Hook A vs Hook B** ("Your doctor says it's normal" vs "Still exhausted at 15 months")
- **Media A vs Media B** (Video vs Carousel vs Image)
- **CTA A vs CTA B** ("See if you qualify" vs "Book your assessment")

#### Bot Flow Tests
- **Question order A vs B** (Symptoms first vs Timeline first)
- **Qualification criteria A vs B** (3 questions vs 5 questions)
- **Trigger word A vs B** (HEAL vs RELIEF vs BETTER)

#### Offer Tests
- **Price anchor A vs B** ($2,997 upfront vs $997/mo)
- **Urgency A vs B** ("Limited spots" vs "Book this week")
- **Social proof A vs B** ("2,800 mamas" vs "Rated 4.9/5")

**A/B Test Template:**
```markdown
### Test: [Name]
**Hypothesis:** [What we think will happen]
**Variant A:** [Control - what we're currently doing]
**Variant B:** [Test - what we're trying]
**Metric:** [What we're measuring - qualify rate, ROAS, etc.]
**Sample Size:** [How many contacts needed for significance]
**Duration:** [How long to run test]
**Status:** Planning / Running / Complete
**Result:** [Winner + why]
```

**Example A/B Test:**
```markdown
### Test: "Overwhelm to Relief" Hook Variants
**Hypothesis:** Validating specific symptoms will outperform generic validation
**Variant A (Control):** "Your PCP/OBGYN says it's normal... but it's NOT"
**Variant B (Test):** "Chronic fatigue, mom brain, low libido - your doctor says
it's normal... but as postpartum experts, we disagree"
**Metric:** Qualify rate (target >80%)
**Sample Size:** 100 contacts per variant (200 total)
**Duration:** 1 week
**Status:** Running (Day 3 of 7)
**Current Results:**
  - Variant A: 47 contacts, 78% qualify (36 qualified)
  - Variant B: 52 contacts, 83% qualify (43 qualified)
  - Leader: Variant B (+5% qualify rate)
**Confidence:** 65% (need 3 more days for significance)
```

---

### 5. Conversion Funnel Analysis

**What to Track:**
| Stage | Last Week | This Week | Change | Bottleneck? |
|-------|-----------|-----------|--------|-------------|
| Subscribe | 188 | XXX | +/-X% | - |
| DM Qualified | 106 (56%) | XXX (XX%) | +/-X% | Drop here? |
| Form Filled | 0 (0%) | XXX (XX%) | +/-X% | Drop here? |
| Link Sent | 0 (0%) | XXX (XX%) | +/-X% | Drop here? |
| Link Clicked | 0 (0%) | XXX (XX%) | +/-X% | Drop here? |
| Booked | 0 (0%) | XXX (XX%) | +/-X% | Drop here? |
| Showed | 0 (0%) | XXX (XX%) | +/-X% | Drop here? |
| Purchased | 0 (0%) | XXX (XX%) | +/-X% | Drop here? |

**Memory Questions:**
- Where's the biggest drop-off? Is it getting worse?
- Did we change anything in the funnel? What happened?
- Are people progressing faster or slower than last week?

**Insight to Extract:**
```
Example:
Week 1: 188 subscribe → 106 qualify (56%) → 0 form filled
Week 2: 245 subscribe → 118 qualify (48%) → 12 form filled (10% of qualified)

Insight: "Form fill tracking is now live - 10% of qualified leads are
filling out the form (12 of 118). This is a new data point we didn't
have last week. Next bottleneck: Only 2 of 12 form fillers clicked the
booking link. Recommendation: Shorten time between form submission and
link delivery (currently 24 hours)."
```

---

### 6. Revenue Attribution (Once Conversion Data Flows)

**What to Track:**
| Ad ID | Contacts | Qualified | Purchases | Revenue | Spend | ROAS |
|-------|----------|-----------|-----------|---------|-------|------|
| ...200652 | 27 | 21 (78%) | 2 | $5,994 | $450 | 13.3x |
| ...310652 | 18 | 12 (67%) | 1 | $2,997 | $380 | 7.9x |

**Memory Questions:**
- Which ads are converting to revenue (not just leads)?
- Is ROAS improving or declining by ad?
- Should we kill any ads that aren't converting?

**Insight to Extract:**
```
Example:
Week 4: Ad ...200652 generated $5,994 revenue (2 purchases) from $450 spend = 13.3x ROAS
Week 5: Ad ...200652 generated $8,991 revenue (3 purchases) from $620 spend = 14.5x ROAS

Insight: "Ad ...200652 ROAS improved from 13.3x to 14.5x as we scaled.
This ad is proving profitable at higher volume. Increased spend by 38%
($450 → $620) and revenue grew 50% ($5,994 → $8,991). Continue scaling
until ROAS drops below 10x."
```

---

## Weekly Report Structure (With Memory)

### Section 1: Executive Summary
**What to include:**
- Total contacts, revenue, spend (week-over-week %)
- System status (any changes to tracking?)
- Biggest win this week
- Biggest concern this week

**Memory integration:**
```
Last week: We recommended scaling Ad ...200652
This week: We did scale it - here's what happened
```

### Section 2: What Changed
**What to include:**
- New ads launched (how are they performing?)
- Budget shifts (did we scale winners?)
- Bot changes (did qualify rate change?)
- Any tests started or completed

**Memory integration:**
```
Last week: Started A/B test on "Overwhelm to Relief" hook variants
This week: Test complete - Variant B wins (+5% qualify rate)
```

### Section 3: A/B Test Results
**What to include:**
- Tests completed this week (winner, loser, insight)
- Tests currently running (progress, early trends)
- Tests planned for next week

**Memory integration:**
```
Week 1: Hypothesized "Overwhelm to Relief" > "Confusion to Clarity"
Week 2: Confirmed - 84.6% vs 60% qualify rate
Week 3: Tested refined "Confusion to Clarity" variant
Week 4: Refined variant improved to 68% (closer, but still losing)
```

### Section 4: Top Performers
**What to include:**
- Best ad by volume (is it new or same as last week?)
- Best ad by quality (is it new or same as last week?)
- Best ad by ROAS (once conversion data available)

**Memory integration:**
```
Weeks 1-3: Ad ...200652 was the volume leader
Week 4: New ad ...450652 overtook it (32 contacts vs 27)
```

### Section 5: What to Do Next Week
**What to include:**
- Specific actions (scale Ad X, test variant Y, kill ad Z)
- Expected outcomes (if we do X, we expect Y)
- What to watch for (leading indicators)

**Memory integration:**
```
Last week: Recommended scaling Ad ...200652
This week: We did - volume up 30%, qualify rate down 5% (expected)
Next week: Continue scaling, monitor quality threshold (don't drop below 70%)
```

---

## Data Retention for Memory

### Store in Database (or Persistent Memory)

**Weekly snapshots table:**
```sql
CREATE TABLE weekly_snapshots (
  week_ending DATE PRIMARY KEY,
  total_contacts INTEGER,
  total_qualified INTEGER,
  qualify_rate DECIMAL(5,2),
  total_revenue DECIMAL(10,2),
  total_spend DECIMAL(10,2),
  roas DECIMAL(5,2),
  top_ad_by_volume TEXT,
  top_ad_by_quality TEXT,
  top_ad_by_roas TEXT,
  recommendations_given TEXT[], -- What we told Eric to do
  actions_taken TEXT[], -- What was actually done
  insights TEXT -- Key learnings this week
);
```

**A/B tests table:**
```sql
CREATE TABLE ab_tests (
  test_id SERIAL PRIMARY KEY,
  test_name TEXT,
  hypothesis TEXT,
  variant_a_description TEXT,
  variant_b_description TEXT,
  metric_tracked TEXT,
  started_at DATE,
  ended_at DATE,
  status TEXT, -- planning, running, complete
  winner TEXT, -- variant_a, variant_b, no_difference
  result_summary TEXT,
  confidence_level DECIMAL(5,2)
);
```

**Ad performance history:**
```sql
CREATE TABLE ad_performance_weekly (
  week_ending DATE,
  ad_id TEXT,
  contacts INTEGER,
  qualified INTEGER,
  qualify_rate DECIMAL(5,2),
  purchases INTEGER,
  revenue DECIMAL(10,2),
  spend DECIMAL(10,2),
  roas DECIMAL(5,2),
  PRIMARY KEY (week_ending, ad_id)
);
```

---

## AI Assistant Memory Prompt

**For future automation:**

```
You are Clara, the analytics system for Postpartum Care USA.

MEMORY FROM PREVIOUS REPORTS:
{
  "last_week": {
    "total_contacts": 188,
    "top_ad": "120236476054200652",
    "recommendations": [
      "Scale Ad ...200652 (84.6% qualify rate)",
      "Test more 'Overwhelm to Relief' messaging"
    ],
    "ab_tests_running": [
      {
        "name": "Hook Variant Test",
        "status": "Day 3 of 7",
        "early_leader": "Variant B"
      }
    ]
  },
  "historical_patterns": {
    "overwhelm_to_relief_wins": true,
    "time_to_purchase": 28,
    "avg_qualify_rate": 0.56
  }
}

THIS WEEK'S DATA:
{json_data}

YOUR JOB:
1. Compare this week vs last week (what changed?)
2. Check if recommendations were followed (did they scale Ad ...200652?)
3. Report on A/B test progress (is Variant B still winning?)
4. Extract new insights (any new patterns emerging?)
5. Give specific next actions (what to do this week)

Remember: Eric wants actionable insights, not just numbers. Tell him what
changed, why it matters, and what to do about it.
```

---

## Example Week-to-Week Flow

### Week 1 Report:
- "Ad ...200652 is your winner (84.6% qualify rate)"
- "Recommendation: Scale this ad"
- "Pattern: 'Overwhelm to Relief' > 'Confusion to Clarity'"

### Week 2 Report (with memory):
- "Last week we recommended scaling Ad ...200652. You did - here's what happened:"
  - Volume: 13 → 27 contacts (+107%)
  - Qualify rate: 84.6% → 79% (-5.6% expected at scale)
  - Still outperforming average (79% vs 56%)
- "New insight: Ad ...450652 launched this week (new 'Overwhelm' variant)"
  - 12 contacts, 91.7% qualify rate (better than original!)
  - Recommendation: Scale this new variant
- "A/B Test Update: Hook variant test completed"
  - Winner: Variant B (specific symptoms) beat Variant A (generic) by 5%
  - Next test: Pain angle vs Validation angle

### Week 3 Report (with memory):
- "You scaled both Ad ...200652 and ...450652 as recommended:"
  - Combined volume: 54 contacts this week (+100% vs Week 2)
  - Combined qualify rate: 81% (holding strong)
- "Pattern confirmed: Symptom-specific hooks win"
  - Week 1: Generic validation = 84.6%
  - Week 2: Specific symptoms = 91.7%
  - Week 3: Added symptom focus to 3 more ads, avg qualify up to 86%
- "Revenue attribution now live:"
  - Ad ...200652 generated first purchase: $2,997 revenue from $620 spend = 4.8x ROAS
  - Time to purchase: 31 days from subscribe (close to predicted 28 days)
- "Next: Kill underperforming ads"
  - 5 "Confusion to Clarity" ads have <40% qualify rate
  - Recommendation: Pause these, reallocate budget to "Overwhelm" ads

---

**This framework ensures every weekly report builds on the last one, tracks A/B tests rigorously, and delivers business improvements - not just data dumps.**
