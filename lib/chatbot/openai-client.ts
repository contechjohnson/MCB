/**
 * OpenAI Chat Completions Client
 *
 * Wraps OpenAI API for chatbot conversations.
 * Uses Chat Completions (not Assistants API) for simpler prompt management.
 * Prompts are stored in MCB database, not in OpenAI platform.
 */

import OpenAI from 'openai';
import { supabaseAdmin } from '@/lib/tenant-context';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Chatbot configuration from database
 */
export interface ChatbotConfig {
  id: string;
  tenant_id: string;
  config_name: string;
  system_prompt: string;
  model: string;
  temperature: number;
  max_tokens: number;
  response_schema: Record<string, string>;
  response_flow_id: string;
  welcome_flow_id?: string;
  ab_test_field: string;
  ab_test_value?: string;
}

/**
 * Conversation thread from database
 */
export interface ConversationThread {
  id: string;
  tenant_id: string;
  contact_id?: string;
  mc_id: string;
  openai_thread_id?: string;
  chatbot_config_id?: string;
  status: 'active' | 'closed' | 'escalated' | 'paused';
  message_count: number;
  last_user_message?: string;
  last_bot_response?: string;
  last_interaction_at: string;
  extracted_symptoms?: string[];
  extracted_months_postpartum?: string;
  extracted_email?: string;
  extracted_objections?: string[];
  booking_intent: boolean;
  link_sent: boolean;
  pdf_sent: boolean;
  lead_magnet_sent: boolean;
  already_booked: boolean;
  recent_messages: Array<{ role: string; content: string }>;
}

/**
 * Expected JSON response structure from AI
 */
export interface ChatbotResponse {
  response: string;
  symptoms: string;
  months_postpartum: string;
  handled_objections: string;
  intending_to_send_link: boolean;
  intend_to_send_pdf: boolean;
  intend_to_send_lead_magnet: boolean;
  already_booked: boolean;
  email: string;
}

/**
 * Get chatbot config by A/B test routing
 */
export async function getChatbotConfig(
  tenantId: string,
  abTestValue?: string
): Promise<ChatbotConfig | null> {
  let query = supabaseAdmin
    .from('chatbot_configs')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_active', true);

  // If A/B test value provided, find matching config
  if (abTestValue) {
    query = query.eq('ab_test_value', abTestValue);
  } else {
    // Otherwise get the default config
    query = query.eq('is_default', true);
  }

  const { data, error } = await query.single();

  if (error) {
    // If no match for A/B value, fall back to default
    if (abTestValue) {
      const { data: defaultConfig } = await supabaseAdmin
        .from('chatbot_configs')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .eq('is_default', true)
        .single();
      return defaultConfig;
    }
    console.error('Failed to get chatbot config:', error);
    return null;
  }

  return data;
}

/**
 * Get or create conversation thread for a subscriber
 */
