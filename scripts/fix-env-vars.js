#!/usr/bin/env node

const { execSync } = require('child_process');

// Values without any newlines
const envVars = [
  {
    key: 'NEXT_PUBLIC_SUPABASE_URL',
    value: 'https://succdcwblbzikenhhlrz.supabase.co'
  },
  {
    key: 'SUPABASE_SERVICE_ROLE_KEY',
    value: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN1Y2NkY3dibGJ6aWtlbmhobHJ6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjIxNDQyMCwiZXhwIjoyMDc3NzkwNDIwfQ.q4texPwypSX_cShDSjBTjTPSBLNdI3nnRViQtw2zUnw'
  },
  {
    key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    value: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN1Y2NkY3dibGJ6aWtlbmhobHJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyMTQ0MjAsImV4cCI6MjA3Nzc5MDQyMH0.lNbMzKYhzZqXcP5Azyqchg_Sv3J_uVyOuFeUi5w9L28'
  }
];

console.log('Setting environment variables via stdin...\n');

for (const envVar of envVars) {
  console.log(`Setting ${envVar.key}...`);

  try {
    // Use stdin properly - write value followed by newline
    execSync(`vercel env add ${envVar.key} development`, {
      input: envVar.value + '\n',
      encoding: 'utf8',
      stdio: ['pipe', 'inherit', 'inherit']
    });

    console.log(`✅ ${envVar.key} set\n`);
  } catch (error) {
    console.error(`❌ Failed to set ${envVar.key}:`, error.message);
  }
}

console.log('Done!');
