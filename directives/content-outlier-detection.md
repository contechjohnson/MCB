# Directive: Content Outlier Detection

> Find high-performing Instagram content outliers with transferability scoring and auto-generated caption variants

**Status:** Active
**Script:** `execution/content-outlier-detection.js`
**Related:** `analytics.md`, `meta-ads-sync.md`, `apify.md` (root)

---

## Overview

This directive identifies high-performing social media content by finding posts that significantly outperform a creator's baseline engagement. Unlike simple outlier detection, this system uses **cross-niche transferability scoring** to filter out non-actionable content and auto-generates **3 caption variants** adapted for each client.

**Philosophy:** Outliers reveal what resonates. Recency matters for trend detection. Transferability matters more than raw performance.

**Scope:** Instagram (primary), extensible to YouTube/LinkedIn

---

## Commands

| Intent | Command | Notes |
|--------|---------|-------|
| Analyze niche by keywords | `/content-outliers "luxury med spa"` | Auto-discovers top 50 creators |
| Analyze specific competitors | `/content-outliers --handles "@restore,@upgradlabs"` | Provide handle list |
| Custom timeframe | `/content-outliers "biohacking" --days 90` | Default: 30 days |
| Preview creators only | `/content-outliers "wellness" --dry-run` | No scraping, no cost |
| Resume interrupted run | `/content-outliers "niche" --resume` | Continues from checkpoint |

---

## Process

### Phase 1: Creator Discovery (2-5 min)

**Input:** Niche keywords OR specific handles
**Tool:** Apify Instagram Profile Scraper
**Filters:**
- 10k-1M followers
- Engagement rate > 2%
- Active in last 30 days

**Output:** List of 20-50 creators with handle, followers, bio, avg ER

**Script:** `findCreators(niche, options)`

### Phase 2: Content Scraping (10-20 min)

**Input:** Creator handles from Phase 1
**Tool:** Apify Instagram Post Scraper
**Timeframe:** Last 30-90 days (configurable)

**Data Collected Per Post:**
- Post URL, thumbnail URL, caption
- Likes, comments, views (videos)
- Post date/time, post type (photo/video/carousel)

**Rate Limiting:**
- 2-second delays between creators
- Checkpoint every 5 creators for resume capability

**Script:** `scrapeCreatorPosts(handle, days)`

### Phase 3: Baseline Calculation (1 min)

**Metric:** Engagement Rate = (Likes + Comments) / Followers × 100

**Per Creator:**
- **Median engagement rate** (primary baseline - robust to outliers)
- Mean, std dev, P75, P90 (for reference)

**Skip If:** <10 posts in timeframe (unreliable baseline)

**Script:** `calculateBaseline(posts, followers)`

### Phase 4: Cross-Niche Scoring (1 min) ⭐ CORE INNOVATION

This is where we filter for **transferability**, not just raw performance.

**Step 4A: Calculate Raw Outlier Score**
```javascript
raw_score = post_er / baseline_er
// Example: 6.5% post ER / 3.0% baseline = 2.17x
```

**Step 4B: Apply Cross-Niche Filters**

**Hard Exclusions** (return score = 0, skip entirely):
- Own competitors (@restorehyperwellness, @upgradlabs, @the10xhealthsystem, etc.)
- Direct wellness competitors in same market

**Heavy Penalties** (-70% to score):
- Product reviews/unboxings ("my new X", "haul", "what I bought")
- Personal vlogs ("day in my life", "what I eat", "my routine")
- Entertainment content ("challenge", "prank", "react to")
- News/current events (not evergreen)

**Soft Penalties** (-20% per term):
- Too technical/medical (specific treatment protocols, medical jargon)
- Equipment-specific (brand names, model numbers)

