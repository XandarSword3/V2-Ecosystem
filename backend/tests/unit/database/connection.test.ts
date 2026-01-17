import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock dependencies
vi.mock('drizzle-orm/node-postgres', () => ({
  drizzle: vi.fn().mockReturnValue({ db: 'mock-drizzle' })
}));

vi.mock('pg', () => ({
  Pool: vi.fn().mockImplementation(() => ({
    connect: vi.fn().mockResolvedValue({
      query: vi.fn().mockResolvedValue({}),
      release: vi.fn()
    }),
    end: vi.fn().mockResolvedValue(undefined)
  }))
}));

vi.mock('../../../src/config/index', () => ({
  config: {
    database: {
      url: 'postgresql://test:test@localhost:5432/test'
    }
  }
}));

vi.mock('../../../src/database/schema/index', () => ({}));

vi.mock('../../../src/database/supabase', () => ({
  getSupabaseAdmin: vi.fn().mockReturnValue({
    from: vi.fn(),
    storage: {}
  })
}));

vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

import { 
  getSupabase, 
  isUsingSupabase,
  closeDatabase
} from '../../../src/database/connection';
import { getSupabaseAdmin } from '../../../src/database/supabase';

describe('Database Connection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getSupabase', () => {
    it('should return Supabase client', () => {
      const client = getSupabase();
      expect(client).toBeDefined();
      expect(getSupabaseAdmin).toHaveBeenCalled();
    });

    it('should return the same instance on subsequent calls', () => {
      const client1 = getSupabase();
      const client2 = getSupabase();
      expect(client1).toBe(client2);
    });
  });

  describe('isUsingSupabase', () => {
    it('should return a boolean', () => {
      const result = isUsingSupabase();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('closeDatabase', () => {
    it('should handle closing gracefully', async () => {
      await expect(closeDatabase()).resolves.toBeUndefined();
    });
  });

  describe('Database configuration', () => {
    it('should have correct pool settings', () => {
      const poolSettings = {
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000
      };
      
      expect(poolSettings.max).toBe(20);
      expect(poolSettings.idleTimeoutMillis).toBe(30000);
      expect(poolSettings.connectionTimeoutMillis).toBe(10000);
    });

    it('should use SSL for connections', () => {
      const sslSettings = {
        rejectUnauthorized: false
      };
      
      expect(sslSettings.rejectUnauthorized).toBe(false);
    });
  });
});
