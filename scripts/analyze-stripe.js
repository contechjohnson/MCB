const fs = require('fs');

// Read CSV
const csv = fs.readFileSync('/Users/connorjohnson/CLAUDE_CODE/MCB/historical_data/stripe_unified_payments.csv', 'utf8');
const lines = csv.split('\n');
const headers = lines[0].split(',');
const rows = lines.slice(1).filter(line => line.trim()).map(line => {
  const values = line.split(',');
  const row = {};
  headers.forEach((header, i) => {
    row[header] = values[i] || '';
  });
  return row;
});

console.log('📊 STRIPE UNIFIED PAYMENTS ANALYSIS');
console.log('='.repeat(60));
console.log();
console.log('Total transactions:', rows.length);
console.log();

// Status breakdown
const statuses = {};
rows.forEach(row => {
  const status = row['Status'] || 'Unknown';
  statuses[status] = (statuses[status] || 0) + 1;
});
console.log('Status breakdown:');
Object.entries(statuses).sort((a, b) => b[1] - a[1]).forEach(([status, count]) => {
  console.log('  ', status + ':', count);
});
console.log();

// Amount analysis
const amounts = rows.map(row => parseFloat(row['Amount']) || 0);
const refunds = rows.map(row => parseFloat(row['Amount Refunded']) || 0);
const totalRevenue = amounts.reduce((sum, amt) => sum + amt, 0);
const totalRefunded = refunds.reduce((sum, amt) => sum + amt, 0);
const netRevenue = totalRevenue - totalRefunded;

console.log('Financial summary:');
console.log('  Total revenue:', '$' + totalRevenue.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2}));
console.log('  Total refunded:', '$' + totalRefunded.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2}));
console.log('  Net revenue:', '$' + netRevenue.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2}));
console.log('  Average transaction:', '$' + (totalRevenue / rows.length).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2}));
console.log();

// Date range
const dates = rows
  .map(row => new Date(row['Created date (UTC)']))
  .filter(d => !isNaN(d));
const minDate = new Date(Math.min(...dates));
const maxDate = new Date(Math.max(...dates));
console.log('Date range:');
console.log('  Earliest:', minDate.toLocaleDateString());
console.log('  Latest:', maxDate.toLocaleDateString());
console.log();

// Email coverage
const withEmail = rows.filter(row => row['Customer Email'] && row['Customer Email'].trim()).length;
const withMetadataEmail = rows.filter(row => row['email (metadata)'] && row['email (metadata)'].trim()).length;
const withAnyEmail = rows.filter(row => {
  const email1 = row['Customer Email'] && row['Customer Email'].trim();
  const email2 = row['email (metadata)'] && row['email (metadata)'].trim();
  return email1 || email2;
}).length;

console.log('Data quality:');
console.log('  With Customer Email:', withEmail);
console.log('  With email (metadata):', withMetadataEmail);
console.log('  With ANY email:', withAnyEmail);
console.log('  Missing email:', rows.length - withAnyEmail);
console.log();

// Package metadata
const withPackageId = rows.filter(row => row['package_id (metadata)'] && row['package_id (metadata)'].trim()).length;
const withPackageName = rows.filter(row => row['package_name (metadata)'] && row['package_name (metadata)'].trim()).length;

console.log('Metadata coverage:');
console.log('  With package_id:', withPackageId);
console.log('  With package_name:', withPackageName);
console.log('  With customer_id:', rows.filter(row => row['customer_id (metadata)'] && row['customer_id (metadata)'].trim()).length);
console.log('  With contactId:', rows.filter(row => row['contactId (metadata)'] && row['contactId (metadata)'].trim()).length);
console.log();

// Refund analysis
const refundedTransactions = rows.filter(row => parseFloat(row['Amount Refunded']) > 0);
console.log('Refunds:');
console.log('  Transactions with refunds:', refundedTransactions.length);
console.log('  Refund rate:', ((refundedTransactions.length / rows.length) * 100).toFixed(2) + '%');
