/**
 * Domain Service
 * 
 * Business logic for domain management
 * Handles domain-related API calls and data transformation
 * 
 * @module lib/api/services/domainService
 */

import { httpClient } from '../httpClient'

/**
 * Domain Entity
 */
export interface Domain {
  id: number
  name: string
  type: string
  icon: string
  description: string
  status: 'active' | 'planned'
  created_at: string
}

/**
 * Domain create/update payloads
 */
export interface DomainCreatePayload {
  name: string
  type: string
  icon?: string
  description?: string
  status?: 'active' | 'planned'
}

export interface DomainUpdatePayload {
  name?: string
  type?: string
  icon?: string
  description?: string
  status?: 'active' | 'planned'
}

/**
 * Domain PPE Rule response
 */
export interface DomainRule {
  id: number
  domain_id: number
  ppe_type_id: number
  is_required: boolean
  priority: number
  warning_message?: string
  created_at: string
}

/**
 * Domain Service
 * 
 * Encapsulates all domain-related API operations
 */
export class DomainService {
  private readonly basePath = '/domains'

  /**
   * Get all domains
   */
  async getAll(skip = 0, limit = 100): Promise<Domain[]> {
    return httpClient.get<Domain[]>(this.basePath, {
      params: { skip, limit },
    })
  }

  /**
   * Get active domains only
   */
  async getActive(): Promise<Domain[]> {
    const domains = await this.getAll()
    return domains.filter((domain) => domain.status === 'active')
  }

  /**
   * Get domain by ID
   */
  async getById(domainId: number): Promise<Domain> {
    return httpClient.get<Domain>(`${this.basePath}/${domainId}`)
  }

  /**
   * Get domain by type (e.g., 'construction', 'manufacturing')
   */
  async getByType(type: string): Promise<Domain | null> {
    const domains = await this.getAll()
    return domains.find((domain) => domain.type === type) || null
  }

  /**
   * Get PPE rules for a domain
   */
  async getRules(domainId: number): Promise<DomainRule[]> {
    return httpClient.get<DomainRule[]>(`${this.basePath}/${domainId}/rules`)
  }

  /**
   * Create a new domain
   */
  async create(payload: DomainCreatePayload): Promise<Domain> {
    return httpClient.post<Domain>(this.basePath, payload)
  }

  /**
   * Update a domain
   */
  async update(domainId: number, payload: DomainUpdatePayload): Promise<Domain> {
    return httpClient.put<Domain>(`${this.basePath}/${domainId}`, payload)
  }

  /**
   * Delete a domain
   */
  async delete(domainId: number): Promise<void> {
    return httpClient.delete<void>(`${this.basePath}/${domainId}`)
  }

  /**
   * Create a PPE rule for a domain
   */
  async createRule(domainId: number, payload: Omit<DomainRule, 'id' | 'created_at'>): Promise<DomainRule> {
    return httpClient.post<DomainRule>(`${this.basePath}/${domainId}/rules`, payload)
  }
}

// Export singleton instance
export const domainService = new DomainService()

