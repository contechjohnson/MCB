# Claude Code Complete Setup Guide

**Last Updated:** November 2, 2025

This is your comprehensive guide to understanding and properly configuring Claude Code for maximum effectiveness. This document covers sub-agents, skills, MCP servers, and best practices.

---

## Table of Contents

1. [Current Setup Analysis](#current-setup-analysis)
2. [Sub-Agents Deep Dive](#sub-agents-deep-dive)
3. [Skills System](#skills-system)
4. [MCP Servers Available](#mcp-servers-available)
5. [Claude Code on the Web](#claude-code-on-the-web)
6. [Best Practices](#best-practices)
7. [Action Items](#action-items)

---

## Current Setup Analysis

### Problems with Current Sub-Agents

Your existing sub-agents in `.claude/agents/` have several critical issues:

#### ❌ Missing Required Structure
```markdown
# Current (WRONG):
# Next.js Setup Agent

You are responsible for...

# Should Be (CORRECT):
---
name: nextjs-setup
description: Expert at setting up Next.js projects with App Router. Use PROACTIVELY when initializing new Next.js projects or configuring deployment.
tools: Read, Write, Edit, Bash, Glob, Grep
model: sonnet
---

# Next.js Setup Expert

You are a Next.js specialist focused on...
```

#### ❌ Critical Missing Elements

1. **No YAML frontmatter** - Without the frontmatter, Claude Code may not recognize them properly
2. **No `description` field** - Claude doesn't know when to invoke them
3. **No `tools` specification** - They inherit ALL tools (inefficient and potentially unsafe)
4. **No `model` specification** - Can't control which model to use
5. **No proactive triggers** - Descriptions don't include "use PROACTIVELY" or "MUST BE USED"

#### ❌ Structural Issues

- File names don't match agent names
- Descriptions are too vague for automatic delegation
- Missing clear task boundaries
- No examples of when to invoke

---

## Sub-Agents Deep Dive

### What Are Sub-Agents?

Sub-agents are **specialized AI assistants** that:
- Have their **own context window** (separate from main conversation)
- Can be configured with **specific tools** they're allowed to use
- Include **custom system prompts** that guide their behavior
- Are **automatically or explicitly invoked** based on task matching

### Key Benefits

1. **Context Preservation**: Main conversation stays focused on high-level objectives
2. **Specialized Expertise**: Fine-tuned instructions for specific domains
3. **Reusability**: Share across projects and team members
4. **Flexible Permissions**: Different tool access levels per agent

### Proper Sub-Agent Structure

```markdown
---
name: agent-name-here
description: What this agent does and when to use it. Use PROACTIVELY when [specific conditions].
tools: Read, Write, Edit, Bash, Grep, Glob  # Optional - omit to inherit all tools
model: sonnet  # Options: sonnet, opus, haiku, inherit
---

# Agent Display Name

Detailed system prompt that defines:
1. Your role and expertise
2. What you do when invoked
3. Your approach and methodology
4. Best practices to follow
5. What NOT to do

## When You're Invoked

Clearly explain:
- Exact scenarios that trigger you
- What information you need
- What you'll deliver

## Process

1. Step-by-step workflow
2. Clear decision points
3. Success criteria

## Key Principles

- Principle 1
- Principle 2
- etc.
```

### Configuration Fields Explained

| Field | Required | Purpose | Example |
|-------|----------|---------|---------|
| `name` | ✅ Yes | Unique identifier | `nextjs-setup` |
| `description` | ✅ Yes | When to invoke (critical for auto-delegation) | `Expert Next.js setup. Use PROACTIVELY when initializing projects.` |
| `tools` | ❌ No | Limit available tools (security & focus) | `Read, Write, Bash` |
| `model` | ❌ No | Which model to use | `sonnet`, `opus`, `haiku`, `inherit` |

### Tool Access Patterns

**Option 1: Inherit All Tools (Default)**
```yaml
---
name: full-access-agent
description: Agent with all tools
# tools field omitted - inherits everything
---
```

**Option 2: Restricted Tools (Recommended)**
```yaml
---
name: read-only-analyst
description: Analyzes code without making changes
tools: Read, Grep, Glob, Bash
---
```

**Option 3: Minimal Tools**
```yaml
---
name: documentation-writer
description: Writes documentation only
tools: Read, Write
---
```

### Model Selection Strategy

```yaml
# Use Sonnet for complex tasks (default)
model: sonnet

# Use Opus for highest capability (expensive)
model: opus

# Use Haiku for fast, simple tasks (cheap)
model: haiku

# Inherit from main conversation
model: inherit
```

### Automatic vs Explicit Invocation

**Automatic Delegation** (Claude decides):
```
description: Expert code reviewer. Use PROACTIVELY after code changes to review quality and security.
```

**Explicit Invocation** (You decide):
```
> Use the nextjs-setup agent to create a new project structure
```

### Best Practices for Sub-Agents

1. **Start with Claude-Generated Agents**
   - Use `/agents` → "Create New Agent" → Generate with Claude
   - Customize the generated agent to your needs
   - This gives you the best starting point

2. **Design Focused Agents**
   - One clear responsibility per agent
   - Avoid trying to make one agent do everything
   - Better: 3 focused agents than 1 jack-of-all-trades

3. **Write Detailed Prompts**
   - Include specific instructions
   - Provide examples
   - Define clear constraints
   - Explain edge cases

4. **Limit Tool Access**
   - Only grant necessary tools
   - Improves security
   - Helps agent focus on relevant actions

5. **Use Proactive Triggers**
   - Include "use PROACTIVELY" in descriptions
   - Be specific about triggering conditions
   - Examples: "after code changes", "when creating new files", "when debugging"

6. **Version Control Them**
   - Check `.claude/agents/` into git
   - Team benefits from shared improvements
   - Track changes over time

---

## Skills System

### What Are Skills?

Skills are **model-invoked capabilities** that extend Claude's functionality. Key differences from sub-agents:

| Feature | Skills | Sub-Agents |
|---------|--------|------------|
| Invocation | Claude decides automatically | Claude decides OR you explicitly invoke |
| Context | No separate context | Separate context window |
| Structure | Folder with SKILL.md | Single .md file |
| Supporting Files | Yes (scripts, templates) | No |
| Tool Restrictions | `allowed-tools` field | `tools` field |

### When to Use Skills vs Sub-Agents

**Use Skills For:**
- Specific utility capabilities (PDF processing, data analysis)
- Tasks requiring supporting files (scripts, templates)
- Operations that don't need separate context
- Specialized tools or workflows

**Use Sub-Agents For:**
- Complex multi-step tasks
- Tasks needing isolated context
- Specialized expertise areas
- Tasks you want to invoke explicitly

### Skill Structure

```
.claude/skills/
└── my-skill/
    ├── SKILL.md          # Required: instructions and metadata
    ├── reference.md      # Optional: additional docs
    ├── scripts/          # Optional: helper scripts
    │   └── helper.py
    └── templates/        # Optional: file templates
        └── template.txt
```

### SKILL.md Format

```yaml
---
name: skill-name
description: What this skill does and when to use it. Triggers: keywords, scenarios.
allowed-tools: Read, Grep, Bash  # Optional: restrict tool usage
---

# Skill Name

## Instructions
Clear, step-by-step guidance for Claude.

## Examples
Concrete examples of using this skill.

## Supporting Files
Reference other files when needed:
- See [reference.md](reference.md) for advanced usage
- Run [scripts/helper.py](scripts/helper.py) for processing
```

### Testing Skills

```bash
# Create personal skill
mkdir -p ~/.claude/skills/my-skill
vim ~/.claude/skills/my-skill/SKILL.md

# Create project skill
mkdir -p .claude/skills/team-skill
vim .claude/skills/team-skill/SKILL.md

# Test by asking relevant questions
# Claude will automatically use the skill if it matches
```

---

## MCP Servers Available

You currently have access to these MCP (Model Context Protocol) servers:

### 🧠 Memory Server
**Purpose:** Knowledge graph for persistent memory across sessions

**Capabilities:**
- Create/read/delete entities and relationships
- Search for stored information
- Build knowledge graphs of project info

**Tools Available:**
- `mcp__memory__create_entities`
- `mcp__memory__create_relations`
- `mcp__memory__add_observations`
- `mcp__memory__read_graph`
- `mcp__memory__search_nodes`
- `mcp__memory__open_nodes`
- `mcp__memory__delete_entities`

**When to Use:**
- Storing important project decisions
- Building knowledge about codebase architecture
- Remembering user preferences
- Tracking technical debt

### 📁 Filesystem Server
**Purpose:** Advanced file operations

**Capabilities:**
- Read/write/edit files with advanced options
- List directories with sizes
- Search files recursively
- Move files and directories
- Get file metadata

**Tools Available:**
- `mcp__filesystem__read_text_file`
- `mcp__filesystem__read_media_file`
- `mcp__filesystem__read_multiple_files`
- `mcp__filesystem__write_file`
- `mcp__filesystem__edit_file`
- `mcp__filesystem__create_directory`
- `mcp__filesystem__list_directory`
- `mcp__filesystem__list_directory_with_sizes`
- `mcp__filesystem__directory_tree`
- `mcp__filesystem__move_file`
- `mcp__filesystem__search_files`
- `mcp__filesystem__get_file_info`
- `mcp__filesystem__list_allowed_directories`

**When to Use:**
- Complex file operations
- Batch file processing
- Directory tree analysis
- File searching with complex patterns

### 🧪 Everything Server (Testing)
**Purpose:** Testing and demonstration of MCP features

**Capabilities:**
- Test MCP protocol features
- Long-running operations with progress
- Echo and simple operations
- LLM sampling
- Resource references

**Tools Available:**
- `mcp__everything__echo`
- `mcp__everything__add`
- `mcp__everything__longRunningOperation`
- `mcp__everything__printEnv`
- `mcp__everything__sampleLLM`
- Various test utilities

**When to Use:**
- Testing MCP integrations
- Debugging MCP connections
- Learning MCP capabilities

### 🧵 Sequential Thinking Server
**Purpose:** Advanced multi-step reasoning and problem solving

**Capabilities:**
- Break down complex problems
- Chain of thought reasoning
- Hypothesis generation and verification
- Iterative problem solving

**Tools Available:**
- `mcp__sequential-thinking__sequentialthinking`

**When to Use:**
- Complex debugging scenarios
- Architectural decisions
- Multi-step problem solving
- When you need to show your work

### 🌐 Puppeteer Server
**Purpose:** Browser automation and web scraping

**Capabilities:**
- Navigate to URLs
- Take screenshots
- Click/fill forms
- Execute JavaScript
- Upload files
- Retrieve console logs

**Tools Available:**
- `mcp__puppeteer__puppeteer_navigate`
- `mcp__puppeteer__puppeteer_screenshot`
- `mcp__puppeteer__puppeteer_click`
- `mcp__puppeteer__puppeteer_fill`
- `mcp__puppeteer__puppeteer_evaluate`
- `mcp__puppeteer__puppeteer_console_logs`
- And many more...

**When to Use:**
- Testing web applications
- Automated browser interactions
- Web scraping
- Taking screenshots for documentation

### 🔥 Firecrawl Server
**Purpose:** Advanced web scraping and content extraction

**Capabilities:**
- Scrape single or multiple URLs
- Search the web
- Map website structures
- Deep research across multiple sources
- Extract structured data
- Generate llms.txt files

**Tools Available:**
- `mcp__mcp-server-firecrawl__firecrawl_scrape` (fastest!)
- `mcp__mcp-server-firecrawl__firecrawl_map`
- `mcp__mcp-server-firecrawl__firecrawl_search`
- `mcp__mcp-server-firecrawl__firecrawl_crawl`
- `mcp__mcp-server-firecrawl__firecrawl_extract`
- `mcp__mcp-server-firecrawl__firecrawl_deep_research`

**When to Use:**
- Gathering documentation
- Market research
- Competitive analysis
- Content aggregation

**Best Practices:**
- Use `scrape` for single pages (fastest)
- Use `search` for finding information
- Use `map` for discovering site structure
- Add `maxAge` parameter for 500% faster cached scrapes

### 📚 Context7 Server
**Purpose:** Up-to-date library documentation

**Capabilities:**
- Resolve library names to Context7 IDs
- Fetch current documentation
- Get code examples
- Version-specific docs

**Tools Available:**
- `mcp__context7__resolve-library-id`
- `mcp__context7__get-library-docs`

**When to Use:**
- Learning new libraries
- Getting current API documentation
- Finding code examples
- Checking breaking changes

**Usage Pattern:**
```
1. First: resolve-library-id to find the library
2. Then: get-library-docs with the ID
```

### 🎭 Playwright Server
**Purpose:** Advanced browser automation (more powerful than Puppeteer)

**Capabilities:**
- Multi-browser support (Chromium, Firefox, WebKit)
- Code generation from actions
- Network interception
- HTTP requests
- File uploads
- Screenshots and PDFs

**Tools Available:**
- `mcp__playwright__start_codegen_session`
- `mcp__playwright__playwright_navigate`
- `mcp__playwright__playwright_screenshot`
- `mcp__playwright__playwright_click`
- `mcp__playwright__playwright_fill`
- `mcp__playwright__playwright_evaluate`
- And 20+ more advanced tools...

**When to Use:**
- E2E testing
- Cross-browser testing
- Generating test code
- Complex web automation

### 📝 Notion Server
**Purpose:** Notion workspace integration

**Capabilities:**
- Read/write pages and databases
- Query databases
- Manage comments
- Search workspace
- Create/update content

**Tools Available:**
- `mcp__notion-mcp-server__API-post-database-query`
- `mcp__notion-mcp-server__API-post-search`
- `mcp__notion-mcp-server__API-retrieve-a-page`
- `mcp__notion-mcp-server__API-patch-page`
- `mcp__notion-mcp-server__API-post-page`
- And 20+ more Notion API tools...

**When to Use:**
- Syncing project documentation
- Creating automated reports
- Managing project databases
- Team knowledge management

### 🔧 Installing Additional MCP Servers

You can add more MCP servers! Popular options:

```bash
# GitHub integration
claude mcp add --transport http github https://api.githubcopilot.com/mcp/

# Sentry error monitoring
claude mcp add --transport http sentry https://mcp.sentry.dev/mcp

# PostgreSQL database
claude mcp add --transport stdio db -- npx -y @bytebase/dbhub \
  --dsn "postgresql://user:pass@host:5432/db"

# Airtable
claude mcp add --transport stdio airtable \
  --env AIRTABLE_API_KEY=YOUR_KEY \
  -- npx -y airtable-mcp-server
```

See the full list of available MCP servers in the documentation.

---

## Claude Code on the Web

### What Is It?

Claude Code on the web lets you kick off coding tasks from claude.ai that run asynchronously on secure cloud infrastructure.

### When to Use

**Perfect For:**
- Answering questions about code architecture
- Bugfixes and routine tasks
- Parallel work (tackle multiple bugs simultaneously)
- Repositories not on your local machine
- Backend changes where Claude can write tests first

**Available On:**
- Claude.ai web interface
- Claude iOS app (monitor on the go!)

### How It Works

1. Visit [claude.ai/code](https://claude.ai/code)
2. Connect GitHub account
3. Install Claude GitHub app in repos
4. Select default environment
5. Submit coding task
6. Review changes and create PR

### Cloud Environment

**Default Image Includes:**
- Python, Node.js, Java, Go, Rust, C++
- Package managers (npm, pip, cargo, etc.)
- Testing frameworks
- Build tools

**Environment Configuration:**
- Configure via SessionStart hooks in `.claude/settings.json`
- Set environment variables
- Install dependencies automatically
- Network access levels: None, Limited (default), Full

### Network Access

**Limited (Default):**
- Access to allowlisted domains
- Package registries (npm, PyPI, etc.)
- GitHub, GitLab, Bitbucket
- Cloud platforms (GCP, AWS, Azure)
- Documentation sites

**Full Access:**
- All internet access
- Use with caution

**No Access:**
- Completely isolated
- For sensitive work

### Moving Between Web and Terminal

**From Web to Terminal:**
1. Click "Open in CLI" button
2. Paste command in terminal
3. Continue working locally
4. All context preserved!

---

## Best Practices

### Sub-Agent Best Practices

1. **Always include YAML frontmatter**
   - `name`: lowercase-with-hyphens
   - `description`: Detailed, with "use PROACTIVELY" if appropriate
   - `tools`: Only what's needed
   - `model`: Choose wisely (sonnet/opus/haiku/inherit)

2. **Write descriptions that trigger correctly**
   ```yaml
   # ❌ Bad
   description: Helps with Next.js

   # ✅ Good
   description: Expert Next.js setup with App Router and TypeScript. Use PROACTIVELY when initializing new Next.js projects, configuring Vercel deployment, or setting up API routes.
   ```

3. **Limit tools appropriately**
   ```yaml
   # Read-only agent
   tools: Read, Grep, Glob, Bash

   # Code writer
   tools: Read, Write, Edit, Bash, Grep, Glob

   # Documentation writer
   tools: Read, Write
   ```

4. **Choose the right model**
   - `sonnet`: Most tasks (balanced)
   - `opus`: Complex reasoning, critical code
   - `haiku`: Quick tasks, simple operations
   - `inherit`: Match main conversation

5. **Version control agents**
   - Commit `.claude/agents/` to git
   - Team members get them automatically
   - Document changes in commit messages

### Skill Best Practices

1. **Keep skills focused**
   - One capability per skill
   - Clear, specific purpose
   - Include trigger keywords in description

2. **Use supporting files**
   - Scripts for complex operations
   - Templates for consistent output
   - Reference docs for details

3. **Test skills thoroughly**
   - Try various phrasings
   - Test with team members
   - Verify Claude uses them correctly

4. **Document clearly**
   - Explicit instructions
   - Concrete examples
   - Edge cases covered

### MCP Server Best Practices

1. **Scope appropriately**
   ```bash
   # Local: Just you, this project
   claude mcp add --scope local ...

   # Project: Everyone in this repo
   claude mcp add --scope project ...

   # User: You, all projects
   claude mcp add --scope user ...
   ```

2. **Secure credentials**
   - Use environment variables
   - Never hardcode API keys
   - Use `--env` flag for secrets

3. **Test connections**
   ```bash
   # Within Claude Code
   /mcp
   ```

4. **Monitor output limits**
   ```bash
   # Increase if needed
   export MAX_MCP_OUTPUT_TOKENS=50000
   ```

### General Best Practices

1. **Use CLAUDE.md effectively**
   - Project-specific context
   - Setup instructions
   - Common patterns
   - Important rules

2. **Leverage hooks**
   - SessionStart: Install dependencies
   - PreToolUse: Validate operations
   - PostToolUse: Format code
   - UserPromptSubmit: Add context

3. **Organize configuration**
   ```
   .claude/
   ├── agents/           # Sub-agents
   ├── skills/           # Skills
   ├── commands/         # Slash commands
   ├── settings.json     # Configuration
   └── hooks.json        # Event handlers
   ```

4. **Test in isolation**
   - Test agents individually
   - Verify tool access
   - Check descriptions trigger correctly

---

## Action Items

### Immediate Actions

1. **Fix Existing Sub-Agents**
   - Add YAML frontmatter to all 6 agents
   - Specify tools appropriately
   - Add proactive triggers to descriptions
   - Test each one individually

2. **Document MCP Usage**
   - Identify which MCPs are useful for your project
   - Test Firecrawl for documentation gathering
   - Consider Notion integration for team docs
   - Set up Playwright for testing if needed

3. **Create Skills**
   - Identify repetitive tasks
   - Create skills for common operations
   - Add supporting scripts where helpful
   - Test with team

4. **Set Up Cloud Environment**
   - Configure SessionStart hooks
   - Set up dependency installation
   - Test web-based coding sessions
   - Document environment setup

### Ongoing Improvements

1. **Iterate on agents**
   - Collect feedback from usage
   - Refine descriptions
   - Adjust tool access
   - Add more specialized agents

2. **Build skill library**
   - Create skills for common tasks
   - Share skills across projects
   - Document skill usage patterns

3. **Optimize MCP usage**
   - Find useful public MCPs
   - Create custom MCPs if needed
   - Monitor performance
   - Adjust scopes as needed

4. **Team adoption**
   - Share configurations
   - Document workflows
   - Train team members
   - Gather feedback

---

## Quick Reference

### Creating a Sub-Agent

```bash
# Use the interactive interface (RECOMMENDED)
/agents

# Or manually create
vim .claude/agents/my-agent.md
```

```markdown
---
name: my-agent
description: What it does. Use PROACTIVELY when [conditions].
tools: Read, Write, Edit, Bash
model: sonnet
---

# Agent Name

Your detailed system prompt here.
```

### Creating a Skill

```bash
mkdir -p .claude/skills/my-skill
vim .claude/skills/my-skill/SKILL.md
```

```yaml
---
name: my-skill
description: What it does and when to use it
allowed-tools: Read, Grep
---

# Skill instructions
```

### Adding an MCP Server

```bash
# HTTP server
claude mcp add --transport http <name> <url>

# Stdio server
claude mcp add --transport stdio <name> --env KEY=value -- <command>

# List all MCPs
claude mcp list

# Authenticate
/mcp
```

### Essential Commands

```bash
# View agents
/agents

# Check MCPs
/mcp

# Check costs
/cost

# Get help
/help

# Test environment
check-tools  # (in cloud environments)
```

---

## Conclusion

Claude Code is incredibly powerful when properly configured. The key is:

1. **Properly structured sub-agents** with YAML frontmatter
2. **Focused skills** for specific capabilities
3. **Strategic MCP usage** for external integrations
4. **Clear documentation** in CLAUDE.md
5. **Continuous iteration** based on real usage

Your current sub-agents need immediate fixes, but once properly structured, they'll significantly improve Claude Code's effectiveness on your project.

Start with fixing one agent, test it thoroughly, then move to the next. Build incrementally and iterate based on what works.

Good luck! 🚀
