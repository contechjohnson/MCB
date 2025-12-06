#!/usr/bin/env node
/**
 * Natural Language Query Tool for Historical Data
 *
 * This CLI tool lets you ask questions about your historical data in plain English.
 * It uses Claude AI to convert your question into SQL, runs the query, and formats results.
 *
 * Usage:
 *   node scripts/query-historical.js "show me paid vs organic revenue"
 *   node scripts/query-historical.js "what's the conversion rate over time?"
 *   node scripts/query-historical.js "which trigger words performed best?"
 *
 * Features:
 *   - Natural language to SQL conversion
 *   - Pretty-printed tables
 *   - AI interpretation of results
 *   - Saves query history
 *
 * Environment Variables Required:
 *   NEXT_PUBLIC_SUPABASE_URL - Your Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY - Your Supabase service role key
 *   ANTHROPIC_API_KEY - Your Claude API key (for NL to SQL conversion)
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Check for required environment variables
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('ERROR: Missing Supabase credentials.');
  console.error('Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are in .env.local');
  process.exit(1);
}

if (!ANTHROPIC_API_KEY) {
  console.error('WARNING: ANTHROPIC_API_KEY not found. You can still run SQL queries directly.');
  console.error('To enable natural language queries, add ANTHROPIC_API_KEY to .env.local');
}

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Format query results as a pretty table
 */
function formatTable(rows) {
  if (!rows || rows.length === 0) {
    return 'No results found.';
  }

  const columns = Object.keys(rows[0]);

  // Calculate column widths
  const widths = {};
  columns.forEach(col => {
    widths[col] = Math.max(
      col.length,
      ...rows.map(row => String(row[col] || '').length)
    );
  });

  // Build header
  const header = columns.map(col => col.padEnd(widths[col])).join(' | ');
  const separator = columns.map(col => '-'.repeat(widths[col])).join('-+-');

  // Build rows
  const bodyRows = rows.map(row =>
    columns.map(col => String(row[col] || '').padEnd(widths[col])).join(' | ')
  );

  return [header, separator, ...bodyRows].join('\n');
}

/**
 * Get schema information for Claude to understand available tables/views
 */
function getSchemaInfo() {
  return `
You are helping query a Supabase database with historical marketing funnel data.

AVAILABLE TABLES:
- hist_contacts: Contact records with email (primary key), first_name, last_name, phone, ad_type (paid/organic), trigger_word, campaign_name, reached_stage, has_purchase, first_seen, purchase_date
- hist_payments: Payment records with email, amount, currency, payment_date, source (stripe/denefits), payment_type (buy_in_full/buy_now_pay_later/refund)
- hist_timeline: Event timeline with email, event_type, event_date
- hist_import_logs: Import audit log

AVAILABLE VIEWS (pre-built queries):
- v_funnel_summary: Overall funnel conversion rates at each stage
- v_revenue_attribution: Revenue breakdown by ad_type and trigger_word
- v_conversion_over_time: Monthly cohort analysis (contacts created vs purchased per month)
- v_time_to_purchase: Individual records showing days from first contact to purchase
- v_time_to_purchase_summary: Statistical summary of conversion timing (min, max, avg, median)
- v_payment_breakdown: Payment type breakdown (Stripe vs Denefits, full vs BNPL)
- v_data_quality_report: Data completeness for each field
- v_top_trigger_words: Best performing ManyChat keywords
- v_paid_vs_organic: Simple paid vs organic comparison

IMPORTANT SQL RULES:
- Always exclude suspicious data: WHERE is_suspicious = FALSE (or just use the views)
- Email matching is case-insensitive: Use ILIKE for email searches
- Use views when possible instead of complex joins
- Don't use SELECT * in production queries (specify columns)
- Use date functions for time-based queries: DATE_TRUNC('month', date_column)

RESPONSE FORMAT:
Return ONLY the SQL query, nothing else. No markdown, no explanations.
If the question can be answered by a view, just use: SELECT * FROM view_name;
  `.trim();
}

/**
 * Convert natural language question to SQL using Claude API
 */