**Bonuses** (multiply score):
- **Money hooks (+40%):** "$", "save money", "cost of", "worth it", "pricing"
- **Curiosity hooks (+30%):** "?", "secret", "nobody tells you", "shocking"
- **Transformation hooks (+25%):** "before/after", "changed my", "results"
- **Contrarian hooks (+25%):** "myth", "wrong", "stop doing"
- **Time hooks (+20%):** "faster", "in 30 days", "quick recovery"
- **Urgency hooks (+15%):** "limited", "now", "before it's too late"
- **Numbers/listicles (+10%):** "5 ways", "3 secrets", "7 tips"

**Step 4C: Final Cross-Niche Score**
```javascript
let score = raw_score;

// Apply filters
if (isOwnNiche(caption)) return 0;  // Hard exclude
if (isNonTransferable(caption)) score *= 0.3;  // Heavy penalty
if (isTooTechnical(caption)) score *= 0.8;  // Soft penalty

// Apply hook bonuses
if (hasMoneyHook(caption)) score *= 1.4;
if (hasCuriosityHook(caption)) score *= 1.3;
if (hasTransformationHook(caption)) score *= 1.25;
// ... etc

return score;  // This is the cross-niche transferability score
```

**Script:** `calculateCrossNicheScore(caption, rawOutlierScore)`

### Phase 5: Recency Amplification (1 min)

Apply time decay boost to prioritize trending content:
- **<1 day: 2.0x multiplier** (viral happening NOW)
- **1-3 days: 1.5x multiplier** (very recent trend)
- **3-7 days: 1.2x multiplier** (recent content)
- **7+ days: 1.0x multiplier** (baseline, no boost)

**Final Score Calculation:**
```javascript
final_score = cross_niche_score * recency_multiplier
```

**Content Categorization** (auto-tag for filtering):
- Money (pricing, cost savings, ROI)
- Transformation (before/after, results)
- Education (how-to, tips)
- Curiosity (questions, secrets)
- General

**Script:** `getRecencyMultiplier(daysAgo)`, `categorizeContent(caption)`

### Phase 6: Caption Variant Generation (2-3 min) ⭐ HIGH VALUE

For each outlier, auto-generate **3 caption variants** adapted for the client's audience.

**Input:** Original caption + client context (Centner/PPCU/etc.)
**Model:** Claude Sonnet 4.5
**Parallel Processing:** 5 outliers at once (much faster)

**Prompt Structure:**
```
Analyze this high-performing caption from [niche]:

Original Caption: "[caption]"

Generate 3 NEW caption variants for [client_name] that:
1. Adapt the hook/structure to [client_services]
2. Use the same emotional trigger and curiosity gap as original
3. Target [client_audience]
4. Maintain [client_tone] tone
5. Pivot to [client_keywords]
6. Are meaningfully different from each other
7. Stay under 2,200 characters

Return JSON array of 3 strings.
```

**Client Context Configs:**
```javascript
const CLIENT_CONFIGS = {
  'centner': {
    name: 'Centner Wellness Center',
    location: 'Miami, FL',
    services: 'Red light therapy, sensory deprivation (float tanks), hyperbaric oxygen, EBOO therapy',
    audience: 'Health-conscious, wellness-focused, performance optimization enthusiasts (30-55, higher income)',
    tone: 'luxury, science-backed, transformative',
    keywords: 'biohacking, wellness optimization, longevity, performance'
  },
  'ppcu': {
    name: 'Postpartum Care USA',
    services: 'Postpartum care, recovery programs',
    audience: 'New mothers, pregnancy recovery',
    tone: 'supportive, educational, empowering',
    keywords: 'postpartum fitness, recovery, motherhood'
  }
};
```

**Output:** 3 caption variants per outlier, ready to post

**Script:** `generateCaptionVariants(originalCaption, clientContext)`

### Phase 7: Export (1-2 min)

**Google Sheets Export:**
- Create spreadsheet in user's main Drive (root)
- 19 columns (see Outputs section)
- Conditional formatting: green for high cross-niche scores, bold for recent posts
- Sort by: Cross-Niche Score (desc), then Days Ago (asc)
- Clickable URLs, inline image previews

