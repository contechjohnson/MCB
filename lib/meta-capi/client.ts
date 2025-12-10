/**
 * Meta Conversions API (CAPI) Client
 *
 * Sends server-side conversion events to Meta for attribution.
 * Events are queued in meta_capi_events table for retry handling.
 *
 * Supported events:
 * - Lead: When a DM conversation qualifies a lead
 * - AddToCart: When a call/consultation is booked
 * - InitiateCheckout: When a form submission occurs
 * - Purchase: When payment is received (Stripe/Denefits)
 */

import { createHash } from 'crypto';
import { TenantContext, supabaseAdmin } from '@/lib/tenant-context';

// Meta CAPI API endpoint
const META_CAPI_BASE = 'https://graph.facebook.com/v18.0';

/**
 * Meta CAPI event types we support
 */
export type CAPIEventName =
  | 'Lead'
  | 'AddToCart'
  | 'InitiateCheckout'
  | 'Purchase'
  | 'CompleteRegistration'
  | 'Contact'
  | 'Schedule';

/**
 * Action source for the event
 */
export type ActionSource =
  | 'website'
  | 'app'
  | 'phone_call'
  | 'chat'
  | 'email'
  | 'physical_store'
  | 'system_generated'
  | 'other';

/**
 * User data for event matching (will be hashed before sending)
 */
export interface UserData {
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  fbp?: string; // _fbp cookie value
  fbc?: string; // _fbc cookie value
  externalId?: string;
  clientIpAddress?: string;
  clientUserAgent?: string;
}

/**
 * Custom data for the event
 */
export interface CustomData {
  value?: number;
  currency?: string;
  contentType?: string;
  contentIds?: string[];
  contentName?: string;
  [key: string]: any;
}

/**
 * Full event payload for Meta CAPI
 */
export interface CAPIEvent {
  eventName: CAPIEventName;
  eventTime: Date;
  eventId?: string; // For deduplication
  eventSourceUrl?: string;
  actionSource: ActionSource;
  userData: UserData;
  customData?: CustomData;
  // Attribution data
  adId?: string;
  adsetId?: string;
  campaignId?: string;
}

/**
 * Meta API response
 */
interface MetaAPIResponse {
  events_received?: number;
  messages?: string[];
  fbtrace_id?: string;
  error?: {
    message: string;
    type: string;
    code: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
}

/**
 * Hash a value using SHA256 (Meta requirement)
 */
export function hashValue(value: string): string {
  return createHash('sha256').update(value.toLowerCase().trim()).digest('hex');
}

/**
 * Normalize and hash email
 */
export function hashEmail(email: string): string {
  // Remove whitespace, lowercase
  const normalized = email.toLowerCase().trim();
  return hashValue(normalized);
}

/**
 * Normalize and hash phone (E.164 format)
 */
export function hashPhone(phone: string): string {
  // Remove all non-digits, ensure country code
  let normalized = phone.replace(/\D/g, '');

  // Add US country code if not present
  if (normalized.length === 10) {
    normalized = '1' + normalized;
  }

  return hashValue(normalized);
}

/**
 * Normalize and hash name
 */
export function hashName(name: string): string {
  // Lowercase, remove extra whitespace
  const normalized = name.toLowerCase().trim().replace(/\s+/g, ' ');
  return hashValue(normalized);
}

/**
 * Meta CAPI Client for a specific tenant
 */
export class MetaCAPIClient {
  private pixelId: string;
  private accessToken: string;
  private testEventCode?: string;

  constructor(credentials: {
    pixel_id: string;
    capi_access_token: string;
    test_event_code?: string;
  }) {
    if (!credentials.pixel_id || !credentials.capi_access_token) {
      throw new Error('Meta pixel_id and capi_access_token are required');
    }
    this.pixelId = credentials.pixel_id;
    this.accessToken = credentials.capi_access_token;
    this.testEventCode = credentials.test_event_code;
  }

  /**
   * Create a Meta CAPI client from tenant context
   */
  static fromTenant(tenant: TenantContext): MetaCAPIClient | null {
    const creds = tenant.credentials?.meta;
    if (!creds?.pixel_id || !creds?.capi_access_token) {
      console.error(`Meta CAPI not configured for tenant: ${tenant.slug}`);
      return null;
    }
    return new MetaCAPIClient(creds);
  }

