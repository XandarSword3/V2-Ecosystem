/**
 * Environment Validation Service
 * 
 * Validates all required environment variables and external service connections
 * on application startup. Fails fast with clear error messages.
 */

import { logger } from '../utils/logger.js';

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

interface EnvVar {
  name: string;
  required: boolean;
  description: string;
  validator?: (value: string) => boolean;
  validatorMessage?: string;
}

// Environment variable definitions
const ENV_VARS: EnvVar[] = [
  // Server
  { name: 'PORT', required: false, description: 'Server port (default: 3005)' },
  { name: 'NODE_ENV', required: false, description: 'Environment (development/production/test)' },
  
  // Database - Required
  { 
    name: 'SUPABASE_URL', 
    required: true, 
    description: 'Supabase project URL',
    validator: (v) => v.startsWith('http://') || v.startsWith('https://'),
    validatorMessage: 'Must be a valid URL starting with http:// or https://'
  },
  { name: 'SUPABASE_ANON_KEY', required: true, description: 'Supabase anonymous key' },
  { name: 'SUPABASE_SERVICE_ROLE_KEY', required: true, description: 'Supabase service role key' },
  
  // Authentication - Required
  { 
    name: 'JWT_SECRET', 
    required: true, 
    description: 'JWT signing secret (min 32 characters)',
    validator: (v) => v.length >= 32,
    validatorMessage: 'Must be at least 32 characters long'
  },
  
  // Email - Required for production
  { name: 'SMTP_HOST', required: false, description: 'SMTP server host' },
  { name: 'SMTP_PORT', required: false, description: 'SMTP server port' },
  { name: 'SMTP_USER', required: false, description: 'SMTP username' },
  { name: 'SMTP_PASS', required: false, description: 'SMTP password' },
  { name: 'SMTP_FROM', required: false, description: 'Default from email address' },
  
  // Stripe - Required for payments
  { 
    name: 'STRIPE_SECRET_KEY', 
    required: false, 
    description: 'Stripe secret key',
    validator: (v) => v.startsWith('sk_'),
    validatorMessage: 'Must start with sk_'
  },
  { name: 'STRIPE_WEBHOOK_SECRET', required: false, description: 'Stripe webhook signing secret' },
  
  // Security
  { 
    name: 'CORS_ORIGIN', 
    required: false, 
    description: 'Allowed CORS origins',
    validator: (v) => v.startsWith('http://') || v.startsWith('https://') || v === '*',
    validatorMessage: 'Must be a valid URL or *'
  },
  
  // Optional Services
  { name: 'REDIS_URL', required: false, description: 'Redis connection URL' },
  { name: 'SENTRY_DSN', required: false, description: 'Sentry error tracking DSN' },
  { name: 'GOOGLE_TRANSLATE_API_KEY', required: false, description: 'Google Translate API key' },
  { name: 'OPENWEATHER_API_KEY', required: false, description: 'OpenWeather API key' },
];

/**
 * Validate a single environment variable
 */
function validateEnvVar(envVar: EnvVar): { valid: boolean; error?: string; warning?: string } {
  const value = process.env[envVar.name];
  
  // Check if required and missing
  if (envVar.required && !value) {
    return { 
      valid: false, 
      error: `Missing required environment variable: ${envVar.name} - ${envVar.description}` 
    };
  }
  
  // Check if optional and missing (warning only)
  if (!envVar.required && !value) {
    // Only warn for important optional vars
    if (['SMTP_HOST', 'STRIPE_SECRET_KEY', 'REDIS_URL'].includes(envVar.name)) {
      return { 
        valid: true, 
        warning: `Optional but recommended: ${envVar.name} is not set - ${envVar.description}` 
      };
    }
    return { valid: true };
  }
  
  // Run custom validator if provided
  if (value && envVar.validator && !envVar.validator(value)) {
    return { 
      valid: false, 
      error: `Invalid value for ${envVar.name}: ${envVar.validatorMessage}` 
    };
  }
  
  return { valid: true };
}

/**
 * Validate all environment variables
 */
