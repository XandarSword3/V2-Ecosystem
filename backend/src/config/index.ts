import { config as dotenvConfig } from 'dotenv';
import crypto from 'crypto';
dotenvConfig();

const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
const isTest = process.env.NODE_ENV === 'test';

const DEV_CORS_ORIGINS = [
  /^http:\/\/localhost:\d+$/,
  /^http:\/\/.*\.v2platform\.local:\d+$/,
  /^https:\/\/.*\.v2platform\.com$/, // For production domain
];

// Matches any subdomain (including multi-level, e.g. resort-1.tenant-a.v2platform.local)
// used by the property-level dev URLs introduced in session 7-8.
const DEV_SUBDOMAIN_PATTERN = /^http:\/\/(?:[a-z0-9-]+\.)+(?:v2platform\.local|localhost)(?::\d+)?$/;

// Known production frontend origins — always allowed regardless of env var configuration.
// This prevents a missing/misconfigured CORS_ORIGINS env var from breaking the production
// browser ↔ API connection. Vercel preview deployments (*.vercel.app) are also accepted.
const PRODUCTION_CORS_ORIGINS = [
  'https://v2-ecosystem.vercel.app',
];

const VERCEL_PREVIEW_PATTERN = /^https:\/\/v2-ecosystem(-[a-z0-9-]+)?\.vercel\.app$/;

export function resolveCorsOrigins(env: NodeJS.ProcessEnv = process.env): (string | RegExp)[] {
  const rawOrigins = env.CORS_ORIGINS || env.CORS_ORIGIN || env.FRONTEND_URL;

  const envOrigins: string[] = rawOrigins
    ? rawOrigins.split(',').map(o => o.trim()).filter(Boolean)
    : [];

  const base = envOrigins.length > 0 ? envOrigins : DEV_CORS_ORIGINS;

  // In production, always merge the known Vercel origins so a missing env var
  // does not silently break browser-side API access.
  if (env.NODE_ENV === 'production') {
    const merged = Array.from(new Set([...base, ...PRODUCTION_CORS_ORIGINS]));
    return [...merged, VERCEL_PREVIEW_PATTERN];
  }

  // In development, include the subdomain pattern for multi-property routing
  return [...base, DEV_SUBDOMAIN_PATTERN];
}

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
  corsOrigins: resolveCorsOrigins(),

  database: {
    url: (() => {
      // Use the correct approach from apply-migrations-verbose.mjs: 
      // use SUPABASE_DB_PASSWORD and properly encode it!
      if (process.env.SUPABASE_DB_PASSWORD) {
        const password = process.env.SUPABASE_DB_PASSWORD;
        const encoded = encodeURIComponent(password);
        return `postgresql://postgres.qxtmesddgwmwspejnbvc:${encoded}@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres`;
      }
      return process.env.DATABASE_URL || '';
    })(),
  },

  supabase: {
    url: process.env.SUPABASE_URL || '',
    anonKey: process.env.SUPABASE_ANON_KEY || '',
    serviceKey: process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '',
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
    from: process.env.EMAIL_FROM || process.env.SMTP_FROM || '',
  },

  storage: {
    endpoint: process.env.STORAGE_ENDPOINT || '',
    bucket: process.env.STORAGE_BUCKET || 'v2-ecosystem-files',
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
    apple: {
      clientId: process.env.APPLE_CLIENT_ID || '', // Service ID (e.g., com.v2ecosystem.web)
      teamId: process.env.APPLE_TEAM_ID || '',
      keyId: process.env.APPLE_KEY_ID || '',
      privateKey: process.env.APPLE_PRIVATE_KEY || '', // Contents of .p8 file (with \n replaced)
      callbackUrl: process.env.APPLE_CALLBACK_URL || `http://localhost:${process.env.PORT || 3005}/api/auth/apple/callback`,
    },
  },

  // Firebase Configuration (for mobile push notifications)
  // Credentials are loaded from a JSON env var (never from a file path)
  // to avoid baking secrets into Docker image layers.
  // Generate with: FIREBASE_SERVICE_ACCOUNT_JSON=$(cat service-account.json)
  firebase: {
    serviceAccountJson: process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '',
    projectId: process.env.FIREBASE_PROJECT_ID || '',
  },

  // Mobile App Configuration
  mobile: {
    bundleId: {
      ios: process.env.IOS_BUNDLE_ID || 'com.v2ecosystem.app',
      android: process.env.ANDROID_BUNDLE_ID || 'com.v2ecosystem.app',
    },
    // Apple Developer Team ID for Apple Sign In
    appleTeamId: process.env.APPLE_TEAM_ID || '',
    // Deep linking scheme
    deepLinkScheme: process.env.DEEP_LINK_SCHEME || 'v2ecosystem',
  },

  // CAPTCHA / Bot Protection Configuration (Cloudflare Turnstile)
  turnstile: {
    secretKey: process.env.TURNSTILE_SECRET_KEY || process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY || '',
    verifyUrl: 'https://challenges.cloudflare.com/turnstile/v0/siteverify',
  },
} as const;

export type Config = typeof config;
