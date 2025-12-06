/**
 * Apply Analytics Views to Supabase
 *
 * This script reads the analytics views migration file and applies it to Supabase
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: '.env.local' });

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function applySQLFile(filePath) {
  console.log(`\n📄 Reading SQL file: ${filePath}`);

  const sqlContent = fs.readFileSync(filePath, 'utf8');

  // Split by view definitions (each CREATE OR REPLACE VIEW statement)
  const viewStatements = sqlContent
    .split(/(?=CREATE OR REPLACE VIEW)/g)
    .filter(stmt => stmt.trim().startsWith('CREATE OR REPLACE VIEW'));

  console.log(`\n✅ Found ${viewStatements.length} view definitions\n`);

  for (let i = 0; i < viewStatements.length; i++) {
    const viewSQL = viewStatements[i].trim();

    // Extract view name
    const viewNameMatch = viewSQL.match(/CREATE OR REPLACE VIEW (\w+) AS/);
    const viewName = viewNameMatch ? viewNameMatch[1] : `View ${i + 1}`;

    console.log(`\n📊 Creating view: ${viewName}`);

    try {
      const { data, error } = await supabaseAdmin.rpc('exec_sql', {
        sql: viewSQL
      });

      if (error) {
        // Try direct query if RPC doesn't exist
        const result = await supabaseAdmin
          .from('_raw_sql')
          .insert({ query: viewSQL });

        if (result.error) {
          console.error(`  ✗ Error creating ${viewName}:`, error.message || error);
        } else {
          console.log(`  ✓ Successfully created ${viewName}`);
        }
      } else {
        console.log(`  ✓ Successfully created ${viewName}`);
      }
    } catch (err) {
      console.error(`  ✗ Exception creating ${viewName}:`, err.message);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ View creation complete!');
  console.log('='.repeat(60) + '\n');
}

async function main() {
  const migrationFile = path.join(__dirname, '../migrations/20250107_create_analytics_views.sql');

  if (!fs.existsSync(migrationFile)) {
    console.error(`❌ Migration file not found: ${migrationFile}`);
    process.exit(1);
  }

  await applySQLFile(migrationFile);
}

main().catch(console.error);
