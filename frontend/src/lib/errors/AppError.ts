/**
 * Application Error Classes
 * 
 * Custom error classes for better error handling and type safety
 * 
 * @module lib/errors/AppError
 */

/**
 * Base Application Error
 */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode?: number,
    public readonly originalError?: unknown
  ) {
    super(message)
    this.name = this.constructor.name
    const capture = (Error as ErrorConstructor as any).captureStackTrace as
      | ((targetObject: Error, constructorOpt: Function) => void)
      | undefined
    if (capture) {
      capture(this, this.constructor)
    } else {
      this.stack = new Error(message).stack
    }
  }
}

/**
 * Network Error
 */
export class NetworkError extends AppError {
  constructor(message = 'Network connection error', originalError?: unknown) {
    super(message, 'NETWORK_ERROR', undefined, originalError)
  }
}

/**
 * API Error
 */
export class ApiError extends AppError {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly errors?: Array<{ field: string; message: string }>,
    originalError?: unknown
  ) {
    super(message, 'API_ERROR', statusCode, originalError)
  }
}

/**
 * Validation Error
 */
export class ValidationError extends AppError {
  constructor(
    message: string,
    public readonly errors: Array<{ field: string; message: string }>
  ) {
    super(message, 'VALIDATION_ERROR', 422)
  }
}

/**
 * Not Found Error
 */
export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', originalError?: unknown) {
    super(message, 'NOT_FOUND', 404, originalError)
  }
}

/**
 * Unauthorized Error
 */
export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized access', originalError?: unknown) {
    super(message, 'UNAUTHORIZED', 401, originalError)
  }
}

