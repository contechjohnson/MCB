---
description: What the workflow does (e.g., "contact enrichment for XYZ client")
---

Create a new workflow for: $ARGUMENTS

## What This Does

When you notice a repeating pattern or need to standardize a process:

1. Creates a new agent in `.claude/agents/[workflow-name].md`
2. Creates a directive in `directives/[workflow-name].md`
3. Optionally creates a slash command

## Steps

1. **Name the workflow** - Use the argument provided (e.g., "contact-enrichment")
2. **Create the agent** - Follow the pattern in `.claude/agents/analytics-agent.md`
3. **Create the directive** - Follow the template in `directives/_template.md`
4. **Log it** - Add entry to `directives/business-ops.md` (create if needed)

## Philosophy

- Start as one-off
- If it repeats, create agent + directive
- If it graduates, add slash command

**Reference:** See top-level `CLAUDE.md` for workflow graduation process.
