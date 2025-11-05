#!/usr/bin/env node
/**
 * Master Analysis Runner
 *
 * Runs all analysis scripts and generates a comprehensive report
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('\n' + '='.repeat(80));
console.log('🚀 RUNNING COMPLETE ANALYSIS');
console.log('='.repeat(80) + '\n');

console.log('This will run all analysis scripts:\n');
console.log('  1. Revenue Analysis');
console.log('  2. Funnel Progression Analysis');
console.log('  3. Time-Based Cohort Analysis');
console.log('\n');

const scriptsDir = __dirname;

// Run each analysis
const analyses = [
  { name: 'Revenue Analysis', script: 'analyze-revenue.js' },
  { name: 'Funnel Analysis', script: 'analyze-funnel.js' },
  { name: 'Cohort Analysis', script: 'analyze-cohorts.js' }
];

let fullOutput = '';

analyses.forEach(({ name, script }, index) => {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`RUNNING: ${name} (${index + 1}/${analyses.length})`);
  console.log('='.repeat(80));

  try {
    const output = execSync(`node "${path.join(scriptsDir, script)}"`, {
      encoding: 'utf8',
      cwd: path.join(scriptsDir, '..')
    });
    console.log(output);
    fullOutput += `\n\n${output}`;
  } catch (error) {
    console.error(`Error running ${name}:`, error.message);
  }
});

// Save full report to file
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
const reportPath = path.join(__dirname, '..', 'reports', `analysis-report-${timestamp}.txt`);

// Create reports directory if it doesn't exist
const reportsDir = path.join(__dirname, '..', 'reports');
if (!fs.existsSync(reportsDir)) {
  fs.mkdirSync(reportsDir, { recursive: true });
}

fs.writeFileSync(reportPath, fullOutput);

console.log('\n' + '='.repeat(80));
console.log('✅ ALL ANALYSES COMPLETE');
console.log('='.repeat(80));
console.log();
console.log(`📄 Full report saved to: ${reportPath}`);
console.log();
console.log('💡 TIP: You can also run individual analyses:');
console.log('   node scripts/analyze-revenue.js');
console.log('   node scripts/analyze-funnel.js');
console.log('   node scripts/analyze-cohorts.js');
console.log();