**CSV Export:**
- Save to `outputs/content_outliers_[niche]_[YYYYMMDD_HHMMSS].csv`
- Create symlink to `content_outliers_[niche]_latest.csv`
- UTF-8 with BOM (Excel compatibility)

**Script:** `exportToSheets(outliers, niche)`, `exportToCSV(outliers, niche)`

---

## Inputs

| Input | Type | Required | Description |
|-------|------|----------|-------------|
| Niche/keywords | string | One of* | Keywords for auto-discovery (e.g., "luxury med spa") |
| `--handles` | string | One of* | Comma-separated creator handles (e.g., "@creator1,@creator2") |
| `--days` | number | No | Lookback window (default: 30, max: 90) |
| `--dry-run` | flag | No | Preview creators without scraping (no cost) |
| `--resume` | flag | No | Resume from checkpoint if interrupted |

*Must provide EITHER niche keywords OR --handles

---

## Outputs

### Google Sheets (19 Columns)

**Sheet Name:** "Content Outliers - [niche] - [date]"

| Col | Name | Description |
|-----|------|-------------|
| A | **Cross-Niche Score** | Transferability score (main metric) |
| B | Final Score | With recency boost applied |
| C | Raw Outlier Score | Post ER / Baseline ER (before filters) |
| D | Days Ago | Age of post |
| E | **Category** | Money/Transform/Curiosity/Education/General |
| F | Creator | Instagram handle (hyperlink to profile) |
| G | Followers | Follower count |
| H | Avg ER | Creator's baseline engagement rate |
| I | Post URL | Link to post (clickable) |
| J | Thumbnail | Image preview =IMAGE(url) |
| K | Caption | Original caption (truncated 200 chars) |
| L | Likes | Like count |
| M | Comments | Comment count |
| N | Date | Post date |
| O | Post ER | Post engagement rate |
| P | **Caption Variant 1** | Adapted for client (full text) |
| Q | **Caption Variant 2** | Adapted for client (full text) |
| R | **Caption Variant 3** | Adapted for client (full text) |
| S | Type | Photo/Video/Carousel |

**Conditional Formatting:**
- Cross-Niche Score >= 5.0: Dark green (highly transferable)
- Cross-Niche Score >= 3.0: Light green (very transferable)
- Cross-Niche Score >= 2.0: Yellow (transferable)
- Days Ago <= 1: Bold + dark blue text (viral NOW)
- Days Ago <= 3: Bold text (very recent)

**Sort Order:**
1. Cross-Niche Score (descending) - most transferable first
2. Days Ago (ascending) - most recent first within same score

### CSV Export

**Filename:** `content_outliers_[niche]_[YYYYMMDD_HHMMSS].csv`

**Columns:** cross_niche_score, final_score, raw_outlier_score, days_ago, category, creator_handle, creator_followers, creator_avg_er, post_url, thumbnail_url, caption, likes, comments, post_date, post_er, caption_variant_1, caption_variant_2, caption_variant_3, post_type

**Symlink:** `content_outliers_[niche]_latest.csv` → most recent run

### Console Output

```
🔍 Content Outlier Detection
   Niche: luxury med spa
   Lookback: 30 days
   Threshold: 2.0x

📦 Phase 1: Creator Discovery
   Found 45 creators

📊 Phase 2: Content Scraping
   [5/45] Processing @restorehyperwellness...
   [10/45] Processing @upgradlabs...
   ...
   Scraped 1,247 posts

🎯 Phase 3-5: Analysis
   Calculated baselines for 45 creators
   Detected 87 raw outliers
   After cross-niche filtering: 23 outliers
   Applied recency boost

✍️ Phase 6: Caption Variants
   [5/23] Generating variants for @creator...
   Generated 69 caption variants (3 per outlier)

📤 Phase 7: Export
   ✓ Google Sheet: https://docs.google.com/spreadsheets/d/...
   ✓ CSV: outputs/content_outliers_luxury_med_spa_20251209_143022.csv

Summary:
   Creators processed: 45
   Posts scraped: 1,247
   Outliers detected: 23
   Caption variants: 69
   Errors: 0
   Runtime: 18m 32s
```