  /**
   * Build the user_data object with hashed values
   */
  private buildUserData(userData: UserData): Record<string, any> {
    const result: Record<string, any> = {};

    if (userData.email) {
      result.em = [hashEmail(userData.email)];
    }
    if (userData.phone) {
      result.ph = [hashPhone(userData.phone)];
    }
    if (userData.firstName) {
      result.fn = [hashName(userData.firstName)];
    }
    if (userData.lastName) {
      result.ln = [hashName(userData.lastName)];
    }
    if (userData.fbp) {
      result.fbp = userData.fbp;
    }
    if (userData.fbc) {
      result.fbc = userData.fbc;
    }
    if (userData.externalId) {
      result.external_id = [hashValue(userData.externalId)];
    }
    if (userData.clientIpAddress) {
      result.client_ip_address = userData.clientIpAddress;
    }
    if (userData.clientUserAgent) {
      result.client_user_agent = userData.clientUserAgent;
    }

    return result;
  }

  /**
   * Build the custom_data object
   */
  private buildCustomData(customData?: CustomData): Record<string, any> | undefined {
    if (!customData) return undefined;

    const result: Record<string, any> = {};

    if (customData.value !== undefined) {
      result.value = customData.value;
    }
    if (customData.currency) {
      result.currency = customData.currency;
    }
    if (customData.contentType) {
      result.content_type = customData.contentType;
    }
    if (customData.contentIds) {
      result.content_ids = customData.contentIds;
    }
    if (customData.contentName) {
      result.content_name = customData.contentName;
    }

    // Add any additional custom fields
    for (const [key, value] of Object.entries(customData)) {
      if (!['value', 'currency', 'contentType', 'contentIds', 'contentName'].includes(key)) {
        result[key] = value;
      }
    }

    return Object.keys(result).length > 0 ? result : undefined;
  }

  /**
   * Send event directly to Meta CAPI
   */
  async sendEvent(event: CAPIEvent): Promise<MetaAPIResponse> {
    const eventId = event.eventId || crypto.randomUUID();

    const payload = {
      data: [
        {
          event_name: event.eventName,
          event_time: Math.floor(event.eventTime.getTime() / 1000),
          event_id: eventId,
          event_source_url: event.eventSourceUrl,
          action_source: event.actionSource,
          user_data: this.buildUserData(event.userData),
          custom_data: this.buildCustomData(event.customData),
        },
      ],
      ...(this.testEventCode && { test_event_code: this.testEventCode }),
    };

    try {
      const response = await fetch(
        `${META_CAPI_BASE}/${this.pixelId}/events?access_token=${this.accessToken}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json();

      if (!response.ok || data.error) {
        console.error('Meta CAPI error:', data.error || response.status);
        return data;
      }

      console.log(`Meta CAPI: ${event.eventName} event sent successfully`, {
        events_received: data.events_received,
        fbtrace_id: data.fbtrace_id,
      });

      return data;
    } catch (error) {
      console.error('Meta CAPI request failed:', error);
      return {
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          type: 'RequestError',
          code: 0,
        },
      };
    }
  }

  /**
   * Send multiple events in a batch
   */
  async sendEvents(events: CAPIEvent[]): Promise<MetaAPIResponse> {
    const payload = {
      data: events.map((event) => ({
        event_name: event.eventName,
        event_time: Math.floor(event.eventTime.getTime() / 1000),
        event_id: event.eventId || crypto.randomUUID(),
        event_source_url: event.eventSourceUrl,
        action_source: event.actionSource,
        user_data: this.buildUserData(event.userData),
        custom_data: this.buildCustomData(event.customData),
      })),
      ...(this.testEventCode && { test_event_code: this.testEventCode }),
    };

    try {
      const response = await fetch(
        `${META_CAPI_BASE}/${this.pixelId}/events?access_token=${this.accessToken}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        }
      );

      return response.json();
    } catch (error) {
      console.error('Meta CAPI batch request failed:', error);
      return {
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          type: 'RequestError',
          code: 0,
        },
      };
    }
  }
}

/**
 * Queue a CAPI event for sending (with retry support)
 */
export async function queueCAPIEvent(
  tenantId: string,
  event: CAPIEvent & { contactId?: string }
): Promise<string> {
  const eventId = event.eventId || crypto.randomUUID();

  const { data, error } = await supabaseAdmin.from('meta_capi_events').insert({
    tenant_id: tenantId,
    contact_id: event.contactId,
    event_name: event.eventName,
    event_time: event.eventTime.toISOString(),
    event_id: eventId,
    event_source_url: event.eventSourceUrl,
    action_source: event.actionSource,
    ad_id: event.adId,
    adset_id: event.adsetId,
    campaign_id: event.campaignId,
    user_email_hash: event.userData.email ? hashEmail(event.userData.email) : null,
    user_phone_hash: event.userData.phone ? hashPhone(event.userData.phone) : null,
    user_first_name_hash: event.userData.firstName ? hashName(event.userData.firstName) : null,
    user_last_name_hash: event.userData.lastName ? hashName(event.userData.lastName) : null,
    user_fbp: event.userData.fbp,
    user_fbc: event.userData.fbc,
    user_external_id: event.userData.externalId,
    user_client_ip_address: event.userData.clientIpAddress,
    user_client_user_agent: event.userData.clientUserAgent,
    event_value: event.customData?.value,
    currency: event.customData?.currency || 'USD',
    content_type: event.customData?.contentType,
    content_ids: event.customData?.contentIds,
    content_name: event.customData?.contentName,
    custom_data: event.customData,
  }).select('id').single();

  if (error) {
    console.error('Failed to queue CAPI event:', error);
    throw error;
  }

  return data.id;
}

