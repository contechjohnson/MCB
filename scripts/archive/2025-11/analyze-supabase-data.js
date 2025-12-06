const fs = require('fs');

console.log('\n' + '='.repeat(60));
console.log('ANALYZING SUPABASE EXPORTS');
console.log('='.repeat(60) + '\n');

// =============================================================================
// ANALYZE CONTACTS
// =============================================================================

console.log('📊 SUPABASE_EXPORT_CONTACTS_FULL.CSV ANALYSIS\n');

const contactsCsv = fs.readFileSync('/Users/connorjohnson/CLAUDE_CODE/MCB/historical_data/supabase_export_contacts_full.csv', 'utf8');
const contactsLines = contactsCsv.split('\n');
const contactsHeaders = contactsLines[0].split(',');
const contactsRows = contactsLines.slice(1).filter(line => line.trim()).map(line => {
  const values = line.split(',');
  const row = {};
  contactsHeaders.forEach((header, i) => {
    row[header] = values[i] || '';
  });
  return row;
});

console.log('Total contacts:', contactsRows.length);
console.log();

// Email coverage
const withEmail = contactsRows.filter(row => row.email_address && row.email_address.trim()).length;
console.log('Data quality:');
console.log('  With email:', withEmail);
console.log('  Missing email:', contactsRows.length - withEmail);
console.log('  Email coverage:', ((withEmail / contactsRows.length) * 100).toFixed(1) + '%');
console.log();

// Purchase tracking
const withPurchase = contactsRows.filter(row => {
  const total = parseFloat(row.total_purchased) || 0;
  const firstAmount = parseFloat(row.first_purchase_amount) || 0;
  const packageAmount = parseFloat(row.package_purchase_amount) || 0;
  return total > 0 || firstAmount > 0 || packageAmount > 0;
}).length;

console.log('Purchase data:');
console.log('  Contacts with purchases:', withPurchase);
console.log('  Purchase rate:', ((withPurchase / contactsRows.length) * 100).toFixed(2) + '%');
console.log();

// Attribution
const paidVsOrganic = {};
contactsRows.forEach(row => {
  const type = row.paid_vs_organic || 'Unknown';
  paidVsOrganic[type] = (paidVsOrganic[type] || 0) + 1;
});

console.log('Attribution breakdown:');
Object.entries(paidVsOrganic).sort((a, b) => b[1] - a[1]).forEach(([type, count]) => {
  console.log('  ', type + ':', count);
});
console.log();

// Stage tracking
const stages = {};
contactsRows.forEach(row => {
  const stage = row.stage || 'Unknown';
  stages[stage] = (stages[stage] || 0) + 1;
});

console.log('Top 10 stages:');
Object.entries(stages)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10)
  .forEach(([stage, count]) => {
    console.log('  ', stage + ':', count);
  });
console.log();

// Date range
const dates = contactsRows
  .map(row => row.subscription_date ? new Date(row.subscription_date) : null)
  .filter(d => d && !isNaN(d));

if (dates.length > 0) {
  const minDate = new Date(Math.min(...dates));
  const maxDate = new Date(Math.max(...dates));
  console.log('Date range:');
  console.log('  Earliest subscription:', minDate.toLocaleDateString());
  console.log('  Latest subscription:', maxDate.toLocaleDateString());
  console.log();
}

// Platform breakdown
const platforms = {};
contactsRows.forEach(row => {
  const platform = row.ig_or_fb || 'Unknown';
  platforms[platform] = (platforms[platform] || 0) + 1;
});

console.log('Platform breakdown:');
Object.entries(platforms).sort((a, b) => b[1] - a[1]).forEach(([platform, count]) => {
  console.log('  ', platform + ':', count);
});
console.log();

// IDs coverage
const withUserId = contactsRows.filter(row => row.user_id && row.user_id.trim()).length;
const withThreadId = contactsRows.filter(row => row.thread_id && row.thread_id.trim()).length;
const withAdId = contactsRows.filter(row => row.ad_id && row.ad_id.trim()).length;

