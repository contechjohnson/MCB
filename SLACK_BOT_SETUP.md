# Slack Bot Setup Guide

Your analytics bot is ready! Follow these steps to get it running in Slack.

## What We Built

A Slack bot that:
- Responds to @mentions in channels
- Accepts DMs for analytics questions
- Uses OpenAI to convert natural language → SQL
- Queries your Supabase database
- Returns formatted results in Slack threads

## Setup Steps

### 1. Create Slack App

1. Go to https://api.slack.com/apps
2. Click **"Create New App"** → **"From scratch"**
3. Name: `Analytics Bot` (or whatever you want)
4. Choose your Slack workspace
5. Click **Create App**

### 2. Configure Bot Permissions

1. In your app settings, go to **OAuth & Permissions**
2. Scroll to **Scopes** → **Bot Token Scopes**
3. Add these scopes:
   - `app_mentions:read` - Read messages mentioning your bot
   - `chat:write` - Send messages as the bot
   - `im:history` - Read DM messages
   - `im:write` - Send DMs

### 3. Enable Events

1. Go to **Event Subscriptions** in your app settings
2. Toggle **Enable Events** to ON
3. For **Request URL**, enter:
   ```
   https://mcb-dun.vercel.app/api/slack/events
   ```
4. Under **Subscribe to bot events**, add:
   - `app_mention` - Bot was mentioned in a channel
   - `message.im` - Message sent to bot DM

5. Click **Save Changes**

### 4. Install App to Workspace

1. Go to **Install App** in sidebar
2. Click **Install to Workspace**
3. Review permissions and click **Allow**
4. You'll see your **Bot User OAuth Token** (starts with `xoxb-`)

### 5. Add Environment Variables

Copy these tokens to your `.env.local`:

```bash
# From "Install App" page
SLACK_BOT_TOKEN=xoxb-your-bot-token-here

# From "Basic Information" → "App Credentials"
SLACK_SIGNING_SECRET=your-signing-secret-here
```

### 6. Deploy to Vercel

```bash
# Make sure env vars are set locally first
vercel env add SLACK_BOT_TOKEN
vercel env add SLACK_SIGNING_SECRET

# Deploy
git add .
git commit -m "Add Slack analytics bot"
git push origin main
```

Vercel will auto-deploy to: `https://mcb-dun.vercel.app`

### 7. Customize Bot (Optional)

1. Go to **App Home** in app settings
2. Set **Display Name**: `Analytics Bot`
3. Set **Default Username**: `@analytics`
4. Upload an icon (optional)
5. Under **Show Tabs**, enable **Messages Tab**

## How to Use

### In Channels

Mention the bot with your question:
```
@analytics how many purchases last week?
@analytics what's our ROAS this month?
@analytics show me the funnel for January
```

The bot will reply in a thread with:
- ✅ Results (formatted as JSON)
- The SQL query it generated
- Error messages if something fails

### In DMs

Just message the bot directly (no @mention needed):
```
How many leads did we get yesterday?
Show me all purchases over $1000
What's the conversion rate from meeting to purchase?
```

## Example Questions You Can Ask

**Purchases & Revenue:**
- "How many purchases in the last 30 days?"
- "What's total revenue this month?"
- "Show me all purchases over $2000"

**Funnel Analysis:**
- "Show me the funnel for last month"
- "How many people at each stage?"
- "What's the conversion rate from meeting to purchase?"

**ROAS & Ads:**
- "What's our ROAS this week?"
- "Which ad spent the most last week?"
- "Show me ad performance for the last 7 days"

**Recent Activity:**
- "Who purchased yesterday?"
- "Show me leads from the last 24 hours"
- "What happened today?"

## Testing Locally

If you want to test before deploying:

1. Install ngrok: `npm install -g ngrok`
2. Start your dev server: `npm run dev`
3. In another terminal: `ngrok http 3000`
4. Copy the ngrok HTTPS URL
5. Update Slack **Event Subscriptions** Request URL to:
   ```
   https://your-ngrok-url.ngrok.io/api/slack/events
   ```

Now messages will hit your local server!

## Troubleshooting

**Bot doesn't respond:**
- Check Vercel deployment logs
- Verify environment variables are set in Vercel dashboard
- Make sure Event Subscriptions URL is correct
- Check that bot is invited to the channel

**"Query failed" errors:**
- Check the SQL query that was generated
- OpenAI might have generated invalid SQL
- You can improve the system prompt if needed

**Permission errors:**
- Make sure bot has all required scopes
- Reinstall the app if you added scopes after installation

**Slack says "url_verification failed":**
- Your endpoint isn't responding to Slack's challenge
- Check that the route is deployed and accessible

## Security Notes

- Never commit `.env.local` to git (already in .gitignore)
- Signing secret prevents unauthorized requests
- Bot uses read-only SQL function (can't modify data)
- Always filters out historical data by default

## Advanced: Customizing the Bot

The bot code is in `app/api/slack/events/route.ts`.

**Change the system prompt** to adjust how queries are generated:
```typescript
const SYSTEM_PROMPT = `...your custom instructions...`;
```

**Adjust OpenAI model**:
```typescript
model: 'gpt-4o-mini', // or 'gpt-4o' for better accuracy
temperature: 0.1,      // lower = more consistent
```

**Format results differently**:
```typescript
// Current: JSON formatted
// You could add markdown tables, charts, etc.
```

## Next Steps

Once it's working, you can:
1. Add more query examples to the system prompt
2. Create slash commands (`/analytics`)
3. Add interactive buttons for common queries
4. Build a home tab with quick stats
5. Set up scheduled reports that post to channels

Enjoy your new analytics bot! 🤖
