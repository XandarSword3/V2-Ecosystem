import dotenv from 'dotenv';
import crypto from 'crypto';
dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
const isTest = process.env.NODE_ENV === 'test';

// SECURITY: Validate critical environment variables
// In production, these must be explicitly set - no fallbacks allowed
const requiredEnvVars = isProduction 
  ? ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'DATABASE_URL']
  : ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY']; // Minimum for development

const missing = requiredEnvVars.filter(v => !process.env[v]);
if (missing.length > 0 && !isTest) {
  throw new Error(`Missing required environment variables: ${missing.join(', ')}. Check your .env file.`);
}

// Ensure JWT secret is strong in production
if (isProduction && process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters in production');
}

// Generate secure development-only secrets (never used in production)
// These are randomly generated per-process so they're different each restart
const generateDevSecret = (prefix: string) => {
  if (isProduction) return ''; // Force failure if not set
  console.warn(`⚠️  WARNING: Using auto-generated ${prefix} - set in .env for persistence`);
  return `dev-only-${prefix}-${crypto.randomBytes(32).toString('hex')}`;
};

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  apiUrl: process.env.API_URL || 'http://localhost:3000',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',

  database: {
    url: process.env.DATABASE_URL || '',
  },

  supabase: {
    url: process.env.SUPABASE_URL || '',
    anonKey: process.env.SUPABASE_ANON_KEY || '',
    serviceKey: process.env.SUPABASE_SERVICE_KEY || '',
  },

  jwt: {
    // SECURITY: No hardcoded fallbacks - use generated dev secrets that change per-restart
    secret: process.env.JWT_SECRET || (isTest ? 'test-secret-key-min-32-characters-long' : generateDevSecret('jwt-secret')),
    refreshSecret: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || (isTest ? 'test-refresh-secret-key-min-32-chars' : generateDevSecret('jwt-refresh')),
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
  },

  email: {
    host: process.env.SMTP_HOST || 'smtp.sendgrid.net',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.EMAIL_FROM || 'noreply@v2resort.com',
  },

  storage: {
    endpoint: process.env.STORAGE_ENDPOINT || '',
    bucket: process.env.STORAGE_BUCKET || 'v2-resort-files',
    accessKey: process.env.STORAGE_ACCESS_KEY || '',
    secretKey: process.env.STORAGE_SECRET_KEY || '',
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10), // 1 minute
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '1000', 10), // 1000 requests per minute for dev
  },
} as const;

export type Config = typeof config;
