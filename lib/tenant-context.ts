/**
 * Tenant Context Utility
 *
 * Provides tenant lookup and credential retrieval for multi-tenant webhooks.
 * Used by all webhook handlers to scope queries to the correct tenant.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Admin client for tenant lookups
const supabaseAdmin: SupabaseClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

/**
 * Tenant context returned by getTenantContext
 */
export interface TenantContext {
  id: string;
  slug: string;
  name: string;
  owner_name: string | null;
  report_email: string | null;
  config: Record<string, any>;
  credentials: Record<string, TenantCredentials>;
}

/**
 * Credentials for a specific provider
 */
export interface TenantCredentials {
  [key: string]: any;
  webhook_secret?: string;
}

/**
 * Get tenant context by slug
 *
 * @param slug - Tenant slug (e.g., 'ppcu', 'centner', 'columnline')
 * @returns TenantContext or null if not found
 *
 * @example
 * const tenant = await getTenantContext('ppcu');
 * if (!tenant) return NextResponse.json({ error: 'Unknown tenant' }, { status: 404 });
 */
export async function getTenantContext(slug: string): Promise<TenantContext | null> {
  // Get tenant
  const { data: tenant, error } = await supabaseAdmin
    .from('tenants')
    .select('id, slug, name, owner_name, report_email, config')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (error || !tenant) {
    console.error('Tenant not found:', slug, error?.message);
    return null;
  }

  // Get integrations for this tenant
  const { data: integrations } = await supabaseAdmin
    .from('tenant_integrations')
    .select('provider, credentials, webhook_secret')
    .eq('tenant_id', tenant.id)
    .eq('is_active', true);

  // Build credentials map
  const credentials: Record<string, TenantCredentials> = {};
  integrations?.forEach((i) => {
    credentials[i.provider] = {
      ...i.credentials,
      webhook_secret: i.webhook_secret,
    };
  });

  return {
    ...tenant,
    credentials,
  };
}

/**
 * Get tenant by ID (for internal use)
 *
 * @param id - Tenant UUID
 * @returns TenantContext or null
 */
export async function getTenantById(id: string): Promise<TenantContext | null> {
  const { data: tenant, error } = await supabaseAdmin
    .from('tenants')
    .select('id, slug, name, owner_name, report_email, config')
    .eq('id', id)
    .eq('is_active', true)
    .single();

  if (error || !tenant) {
    return null;
  }

  const { data: integrations } = await supabaseAdmin
    .from('tenant_integrations')
    .select('provider, credentials, webhook_secret')
    .eq('tenant_id', id)
    .eq('is_active', true);

  const credentials: Record<string, TenantCredentials> = {};
  integrations?.forEach((i) => {
    credentials[i.provider] = {
      ...i.credentials,
      webhook_secret: i.webhook_secret,
    };
  });

  return {
    ...tenant,
    credentials,
  };
}

/**
 * Get all active tenants
 *
 * @returns Array of tenant contexts (without credentials)
 */
export async function getAllTenants(): Promise<Omit<TenantContext, 'credentials'>[]> {
  const { data: tenants, error } = await supabaseAdmin
    .from('tenants')
    .select('id, slug, name, owner_name, report_email, config')
    .eq('is_active', true)
    .order('created_at');

  if (error) {
    console.error('Error fetching tenants:', error.message);
    return [];
  }

  return tenants || [];
}

/**
 * Get credentials for a specific provider
 *
 * @param tenantId - Tenant UUID
 * @param provider - Provider name ('manychat', 'stripe', etc.)
 * @returns Credentials object or null
 */
export async function getTenantCredentials(
  tenantId: string,
  provider: string
): Promise<TenantCredentials | null> {
  const { data, error } = await supabaseAdmin
    .from('tenant_integrations')
    .select('credentials, webhook_secret')
    .eq('tenant_id', tenantId)
    .eq('provider', provider)
    .eq('is_active', true)
    .single();

  if (error || !data) {
    return null;
  }

  return {
    ...data.credentials,
    webhook_secret: data.webhook_secret,
  };
}

/**
 * Get tenants with a specific integration
 *
 * @param provider - Provider name ('meta', 'stripe', etc.)
 * @returns Array of tenants with that integration configured
 */
export async function getTenantsWithIntegration(provider: string): Promise<TenantContext[]> {
  const { data, error } = await supabaseAdmin
    .from('tenants')
    .select(`
      id, slug, name, owner_name, report_email, config,
      tenant_integrations!inner (
        provider, credentials, webhook_secret
      )
    `)
    .eq('is_active', true)
    .eq('tenant_integrations.provider', provider)
    .eq('tenant_integrations.is_active', true);

  if (error || !data) {
    console.error('Error fetching tenants with integration:', error?.message);
    return [];
  }

  return data.map((tenant: any) => ({
    id: tenant.id,
    slug: tenant.slug,
    name: tenant.name,
    owner_name: tenant.owner_name,
    report_email: tenant.report_email,
    config: tenant.config,
    credentials: {
      [provider]: {
        ...tenant.tenant_integrations[0].credentials,
        webhook_secret: tenant.tenant_integrations[0].webhook_secret,
      },
    },
  }));
}

/**
 * Verify webhook signature for a tenant
 *
 * @param tenantId - Tenant UUID
 * @param provider - Provider name
 * @param signature - Signature from webhook headers
 * @param payload - Raw request body
 * @returns boolean indicating if signature is valid
 */
export async function verifyWebhookSignature(
  tenantId: string,
  provider: string,
  signature: string,
  payload: string
): Promise<boolean> {
  const creds = await getTenantCredentials(tenantId, provider);
  if (!creds?.webhook_secret) {
    // No secret configured, skip verification
    return true;
  }

  // Provider-specific verification would go here
  // For now, return true (implement per-provider as needed)
  // Stripe uses stripe.webhooks.constructEvent()
  // ManyChat uses HMAC verification
  return true;
}

// Export the admin client for direct queries
export { supabaseAdmin };
