/**
 * Tenant Configuration Helpers
 *
 * Centralized functions for loading tenant config from database.
 * Used by cron jobs and multi-tenant endpoints.
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface TenantConfig {
  id: string;
  slug: string;
  name: string;
  owner_name: string | null;
  report_email: string | null;
  is_active: boolean;
  config: {
    report_recipients?: string[];
    historical_filter?: boolean;
    [key: string]: any;
  };
}

/**
 * Get tenant by slug
 */
export async function getTenantBySlug(slug: string): Promise<TenantConfig | null> {
  const { data, error } = await supabase
    .from('tenants')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error) {
    console.error(`Error fetching tenant ${slug}:`, error);
    return null;
  }

  return data as TenantConfig;
}

/**
 * Get all active tenants
 */
export async function getActiveTenants(): Promise<TenantConfig[]> {
  const { data, error } = await supabase
    .from('tenants')
    .select('*')
    .eq('is_active', true)
    .order('slug');

  if (error) {
    console.error('Error fetching active tenants:', error);
    return [];
  }

  return data as TenantConfig[];
}

/**
 * Get report recipients for a tenant
 * Falls back to report_email if report_recipients not configured
 */
export function getReportRecipients(tenant: TenantConfig): string[] {
  // Priority 1: config.report_recipients (array)
  if (tenant.config?.report_recipients && Array.isArray(tenant.config.report_recipients)) {
    return tenant.config.report_recipients;
  }

  // Priority 2: report_email (single email)
  if (tenant.report_email) {
    return [tenant.report_email];
  }

  // Fallback: empty array (no recipients configured)
  return [];
}
