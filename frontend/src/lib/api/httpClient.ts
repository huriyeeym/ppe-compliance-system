/**
 * HTTP Client
 * 
 * Centralized HTTP client configuration with interceptors
 * Handles authentication, error handling, and request/response transformation
 * 
 * @module lib/api/httpClient
 */

import axios from 'axios'
import type { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios'

/**
 * API Configuration
 */
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
const API_PREFIX = '/api/v1'
const REQUEST_TIMEOUT = 10000 // 10 seconds

/**
 * HTTP Client Class
 * 
 * Encapsulates axios instance with custom interceptors and error handling
 */
class HttpClient {
  private client: AxiosInstance

  constructor() {
    this.client = axios.create({
      baseURL: `${API_BASE_URL}${API_PREFIX}`,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      timeout: REQUEST_TIMEOUT,
    })

    this.setupInterceptors()
  }

  /**
   * Setup request and response interceptors
   */
  private setupInterceptors(): void {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        // Add authentication token if available
        const token = this.getAuthToken()
        if (token) {
          config.headers.Authorization = `Bearer ${token}`
        }

        // Log request in development
        if (import.meta.env.DEV) {
          console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url}`, {
            params: config.params,
            data: config.data,
          })
        }

        return config
      },
      (error: AxiosError) => {
        this.handleRequestError(error)
        return Promise.reject(error)
      }
    )

    // Response interceptor
    this.client.interceptors.response.use(
      (response: AxiosResponse) => {
        // Log response in development
        if (import.meta.env.DEV) {
          console.log(`[API Response] ${response.config.method?.toUpperCase()} ${response.config.url}`, {
            status: response.status,
            data: response.data,
          })
        }
        return response
      },
      (error: AxiosError) => {
        return this.handleResponseError(error)
      }
    )
  }

  /**
   * Get authentication token from storage
   */
  private getAuthToken(): string | null {
    // TODO: Implement token storage (localStorage, sessionStorage, or secure cookie)
    return localStorage.getItem('auth_token')
  }

  /**
   * Handle request errors
   */
  private handleRequestError(error: AxiosError): void {
    console.error('[API Request Error]', {
      message: error.message,
      config: error.config,
    })
  }

  /**
   * Handle response errors
   * 
   * Centralized error handling with proper error transformation
   */
  private handleResponseError(error: AxiosError): Promise<never> {
    if (!error.response) {
      // Network error or timeout
      console.error('[API Network Error]', {
        message: error.message,
        code: error.code,
      })
      
      return Promise.reject({
        type: 'NETWORK_ERROR',
        message: 'Connection error. Please check your internet connection.',
        originalError: error,
      })
    }

    const { status, data } = error.response

    // Transform backend error response
    const errorMessage = (data as any)?.detail || error.message || 'Unknown error'

    console.error('[API Response Error]', {
      status,
      message: errorMessage,
      data,
    })

    // Handle specific status codes
    switch (status) {
      case 401:
        // Unauthorized - clear token and redirect to login
        // Clear authentication data from localStorage
        localStorage.removeItem('auth_token')
        localStorage.removeItem('auth_user')
        
        // Dispatch custom event to notify AuthContext
        window.dispatchEvent(new CustomEvent('auth:logout', { detail: { reason: 'UNAUTHORIZED' } }))
        
        // Redirect to login page if not already there
        if (window.location.pathname !== '/sign-in' && window.location.pathname !== '/login') {
          // Use setTimeout to avoid navigation during error handling
          setTimeout(() => {
            window.location.href = '/sign-in'
          }, 100)
        }
        
        return Promise.reject({
          type: 'UNAUTHORIZED',
          message: 'Your session has expired. Please login again.',
          status,
        })

      case 403:
        return Promise.reject({
          type: 'FORBIDDEN',
          message: 'You do not have permission for this operation.',
          status,
        })

      case 404:
        return Promise.reject({
          type: 'NOT_FOUND',
          message: 'The requested resource was not found.',
          status,
        })
      
      case 422:
        // Validation error
        // FastAPI returns detail as array of error objects
        const validationErrors = Array.isArray((data as any)?.detail)
          ? (data as any).detail
          : []

        // Extract first error message if available
        const firstError = validationErrors[0]
        const validationMessage = firstError?.msg || errorMessage

        console.error('[Validation Error Details]', validationErrors)

        return Promise.reject({
          type: 'VALIDATION_ERROR',
          message: validationMessage,
          errors: validationErrors,
          status,
        })
      
      case 500:
        return Promise.reject({
          type: 'SERVER_ERROR',
          message: 'Server error. Please try again later.',
          status,
        })
      
      default:
        return Promise.reject({
          type: 'API_ERROR',
          message: errorMessage,
          status,
        })
    }
  }

  /**
   * Get the axios instance
   */
  public getInstance(): AxiosInstance {
    return this.client
  }

  /**
   * GET request
   */
  public async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.get<T>(url, config)
    return response.data
  }

  /**
   * POST request
   */
  public async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.post<T>(url, data, config)
    return response.data
  }

  /**
   * PUT request
   */
  public async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.put<T>(url, data, config)
    return response.data
  }

  /**
   * PATCH request
   */
  public async patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.patch<T>(url, data, config)
    return response.data
  }

  /**
   * DELETE request
   */
  public async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.delete<T>(url, config)
    return response.data
  }
}

// Export singleton instance
export const httpClient = new HttpClient()

// Export types
export type { AxiosRequestConfig, AxiosResponse, AxiosError }

