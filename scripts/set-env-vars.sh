#!/bin/bash
# Set Supabase environment variables without trailing newlines

set -e

echo "Setting NEXT_PUBLIC_SUPABASE_URL..."
echo -n "https://succdcwblbzikenhhlrz.supabase.co" | vercel env add NEXT_PUBLIC_SUPABASE_URL development

echo "Setting SUPABASE_SERVICE_ROLE_KEY..."
echo -n "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN1Y2NkY3dibGJ6aWtlbmhobHJ6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjIxNDQyMCwiZXhwIjoyMDc3NzkwNDIwfQ.q4texPwypSX_cShDSjBTjTPSBLNdI3nnRViQtw2zUnw" | vercel env add SUPABASE_SERVICE_ROLE_KEY development

echo "Setting NEXT_PUBLIC_SUPABASE_ANON_KEY..."
echo -n "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN1Y2NkY3dibGJ6aWtlbmhobHJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyMTQ0MjAsImV4cCI6MjA3Nzc5MDQyMH0.lNbMzKYhzZqXcP5Azyqchg_Sv3J_uVyOuFeUi5w9L28" | vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY development

echo "Done!"
