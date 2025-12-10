/**
 * ManyChat API Client
 *
 * Provides write operations for ManyChat:
 * - Set custom field values on subscribers
 * - Trigger flows to send messages
 *
 * Read operations are handled directly by webhooks receiving data from ManyChat.
 */

import { TenantContext } from '@/lib/tenant-context';

// ManyChat API base URL
const MANYCHAT_API_BASE = 'https://api.manychat.com/fb';

/**
 * ManyChat API response wrapper
 */
interface ManyChatResponse<T = any> {
  status: 'success' | 'error';
  data?: T;
  error?: string;
}

/**
 * Custom field update payload
 */
interface CustomFieldUpdate {
  field_id: number;
  field_value: string | number | boolean | null;
}

/**
 * Subscriber info from ManyChat
 */
interface ManyChatSubscriber {
  id: string;
  name: string;
  first_name: string;
  last_name: string;
  gender: string;
  profile_pic: string;
  locale: string;
  language: string;
  timezone: string;
  live_chat_url: string;
  last_seen: string;
  custom_fields: Record<string, any>;
  tags: Array<{ id: number; name: string }>;
}

/**
 * ManyChat Client for a specific tenant
 */
export class ManyChatClient {
  private apiKey: string;
  private pageId?: string;

  constructor(credentials: { api_key: string; page_id?: string }) {
    if (!credentials.api_key) {
      throw new Error('ManyChat API key is required');
    }
    this.apiKey = credentials.api_key;
    this.pageId = credentials.page_id;
  }

  /**
   * Create a ManyChat client from tenant context
   */
  static fromTenant(tenant: TenantContext): ManyChatClient | null {
    const creds = tenant.credentials?.manychat;
    if (!creds?.api_key) {
      console.error(`ManyChat not configured for tenant: ${tenant.slug}`);
      return null;
    }
    return new ManyChatClient(creds);
  }