async function convertToSQL(question) {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY not configured. Cannot convert natural language to SQL.');
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `${getSchemaInfo()}\n\nConvert this question to SQL:\n${question}`
      }]
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Claude API error: ${error}`);
  }

  const data = await response.json();
  const sql = data.content[0].text.trim();

  // Remove markdown code blocks if present
  return sql.replace(/```sql\n?/g, '').replace(/```\n?/g, '').trim();
}

/**
 * Get AI interpretation of query results
 */
async function interpretResults(question, sql, results) {
  if (!ANTHROPIC_API_KEY) {
    return null; // Skip interpretation if no API key
  }

  if (!results || results.length === 0) {
    return 'No results found for this query.';
  }

  const prompt = `
You are analyzing marketing funnel data.

QUESTION: ${question}

SQL QUERY USED:
${sql}

RESULTS:
${JSON.stringify(results, null, 2)}

Provide a concise 2-3 sentence interpretation of these results. Focus on:
- Key insights or patterns
- Actionable takeaways
- Notable numbers or trends

Keep it brief and focused on what matters most.
  `.trim();

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: prompt
      }]
    })
  });

  if (!response.ok) {
    return null; // Skip interpretation on error
  }

  const data = await response.json();
  return data.content[0].text.trim();
}

/**
 * Execute SQL query against Supabase
 */
async function executeQuery(sql) {
  // Use raw SQL via Supabase RPC or direct query
  // For this to work, you need to create a stored procedure in Supabase
  // For now, we'll use a workaround with select queries

  try {
    // If it's a view query, we can execute directly
    if (sql.toLowerCase().includes('from v_')) {
      const viewName = sql.match(/from\s+(v_\w+)/i)?.[1];
      if (viewName) {
        const { data, error } = await supabase.from(viewName).select('*');
        if (error) throw error;
        return data;
      }
    }

    // For complex queries, use Supabase's RPC feature
    // You would need to create a stored procedure for this
    // For now, return a helpful message
    console.log('\n⚠️  This query requires a stored procedure.');
    console.log('Copy and paste this SQL into the Supabase SQL Editor:\n');
    console.log(sql);
    console.log('\nOr create a stored procedure to run complex queries from this CLI.');
    return null;

  } catch (error) {
    throw new Error(`Query execution failed: ${error.message}`);
  }
}

/**
 * Run a saved/common query by name
 */
async function runSavedQuery(queryName) {
  const savedQueries = {
    'funnel': 'SELECT * FROM v_funnel_summary',
    'attribution': 'SELECT * FROM v_revenue_attribution ORDER BY total_revenue DESC',
    'conversion-over-time': 'SELECT * FROM v_conversion_over_time',
    'paid-vs-organic': 'SELECT * FROM v_paid_vs_organic',
    'trigger-words': 'SELECT * FROM v_top_trigger_words',
    'time-to-purchase': 'SELECT * FROM v_time_to_purchase_summary',
    'data-quality': 'SELECT * FROM v_data_quality_report',
    'payments': 'SELECT * FROM v_payment_breakdown'
  };

  const sql = savedQueries[queryName];
  if (!sql) {
    console.error(`Unknown saved query: ${queryName}`);
    console.log('\nAvailable saved queries:');
    Object.keys(savedQueries).forEach(name => {
      console.log(`  - ${name}`);
    });
    process.exit(1);
  }

  return sql;
}

// =============================================================================
// MAIN CLI LOGIC
// =============================================================================

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Usage:');
    console.log('  node scripts/query-historical.js "your question in plain English"');
    console.log('  node scripts/query-historical.js --saved funnel');
    console.log('  node scripts/query-historical.js --sql "SELECT * FROM v_funnel_summary"');
    console.log('\nExamples:');
    console.log('  node scripts/query-historical.js "show me paid vs organic revenue"');
    console.log('  node scripts/query-historical.js "what is the conversion rate over time?"');
    console.log('  node scripts/query-historical.js --saved attribution');
    console.log('\nSaved queries: funnel, attribution, conversion-over-time, paid-vs-organic, trigger-words, time-to-purchase, data-quality, payments');
    process.exit(0);
  }

  // Parse arguments
  let sql;
  let question;
  let skipInterpretation = false;

  if (args[0] === '--saved') {
    sql = await runSavedQuery(args[1]);
    question = `Saved query: ${args[1]}`;
    skipInterpretation = true;
  } else if (args[0] === '--sql') {
    sql = args.slice(1).join(' ');
    question = 'Direct SQL query';
    skipInterpretation = true;
  } else {
    question = args.join(' ');
    console.log(`\n🤔 Converting to SQL...`);
    try {
      sql = await convertToSQL(question);
      console.log(`\n📝 Generated SQL:\n${sql}\n`);
    } catch (error) {
      console.error(`\n❌ Error converting to SQL: ${error.message}`);
      process.exit(1);
    }
  }

  // Execute query
  console.log(`⚡ Executing query...`);
  try {
    const results = await executeQuery(sql);

    if (!results) {
      process.exit(0); // Query needs to be run manually
    }

    console.log(`\n✅ Results (${results.length} rows):\n`);
    console.log(formatTable(results));

    // Get AI interpretation (if not skipped and API key available)
    if (!skipInterpretation && ANTHROPIC_API_KEY && results.length > 0 && results.length < 100) {
      console.log(`\n💡 Interpreting results...`);
      const interpretation = await interpretResults(question, sql, results);
      if (interpretation) {
        console.log(`\n📊 Insights:\n${interpretation}\n`);
      }
    }

  } catch (error) {
    console.error(`\n❌ Error executing query: ${error.message}`);
    process.exit(1);
  }
}

// Run main function
main().catch(error => {
  console.error(`\n❌ Fatal error: ${error.message}`);
  process.exit(1);
});
