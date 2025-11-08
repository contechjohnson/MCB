/**
 * Slack Events API Handler
 *
 * Handles incoming events from Slack including:
 * - app_mention (when bot is @mentioned)
 * - message events in bot DMs
 *
 * Uses OpenAI to process natural language queries and convert them to SQL
 * Executes queries via the Supabase execute_sql() function
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// System prompt for the analytics bot
const SYSTEM_PROMPT = `You are an analytics assistant for Manychatbot, a lead generation and sales tracking system. Your role is to help users query their data by converting natural language questions into SQL queries.

## Database Context

You have access to a Supabase PostgreSQL database with the following main tables:

**contacts** - Customer journey data
- id, first_name, last_name, email_primary, phone_primary
- stage (new_lead, dm_qualified, landing_link_sent, landing_link_clicked, form_submitted, meeting_booked, meeting_held, package_sent, purchased)
- source (instagram, website, instagram_lm, instagram_historical)
- ad_id, mc_id, trigger_word, chatbot_ab
- purchase_amount, purchase_date, package_sent_date
- created_at, updated_at

**meta_ads** - LIFETIME ad performance
- ad_id, ad_name, spend (LIFETIME total), impressions, clicks, leads
- date_start, date_stop, is_active

**meta_ad_insights** - LAST 7 DAYS snapshots
- ad_id, snapshot_date, spend (LAST 7 DAYS), impressions, clicks, leads

## Critical Rules

1. **ALWAYS exclude historical data**: Add \`WHERE source != 'instagram_historical'\` to ALL queries by default
2. **Read-only queries**: ONLY generate SELECT statements, never INSERT/UPDATE/DELETE
3. **Date calculations**: Use PostgreSQL date functions like \`NOW() - INTERVAL '30 days'\`
4. **ROAS calculations**:
   - Weekly ROAS: Use meta_ad_insights for spend
   - Lifetime ROAS: Use meta_ads for spend
   - Always filter contacts by \`source != 'instagram_historical'\`

## Common Query Examples

**Last 30 days purchases:**
\`\`\`sql
SELECT COUNT(*) as total_purchases, SUM(purchase_amount) as revenue
FROM contacts
WHERE source != 'instagram_historical'
  AND purchase_date >= NOW() - INTERVAL '30 days'
\`\`\`

**Funnel analysis:**
\`\`\`sql
SELECT stage, COUNT(*) as count
FROM contacts
WHERE source != 'instagram_historical'
  AND created_at >= NOW() - INTERVAL '30 days'
GROUP BY stage
ORDER BY CASE stage
  WHEN 'new_lead' THEN 1
  WHEN 'dm_qualified' THEN 2
  WHEN 'landing_link_sent' THEN 3
  WHEN 'landing_link_clicked' THEN 4
  WHEN 'form_submitted' THEN 5
  WHEN 'meeting_booked' THEN 6
  WHEN 'meeting_held' THEN 7
  WHEN 'package_sent' THEN 8
  WHEN 'purchased' THEN 9
END
\`\`\`

**Weekly ROAS:**
\`\`\`sql
WITH weekly_spend AS (
  SELECT SUM(spend) as total_spend
  FROM meta_ad_insights
  WHERE snapshot_date >= CURRENT_DATE - 7
),
weekly_revenue AS (
  SELECT SUM(purchase_amount) as total_revenue
  FROM contacts
  WHERE purchase_date >= CURRENT_DATE - 7
    AND source != 'instagram_historical'
)
SELECT
  weekly_spend.total_spend,
  weekly_revenue.total_revenue,
  ROUND(weekly_revenue.total_revenue / NULLIF(weekly_spend.total_spend, 0), 2) as weekly_roas
FROM weekly_spend, weekly_revenue
\`\`\`

## Your Task

When the user asks a question:
1. Analyze the question to understand what data they need
2. Generate a SQL query that answers their question
3. Return ONLY the SQL query, no explanation or markdown
4. Ensure the query follows all critical rules above`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Handle Slack URL verification challenge
    if (body.type === 'url_verification') {
      return NextResponse.json({ challenge: body.challenge });
    }

    // Handle event callbacks
    if (body.type === 'event_callback') {
      const event = body.event;

      // Ignore bot messages to prevent loops
      if (event.bot_id) {
        return NextResponse.json({ ok: true });
      }

      // Handle app_mention or direct messages
      if (event.type === 'app_mention' || event.type === 'message') {
        // Process message in background to avoid Slack timeout
        processMessage(event).catch(console.error);

        // Immediately acknowledge receipt
        return NextResponse.json({ ok: true });
      }
    }

    return NextResponse.json({ ok: true });

  } catch (error) {
    console.error('Slack events error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 200 }); // Always return 200
  }
}

async function processMessage(event: any) {
  try {
    const userMessage = event.text.replace(/<@[A-Z0-9]+>/g, '').trim(); // Remove @mentions

    if (!userMessage) {
      return; // Empty message after removing mention
    }

    // Use OpenAI to convert question to SQL
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage }
      ],
      temperature: 0.1, // Low temperature for consistent SQL generation
    });

    const sqlQuery = completion.choices[0].message.content?.trim();

    if (!sqlQuery) {
      await postToSlack(event.channel, 'Sorry, I couldn\'t generate a query for that question.', event.ts);
      return;
    }

    // Execute the SQL query via Supabase
    const { data, error } = await supabaseAdmin.rpc('execute_sql', {
      query: sqlQuery
    });

    if (error) {
      console.error('SQL execution error:', error);
      await postToSlack(
        event.channel,
        `❌ Query failed: ${error.message}\n\nGenerated query:\n\`\`\`\n${sqlQuery}\n\`\`\``,
        event.ts
      );
      return;
    }

    // Format results for Slack
    const results = data || [];
    const resultCount = Array.isArray(results) ? results.length : 1;

    let message = `✅ Found ${resultCount} result(s):\n\n`;

    if (results.length === 0) {
      message += 'No data found.';
    } else if (results.length <= 10) {
      message += '```\n' + JSON.stringify(results, null, 2) + '\n```';
    } else {
      message += '```\n' + JSON.stringify(results.slice(0, 10), null, 2) + '\n```';
      message += `\n_Showing first 10 of ${results.length} results_`;
    }

    message += `\n\n_Query:_\n\`\`\`\n${sqlQuery}\n\`\`\``;

    await postToSlack(event.channel, message, event.ts);

  } catch (error) {
    console.error('Message processing error:', error);
    await postToSlack(
      event.channel,
      '❌ Sorry, something went wrong processing your request.',
      event.ts
    );
  }
}

async function postToSlack(channel: string, text: string, thread_ts?: string) {
  try {
    const response = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SLACK_BOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel,
        text,
        thread_ts, // Reply in thread if provided
      }),
    });

    const result = await response.json();
    if (!result.ok) {
      console.error('Slack API error:', result);
    }
  } catch (error) {
    console.error('Error posting to Slack:', error);
  }
}

// Allow GET for testing
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Slack Events API endpoint is running'
  });
}
