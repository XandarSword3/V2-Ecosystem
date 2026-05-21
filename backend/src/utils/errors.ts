/**
 * Structured Error Classes for V2 Ecosystem Backend
 * 
 * Provides a hierarchy of typed errors that the global error handler
 * can distinguish between operational errors (expected, safe to expose)
 * and programmer errors (bugs, should not expose details).
 */

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    statusCode: number,
    code: string,
    isOperational = true,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

// ============================================
// 400 - Bad Request
// ============================================

export class ValidationError extends AppError {
  public readonly errors?: Array<{ path: string[]; message: string }>;

  constructor(
    message = 'Validation failed',
    errors?: Array<{ path: string[]; message: string }>,
    details?: Record<string, unknown>
  ) {
    super(message, 400, 'VALIDATION_ERROR', true, details);
    this.errors = errors;
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Bad request', details?: Record<string, unknown>) {
    super(message, 400, 'BAD_REQUEST', true, details);
  }
}

// ============================================
// 401 - Unauthorized
// ============================================

export class AuthenticationError extends AppError {
  constructor(message = 'Authentication required', details?: Record<string, unknown>) {
    super(message, 401, 'AUTHENTICATION_REQUIRED', true, details);
  }
}

export class InvalidTokenError extends AppError {
  constructor(message = 'Invalid or expired token') {
    super(message, 401, 'INVALID_TOKEN', true);
  }
}

// ============================================
// 403 - Forbidden
// ============================================

export class ForbiddenError extends AppError {
  constructor(message = 'Insufficient permissions', details?: Record<string, unknown>) {
    super(message, 403, 'FORBIDDEN', true, details);
  }
}

// ============================================
// 404 - Not Found
// ============================================

export class NotFoundError extends AppError {
  constructor(resource = 'Resource', identifier?: string) {
    const message = identifier
      ? `${resource} '${identifier}' not found`
      : `${resource} not found`;
    super(message, 404, 'NOT_FOUND', true, { resource, identifier });
  }
}

// ============================================
// 409 - Conflict
// ============================================

export class ConflictError extends AppError {
  constructor(message = 'Resource conflict', details?: Record<string, unknown>) {
    super(message, 409, 'CONFLICT', true, details);
  }
}

// ============================================
// 429 - Rate Limit
// ============================================

export class RateLimitError extends AppError {
  constructor(message = 'Too many requests', retryAfterSeconds?: number) {
    super(message, 429, 'RATE_LIMIT_EXCEEDED', true, { retryAfterSeconds });
  }
}

// ============================================
// 500 - Internal Server Error
// ============================================

export class InternalError extends AppError {
  constructor(message = 'Internal server error', details?: Record<string, unknown>) {
    super(message, 500, 'INTERNAL_ERROR', false, details);
  }
}

// ============================================
// Type Guards
// ============================================

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export function isOperationalError(error: unknown): boolean {
  if (isAppError(error)) {
    return error.isOperational;
  }
  return false;
}