export async function getOrCreateThread(
  tenantId: string,
  mcId: string,
  configId?: string
): Promise<ConversationThread> {
  // Try to find existing thread
  const { data: existing } = await supabaseAdmin
    .from('conversation_threads')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('mc_id', mcId)
    .single();

  if (existing) {
    // Update config if changed
    if (configId && existing.chatbot_config_id !== configId) {
      await supabaseAdmin
        .from('conversation_threads')
        .update({ chatbot_config_id: configId })
        .eq('id', existing.id);
    }
    return existing;
  }

  // Create new thread
  const { data: newThread, error } = await supabaseAdmin
    .from('conversation_threads')
    .insert({
      tenant_id: tenantId,
      mc_id: mcId,
      chatbot_config_id: configId,
      recent_messages: [],
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to create conversation thread:', error);
    throw error;
  }

  return newThread;
}

/**
 * Update thread with new message and response
 */
export async function updateThread(
  threadId: string,
  userMessage: string,
  botResponse: string,
  parsedResponse: Partial<ChatbotResponse>,
  recentMessages: Array<{ role: string; content: string }>
): Promise<void> {
  const updates: Record<string, any> = {
    last_user_message: userMessage,
    last_bot_response: botResponse,
    last_interaction_at: new Date().toISOString(),
    recent_messages: recentMessages,
    message_count: supabaseAdmin.rpc('increment', { x: 1 }), // Will need to use raw SQL or fetch+update
  };

  // Update extracted fields if present
  if (parsedResponse.symptoms) {
    updates.extracted_symptoms = parsedResponse.symptoms
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (parsedResponse.months_postpartum) {
    updates.extracted_months_postpartum = parsedResponse.months_postpartum;
  }
  if (parsedResponse.email) {
    updates.extracted_email = parsedResponse.email;
  }
  if (parsedResponse.handled_objections) {
    updates.extracted_objections = parsedResponse.handled_objections
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  // Update intent flags
  if (parsedResponse.intending_to_send_link !== undefined) {
    updates.link_sent = parsedResponse.intending_to_send_link;
    if (parsedResponse.intending_to_send_link) {
      updates.booking_intent = true;
    }
  }
  if (parsedResponse.intend_to_send_pdf !== undefined) {
    updates.pdf_sent = parsedResponse.intend_to_send_pdf;
  }
  if (parsedResponse.intend_to_send_lead_magnet !== undefined) {
    updates.lead_magnet_sent = parsedResponse.intend_to_send_lead_magnet;
  }
  if (parsedResponse.already_booked !== undefined) {
    updates.already_booked = parsedResponse.already_booked;
  }

  // Get current message count and increment
  const { data: thread } = await supabaseAdmin
    .from('conversation_threads')
    .select('message_count')
    .eq('id', threadId)
    .single();

  updates.message_count = (thread?.message_count || 0) + 1;

  await supabaseAdmin.from('conversation_threads').update(updates).eq('id', threadId);
}

/**
 * Call OpenAI Chat Completions with conversation context
 */
export async function generateChatResponse(
  config: ChatbotConfig,
  thread: ConversationThread,
  userMessage: string
): Promise<{ response: ChatbotResponse; rawResponse: string }> {
  // Build messages array
  const messages: OpenAI.ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content: config.system_prompt,
    },
    // Include recent conversation history
    ...thread.recent_messages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    // Add new user message
    {
      role: 'user',
      content: userMessage,
    },
  ];

  try {
    const completion = await openai.chat.completions.create({
      model: config.model || 'gpt-4o',
      messages,
      temperature: config.temperature || 0.7,
      max_tokens: config.max_tokens || 1000,
      response_format: { type: 'json_object' },
    });

    const rawResponse = completion.choices[0]?.message?.content || '{}';

    // Parse JSON response
    let parsedResponse: ChatbotResponse;
    try {
      parsedResponse = JSON.parse(rawResponse);
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', rawResponse);
      // Return a fallback response
      parsedResponse = {
        response:
          rawResponse ||
          "I apologize, but I'm having trouble responding right now. Could you try again?",
        symptoms: '',
        months_postpartum: '',
        handled_objections: '',
        intending_to_send_link: false,
        intend_to_send_pdf: false,
        intend_to_send_lead_magnet: false,
        already_booked: false,
        email: '',
      };
    }

    // Ensure all required fields exist
    const response: ChatbotResponse = {
      response: parsedResponse.response || '',
      symptoms: parsedResponse.symptoms || '',
      months_postpartum: parsedResponse.months_postpartum || '',
      handled_objections: parsedResponse.handled_objections || '',
      intending_to_send_link: Boolean(parsedResponse.intending_to_send_link),
      intend_to_send_pdf: Boolean(parsedResponse.intend_to_send_pdf),
      intend_to_send_lead_magnet: Boolean(parsedResponse.intend_to_send_lead_magnet),
      already_booked: Boolean(parsedResponse.already_booked),
      email: parsedResponse.email || '',
    };

    return { response, rawResponse };
  } catch (error) {
    console.error('OpenAI API error:', error);
    throw error;
  }
}

/**
 * Build updated recent_messages array (keep last N messages)
 */
export function buildRecentMessages(
  current: Array<{ role: string; content: string }>,
  userMessage: string,
  botResponse: string,
  maxMessages: number = 10
): Array<{ role: string; content: string }> {
  const updated = [
    ...current,
    { role: 'user', content: userMessage },
    { role: 'assistant', content: botResponse },
  ];

  // Keep only the last N messages (pairs of user/assistant)
  if (updated.length > maxMessages * 2) {
    return updated.slice(-maxMessages * 2);
  }

  return updated;
}

/**
 * Full chatbot conversation handler
 *
 * This is the main entry point for processing a chatbot message:
 * 1. Get chatbot config (with A/B routing)
 * 2. Get or create conversation thread
 * 3. Generate AI response
 * 4. Update thread with new context
 * 5. Return response and config for ManyChat actions
 */
export async function processChatbotMessage(
  tenantId: string,
  mcId: string,
  userMessage: string,
  abTestValue?: string
): Promise<{
  response: ChatbotResponse;
  config: ChatbotConfig;
  thread: ConversationThread;
  isNewThread: boolean;
}> {
  // Get chatbot config
  const config = await getChatbotConfig(tenantId, abTestValue);
  if (!config) {
    throw new Error(`No chatbot config found for tenant: ${tenantId}`);
  }

  // Get or create thread
  const existingThread = await supabaseAdmin
    .from('conversation_threads')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('mc_id', mcId)
    .single();

  const isNewThread = !existingThread.data;
  const thread = await getOrCreateThread(tenantId, mcId, config.id);

  // Generate response
  const { response, rawResponse } = await generateChatResponse(config, thread, userMessage);

  // Update thread
  const updatedMessages = buildRecentMessages(
    thread.recent_messages,
    userMessage,
    response.response
  );
  await updateThread(thread.id, userMessage, response.response, response, updatedMessages);

  // Update config metrics
  await supabaseAdmin
    .from('chatbot_configs')
    .update({
      total_messages: config.total_messages + 1,
      ...(response.intending_to_send_link && {
        total_qualifications: config.total_qualifications + 1,
      }),
    })
    .eq('id', config.id);

  return {
    response,
    config,
    thread: {
      ...thread,
      recent_messages: updatedMessages,
      last_user_message: userMessage,
      last_bot_response: response.response,
    },
    isNewThread,
  };
}

/**
 * Increment config booking count (called when booking is confirmed)
 */
export async function incrementBookingCount(configId: string): Promise<void> {
  const { data: config } = await supabaseAdmin
    .from('chatbot_configs')
    .select('total_bookings')
    .eq('id', configId)
    .single();

  await supabaseAdmin
    .from('chatbot_configs')
    .update({ total_bookings: (config?.total_bookings || 0) + 1 })
    .eq('id', configId);
}
