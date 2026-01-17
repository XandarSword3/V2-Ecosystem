/**
 * Application Constants
 * 
 * Centralized location for magic numbers and configuration values.
 * These constants make the codebase more maintainable and self-documenting.
 */

// ============================================
// TIME CONSTANTS (in milliseconds)
// ============================================

export const TIME = {
  /** 1 second in milliseconds */
  SECOND: 1000,
  /** 1 minute in milliseconds */
  MINUTE: 60 * 1000,
  /** 1 hour in milliseconds */
  HOUR: 60 * 60 * 1000,
  /** 1 day in milliseconds */
  DAY: 24 * 60 * 60 * 1000,
  /** 1 week in milliseconds */
  WEEK: 7 * 24 * 60 * 60 * 1000,
} as const;

// ============================================
// CACHE TTL (in seconds)
// ============================================

export const CACHE_TTL = {
  /** 30 seconds - for highly dynamic data */
  VERY_SHORT: 30,
  /** 5 minutes - for frequently updated data */
  SHORT: 300,
  /** 1 hour - for moderately static data */
  MEDIUM: 3600,
  /** 6 hours - for semi-static data */
  LONG: 21600,
  /** 24 hours - for mostly static data */
  VERY_LONG: 86400,
  /** 7 days - for session data */
  SESSION: 604800,
} as const;

// ============================================
// AUTHENTICATION
// ============================================

export const AUTH = {
  /** OAuth state cookie max age: 10 minutes */
  OAUTH_STATE_MAX_AGE: 10 * TIME.MINUTE,
  /** Access token cookie max age: 15 minutes */
  ACCESS_TOKEN_MAX_AGE: 15 * TIME.MINUTE,
  /** Refresh token cookie max age: 7 days */
  REFRESH_TOKEN_MAX_AGE: 7 * TIME.DAY,
  /** 2FA code expiry: 10 minutes */
  TWO_FACTOR_EXPIRY: 10 * TIME.MINUTE,
  /** JWT access token expiry: 15 minutes */
  JWT_ACCESS_EXPIRY: '15m',
  /** JWT refresh token expiry: 7 days */
  JWT_REFRESH_EXPIRY: '7d',
  /** Password min length */
  PASSWORD_MIN_LENGTH: 8,
  /** Password max length */
  PASSWORD_MAX_LENGTH: 128,
} as const;

// ============================================
// RATE LIMITING
// ============================================

export const RATE_LIMIT = {
  /** Standard rate limit window: 15 minutes */
  WINDOW_MS: 15 * TIME.MINUTE,
  /** Max requests per window for general API */
  MAX_REQUESTS_GENERAL: 100,
  /** Max requests for authenticated users */
  MAX_REQUESTS_AUTHENTICATED: 1000,
  /** Max requests for sensitive operations (login, password reset) */
  MAX_REQUESTS_SENSITIVE: 5,
  /** Max write operations per minute */
  MAX_WRITE_OPERATIONS: 30,
} as const;

// ============================================
// PAGINATION
// ============================================

export const PAGINATION = {
  /** Default page size */
  DEFAULT_LIMIT: 20,
  /** Maximum page size */
  MAX_LIMIT: 100,
  /** Minimum page size */
  MIN_LIMIT: 1,
} as const;

// ============================================
// FILE UPLOAD
// ============================================

export const FILE_UPLOAD = {
  /** Maximum file size: 10 MB */
  MAX_SIZE: 10 * 1024 * 1024,
  /** Maximum backup file size: 100 MB */
  MAX_BACKUP_SIZE: 100 * 1024 * 1024,
  /** Allowed image MIME types */
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const,
} as const;

// ============================================
// TIMEOUTS
// ============================================

export const TIMEOUTS = {
  /** Database connection timeout: 3 seconds */
  DATABASE_CONNECTION: 3000,
  /** Redis connection timeout: 5 seconds */
  REDIS_CONNECTION: 5000,
  /** HTTP request timeout: 10 seconds */
  HTTP_REQUEST: 10000,
  /** Health check timeout: 3 seconds */
  HEALTH_CHECK: 3000,
  /** Slow request threshold: 1 second */
  SLOW_REQUEST_THRESHOLD: 1000,
} as const;

// ============================================
// SERVER
// ============================================

export const SERVER = {
  /** Default port */
  DEFAULT_PORT: 3000,
  /** Maximum request body size: 10 MB */
  MAX_BODY_SIZE: '10mb',
} as const;

// ============================================
// MONITORING
// ============================================

export const MONITORING = {
  /** Maximum response times to keep for percentile calculation */
  MAX_RESPONSE_TIMES: 1000,
  /** Metrics retention period: 1 hour */
  METRICS_RETENTION: TIME.HOUR,
} as const;

// ============================================
// BUSINESS LOGIC
// ============================================

export const BUSINESS = {
  /** Maximum guests per chalet booking */
  MAX_GUESTS_PER_BOOKING: 10,
  /** Maximum items per order */
  MAX_ITEMS_PER_ORDER: 50,
  /** Order number prefix length */
  ORDER_NUMBER_LENGTH: 6,
  /** Default loyalty points per currency unit */
  LOYALTY_POINTS_PER_UNIT: 1,
  /** Minimum booking advance days */
  MIN_BOOKING_ADVANCE_DAYS: 0,
  /** Maximum booking advance days */
  MAX_BOOKING_ADVANCE_DAYS: 365,
} as const;

// ============================================
// HTTP STATUS CODES
// ============================================

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;
