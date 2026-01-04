import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { config } from '../config/index';
import * as schema from './schema/index';
import { getSupabaseAdmin } from './supabase';
import { logger } from '../utils/logger';
import { SupabaseClient } from '@supabase/supabase-js';

let pool: Pool | null = null;
let db: ReturnType<typeof drizzle> | null = null;
let supabase: SupabaseClient | null = null;
let useSupabaseClient = false;

export async function initializeDatabase() {
  // Try direct PostgreSQL connection first
  try {
    pool = new Pool({
      connectionString: config.database.url,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      ssl: {
        rejectUnauthorized: false,
      },
    });

    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();

    db = drizzle(pool, { schema });
    logger.info('Connected to PostgreSQL directly');
    return db;
  } catch (error: any) {
    logger.warn(`Direct PostgreSQL connection failed: ${error.message}`);
    logger.info('Falling back to Supabase client...');
    
    // Use Supabase client
    supabase = getSupabaseAdmin();
    useSupabaseClient = true;
    logger.info('Using Supabase client for database operations');
    return null;
  }
}

export function getDb() {
  if (!db && !useSupabaseClient) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return db;
}

export function getSupabase(): SupabaseClient {
  if (!supabase) {
    supabase = getSupabaseAdmin();
  }
  return supabase;
}

export function getPool() {
  if (!pool) {
    throw new Error('Database pool not initialized.');
  }
  return pool;
}

export function isUsingSupabase() {
  return useSupabaseClient;
}

export async function closeDatabase() {
  if (pool) {
    await pool.end();
  }
}
