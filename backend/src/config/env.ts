import dotenv from 'dotenv';
dotenv.config();

export const env = {
  PORT: process.env.PORT || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  SUPABASE_URL: process.env.SUPABASE_URL || '',
  SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY || '',
  JWT_SECRET: process.env.JWT_SECRET || 'default-secret-key-change-me',
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY || 'default-encryption-key-change-me',
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || 'sk_test_1234567890abcdef',
  QR_SECRET_KEY: process.env.QR_SECRET_KEY || 'qr-secret-key-change-me',
};