---

## Configuration

### Environment Variables

```bash
# Required
APIFY_TOKEN=apify_api_xxx
ANTHROPIC_API_KEY=sk-ant-xxx

# Google Workspace MCP (already configured)
# Uses existing connection for Sheets export

# Optional (for debugging)
DEBUG=true  # Verbose logging
```

### Per-Niche Thresholds

```javascript
const NICHE_CONFIGS = {
  'luxury_med_spa': {
    outlier_threshold: 2.0,      // B2C high engagement
    min_followers: 10000,
    max_followers: 500000
  },
  'postpartum_fitness': {
    outlier_threshold: 2.0,      // B2C high engagement
    min_followers: 10000,
    max_followers: 500000
  },
  'aec_sales': {
    outlier_threshold: 1.5,      // B2B lower engagement
    min_followers: 5000,
    max_followers: 100000
  },
  'default': {
    outlier_threshold: 2.0,
    min_followers: 10000,
    max_followers: 1000000
  }
};
```

### Exclusion Lists (Configurable Per Client)

```javascript
// Example for Centner Wellness
const CENTNER_EXCLUSIONS = {
  // Hard exclude (wellness competitors)
  own_niche: [
    '@restorehyperwellness',
    '@upgradlabs',
    '@the10xhealthsystem',
    '@icryo',
    '@modernrecovery',
    'restore hyper wellness',
    'upgrade labs',
    '10x health'
  ],

  // Heavy penalty formats
  non_transferable: [
    'product review', 'unboxing', 'haul',
    'day in my life', 'what I eat', 'morning routine',
    'challenge', 'prank', 'react'
  ],

  // Soft penalty terms
  too_technical: [
    'hyperbaric chamber model',
    'specific ozone protocol',
    'medical device brand names'
  ]
};
```

---

## Edge Cases

| Scenario | Symptom | Handling |
|----------|---------|----------|
| Private account | Can't access posts | Skip creator, log warning, continue |
| Deleted content | Post no longer exists during scraping | Skip post, continue with others |
| <10 posts in timeframe | Baseline unreliable | Skip creator, log warning (need more data) |
| API rate limit hit | 429 error from Apify | Exponential backoff, retry 3x, then skip creator |
| Interrupted run | Process crashes mid-scrape | Resume from checkpoint using `--resume` flag |
| All outliers filtered | 0 outliers after cross-niche scoring | Log warning, suggest lowering threshold or broadening niche |
| Caption variant error | Claude API fails | Log error, leave variant columns empty, continue export |
| No ANTHROPIC_API_KEY | Caption generation fails | Skip Phase 6, export without variants (still valuable) |

---

## Troubleshooting

### Issue 1: No Creators Found

**Symptom:** "No creators found for niche" or 0 creators after filtering

**Cause:**
- Niche keywords too specific (e.g., "Miami luxury med spa with red light therapy")
- Apify actor search failed or returned 0 results
- Filters too aggressive (min followers too high)

**Fix:**
1. Broaden keywords (e.g., "med spa" instead of "luxury med spa Miami")
2. Lower min_followers in config (try 5k instead of 10k)
3. Provide manual handle list using `--handles` flag

### Issue 2: Low Outlier Count

**Symptom:** Only 2-3 outliers detected after analysis

**Cause:**
- Outlier threshold too high for niche (2.0x too strict)
- Cross-niche filters too aggressive (filtering out 90%+ of outliers)
- Timeframe too short (<30 days not enough posts)

**Fix:**
1. Lower outlier_threshold in NICHE_CONFIGS (try 1.5x instead of 2.0x)
2. Review exclusion lists - may be over-filtering
3. Increase lookback window: `--days 60` or `--days 90`

### Issue 3: Checkpoint Corrupted

**Symptom:** "Cannot resume from checkpoint" or JSON parse error

**Cause:**
- Checkpoint file malformed (process crashed mid-write)
- Disk full during checkpoint save
- Manual edit to checkpoint file

