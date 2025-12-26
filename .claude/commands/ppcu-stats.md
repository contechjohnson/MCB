---
description: PPCU leads & meetings with source/attribution breakdowns (project)
---

Show PPCU stats for $ARGUMENTS.

Run the PPCU stats script:

```bash
node scripts/production/ppcu-stats.js "$ARGUMENTS"
```

## Usage Examples

```
/ppcu-stats last 7 days
/ppcu-stats last 8 days
/ppcu-stats last 30 days
/ppcu-stats november 2025
/ppcu-stats december 2025
```

## What It Shows

### New Leads (from GHL)
Queries GoHighLevel contacts API directly with proper pagination.

**Filters:**
- Must have email OR phone to count as valid lead
- Filtered by `dateAdded` within time range

**Breakdowns:**
- **By Source:** ManyChat (has MC_ID custom field) vs Other
- **By Attribution:** Ad Attributed (has AD_ID custom field) vs Not
- **Matrix:** Combined 2x2 breakdown

### Meetings Held (from GHL Pipelines)

**Calendly Free (FREE DISCOVERY CALL PIPELINE):**
- Counts all stages EXCEPT "DC BOOKED" and "NO SHOW"
- These represent meetings that were actually held

**Jane Paid (Discovery Call Main Pipeline):**
- Counts "Completed DC" stage only

## Data Sources

| Data | Source | API |
|------|--------|-----|
| Leads | GHL Contacts | `GET /contacts/` |
| Meetings | GHL Opportunities | `GET /opportunities/search` |

## GHL Custom Fields

| Field | ID | Purpose |
|-------|-----|---------|
| MC_ID | `qeXNjfM5QqZhWCBUTmN7` | ManyChat subscriber ID |
| AD_ID | `AqpaXqbSl40QJlnsX5Sn` | Meta Ad ID for attribution |

## Example Output

```
## PPCU Stats - Last 7 Days (Dec 17-24, 2025)

### New Leads (from GHL)

**Raw GHL Contacts:** 1,086
**Valid Leads (with email/phone):** 404

**By Source:**
| Source | Count |
|--------|-------|
| ManyChat | 119 |
| Other | 285 |

**By Attribution:**
| Attribution | Count |
|-------------|-------|
| Ad Attributed | 95 |
| Not Attributed | 309 |

**Matrix (Source x Attribution):**
| | Ad Attributed | Not Attributed |
|----------|---------------|----------------|
| ManyChat | 1 | 118 |
| Other | 94 | 191 |

---

### Meetings Held

**Calendly Free:** 41
**Jane Paid:** 15

**Total Meetings Held:** 56
```

## Related Skills

- `/ghl-pipelines ppcu` - List all GHL pipelines and stages
- `/ghl-meetings ppcu "Pipeline" "Stage"` - Query specific pipeline/stage

## Script Location

`scripts/production/ppcu-stats.js`
