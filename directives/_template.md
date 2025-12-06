# Directive: [Name]

> [One-line description of what this does]

**Status:** Active | Experimental | Deprecated
**Script:** `execution/[script-name].js` or `app/api/[route]`
**Related:** `other-directive.md`, `another.md`

---

## Overview

2-3 sentences explaining scope and philosophy. What is this directive responsible for? What are its boundaries?

---

## Commands

| Intent | Command | Notes |
|--------|---------|-------|
| Do X | `command-here --flag value` | |
| Do Y | `other-command` | |

---

## Process

### Step 1: [Name]
- Details about what happens
- Script involved: `path/to/script`

### Step 2: [Name]
- Details

---

## Inputs

| Input | Type | Required | Description |
|-------|------|----------|-------------|
| `--flag` | string | Yes | What it does |

---

## Outputs

| Output | Format | Location |
|--------|--------|----------|
| Result | JSON | stdout / file path |

---

## Configuration

Environment variables or settings needed:

```bash
# Required
EXAMPLE_VAR=value

# Optional
OPTIONAL_VAR=default
```

---

## Edge Cases

| Scenario | Symptom | Handling |
|----------|---------|----------|
| Case 1 | What you observe | How it's handled |
| Case 2 | What you observe | How it's handled |

---

## Troubleshooting

### Common Issue 1
**Symptom:** What the user sees
**Cause:** Why it happens
**Fix:** How to resolve

### Common Issue 2
**Symptom:** What the user sees
**Cause:** Why it happens
**Fix:** How to resolve

---

## Self-Annealing Log

> **IMPORTANT**: Update this section every time you fix an error or discover a constraint.
> This is how the system learns and improves.

| Date | Issue | Resolution |
|------|-------|------------|
| YYYY-MM-DD | What broke + root cause | Fix applied + prevention |

### Detailed Learnings

[Narrative for complex discoveries - patterns, architectural insights, etc.]

---

## Related Directives

- `directive-a.md` - Why related (e.g., "upstream dependency")
- `directive-b.md` - Why related (e.g., "uses same data")
