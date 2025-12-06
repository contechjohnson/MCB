const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runQuery(name, sql) {
  console.log(`\n========== ${name} ==========\n`);
  console.log(`SQL:\n${sql}\n`);
  
  const { data, error } = await supabase.from('contacts').select('*').limit(0);
  
  // Use raw SQL via Supabase PostgREST
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`
    },
    body: JSON.stringify({ sql_query: sql })
  });
  
  if (!response.ok) {
    console.error(`HTTP Error: ${response.status} ${response.statusText}`);
    const errorText = await response.text();
    console.error(errorText);
    return null;
  }
  
  const result = await response.json();
  const rowCount = result ? result.length : 0;
  console.log(`Results (${rowCount} rows):`);
  console.log(JSON.stringify(result, null, 2));
  return result;
}

async function main() {
  console.log('AD_ID Attribution Investigation');
  console.log('Date Range: November 7-14, 2025');
  console.log('='.repeat(80));

  // Query 1: Contacts WITHOUT AD_ID
  await runQuery(
    'Query 1: Contacts WITHOUT AD_ID - Source Breakdown',
    `SELECT 
      source,
      COUNT(*) as contact_count,
      COUNT(CASE WHEN dm_qualified_date IS NOT NULL THEN 1 END) as dm_qualified,
      COUNT(CASE WHEN form_submit_date IS NOT NULL THEN 1 END) as form_submitted,
      COUNT(CASE WHEN appointment_held_date IS NOT NULL THEN 1 END) as meeting_held,
      COUNT(CASE WHEN purchase_date IS NOT NULL THEN 1 END) as purchased,
      SUM(COALESCE(purchase_amount, 0)) as revenue
    FROM contacts
    WHERE created_at >= '2025-11-07'::timestamptz
      AND source != 'instagram_historical'
      AND ad_id IS NULL
    GROUP BY source
    ORDER BY contact_count DESC;`
  );

  // Query 2: BOF Funnel Pattern Check
  await runQuery(
    'Query 2: BOF Funnel Pattern Analysis',
    `SELECT 
      mc_id IS NOT NULL as has_mc_id,
      ad_id IS NOT NULL as has_ad_id,
      trigger_word,
      chatbot_ab,
      source,
      COUNT(*) as count
    FROM contacts
    WHERE created_at >= '2025-11-07'::timestamptz
      AND source != 'instagram_historical'
    GROUP BY has_mc_id, has_ad_id, trigger_word, chatbot_ab, source
    ORDER BY count DESC
    LIMIT 20;`
  );

  // Query 3: Duplicate Ad Names
  await runQuery(
    'Query 3: Duplicate Ad Names with Different IDs',
    `SELECT 
      ma.ad_name,
      COUNT(DISTINCT ma.ad_id) as num_ad_ids,
      STRING_AGG(DISTINCT ma.ad_id, ', ') as ad_ids
    FROM meta_ads ma
    WHERE ma.is_active = true
    GROUP BY ma.ad_name
    HAVING COUNT(DISTINCT ma.ad_id) > 1
    ORDER BY num_ad_ids DESC;`
  );

  // Query 4: CPL Calculation Check
  await runQuery(
    'Query 4: CPL Calculation - Our Contacts vs Meta Reported Leads',
    `SELECT 
      ma.ad_id,
      ma.ad_name,
      COUNT(DISTINCT c.id) as our_contacts,
      SUM(mai.leads) as meta_reported_leads,
      SUM(mai.spend) as total_spend,
      CASE 
        WHEN COUNT(DISTINCT c.id) > 0 
        THEN ROUND(SUM(mai.spend) / COUNT(DISTINCT c.id), 2)
        ELSE 0
      END as our_cpl,
      CASE 
        WHEN SUM(mai.leads) > 0 
        THEN ROUND(SUM(mai.spend) / SUM(mai.leads), 2)
        ELSE NULL
      END as meta_cpl
    FROM meta_ads ma
    LEFT JOIN meta_ad_insights mai ON ma.ad_id = mai.ad_id 
      AND mai.snapshot_date >= '2025-11-07'
    LEFT JOIN contacts c ON c.ad_id = ma.ad_id 
      AND c.created_at >= '2025-11-07'::timestamptz
      AND c.source != 'instagram_historical'
    WHERE ma.is_active = true
    GROUP BY ma.ad_id, ma.ad_name
    HAVING SUM(mai.spend) > 0
    ORDER BY our_contacts DESC
    LIMIT 20;`
  );

  // Query 5: Website vs Instagram Breakdown
  await runQuery(
    'Query 5: Website vs Instagram with AD_ID Breakdown',
    `SELECT 
      source,
      ad_id IS NOT NULL as has_ad_id,
      COUNT(*) as contacts,
      ROUND(AVG(CASE WHEN purchase_date IS NOT NULL THEN 1 ELSE 0 END) * 100, 2) as conversion_pct,
      SUM(COALESCE(purchase_amount, 0)) as revenue
    FROM contacts
    WHERE created_at >= '2025-11-07'::timestamptz
      AND source != 'instagram_historical'
    GROUP BY source, has_ad_id
    ORDER BY contacts DESC;`
  );
}

main().catch(console.error);
