/**
 * Violation Service
 * 
 * Business logic for violation management
 * Handles violation-related API calls, statistics, and data transformation
 * 
 * @module lib/api/services/violationService
 */

import { httpClient } from '../httpClient'
import type { PaginatedResponse } from '../types'

/**
 * Violation Entity
 */
export interface Violation {
  id: number
  camera_id: number
  domain_id: number
  timestamp: string
  person_bbox: { x: number; y: number; w: number; h: number }
  detected_ppe: Array<{ type: string; confidence: number }>
  missing_ppe: Array<{ type: string; required: boolean; priority: number }>
  track_id?: number
  confidence: number
  severity: 'critical' | 'high' | 'medium' | 'low'
  status: 'open' | 'in_progress' | 'closed' | 'false_positive'
  assigned_to?: string
  notes?: string
  corrective_action?: string
  snapshot_path?: string
  frame_snapshot?: string
  acknowledged: boolean
  acknowledged_by?: string
  acknowledged_at?: string
  created_at: string
}

/**
 * Violation Statistics
 */
export interface ViolationStatistics {
  total: number
  critical: number
  high: number
  medium: number
  low: number
  by_ppe_type: Record<string, number>
  compliance_rate: number
}

/**
 * Violation Filter Parameters
 */
export interface ViolationFilters {
  domain_id?: number
  camera_id?: number
  status?: 'open' | 'in_progress' | 'closed' | 'false_positive'
  severity?: 'critical' | 'high' | 'medium' | 'low'
  missing_ppe_type?: string
  start_date?: string
  end_date?: string
  skip?: number
  limit?: number
  acknowledged?: boolean // Legacy field
}

/**
 * Violation Create Payload
 */
export interface ViolationCreatePayload {
  camera_id: number
  domain_id: number
  timestamp?: string
  person_bbox: { x: number; y: number; w: number; h: number }
  detected_ppe: Array<{ type: string; confidence: number }>
  missing_ppe: Array<{ type: string; required: boolean; priority: number }>
  confidence: number
  severity?: 'critical' | 'high' | 'medium' | 'low'
  frame_snapshot?: string
}

/**
 * Violation Update Payload
 */
export interface ViolationUpdatePayload {
  status?: 'open' | 'in_progress' | 'closed' | 'false_positive'
  assigned_to?: string
  notes?: string
  corrective_action?: string
  acknowledged?: boolean // Legacy field
  acknowledged_by?: string // Legacy field
}

/**
 * Violation Service
 * 
 * Encapsulates all violation-related API operations
 */
export class ViolationService {
  private readonly basePath = '/violations'

  /**
   * Get violations with filtering and pagination
   */
  async getAll(filters: ViolationFilters = {}): Promise<PaginatedResponse<Violation>> {
    const params: Record<string, any> = {}
    
    if (filters.domain_id) params.domain_id = filters.domain_id
    if (filters.camera_id) params.camera_id = filters.camera_id
    if (filters.status) params.status = filters.status
    if (filters.severity) params.severity = filters.severity
    if (filters.missing_ppe_type) params.missing_ppe_type = filters.missing_ppe_type
    if (filters.start_date) params.start_date = filters.start_date
    if (filters.end_date) params.end_date = filters.end_date
    if (filters.acknowledged !== undefined) params.acknowledged = filters.acknowledged
    params.skip = filters.skip || 0
    params.limit = filters.limit || 50

    return httpClient.get<PaginatedResponse<Violation>>(this.basePath, { params })
  }

  /**
   * Get violation by ID
   */
  async getById(violationId: number): Promise<Violation> {
    return httpClient.get<Violation>(`${this.basePath}/${violationId}`)
  }

  /**
   * Get violation statistics
   */
  async getStatistics(
    domainId?: number,
    startDate?: string,
    endDate?: string
  ): Promise<ViolationStatistics> {
    const params: Record<string, any> = {}
    if (domainId) params.domain_id = domainId
    if (startDate) params.start_date = startDate
    if (endDate) params.end_date = endDate

    return httpClient.get<ViolationStatistics>(`${this.basePath}/stats`, { params })
  }

  /**
   * Create a new violation
   * 
   * Typically called by ML Engine when a violation is detected
   */
  async create(payload: ViolationCreatePayload): Promise<Violation> {
    // Set default timestamp if not provided
    if (!payload.timestamp) {
      payload.timestamp = new Date().toISOString()
    }

    // Calculate severity if not provided
    if (!payload.severity) {
      payload.severity = this.calculateSeverity(payload.missing_ppe)
    }

    return httpClient.post<Violation>(this.basePath, payload)
  }

  /**
   * Update a violation
   * 
   * Typically used for acknowledgment or adding notes
   */
  async update(violationId: number, payload: ViolationUpdatePayload): Promise<Violation> {
    return httpClient.put<Violation>(`${this.basePath}/${violationId}`, payload)
  }

  /**
   * Acknowledge a violation
   */
  async acknowledge(violationId: number, acknowledgedBy?: string): Promise<Violation> {
    return this.update(violationId, {
      acknowledged: true,
      acknowledged_by: acknowledgedBy,
    })
  }

  /**
   * Calculate violation severity based on missing PPE
   * 
   * Business logic: Critical if required PPE missing, High if recommended missing
   */
  private calculateSeverity(missingPPE: Array<{ required: boolean; priority: number }>): 'critical' | 'high' | 'medium' | 'low' {
    if (missingPPE.length === 0) return 'low'

    const hasRequired = missingPPE.some((ppe) => ppe.required)
    const hasHighPriority = missingPPE.some((ppe) => ppe.priority === 1)

    if (hasRequired || hasHighPriority) return 'critical'
    if (missingPPE.length >= 2) return 'high'
    return 'medium'
  }
}

// Export singleton instance
export const violationService = new ViolationService()

