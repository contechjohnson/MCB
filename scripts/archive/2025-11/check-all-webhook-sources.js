const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function checkAllWebhookSources() {
  console.log('🔍 Checking all webhook sources...\n');
  
  const { data: logs } = await supabase
    .from('webhook_logs')
    .select('source, created_at')
    .order('created_at', { ascending: false })
    .limit(500);
    
  if (!logs || logs.length === 0) {
    console.log('No webhook logs found');
    return;
  }
  
  // Count by source
  const sourceCounts = {};
  logs.forEach(log => {
    const source = log.source || 'null';
    sourceCounts[source] = (sourceCounts[source] || 0) + 1;
  });
  
  console.log('📊 Webhook sources (last 500 webhooks):\n');
  Object.entries(sourceCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([source, count]) => {
      console.log(`  ${source}: ${count}`);
    });
  
  console.log('\n🔍 Recent webhooks by source:\n');
  
  const uniqueSources = [...new Set(logs.map(l => l.source))];
  
  for (const source of uniqueSources) {
    const recent = logs.filter(l => l.source === source).slice(0, 3);
    console.log(`${source} (most recent 3):`);
    recent.forEach(r => {
      console.log(`  - ${r.created_at}`);
    });
    console.log('');
  }
}

checkAllWebhookSources().catch(console.error);
