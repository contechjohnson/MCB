/**
 * Shared Webhook Utilities
 *
 * Re-exports tenant context and adds webhook-specific helpers
 */

export {
  getTenantContext,
  getTenantById,
  getTenantCredentials,
  supabaseAdmin,
  type TenantContext,
  type TenantCredentials,
} from '@/lib/tenant-context';

import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext, TenantContext } from '@/lib/tenant-context';

/**
 * Extract tenant slug from dynamic route params
 */
export function getTenantSlug(params: { tenant: string }): string {
  return params.tenant;
}

/**
 * Standard error response for webhook handlers
 * Always returns 200 to prevent retries
 */
export function webhookError(message: string, details?: any): NextResponse {
  console.error('Webhook error:', message, details);
  return NextResponse.json(
    { error: message, success: false },
    { status: 200 } // Always 200 to prevent retries
  );
}

/**
 * Standard success response for webhook handlers
 */
export function webhookSuccess(data?: any): NextResponse {
  return NextResponse.json(
    { success: true, ...data },
    { status: 200 }
  );
}

/**
 * Middleware to validate tenant exists
 * Returns tenant context or null with error response
 */
export async function validateTenant(
  tenantSlug: string
): Promise<{ tenant: TenantContext | null; error: NextResponse | null }> {
  const tenant = await getTenantContext(tenantSlug);

  if (!tenant) {
    return {
      tenant: null,
      error: NextResponse.json(
        { error: 'Unknown tenant', success: false },
        { status: 404 }
      ),
    };
  }

  return { tenant, error: null };
}

/**
 * Log webhook to database
 */
export async function logWebhook(
  supabase: any,
  params: {
    tenant_id: string;
    source: string;
    event_type: string;
    payload: any;
    mc_id?: string;
    ghl_id?: string;
    contact_id?: string;
    status?: string;
    error_message?: string;
  }
): Promise<void> {
  try {
    await supabase.from('webhook_logs').insert({
      tenant_id: params.tenant_id,
      source: params.source,
      event_type: params.event_type,
      payload: params.payload,
      mc_id: params.mc_id,
      ghl_id: params.ghl_id,
      contact_id: params.contact_id,
      status: params.status || 'received',
      error_message: params.error_message,
    });
  } catch (error) {
    console.error('Failed to log webhook:', error);
    // Don't throw - logging failures shouldn't break webhook processing
  }
}
