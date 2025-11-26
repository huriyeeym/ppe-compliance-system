/**
 * API Types
 * 
 * Shared types and interfaces for API communication
 * 
 * @module lib/api/types
 */

/**
 * Standard API Error Response
 */
export interface ApiError {
  type: 'NETWORK_ERROR' | 'UNAUTHORIZED' | 'FORBIDDEN' | 'NOT_FOUND' | 'VALIDATION_ERROR' | 'SERVER_ERROR' | 'API_ERROR'
  message: string
  status?: number
  errors?: ValidationError[]
  originalError?: unknown
}

/**
 * Validation Error
 */
export interface ValidationError {
  field: string
  message: string
}

/**
 * Paginated Response
 */
export interface PaginatedResponse<T> {
  total: number
  skip: number
  limit: number
  items: T[]
}

/**
 * API Response Wrapper
 */
export interface ApiResponse<T> {
  data: T
  message?: string
  success: boolean
}

