import dotenv from 'dotenv';
dotenv.config();

const isProduction = (process.env.NODE_ENV || 'development') === 'production';
if (isProduction) {
  const missing: string[] = [];
  if (!process.env.JWT_SECRET) missing.push('JWT_SECRET');
  if (!process.env.ENCRYPTION_KEY) missing.push('ENCRYPTION_KEY');
  if (missing.length > 0) {
    // A known placeholder signing key in production is an authentication
    // bypass; refuse to boot instead of falling back.
    throw new Error(`FATAL: ${missing.join(', ')} must be explicitly configured in production`);
  }
}

export const env = {
  PORT: process.env.PORT || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  SUPABASE_URL: process.env.SUPABASE_URL || '',
  SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY || '',
  JWT_SECRET: process.env.JWT_SECRET || 'default-secret-key-change-me',
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY || 'default-encryption-key-change-me',
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || '',
  QR_SECRET_KEY: process.env.QR_SECRET_KEY || 'qr-secret-key-change-me',
};
