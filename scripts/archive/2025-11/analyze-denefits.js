const XLSX = require('xlsx');

const workbook = XLSX.readFile('/Users/connorjohnson/CLAUDE_CODE/MCB/historical_data/contracts_export.xlsx');
const data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

console.log('📊 DENEFITS CONTRACTS ANALYSIS');
console.log('='.repeat(60));
console.log();
console.log('Total contracts:', data.length);
console.log();

// Status breakdown
const statuses = {};
data.forEach(row => {
  const status = row['Payment Plan Status'] || 'Unknown';
  statuses[status] = (statuses[status] || 0) + 1;
});
console.log('Status breakdown:');
Object.entries(statuses).sort((a, b) => b[1] - a[1]).forEach(([status, count]) => {
  console.log('  ', status + ':', count);
});
console.log();

// Total amounts
const totalPlanAmount = data.reduce((sum, row) => sum + (row['Payment Plan Amount'] || 0), 0);
const totalDownPayment = data.reduce((sum, row) => sum + (row['Down Payment Amount'] || 0), 0);
console.log('Financial summary:');
console.log('  Total financed:', '$' + totalPlanAmount.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2}));
console.log('  Total down payments:', '$' + totalDownPayment.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2}));
console.log('  Average plan amount:', '$' + (totalPlanAmount / data.length).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2}));
console.log();

// Date range
const dates = data.map(row => new Date(row['Payment Plan Sign Up Date'])).filter(d => !isNaN(d));
const minDate = new Date(Math.min(...dates));
const maxDate = new Date(Math.max(...dates));
console.log('Date range:');
console.log('  Earliest:', minDate.toLocaleDateString());
console.log('  Latest:', maxDate.toLocaleDateString());
console.log();

// Missing emails
const missingEmails = data.filter(row => !row['Customer Email'] || row['Customer Email'].trim() === '').length;
console.log('Data quality:');
console.log('  Rows with email:', data.length - missingEmails);
console.log('  Rows missing email:', missingEmails);