  /**
   * Make an authenticated API request to ManyChat
   */
  private async request<T>(
    endpoint: string,
    method: 'GET' | 'POST' = 'GET',
    body?: any
  ): Promise<ManyChatResponse<T>> {
    try {
      const response = await fetch(`${MANYCHAT_API_BASE}${endpoint}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('ManyChat API error:', response.status, data);
        return {
          status: 'error',
          error: data.details?.messages?.[0] || data.message || `HTTP ${response.status}`,
        };
      }

      return { status: 'success', data };
    } catch (error) {
      console.error('ManyChat request failed:', error);
      return {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get subscriber info by subscriber ID
   */
  async getSubscriber(subscriberId: string): Promise<ManyChatResponse<ManyChatSubscriber>> {
    return this.request<ManyChatSubscriber>(
      `/subscriber/getInfo?subscriber_id=${subscriberId}`
    );
  }

  /**
   * Get subscriber info by user reference (external ID)
   */
  async getSubscriberByRef(userRef: string): Promise<ManyChatResponse<ManyChatSubscriber>> {
    return this.request<ManyChatSubscriber>(
      `/subscriber/getInfoByUserRef?user_ref=${userRef}`
    );
  }

  /**
   * Set a single custom field on a subscriber
   *
   * @param subscriberId - ManyChat subscriber ID
   * @param fieldId - Custom field ID (number)
   * @param value - Value to set
   */
  async setCustomField(
    subscriberId: string,
    fieldId: number,
    value: string | number | boolean | null
  ): Promise<ManyChatResponse> {
    return this.request('/subscriber/setCustomField', 'POST', {
      subscriber_id: subscriberId,
      field_id: fieldId,
      field_value: value,
    });
  }

  /**
   * Set multiple custom fields on a subscriber in one call
   *
   * @param subscriberId - ManyChat subscriber ID
   * @param fields - Array of field updates [{field_id, field_value}]
   */
  async setCustomFields(
    subscriberId: string,
    fields: CustomFieldUpdate[]
  ): Promise<ManyChatResponse> {
    return this.request('/subscriber/setCustomFields', 'POST', {
      subscriber_id: subscriberId,
      fields,
    });
  }

  /**
   * Set a custom field by field name (looks up ID automatically)
   * Note: This requires knowing the field name to ID mapping
   *
   * @param subscriberId - ManyChat subscriber ID
   * @param fieldName - Custom field name
   * @param value - Value to set
   */
  async setCustomFieldByName(
    subscriberId: string,
    fieldName: string,
    value: string | number | boolean | null
  ): Promise<ManyChatResponse> {
    return this.request('/subscriber/setCustomFieldByName', 'POST', {
      subscriber_id: subscriberId,
      field_name: fieldName,
      field_value: value,
    });
  }

  /**
   * Send a flow to a subscriber
   *
   * @param subscriberId - ManyChat subscriber ID
   * @param flowNs - Flow namespace (from flow settings in ManyChat)
   */
  async sendFlow(subscriberId: string, flowNs: string): Promise<ManyChatResponse> {
    return this.request('/sending/sendFlow', 'POST', {
      subscriber_id: subscriberId,
      flow_ns: flowNs,
    });
  }

  /**
   * Send content to a subscriber (direct message)
   *
   * @param subscriberId - ManyChat subscriber ID
   * @param data - Message content object
   * @param messageTag - Optional tag for sending outside 24h window
   */
  async sendContent(
    subscriberId: string,
    data: {
      version: string;
      content: {
        messages: Array<{
          type: string;
          text?: string;
          buttons?: Array<{
            type: string;
            caption: string;
            url?: string;
            actions?: any[];
          }>;
        }>;
        actions?: any[];
        quick_replies?: any[];
      };
    },
    messageTag?: string
  ): Promise<ManyChatResponse> {
    const payload: any = {
      subscriber_id: subscriberId,
      data,
    };

    if (messageTag) {
      payload.message_tag = messageTag;
    }

    return this.request('/sending/sendContent', 'POST', payload);
  }

  /**
   * Add a tag to a subscriber
   */
  async addTag(subscriberId: string, tagId: number): Promise<ManyChatResponse> {
    return this.request('/subscriber/addTag', 'POST', {
      subscriber_id: subscriberId,
      tag_id: tagId,
    });
  }

  /**
   * Remove a tag from a subscriber
   */
  async removeTag(subscriberId: string, tagId: number): Promise<ManyChatResponse> {
    return this.request('/subscriber/removeTag', 'POST', {
      subscriber_id: subscriberId,
      tag_id: tagId,
    });
  }

  /**
   * Add a tag by name (ManyChat will create if doesn't exist)
   */
  async addTagByName(subscriberId: string, tagName: string): Promise<ManyChatResponse> {
    return this.request('/subscriber/addTagByName', 'POST', {
      subscriber_id: subscriberId,
      tag_name: tagName,
    });
  }

  /**
   * Remove a tag by name
   */
  async removeTagByName(subscriberId: string, tagName: string): Promise<ManyChatResponse> {
    return this.request('/subscriber/removeTagByName', 'POST', {
      subscriber_id: subscriberId,
      tag_name: tagName,
    });
  }
}

/**
 * Common ManyChat field IDs for PPCU
 * (These should be moved to tenant config eventually)
 */
export const PPCU_FIELD_IDS = {
  // Conversation tracking
  CONVERSATION_ID: 10952877, // 'Conversation ID' - OpenAI thread ID
  CODY_RESPONSE: 10953166, // 'Cody > Response' - AI response text

  // Lead qualification
  SYMPTOMS: 10929875, // 'Symptoms' - extracted symptoms
  MONTHS_POSTPARTUM: 10929876, // 'Months Postpartum' - extracted value

  // Intent flags
  INTENDING_TO_SEND_LINK: 10950605, // boolean
  INTEND_TO_SEND_PDF: 10953167, // boolean
  INTEND_TO_SEND_LEAD_MAGNET: 10953168, // boolean
  ALREADY_BOOKED: 10953169, // boolean

  // Contact info
  EMAIL: 10953170, // captured email

  // A/B test
  CHATBOT_AB: 10950604, // 'chatbot_AB' - 'A' or 'B'

  // Conversation state
  HANDLED_OBJECTIONS: 10953171, // list of handled objections
} as const;

/**
 * Common ManyChat flow IDs for PPCU
 * (These should be moved to tenant config eventually)
 */
export const PPCU_FLOW_IDS = {
  // Response flows
  SEND_AI_RESPONSE: 'content20241201_123456', // Flow to send AI response
  SEND_BOOKING_LINK: 'content20241201_booking', // Flow to send booking link
  SEND_PDF: 'content20241201_pdf', // Flow to send PDF

  // Qualification flows
  QUALIFIED_LEAD: 'content20241201_qualified', // Triggered when lead qualifies
} as const;

/**
 * Helper to batch update chatbot response fields
 */
export async function updateChatbotFields(
  client: ManyChatClient,
  subscriberId: string,
  response: {
    aiResponse: string;
    symptoms?: string;
    monthsPostpartum?: string;
    handledObjections?: string;
    intendingToSendLink?: boolean;
    intendToSendPdf?: boolean;
    intendToSendLeadMagnet?: boolean;
    alreadyBooked?: boolean;
    email?: string;
  }
): Promise<ManyChatResponse> {
  const fields: CustomFieldUpdate[] = [
    { field_id: PPCU_FIELD_IDS.CODY_RESPONSE, field_value: response.aiResponse },
  ];

  if (response.symptoms !== undefined) {
    fields.push({ field_id: PPCU_FIELD_IDS.SYMPTOMS, field_value: response.symptoms });
  }
  if (response.monthsPostpartum !== undefined) {
    fields.push({
      field_id: PPCU_FIELD_IDS.MONTHS_POSTPARTUM,
      field_value: response.monthsPostpartum,
    });
  }
  if (response.handledObjections !== undefined) {
    fields.push({
      field_id: PPCU_FIELD_IDS.HANDLED_OBJECTIONS,
      field_value: response.handledObjections,
    });
  }
  if (response.intendingToSendLink !== undefined) {
    fields.push({
      field_id: PPCU_FIELD_IDS.INTENDING_TO_SEND_LINK,
      field_value: response.intendingToSendLink,
    });
  }
  if (response.intendToSendPdf !== undefined) {
    fields.push({
      field_id: PPCU_FIELD_IDS.INTEND_TO_SEND_PDF,
      field_value: response.intendToSendPdf,
    });
  }
  if (response.intendToSendLeadMagnet !== undefined) {
    fields.push({
      field_id: PPCU_FIELD_IDS.INTEND_TO_SEND_LEAD_MAGNET,
      field_value: response.intendToSendLeadMagnet,
    });
  }
  if (response.alreadyBooked !== undefined) {
    fields.push({ field_id: PPCU_FIELD_IDS.ALREADY_BOOKED, field_value: response.alreadyBooked });
  }
  if (response.email !== undefined) {
    fields.push({ field_id: PPCU_FIELD_IDS.EMAIL, field_value: response.email });
  }

  return client.setCustomFields(subscriberId, fields);
}
