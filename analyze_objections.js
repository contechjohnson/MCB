const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '/home/user/MCB/.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function analyzeObjections() {
  // Query contacts from last 7 days with objections
  const sevenDaysAgo = new Date('2025-11-01T00:00:00Z').toISOString();
  
  const { data, error } = await supabase
    .from('contacts')
    .select('id, first_name, last_name, email_primary, source, stage, objections, created_at, dm_qualified_date, chatbot_ab')
    .neq('source', 'instagram_historical')
    .gte('created_at', sevenDaysAgo)
    .not('objections', 'is', null)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error querying contacts:', error);
    return;
  }

  console.log('\n=== OBJECTIONS ANALYSIS (Last 7 Days: Nov 1-8, 2025) ===\n');
  console.log(`Total contacts with objections: ${data.length}\n`);

  if (data.length === 0) {
    console.log('No contacts with objections found in the last 7 days.');
    return;
  }

  // Categorize objections
  const categories = {
    price: { count: 0, keywords: ['price', 'cost', 'expensive', 'afford', 'money', 'pay', 'budget', 'cheap'], examples: [] },
    time: { count: 0, keywords: ['time', 'busy', 'schedule', 'when', 'available'], examples: [] },
    skepticism: { count: 0, keywords: ['work', 'really', 'sure', 'doubt', 'believe', 'trust', 'scam'], examples: [] },
    health_concerns: { count: 0, keywords: ['pain', 'injury', 'condition', 'surgery', 'medical', 'doctor'], examples: [] },
    location: { count: 0, keywords: ['location', 'where', 'far', 'distance', 'travel', 'remote', 'online'], examples: [] },
    commitment: { count: 0, keywords: ['commit', 'long', 'hard', 'difficult', 'quit', 'give up'], examples: [] },
    other: { count: 0, examples: [] }
  };

  // Analyze each contact's objections
  data.forEach(contact => {
    const objection = contact.objections.toLowerCase();
    let categorized = false;

    for (const [category, info] of Object.entries(categories)) {
      if (category === 'other') continue;
      
      if (info.keywords.some(keyword => objection.includes(keyword))) {
        info.count++;
        if (info.examples.length < 3) {
          info.examples.push({
            text: contact.objections,
            contact: `${contact.first_name || 'Unknown'} ${contact.last_name || ''}`.trim(),
            source: contact.source,
            stage: contact.stage
          });
        }
        categorized = true;
      }
    }

    if (!categorized) {
      categories.other.count++;
      if (categories.other.examples.length < 3) {
        categories.other.examples.push({
          text: contact.objections,
          contact: `${contact.first_name || 'Unknown'} ${contact.last_name || ''}`.trim(),
          source: contact.source,
          stage: contact.stage
        });
      }
    }
  });

  // Display categorized results
  console.log('=== OBJECTION CATEGORIES ===\n');
  
  const sortedCategories = Object.entries(categories)
    .sort((a, b) => b[1].count - a[1].count)
    .filter(([_, info]) => info.count > 0);

  sortedCategories.forEach(([category, info]) => {
    const percentage = ((info.count / data.length) * 100).toFixed(1);
    console.log(`${category.toUpperCase()}: ${info.count} contacts (${percentage}%)`);
    
    if (info.examples.length > 0) {
      console.log('  Examples:');
      info.examples.forEach((example, idx) => {
        console.log(`    ${idx + 1}. "${example.text}"`);
        console.log(`       - Contact: ${example.contact}, Source: ${example.source}, Stage: ${example.stage}`);
      });
    }
    console.log('');
  });

  // Show all contacts with objections
  console.log('=== ALL CONTACTS WITH OBJECTIONS ===\n');
  data.forEach((contact, idx) => {
    console.log(`${idx + 1}. ${contact.first_name || 'Unknown'} ${contact.last_name || ''}`);
    console.log(`   Email: ${contact.email_primary || 'N/A'}`);
    console.log(`   Source: ${contact.source}`);
    console.log(`   Stage: ${contact.stage}`);
    console.log(`   Chatbot: ${contact.chatbot_ab || 'N/A'}`);
    console.log(`   Created: ${new Date(contact.created_at).toLocaleDateString()}`);
    console.log(`   Objections: "${contact.objections}"`);
    console.log('');
  });

  // Insights
  console.log('=== INSIGHTS ===\n');
  
  // Source breakdown
  const sourceBreakdown = data.reduce((acc, c) => {
    acc[c.source] = (acc[c.source] || 0) + 1;
    return acc;
  }, {});
  console.log('By Source:');
  Object.entries(sourceBreakdown).forEach(([source, count]) => {
    console.log(`  - ${source}: ${count} contacts`);
  });
  console.log('');

  // Stage breakdown
  const stageBreakdown = data.reduce((acc, c) => {
    acc[c.stage] = (acc[c.stage] || 0) + 1;
    return acc;
  }, {});
  console.log('By Stage:');
  Object.entries(stageBreakdown).forEach(([stage, count]) => {
    console.log(`  - ${stage}: ${count} contacts`);
  });
  console.log('');

  // Chatbot A/B breakdown
  const abBreakdown = data.reduce((acc, c) => {
    const variant = c.chatbot_ab || 'unknown';
    acc[variant] = (acc[variant] || 0) + 1;
    return acc;
  }, {});
  console.log('By Chatbot Variant:');
  Object.entries(abBreakdown).forEach(([variant, count]) => {
    console.log(`  - ${variant}: ${count} contacts`);
  });
}

analyzeObjections().catch(console.error);
