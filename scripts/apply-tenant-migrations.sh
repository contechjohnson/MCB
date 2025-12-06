#!/bin/bash
# Apply tenant migrations to Supabase database
# Usage: ./apply-tenant-migrations.sh

set -e  # Exit on error

# Load environment variables
if [ -f .env.local ]; then
  export $(cat .env.local | grep -v '^#' | xargs)
fi

# Check for required env vars
if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ]; then
  echo "❌ NEXT_PUBLIC_SUPABASE_URL not set in .env.local"
  exit 1
fi

if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "❌ SUPABASE_SERVICE_ROLE_KEY not set in .env.local"
  exit 1
fi

# Extract database connection details from Supabase URL
# Format: https://succdcwblbzikenhhlrz.supabase.co
PROJECT_ID=$(echo $NEXT_PUBLIC_SUPABASE_URL | sed -E 's/https:\/\/([^.]+).*/\1/')

echo "🚀 Starting tenant migration..."
echo "📊 Project ID: $PROJECT_ID"
echo ""

# Database connection details
DB_HOST="${PROJECT_ID}.supabase.co"
DB_NAME="postgres"
DB_PORT="5432"
DB_USER="postgres"
DB_PASSWORD="${SUPABASE_SERVICE_ROLE_KEY}"

# Connection string
CONNECTION_STRING="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}?sslmode=require"

# Migration files
MIGRATIONS=(
  "20251205_001_create_tenants.sql"
  "20251205_002_create_tenant_integrations.sql"
  "20251205_003_add_tenant_id_columns.sql"
  "20251205_004_migrate_ppcu_data.sql"
  "20251205_005_update_constraints.sql"
)

# Run each migration
for migration in "${MIGRATIONS[@]}"; do
  echo "📄 Running migration: $migration"

  if [ ! -f "migrations/$migration" ]; then
    echo "❌ File not found: migrations/$migration"
    exit 1
  fi

  # Execute SQL file
  psql "$CONNECTION_STRING" -f "migrations/$migration"

  if [ $? -eq 0 ]; then
    echo "✅ $migration completed successfully"
    echo ""
  else
    echo "❌ $migration failed"
    exit 1
  fi
done

echo "=========================================="
echo "🔍 Verifying migrations..."
echo "=========================================="

# Verify tenants table
echo ""
echo "Tenants:"
psql "$CONNECTION_STRING" -c "SELECT slug, name, owner_name FROM tenants ORDER BY slug;"

echo ""
echo "Tenant integrations count:"
psql "$CONNECTION_STRING" -c "SELECT COUNT(*) as count FROM tenant_integrations;"

echo ""
echo "Contacts with tenant_id:"
psql "$CONNECTION_STRING" -c "SELECT COUNT(*) as total, COUNT(tenant_id) as with_tenant FROM contacts;"

echo ""
echo "✅ Migration complete!"
