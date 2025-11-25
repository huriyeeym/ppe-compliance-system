/**
 * Camera Service
 * 
 * Business logic for camera management
 * 
 * @module lib/api/services/cameraService
 */

import { httpClient } from '../httpClient'

/**
 * Camera Entity
 */
export interface Camera {
  id: number
  name: string
  domain_id: number
  source_type: 'webcam' | 'rtsp' | 'file'
  source_uri: string
  is_active: boolean
  location?: string
  created_at: string
}

export interface CameraCreatePayload {
  name: string
  domain_id: number
  source_type: 'webcam' | 'rtsp' | 'file'
  source_uri: string
  is_active?: boolean
  location?: string
}

export interface CameraUpdatePayload {
  name?: string
  domain_id?: number
  source_type?: 'webcam' | 'rtsp' | 'file'
  source_uri?: string
  is_active?: boolean
  location?: string
}

/**
 * Camera Service
 */
export class CameraService {
  private readonly basePath = '/cameras'

  /**
   * Get all cameras
   */
  async getAll(domainId?: number): Promise<Camera[]> {
    const params = domainId ? { domain_id: domainId } : {}
    return httpClient.get<Camera[]>(this.basePath, { params })
  }

  /**
   * Get camera by ID
   */
  async getById(cameraId: number): Promise<Camera> {
    return httpClient.get<Camera>(`${this.basePath}/${cameraId}`)
  }

  /**
   * Get active cameras for a domain
   */
  async getActiveByDomain(domainId: number): Promise<Camera[]> {
    const cameras = await this.getAll(domainId)
    return cameras.filter((camera) => camera.is_active)
  }

  /**
   * Create a new camera
   */
  async create(payload: CameraCreatePayload): Promise<Camera> {
    return httpClient.post<Camera>(this.basePath, payload)
  }

  /**
   * Update a camera
   */
  async update(cameraId: number, payload: CameraUpdatePayload): Promise<Camera> {
    return httpClient.put<Camera>(`${this.basePath}/${cameraId}`, payload)
  }

  /**
   * Delete a camera
   */
  async delete(cameraId: number): Promise<void> {
    return httpClient.delete<void>(`${this.basePath}/${cameraId}`)
  }
}

// Export singleton instance
export const cameraService = new CameraService()

