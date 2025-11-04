---
description: Display quick project overview including structure, key files, and current setup
---

# Project Information

Show a quick overview of the MCB project structure and current setup.

## What to Display

1. **Project Type**: Next.js data collection system
2. **Key Directories**: Show main folders and their purpose
3. **Important Files**: List critical configuration files
4. **Environment Status**: Check which env vars are set
5. **Dependencies**: Show key packages installed

## Instructions

When this command is invoked, display the following information:

### 1. Project Overview
```
MCB - ManyChat Bot Data Collection System
==========================================
Type: Next.js 15 App Router + Supabase
Purpose: Data collection system (NOT a dashboard app)
Focus: Webhook handling and clean data storage
```

### 2. Directory Structure

Show the main directories and what they contain:

```
📁 /app
   └── /api          # All webhook endpoints
       ├── /stripe-webhook
       ├── /ghl-webhook
       └── /manychat
   ├── layout.tsx    # Basic Next.js layout
   └── page.tsx      # Simple status page

📁 /historical_data  # CSV files for analysis (not in DB)

📁 /_archive_2025_11_02  # Old code (archived)

📁 /.claude
   ├── /agents       # Sub-agents for specialized tasks
   ├── /skills       # Agent skills
   └── /commands     # Slash commands (like this one!)

📄 Key Files:
   ├── CLAUDE.md                    # Project guidance for Claude
   ├── CLAUDE_CODE_SETUP_GUIDE.md   # Complete setup guide
   ├── SUB_AGENT_FIXES.md           # Agent templates
   ├── .env.local                   # Your secrets (not in git)
   ├── package.json                 # Dependencies
   ├── next.config.ts               # Next.js config
   └── tsconfig.json                # TypeScript config
```

### 3. Check Environment Variables

Run this to check which variables are set:

```bash
echo "Environment Variables Status:"
echo "=============================="

# Check Supabase
if [ -n "$NEXT_PUBLIC_SUPABASE_URL" ]; then
  echo "✅ NEXT_PUBLIC_SUPABASE_URL"
else
  echo "❌ NEXT_PUBLIC_SUPABASE_URL (missing)"
fi

if [ -n "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "✅ SUPABASE_SERVICE_ROLE_KEY"
else
  echo "❌ SUPABASE_SERVICE_ROLE_KEY (missing)"
fi

# Check Stripe
if [ -n "$STRIPE_SECRET_KEY" ]; then
  echo "✅ STRIPE_SECRET_KEY"
else
  echo "❌ STRIPE_SECRET_KEY (missing)"
fi

if [ -n "$STRIPE_WEBHOOK_SECRET" ]; then
  echo "✅ STRIPE_WEBHOOK_SECRET"
else
  echo "❌ STRIPE_WEBHOOK_SECRET (missing)"
fi

# Check GoHighLevel
if [ -n "$GHL_API_KEY" ]; then
  echo "✅ GHL_API_KEY"
else
  echo "⚠️  GHL_API_KEY (optional)"
fi

# Check ManyChat
if [ -n "$MANYCHAT_VERIFY_TOKEN" ]; then
  echo "✅ MANYCHAT_VERIFY_TOKEN"
else
  echo "⚠️  MANYCHAT_VERIFY_TOKEN (optional)"
fi
```

### 4. Show Installed Key Dependencies

Run this to show main packages:

```bash
echo ""
echo "Key Dependencies:"
echo "================="
if [ -f "package.json" ]; then
  echo "Next.js version:" $(node -pe "require('./package.json').dependencies.next || 'not found'")
  echo "React version:" $(node -pe "require('./package.json').dependencies.react || 'not found'")
  echo "Supabase version:" $(node -pe "require('./package.json').dependencies['@supabase/supabase-js'] || 'not found'")
  echo "Stripe version:" $(node -pe "require('./package.json').dependencies.stripe || 'not found'")
else
  echo "❌ package.json not found"
fi
```

### 5. Show Available Commands

```
Available Commands:
===================
npm run dev              # Start dev server (localhost:3000)
npm run build            # Build for production
npm run lint             # Run ESLint
npm run type-check       # TypeScript checks

Project Slash Commands:
/db-status               # Check database health
/project-info            # This command!
```

### 6. Show Sub-Agents Available

```bash
echo ""
echo "Available Sub-Agents:"
echo "===================="
if [ -d ".claude/agents" ]; then
  for file in .claude/agents/*.md; do
    if [ -f "$file" ]; then
      name=$(basename "$file" .md)
      echo "  - $name"
    fi
  done
else
  echo "No agents directory found"
fi
```

### 7. Quick Health Check

```
Quick Health Check:
===================
[Run these checks:]

1. ✅/❌ .env.local exists
2. ✅/❌ node_modules installed
3. ✅/❌ Supabase connection valid
4. ✅/❌ TypeScript compiles
```

## Example Full Output

```
MCB - ManyChat Bot Data Collection System
==========================================
Type: Next.js 15 App Router + Supabase
Purpose: Data collection system (NOT a dashboard app)

📁 Directory Structure:
   /app/api          - Webhook endpoints
   /historical_data  - CSV files for analysis
   /.claude          - Claude Code configuration

Environment Variables:
======================
✅ NEXT_PUBLIC_SUPABASE_URL
✅ SUPABASE_SERVICE_ROLE_KEY
✅ STRIPE_SECRET_KEY
✅ STRIPE_WEBHOOK_SECRET
⚠️  GHL_API_KEY (optional)
⚠️  MANYCHAT_VERIFY_TOKEN (optional)

Key Dependencies:
=================
Next.js: ^15.0.0
React: ^19.0.0
Supabase: ^2.39.0
Stripe: ^14.0.0

Available Sub-Agents:
====================
  - nextjs-setup
  - supabase-setup
  - supabase-expert
  - manychat-webhook
  - openai-assistant
  - api-integrations
  - dashboard-metrics

Quick Health Check:
===================
✅ .env.local exists
✅ node_modules installed
✅ Supabase connection valid
✅ TypeScript compiles

🎉 Project is healthy!

💡 Quick Start:
   Run: npm run dev
   Visit: http://localhost:3000

📚 Documentation:
   - CLAUDE.md - Project guidance
   - CLAUDE_CODE_SETUP_GUIDE.md - Complete guide
   - SUB_AGENT_FIXES.md - Agent templates
```

## Notes

- This is a quick reference command
- Useful when onboarding or refreshing project context
- Shows current state, not ideal state
- Helps identify missing configuration quickly