/**
 * Send a queued CAPI event and update its status
 */
export async function sendQueuedEvent(
  eventId: string,
  client: MetaCAPIClient
): Promise<boolean> {
  // Get the queued event
  const { data: event, error: fetchError } = await supabaseAdmin
    .from('meta_capi_events')
    .select('*')
    .eq('id', eventId)
    .single();

  if (fetchError || !event) {
    console.error('Failed to fetch queued event:', fetchError);
    return false;
  }

  // Build the event payload
  const capiEvent: CAPIEvent = {
    eventName: event.event_name as CAPIEventName,
    eventTime: new Date(event.event_time),
    eventId: event.event_id,
    eventSourceUrl: event.event_source_url,
    actionSource: event.action_source as ActionSource,
    userData: {
      // Use pre-hashed values directly (they're already hashed in the DB)
      // We need to reconstruct for the client
    },
    customData: event.custom_data,
  };

  // Update attempt tracking
  await supabaseAdmin
    .from('meta_capi_events')
    .update({
      send_attempts: event.send_attempts + 1,
      last_send_attempt_at: new Date().toISOString(),
    })
    .eq('id', eventId);

  // Send to Meta
  const response = await client.sendEvent(capiEvent);

  // Update based on result
  if (response.events_received && response.events_received > 0) {
    await supabaseAdmin
      .from('meta_capi_events')
      .update({
        sent_to_meta: true,
        sent_at: new Date().toISOString(),
        meta_response: response,
        meta_events_received: response.events_received,
        meta_fbtrace_id: response.fbtrace_id,
        send_error: null,
      })
      .eq('id', eventId);
    return true;
  } else {
    await supabaseAdmin
      .from('meta_capi_events')
      .update({
        meta_response: response,
        send_error: response.error?.message || 'No events received',
      })
      .eq('id', eventId);
    return false;
  }
}

/**
 * Process all unsent CAPI events for a tenant
 */
export async function processUnsentEvents(
  tenantId: string,
  client: MetaCAPIClient,
  limit: number = 100
): Promise<{ sent: number; failed: number }> {
  const { data: events, error } = await supabaseAdmin
    .from('meta_capi_events')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('sent_to_meta', false)
    .lt('send_attempts', 5)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error || !events) {
    console.error('Failed to fetch unsent events:', error);
    return { sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;

  for (const event of events) {
    const success = await sendQueuedEvent(event.id, client);
    if (success) {
      sent++;
    } else {
      failed++;
    }
  }

  return { sent, failed };
}

/**
 * Helper to create a Lead event
 */
export function createLeadEvent(
  userData: UserData,
  options?: {
    eventSourceUrl?: string;
    adId?: string;
    contentName?: string;
  }
): CAPIEvent {
  return {
    eventName: 'Lead',
    eventTime: new Date(),
    actionSource: 'chat', // From DM conversation
    userData,
    customData: {
      contentName: options?.contentName || 'DM Qualification',
    },
    eventSourceUrl: options?.eventSourceUrl,
    adId: options?.adId,
  };
}

/**
 * Helper to create an AddToCart event (call booked)
 */
export function createAddToCartEvent(
  userData: UserData,
  options?: {
    eventSourceUrl?: string;
    adId?: string;
    value?: number;
    contentName?: string;
  }
): CAPIEvent {
  return {
    eventName: 'AddToCart',
    eventTime: new Date(),
    actionSource: 'website',
    userData,
    customData: {
      value: options?.value || 0,
      currency: 'USD',
      contentType: 'service',
      contentName: options?.contentName || 'Consultation Booking',
    },
    eventSourceUrl: options?.eventSourceUrl,
    adId: options?.adId,
  };
}

/**
 * Helper to create a Purchase event
 */
export function createPurchaseEvent(
  userData: UserData,
  value: number,
  options?: {
    eventSourceUrl?: string;
    adId?: string;
    contentName?: string;
    orderId?: string;
  }
): CAPIEvent {
  return {
    eventName: 'Purchase',
    eventTime: new Date(),
    actionSource: 'website',
    userData,
    customData: {
      value,
      currency: 'USD',
      contentType: 'service',
      contentName: options?.contentName || 'Service Purchase',
      order_id: options?.orderId,
    },
    eventSourceUrl: options?.eventSourceUrl,
    adId: options?.adId,
  };
}