console.log('ID coverage:');
console.log('  With user_id:', withUserId, '(' + ((withUserId / contactsRows.length) * 100).toFixed(1) + '%)');
console.log('  With thread_id:', withThreadId, '(' + ((withThreadId / contactsRows.length) * 100).toFixed(1) + '%)');
console.log('  With ad_id:', withAdId, '(' + ((withAdId / contactsRows.length) * 100).toFixed(1) + '%)');
console.log();

// =============================================================================
// ANALYZE WEBHOOK LOGS
// =============================================================================

console.log('='.repeat(60));
console.log('📊 SUPABASE_EXPORT_STRIPE_WEBHOOKS.CSV ANALYSIS\n');

const webhookCsv = fs.readFileSync('/Users/connorjohnson/CLAUDE_CODE/MCB/historical_data/supabase_export_stripe_webhooks.csv', 'utf8');
const webhookLines = webhookCsv.split('\n');
const webhookHeaders = webhookLines[0].split(',');
const webhookRows = webhookLines.slice(1).filter(line => line.trim()).map(line => {
  const values = line.split(',');
  const row = {};
  webhookHeaders.forEach((header, i) => {
    row[header] = values[i] || '';
  });
  return row;
});

console.log('Total webhook events:', webhookRows.length);
console.log();

// Event types
const eventTypes = {};
webhookRows.forEach(row => {
  const type = row.event_type || 'Unknown';
  eventTypes[type] = (eventTypes[type] || 0) + 1;
});

console.log('Event type breakdown:');
Object.entries(eventTypes).sort((a, b) => b[1] - a[1]).forEach(([type, count]) => {
  console.log('  ', type + ':', count);
});
console.log();

// Status breakdown
const statuses = {};
webhookRows.forEach(row => {
  const status = row.status || 'Unknown';
  statuses[status] = (statuses[status] || 0) + 1;
});

console.log('Status breakdown:');
Object.entries(statuses).sort((a, b) => b[1] - a[1]).forEach(([status, count]) => {
  console.log('  ', status + ':', count);
});
console.log();

// Email coverage in webhooks
const webhookWithEmail = webhookRows.filter(row => row.customer_email && row.customer_email.trim()).length;
console.log('Data quality:');
console.log('  With email:', webhookWithEmail);
console.log('  Missing email:', webhookRows.length - webhookWithEmail);
console.log('  Email coverage:', ((webhookWithEmail / webhookRows.length) * 100).toFixed(1) + '%');
console.log();

// Match tracking
const matched = webhookRows.filter(row => row.matched_contact_id && row.matched_contact_id.trim()).length;
console.log('Contact matching:');
console.log('  Matched to contact:', matched);
console.log('  Not matched:', webhookRows.length - matched);
console.log('  Match rate:', ((matched / webhookRows.length) * 100).toFixed(1) + '%');
console.log();

// Match methods
const matchMethods = {};
webhookRows.forEach(row => {
  const method = row.match_method || 'not_matched';
  matchMethods[method] = (matchMethods[method] || 0) + 1;
});

console.log('Match method breakdown:');
Object.entries(matchMethods).sort((a, b) => b[1] - a[1]).forEach(([method, count]) => {
  console.log('  ', method + ':', count);
});
console.log();

// Abandonment tracking
const abandoned = webhookRows.filter(row => row.abandoned_at && row.abandoned_at.trim()).length;
const converted = webhookRows.filter(row => row.converted_at && row.converted_at.trim()).length;

console.log('Checkout tracking:');
console.log('  Abandoned checkouts:', abandoned);
console.log('  Converted checkouts:', converted);
if (abandoned + converted > 0) {
  console.log('  Abandonment rate:', ((abandoned / (abandoned + converted)) * 100).toFixed(1) + '%');
}
console.log();

console.log('='.repeat(60));
console.log('✅ ANALYSIS COMPLETE');
console.log('='.repeat(60));
console.log();