export function validateEnvironment(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  for (const envVar of ENV_VARS) {
    const result = validateEnvVar(envVar);
    if (!result.valid && result.error) {
      errors.push(result.error);
    }
    if (result.warning) {
      warnings.push(result.warning);
    }
  }
  
  // Production-specific checks
  if (process.env.NODE_ENV === 'production') {
    // Email is required in production
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
      errors.push('SMTP configuration (SMTP_HOST, SMTP_USER, SMTP_PASS) is required in production');
    }
    
    // Stripe is required in production
    if (!process.env.STRIPE_SECRET_KEY) {
      errors.push('STRIPE_SECRET_KEY is required in production');
    }
    
    // CORS should not be wildcard in production
    if (process.env.CORS_ORIGIN === '*') {
      warnings.push('CORS_ORIGIN should not be * in production');
    }
    
    // JWT secret should be strong
    if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 64) {
      warnings.push('JWT_SECRET should be at least 64 characters in production');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Test database connectivity
 */
export async function testDatabaseConnection(): Promise<{ success: boolean; error?: string }> {
  try {
    // Dynamic import to avoid circular dependencies
    const { getSupabase } = await import('../database/connection.js');
    const supabase = getSupabase();
    
    // Simple query to test connection
    const { error } = await supabase.from('users').select('id').limit(1);
    
    if (error && !error.message.includes('does not exist')) {
      return { success: false, error: `Database connection failed: ${error.message}` };
    }
    
    return { success: true };
  } catch (error) {
    return { 
      success: false, 
      error: `Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
    };
  }
}

/**
 * Test Redis connectivity (if configured)
 */
export async function testRedisConnection(): Promise<{ success: boolean; error?: string; skipped?: boolean }> {
  if (!process.env.REDIS_URL || process.env.REDIS_ENABLED === 'false') {
    return { success: true, skipped: true };
  }
  
  try {
    const { cache } = await import('../utils/cache.js');
    
    // Test set and get
    const testKey = '__connection_test__';
    await cache.set(testKey, 'test', 5);
    const value = await cache.get(testKey);
    
    if (value !== 'test') {
      return { success: false, error: 'Redis read/write test failed' };
    }
    
    return { success: true };
  } catch (error) {
    return { 
      success: false, 
      error: `Redis connection failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
    };
  }
}

/**
 * Run all startup validations
 */
export async function runStartupValidation(): Promise<void> {
  logger.info('Running startup validation...');
  
  // 1. Validate environment variables
  const envResult = validateEnvironment();
  
  // Log warnings
  for (const warning of envResult.warnings) {
    logger.warn(`⚠️  ${warning}`);
  }
  
  // If there are errors, log them and exit
  if (!envResult.valid) {
    logger.error('❌ Environment validation failed:');
    for (const error of envResult.errors) {
      logger.error(`   - ${error}`);
    }
    logger.error('\nPlease check your .env file and ensure all required variables are set.');
    logger.error('See .env.example for reference.');
    process.exit(1);
  }
  
  logger.info('✅ Environment variables validated');
  
  // 2. Test database connection
  const dbResult = await testDatabaseConnection();
  if (!dbResult.success) {
    logger.error(`❌ ${dbResult.error}`);
    logger.error('Please check your database configuration and ensure Supabase is running.');
    process.exit(1);
  }
  logger.info('✅ Database connection verified');
  
  // 3. Test Redis connection (optional)
  const redisResult = await testRedisConnection();
  if (redisResult.skipped) {
    logger.info('ℹ️  Redis not configured (caching disabled)');
  } else if (!redisResult.success) {
    logger.warn(`⚠️  ${redisResult.error}`);
    logger.warn('Continuing without Redis caching...');
  } else {
    logger.info('✅ Redis connection verified');
  }
  
  // 4. Additional production checks
  if (process.env.NODE_ENV === 'production') {
    // Verify HTTPS in CORS origin
    const corsOrigin = process.env.CORS_ORIGIN || '';
    if (corsOrigin && !corsOrigin.includes('https://') && corsOrigin !== '*') {
      logger.warn('⚠️  CORS_ORIGIN should use HTTPS in production');
    }
  }
  
  logger.info('✅ All startup validations passed');
}

/**
 * Get validation status for health check endpoint
 */
export async function getValidationStatus(): Promise<{
  environment: 'valid' | 'invalid';
  database: 'connected' | 'disconnected';
  redis: 'connected' | 'disconnected' | 'disabled';
  issues: string[];
}> {
  const issues: string[] = [];
  
  // Environment
  const envResult = validateEnvironment();
  if (!envResult.valid) {
    issues.push(...envResult.errors);
  }
  
  // Database
  const dbResult = await testDatabaseConnection();
  if (!dbResult.success && dbResult.error) {
    issues.push(dbResult.error);
  }
  
  // Redis
  const redisResult = await testRedisConnection();
  
  return {
    environment: envResult.valid ? 'valid' : 'invalid',
    database: dbResult.success ? 'connected' : 'disconnected',
    redis: redisResult.skipped ? 'disabled' : (redisResult.success ? 'connected' : 'disconnected'),
    issues
  };
}

export default {
  validateEnvironment,
  testDatabaseConnection,
  testRedisConnection,
  runStartupValidation,
  getValidationStatus
};
