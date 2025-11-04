# Terminal Restart Checklist

**When to Restart:** After installing new MCPs or updating permissions

## ✅ Before You Restart

Make sure these files are updated:

- [x] `.claude/settings.local.json` - Permissions set to `"allow": ["*"]`
- [x] `CLAUDE.md` - Tool usage guide updated
- [x] `MCP_STATUS.md` - Supabase MCP installation guide created
- [x] `schema_v2.sql` - New database schema ready
- [x] `SCHEMA_V2_README.md` - Schema documentation complete

## 🔧 What Needs to Be Installed (Optional but Recommended)

### Supabase MCP

**Current Status:** Not yet installed (based on config file not found)

**Why You Want This:**
- Query database with natural language
- Faster schema exploration
- Quick data analysis
- No need to write code for simple queries

**How to Install:**

1. Find your Claude config file:
   - Mac: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - If it doesn't exist, create it

2. Add this to the config:
```json
{
  "mcpServers": {
    "supabase": {
      "url": "https://mcp.supabase.com/mcp?project_ref=YOUR_PROJECT_REF&read_only=true"
    }
  }
}
```

3. Get your project ref:
   - Go to Supabase dashboard
   - Look at the URL: `https://supabase.com/dashboard/project/YOUR_PROJECT_REF`
   - Copy that ref

4. Save the config file

5. **Quit Claude completely** (Cmd+Q, not just close window)

6. Reopen Claude

7. First time you use it, Claude will ask you to log in to Supabase

**Note:** Using `read_only=true` prevents accidental data deletion - highly recommended!

## 📋 After Restart Checklist

Once your terminals restart, verify:

### 1. Permissions Working
Try: "Create a new file called test.txt"
- ✅ Should work without asking permission

### 2. Firecrawl Working
Try: "Search the web for Next.js documentation"
- ✅ Should use `firecrawl_search` automatically
- ❌ Should NOT use WebSearch

### 3. Files Accessible
Try: "Read CLAUDE.md"
- ✅ Should read the file
- ✅ Should know about tool usage

### 4. Archive Ignored
Try: "What's in the _archive folder?"
- ✅ Should say it's ignoring that folder per `.claudeignore`

### 5. Supabase MCP (If Installed)
Try: "Show me all tables in my database"
- ✅ Should list tables using Supabase MCP
- If not installed: Will say "I need code to do that"

## 🚨 If Something's Not Working

**Permissions still asking:**
- Check `.claude/settings.local.json` has `"allow": ["*"]`
- Make sure there are no syntax errors (commas, brackets)
- Restart again

**Firecrawl not being used:**
- Read `CLAUDE.md` - it should have instructions
- May need to explicitly say "Use Firecrawl" first time
- After that, it should remember

**Can't access files:**
- Make sure you're in the correct directory: `/Users/connorjohnson/CLAUDE_CODE/MCB`
- Use `pwd` to check current directory

**Supabase MCP not working:**
- Check config file syntax (no trailing commas)
- Make sure you completely quit and reopened Claude (Cmd+Q)
- Try logging out and back in to Supabase
- Check `MCP_STATUS.md` for troubleshooting

## 🎯 What You Should Be Able to Do Now

After restart and Supabase MCP installation:

1. ✅ All file operations without permission prompts
2. ✅ Web research using Firecrawl automatically
3. ✅ Query your Supabase database with natural language
4. ✅ Run the schema migration easily
5. ✅ Explore data without writing SQL

## 📝 Next Steps

After verifying everything works:

1. Run the schema migration (`schema_v2.sql`)
2. Start building webhook endpoints
3. Set up automated reporting queries
4. Test with real data

---

**Don't restart yet if:** You want to make more config changes first

**Restart now if:** Everything is ready and you want the new config to take effect
