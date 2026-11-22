/**
 * Worker-side env for the audit proof suite.
 * Loads .env.test only; explicitly blanks the remote-DB and Stripe secrets.
 */
import dotenv from 'dotenv';
import path from 'path';
import { assertLocalTestEnvironment } from '../env-guard';

dotenv.config({ path: path.resolve(process.cwd(), '.env.test'), override: true });
process.env.SUPABASE_DB_PASSWORD = '';
process.env.STRIPE_SECRET_KEY = '';
process.env.REDIS_URL = 'redis://127.0.0.1:6380/0';
process.env.CSRF_BYPASS_IN_TESTS = 'true';
process.env.AUDIT_BASE_URL = process.env.AUDIT_BASE_URL || 'http://127.0.0.1:3199/api/v1';

assertLocalTestEnvironment(process.env, 'audit');
