import dotenv from 'dotenv';
import crypto from 'crypto';
dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
const isTest = process.env.NODE_ENV === 'test';

/**
 * Validate that required environment variables are set.
 * Called at application startup, NOT at import time.
 * This allows tests to import modules without env validation.
 */
export function validateEnvironment(): void {
  const requiredEnvVars = isProduction 
    ? ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'DATABASE_URL']
    : ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY'];

  const missing = requiredEnvVars.filter(v => !process.env[v]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}. Check your .env file.`);
  }

  if (isProduction && process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters in production');
  }
}

// Only validate at import time in non-test environments
// Tests can call validateEnvironment() explicitly if needed
if (!isTest) {
  const requiredEnvVars = isProduction 
    ? ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'DATABASE_URL']
    : ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY'];

  const missing = requiredEnvVars.filter(v => !process.env[v]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}. Check your .env file.`);
  }

  if (isProduction && process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters in production');
  }
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
  corsOrigins: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : '*',

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

  // OAuth Configuration
  oauth: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      callbackUrl: process.env.GOOGLE_CALLBACK_URL || `http://localhost:${process.env.PORT || 3005}/api/auth/google/callback`,
    },
    facebook: {
      clientId: process.env.FACEBOOK_CLIENT_ID || '',
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET || '',
      callbackUrl: process.env.FACEBOOK_CALLBACK_URL || `http://localhost:${process.env.PORT || 3005}/api/auth/facebook/callback`,
    },
  },

  // Firebase Configuration (for mobile push notifications)
  firebase: {
    serviceAccountPath: process.env.FIREBASE_SERVICE_ACCOUNT_PATH || '',
    // Alternative: JSON string of service account credentials
    // serviceAccount: process.env.FIREBASE_SERVICE_ACCOUNT || '',
    projectId: process.env.FIREBASE_PROJECT_ID || '',
  },

  // Mobile App Configuration
  mobile: {
    bundleId: {
      ios: process.env.IOS_BUNDLE_ID || 'com.v2resort.app',
      android: process.env.ANDROID_BUNDLE_ID || 'com.v2resort.app',
    },
    // Apple Developer Team ID for Apple Sign In
    appleTeamId: process.env.APPLE_TEAM_ID || '',
    // Deep linking scheme
    deepLinkScheme: process.env.DEEP_LINK_SCHEME || 'v2resort',
  },
} as const;

export type Config = typeof config;
