# MCP Server Status & Configuration

**Last Updated:** Nov 2, 2025

## Currently Working MCPs

Based on successful tool usage in this session:

✅ **Firecrawl** - Web scraping and search (verified working)
✅ **Filesystem** - File operations
✅ **Playwright** - Browser automation
✅ **Memory** - Knowledge graph
✅ **Context7** - Library documentation
✅ **Notion** - Notion API integration
✅ **Everything** - Testing MCP

## Supabase MCP - Installation Guide

### What is Supabase MCP?

The official Supabase MCP gives Claude direct access to:
- Query your database with natural language
- Create/modify tables
- Manage storage
- View/edit data
- Execute SQL

### Installation for Claude Code

**Option 1: Automatic (Recommended)**

Supabase provides a hosted MCP server that works out of the box:

```json
{
  "mcpServers": {
    "supabase": {
      "url": "https://mcp.supabase.com/mcp"
    }
  }
}
```

Add this to your Claude Desktop config, then restart Claude.

**Option 2: Project-Scoped (More Secure)**

Lock the MCP to a specific project:

```json
{
  "mcpServers": {
    "supabase": {
      "url": "https://mcp.supabase.com/mcp?project_ref=YOUR_PROJECT_REF"
    }
  }
}
```

Find your project ref in your Supabase dashboard URL: `https://supabase.com/dashboard/project/YOUR_PROJECT_REF`

**Option 3: Read-Only (Safest)**

Use read-only mode to prevent accidental writes:

```json
{
  "mcpServers": {
    "supabase": {
      "url": "https://mcp.supabase.com/mcp?project_ref=YOUR_PROJECT_REF&read_only=true"
    }
  }
}
```

### Where to Add This Config

**For Claude Desktop (Mac):**
- Config file: `~/Library/Application Support/Claude/claude_desktop_config.json`
- If file doesn't exist, create it

**For Claude Code:**
- May use project-level `.claude/` config
- Check with Claude support for exact location

### Authentication

When you first use Supabase MCP, Claude will:
1. Open your browser
2. Ask you to log in to Supabase
3. Request permission to access your projects
4. Store the auth token automatically

No need to manually create API keys!

### Testing If It's Installed

After restarting Claude, try:
- "Show me all tables in my database"
- "Query the contacts table"
- "What's the schema of my database?"

If Claude can do this, Supabase MCP is working!

## Security Best Practices

⚠️ **IMPORTANT**: Only use Supabase MCP with development databases, NOT production!

### Why?

- LLMs can be tricked by prompt injection
- Accidental data deletion is possible
- No undo button for SQL operations

### Recommendations

1. ✅ **Use a dev project** - Clone your prod data to a dev project
2. ✅ **Read-only mode** - Add `read_only=true` to the URL
3. ✅ **Project scoping** - Lock to one project with `project_ref`
4. ✅ **Manual approval** - Always review SQL before executing
5. ✅ **Branching** - Use Supabase branches for safe testing

## Benefits of Using Supabase MCP

### Without MCP (Current Setup)
```typescript
// Write code manually
const { data } = await supabaseAdmin
  .from('contacts')
  .select('*')
  .eq('stage', 'purchased');
```

### With MCP (Much Easier)
You: "Show me all contacts who purchased"
Claude: *Automatically queries and formats results*

### Other Benefits
- Natural language database queries
- Faster schema exploration
- Quick data analysis
- No need to write SQL for simple queries
- Automatic connection handling

## When to Use Supabase MCP vs Manual Code

**Use MCP for:**
- 🔍 Exploring data
- 📊 Quick analysis
- 🧪 Testing queries
- 📝 Schema discovery
- 🔧 Development/debugging

**Use manual code for:**
- 🚀 Production webhooks (reliability)
- 🔒 Secure operations (no LLM involved)
- ⚡ Performance-critical code
- 🔄 Automated processes
- 📦 Deployed applications

## Troubleshooting

### "MCP not found" error
- Make sure config file exists
- Check JSON syntax (no trailing commas)
- Restart Claude completely (quit and reopen)

### "Authentication failed"
- Clear Claude's cache
- Re-login through the browser flow
- Check that you selected the correct org

### "No permission" errors
- Make sure you're an admin/owner on the Supabase project
- Check that the project_ref is correct
- Verify you're logged into the right Supabase account

## Next Steps

1. [ ] Locate your Claude config file
2. [ ] Add Supabase MCP configuration
3. [ ] Restart Claude
4. [ ] Test with "Show me my database tables"
5. [ ] Run the schema migration with MCP assistance!

---

**Need Help?**
- [Supabase MCP Docs](https://supabase.com/docs/guides/getting-started/mcp)
- [MCP GitHub](https://github.com/supabase-community/supabase-mcp)
- Ask in this chat!
