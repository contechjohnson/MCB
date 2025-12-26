/**
 * GoHighLevel API Client
 *
 * Provides READ-ONLY operations for GHL:
 * - List pipelines and stages
 * - Search opportunities by pipeline/stage
 * - Get opportunity counts
 *
 * For WRITE operations (contact updates, etc.), use GHL webhooks.
 */

import { TenantContext } from '@/lib/tenant-context';

// GHL API base URL
const GHL_API_BASE = 'https://services.leadconnectorhq.com';

/**
 * GHL API response wrapper
 */
interface GHLResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Pipeline stage from GHL
 */
export interface GHLStage {
  id: string;
  name: string;
  position?: number;
}

/**
 * Pipeline from GHL
 */
export interface GHLPipeline {
  id: string;
  name: string;
  stages: GHLStage[];
  locationId: string;
}

/**
 * Contact info from opportunity
 */
export interface GHLContact {
  id: string;
  name: string;
  email?: string;
  phone?: string;
}

/**
 * Opportunity from GHL
 */
export interface GHLOpportunity {
  id: string;
  name: string;
  pipelineId: string;
  pipelineStageId: string;
  status: string;
  contact?: GHLContact;
  monetaryValue?: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Search filters for opportunities
 */
export interface OpportunitySearchFilters {
  pipelineId?: string;
  pipelineStageId?: string;
  status?: 'open' | 'won' | 'lost' | 'abandoned' | 'all';
  startDate?: string; // mm-dd-yyyy format for GHL
  endDate?: string;   // mm-dd-yyyy format for GHL
  limit?: number;
  page?: number;
}

/**
 * GHL API Client for a specific tenant
 */
export class GHLClient {
  private locationId: string;
  private apiKey: string;

  constructor(credentials: { location_id: string; api_key: string }) {
    if (!credentials.location_id || !credentials.api_key) {
      throw new Error('GHL location_id and api_key are required');
    }
    this.locationId = credentials.location_id;
    this.apiKey = credentials.api_key;
  }

  /**
   * Create a GHL client from tenant context
   */
  static fromTenant(tenant: TenantContext): GHLClient | null {
    const creds = tenant.credentials?.ghl;
    if (!creds?.location_id || !creds?.api_key) {
      console.error(`GHL not configured for tenant: ${tenant.slug}`);
      return null;
    }
    return new GHLClient(creds);
  }

  /**
   * Make an authenticated API request to GHL
   */
  private async request<T>(
    endpoint: string,
    method: 'GET' | 'POST' = 'GET',
    body?: any
  ): Promise<GHLResponse<T>> {
    try {
      const url = new URL(`${GHL_API_BASE}${endpoint}`);

      const response = await fetch(url.toString(), {
        method,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Version: '2021-07-28', // GHL API version
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('GHL API error:', response.status, data);
        return {
          success: false,
          error: data.message || data.error || `HTTP ${response.status}`,
        };
      }

      return { success: true, data };
    } catch (error) {
      console.error('GHL request failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get all pipelines with their stages
   */
  async getPipelines(): Promise<GHLResponse<GHLPipeline[]>> {
    const result = await this.request<{ pipelines: any[] }>(
      `/opportunities/pipelines?locationId=${this.locationId}`
    );

    if (result.success && result.data) {
      // Normalize the pipeline data
      const pipelines: GHLPipeline[] = result.data.pipelines.map((p: any) => ({
        id: p.id,
        name: p.name,
        locationId: p.locationId,
        stages: (p.stages || []).map((s: any, idx: number) => ({
          id: s.id,
          name: s.name,
          position: s.position ?? idx,
        })),
      }));
      return { success: true, data: pipelines };
    }
    return { success: false, error: result.error };
  }

  /**
   * Search opportunities with filters
   */
  async searchOpportunities(
    filters: OpportunitySearchFilters = {}
  ): Promise<GHLResponse<GHLOpportunity[]>> {
    const params = new URLSearchParams();
    params.set('location_id', this.locationId);

    if (filters.pipelineId) params.set('pipeline_id', filters.pipelineId);
    if (filters.pipelineStageId) params.set('pipeline_stage_id', filters.pipelineStageId);
    if (filters.status) params.set('status', filters.status);
    if (filters.startDate) params.set('date', filters.startDate);
    if (filters.endDate) params.set('endDate', filters.endDate);
    if (filters.limit) params.set('limit', String(Math.min(filters.limit, 100)));
    if (filters.page) params.set('page', String(filters.page));

    const result = await this.request<{ opportunities: any[]; meta?: any }>(
      `/opportunities/search?${params.toString()}`
    );

    if (result.success && result.data) {
      const opportunities: GHLOpportunity[] = result.data.opportunities.map((o: any) => ({
        id: o.id,
        name: o.name,
        pipelineId: o.pipelineId,
        pipelineStageId: o.pipelineStageId,
        status: o.status,
        contact: o.contact
          ? {
              id: o.contact.id,
              name: o.contact.name,
              email: o.contact.email,
              phone: o.contact.phone,
            }
          : undefined,
        monetaryValue: o.monetaryValue,
        createdAt: o.createdAt,
        updatedAt: o.updatedAt,
      }));
      return { success: true, data: opportunities };
    }
    return { success: false, error: result.error };
  }

  /**
   * Count opportunities in a specific pipeline stage
   * Fetches all pages to get accurate count
   */
  async countInStage(
    pipelineId: string,
    stageId: string,
    dateRange?: { start: string; end: string }
  ): Promise<GHLResponse<number>> {
    let total = 0;
    let page = 1;
    const limit = 100;

    while (true) {
      const filters: OpportunitySearchFilters = {
        pipelineId,
        pipelineStageId: stageId,
        status: 'all',
        limit,
        page,
      };

      if (dateRange) {
        filters.startDate = dateRange.start;
        filters.endDate = dateRange.end;
      }

      const result = await this.searchOpportunities(filters);

      if (!result.success) {
        return { success: false, error: result.error };
      }

      const opportunities = result.data || [];
      total += opportunities.length;

      // If we got less than limit, we've reached the end
      if (opportunities.length < limit) {
        break;
      }

      page++;

      // Safety limit to prevent infinite loops
      if (page > 100) {
        console.warn('GHL: Hit page limit of 100, count may be incomplete');
        break;
      }
    }

    return { success: true, data: total };
  }

  /**
   * Get location ID for this client
   */
  getLocationId(): string {
    return this.locationId;
  }
}
