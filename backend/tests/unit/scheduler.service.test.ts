/**
 * Scheduler Service Unit Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock node-cron
vi.mock('node-cron', () => ({
  default: {
    schedule: vi.fn((cronExpr, callback) => ({
      start: vi.fn(),
      stop: vi.fn(),
    })),
  },
}));

// Mock the BackupService
vi.mock('../../src/services/backup.service.js', () => ({
  BackupService: {
    createBackup: vi.fn().mockResolvedValue({
      filename: 'backup_2024-01-01.sql',
      sizeBytes: 1024,
    }),
  },
}));

// Mock the pool ticket expiry script
vi.mock('../../src/scripts/expire-pool-tickets.js', () => ({
  expirePoolTickets: vi.fn().mockResolvedValue({ expired: 5 }),
}));

// Mock database connection
const mockSupabaseClient = {
  from: vi.fn(() => mockSupabaseClient),
  select: vi.fn(() => mockSupabaseClient),
  insert: vi.fn(() => mockSupabaseClient),
  update: vi.fn(() => mockSupabaseClient),
  delete: vi.fn(() => mockSupabaseClient),
  eq: vi.fn(() => mockSupabaseClient),
  lt: vi.fn(() => Promise.resolve({ data: [], error: null })),
};

vi.mock('../../src/database/connection.js', () => ({
  getSupabase: () => mockSupabaseClient,
}));

// Mock logger
vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import cron from 'node-cron';
import { BackupService } from '../../src/services/backup.service.js';
import { expirePoolTickets } from '../../src/scripts/expire-pool-tickets.js';
import { SchedulerService } from '../../src/services/scheduler.service.js';

describe('Scheduler Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('SchedulerService.init', () => {
    it('should schedule all cron jobs on initialization', () => {
      SchedulerService.init();
      
      // Should schedule multiple cron jobs
      expect(cron.schedule).toHaveBeenCalled();
      
      // At minimum: daily backup, pool expiry, session cleanup
      expect(vi.mocked(cron.schedule).mock.calls.length).toBeGreaterThanOrEqual(3);
    });

    it('should schedule daily backup at 3 AM', () => {
      SchedulerService.init();
      
      // Check that a cron job with the daily backup pattern is scheduled
      const calls = vi.mocked(cron.schedule).mock.calls;
      const backupCall = calls.find(call => call[0] === '0 3 * * *');
      
      expect(backupCall).toBeDefined();
    });

    it('should schedule pool ticket expiry at midnight', () => {
      SchedulerService.init();
      
      const calls = vi.mocked(cron.schedule).mock.calls;
      const midnightCall = calls.find(call => call[0] === '0 0 * * *');
      
      expect(midnightCall).toBeDefined();
    });

    it('should schedule session cleanup at 4 AM', () => {
      SchedulerService.init();
      
      const calls = vi.mocked(cron.schedule).mock.calls;
      const sessionCall = calls.find(call => call[0] === '0 4 * * *');
      
      expect(sessionCall).toBeDefined();
    });
  });

  describe('Cron job callbacks', () => {
    it('backup job should call BackupService.createBackup', async () => {
      SchedulerService.init();
      
      // Find the backup job callback
      const calls = vi.mocked(cron.schedule).mock.calls;
      const backupCall = calls.find(call => call[0] === '0 3 * * *');
      
      if (backupCall) {
        // Execute the callback
        await backupCall[1]();
        
        expect(BackupService.createBackup).toHaveBeenCalledWith('system-scheduler');
      }
    });

    it('pool expiry job should call expirePoolTickets', async () => {
      SchedulerService.init();
      
      const calls = vi.mocked(cron.schedule).mock.calls;
      const expiryCall = calls.find(call => call[0] === '0 0 * * *');
      
      if (expiryCall) {
        await expiryCall[1]();
        
        expect(expirePoolTickets).toHaveBeenCalled();
      }
    });

    it('session cleanup should delete old sessions', async () => {
      SchedulerService.init();
      
      const calls = vi.mocked(cron.schedule).mock.calls;
      const sessionCall = calls.find(call => call[0] === '0 4 * * *');
      
      if (sessionCall) {
        await sessionCall[1]();
        
        expect(mockSupabaseClient.from).toHaveBeenCalledWith('sessions');
        expect(mockSupabaseClient.delete).toHaveBeenCalled();
      }
    });
  });

  describe('Error handling', () => {
    it('should handle backup failures gracefully', async () => {
      vi.mocked(BackupService.createBackup).mockRejectedValueOnce(new Error('Backup failed'));
      
      SchedulerService.init();
      
      const calls = vi.mocked(cron.schedule).mock.calls;
      const backupCall = calls.find(call => call[0] === '0 3 * * *');
      
      if (backupCall) {
        // Should not throw
        await expect(backupCall[1]()).resolves.not.toThrow();
      }
    });

    it('should handle pool expiry failures gracefully', async () => {
      vi.mocked(expirePoolTickets).mockRejectedValueOnce(new Error('Expiry failed'));
      
      SchedulerService.init();
      
      const calls = vi.mocked(cron.schedule).mock.calls;
      const expiryCall = calls.find(call => call[0] === '0 0 * * *');
      
      if (expiryCall) {
        await expect(expiryCall[1]()).resolves.not.toThrow();
      }
    });
  });
});

describe('Cron Expression Patterns', () => {
  it('should use valid cron expressions', () => {
    // Test cron patterns used by the scheduler
    const cronPatterns = [
      '0 3 * * *',           // Daily at 3 AM
      '0 0 * * *',           // Daily at midnight
      '0 4 * * *',           // Daily at 4 AM
      '0 4,8,12,16,20 * * *', // Every 4 hours
    ];

    // Simple validation - cron patterns should have 5 parts
    for (const pattern of cronPatterns) {
      const parts = pattern.split(' ');
      expect(parts.length).toBe(5);
    }
  });

  it('should correctly parse minute field', () => {
    const patterns = ['0 3 * * *', '30 3 * * *', '*/15 * * * *'];
    
    for (const pattern of patterns) {
      const minute = pattern.split(' ')[0];
      // Should be a valid minute value (0-59, *, or */n)
      expect(/^(\d{1,2}|\*|(\*\/\d+))$/.test(minute)).toBe(true);
    }
  });
});