**Fix:**
1. Delete `.checkpoint_content_outliers_[niche].json` from outputs/
2. Restart without `--resume` flag (fresh run)
3. If happens repeatedly, check disk space

### Issue 4: Caption Variants Generic/Low Quality

**Symptom:** Generated captions don't maintain hook quality or sound generic

**Cause:**
- Client context insufficient (need more details about audience/tone)
- Original caption too short/generic (nothing to adapt)
- Prompt needs tuning for specific client

**Fix:**
1. Enhance CLIENT_CONFIGS with more specific audience/tone details
2. Review caption variant prompt - may need client-specific tweaks
3. Filter outliers by category - focus on types that adapt well

### Issue 5: Export Fails (Google Sheets)

**Symptom:** "Failed to create spreadsheet" or permission errors

**Cause:**
- Google Workspace MCP not authenticated
- User Drive quota exceeded
- Network timeout during export

**Fix:**
1. Check Google Workspace MCP connection: `claude mcp list`
2. Check Drive storage quota
3. Retry export (CSV still saved locally)
4. Manual upload CSV to Drive if needed

---

## Self-Annealing Log

> **IMPORTANT**: Update this section every time you fix an error or discover a constraint.

| Date | Issue | Resolution |
|------|-------|------------|
| 2025-12-09 | Initial creation | N/A - baseline implementation based on proven YouTube outlier system |

### Detailed Learnings

(To be populated after first production runs)

**Expected learnings to document:**
- Which hook bonuses are most predictive for each client
- Optimal outlier threshold per niche
- Cross-niche filter tuning (are we over/under filtering?)
- Caption variant quality patterns
- Cost per run actual vs estimated
- Runtime optimization opportunities

---

## Related Directives

- `analytics.md` - Similar filtering/metric calculation patterns
- `meta-ads-sync.md` - Similar API scraping + export workflow, checkpoint/resume logic
- `apify.md` (root) - Apify actor usage patterns, cost optimization

---

## Cost Breakdown

### Per Run Estimate

| Item | Quantity | Unit Cost | Total |
|------|----------|-----------|-------|
| Creator profile scraping | 50 profiles | $0.0026 | $0.13 |
| Post scraping | 1,500 posts | $0.003 | $4.50 |
| Caption variants (Claude) | 20 outliers × 3 variants | $0.10/outlier | $2.00 |
| **TOTAL PER RUN** | | | **~$6.63** |

### Monthly Usage (4 niches)

4 runs × $6.63 = **~$26.52/month**

**Cost vs Value:**
- Original plan (no variants): ~$4.50/run
- Enhanced plan (with variants): ~$6.63/run (+47%)
- **Client value increase:** 5x (ready-to-post captions vs just inspiration)
- **Time saved:** 2-3 hours of copywriting per run

---

## Performance Targets

| Metric | Target | Actual (TBD) |
|--------|--------|--------------|
| Total runtime | <25 minutes | |
| Creators found | 40-50 | |
| Posts scraped | 1,200-1,500 | |
| Raw outliers | 60-100 | |
| Post-filter outliers | 15-25 | |
| Caption variants | 45-75 (3 per outlier) | |
| Success rate | >95% | |
| Cost per run | <$7.00 | |

---

## Future Enhancements

### Phase 2 (1-2 weeks)
- Add YouTube support (similar workflow, different scrapers)
- Add LinkedIn support (B2B niches)

### Phase 3 (Future)
- **Thumbnail Recreation** (adapted from YouTube outlier system)
  - Use image generation API (Nano Banana Pro)
  - Face swap with client's face/branding
  - Generate 3 thumbnail variations per outlier
  - Cost: ~$0.50-1.00 per thumbnail
  - Effort: 4-6 hours

- **Content Calendar Integration**
  - Schedule posts based on outliers
  - Track which outliers performed best after client posts them

- **Performance Tracking**
  - Monitor which caption variants get used
  - Track engagement of client posts using outlier captions
  - Feed back into hook bonus weights
