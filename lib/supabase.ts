import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Admin client for server-side operations
export const supabaseAdmin = createClient(
  supabaseUrl,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Database types (to be extended as needed)
export interface Database {
  public: {
    Tables: {
      webhook_logs: {
        Row: {
          id: string;
          payload: Record<string, unknown>;
          signature: string | null;
          received_at: string;
          source: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          payload: Record<string, unknown>;
          signature?: string | null;
          received_at: string;
          source: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          payload?: Record<string, unknown>;
          signature?: string | null;
          received_at?: string;
          source?: string;
          created_at?: string;
        };
      };
      conversation_logs: {
        Row: {
          id: string;
          user_id: string;
          message: string;
          response: string;
          tokens_used: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          message: string;
          response: string;
          tokens_used: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          message?: string;
          response?: string;
          tokens_used?: number;
          created_at?: string;
        };
      };
      contacts: {
        Row: {
          mcid: string;
          channel: 'ig' | 'fb' | null;
          name: string | null;
          username: string | null;
          email: string | null;
          phone: string | null;
          stage: 'new' | 'lead' | 'qualified' | 'booked' | 'attended' | 'purchased' | 'disqualified' | 'archived';
          tags: any[];
          ab_variant: string | null;
          acquisition_source: 'organic' | 'paid' | null;
          trigger_tag: string | null;
          conversation_history: any[];
          last_ai_response: string | null;
          total_messages: number;
          dm_started_at: string | null;
          lead_captured_at: string | null;
          booking_shown_at: string | null;
          booking_clicked_at: string | null;
          booked_at: string | null;
          attended_at: string | null;
          purchased_at: string | null;
          symptoms: string | null;
          months_postpartum: number | null;
          objections_json: any | null;
          last_igfb_interaction_at: string | null;
          last_mc_interaction_at: string | null;
          purchase_amount_cents: number | null;
          currency: string;
          attribution_json: any | null;
          custom_json: any | null;
          created_at: string;
          updated_at: string;
          archived_at: string | null;
        };
        Insert: {
          mcid: string;
          channel?: 'ig' | 'fb' | null;
          name?: string | null;
          username?: string | null;
          email?: string | null;
          phone?: string | null;
          stage?: 'new' | 'lead' | 'qualified' | 'booked' | 'attended' | 'purchased' | 'disqualified' | 'archived';
          tags?: any[];
          ab_variant?: string | null;
          acquisition_source?: 'organic' | 'paid' | null;
          trigger_tag?: string | null;
          conversation_history?: any[];
          last_ai_response?: string | null;
          total_messages?: number;
          dm_started_at?: string | null;
          lead_captured_at?: string | null;
          booking_shown_at?: string | null;
          booking_clicked_at?: string | null;
          booked_at?: string | null;
          attended_at?: string | null;
          purchased_at?: string | null;
          symptoms?: string | null;
          months_postpartum?: number | null;
          objections_json?: any | null;
          last_igfb_interaction_at?: string | null;
          last_mc_interaction_at?: string | null;
          purchase_amount_cents?: number | null;
          currency?: string;
          attribution_json?: any | null;
          custom_json?: any | null;
          created_at?: string;
          updated_at?: string;
          archived_at?: string | null;
        };
        Update: {
          mcid?: string;
          channel?: 'ig' | 'fb' | null;
          name?: string | null;
          username?: string | null;
          email?: string | null;
          phone?: string | null;
          stage?: 'new' | 'lead' | 'qualified' | 'booked' | 'attended' | 'purchased' | 'disqualified' | 'archived';
          tags?: any[];
          ab_variant?: string | null;
          acquisition_source?: 'organic' | 'paid' | null;
          trigger_tag?: string | null;
          conversation_history?: any[];
          last_ai_response?: string | null;
          total_messages?: number;
          dm_started_at?: string | null;
          lead_captured_at?: string | null;
          booking_shown_at?: string | null;
          booking_clicked_at?: string | null;
          booked_at?: string | null;
          attended_at?: string | null;
          purchased_at?: string | null;
          symptoms?: string | null;
          months_postpartum?: number | null;
          objections_json?: any | null;
          last_igfb_interaction_at?: string | null;
          last_mc_interaction_at?: string | null;
          purchase_amount_cents?: number | null;
          currency?: string;
          attribution_json?: any | null;
          custom_json?: any | null;
          created_at?: string;
          updated_at?: string;
          archived_at?: string | null;
        };
      };
    };
  };
}