import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock node-cron before importing
vi.mock('node-cron', () => ({
  default: {
    schedule: vi.fn().mockImplementation((expression, callback) => {
      // Store callback for potential testing
      return { expression, callback };
    })
  }
}));

// Mock dependencies
vi.mock('../../../src/database/connection', () => ({
  getSupabase: vi.fn()
}));

vi.mock('../../../src/services/backup.service', () => ({
  BackupService: {
    createBackup: vi.fn().mockResolvedValue({
      filename: 'backup-test.json',
      sizeBytes: 1024
    })
  }
}));

vi.mock('../../../src/scripts/expire-pool-tickets.js', () => ({
  expirePoolTickets: vi.fn().mockResolvedValue({ expired: 5 })
}));

vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

import cron from 'node-cron';
import { SchedulerService } from '../../../src/services/scheduler.service';
import { logger } from '../../../src/utils/logger.js';

describe('SchedulerService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('init', () => {
    it('should initialize all cron jobs', () => {
      SchedulerService.init();

      // Should schedule 5 cron jobs (daily backup, pool ticket expiry x2, session cleanup, daily notification)
      expect(cron.schedule).toHaveBeenCalledTimes(5);
      expect(logger.info).toHaveBeenCalledWith('Scheduler service initialized.');
    });

    it('should schedule daily backup at 3:00 AM', () => {
      SchedulerService.init();

      expect(cron.schedule).toHaveBeenCalledWith(
        '0 3 * * *',
        expect.any(Function)
      );
    });

    it('should schedule pool ticket expiry at midnight', () => {
      SchedulerService.init();

      expect(cron.schedule).toHaveBeenCalledWith(
        '0 0 * * *',
        expect.any(Function)
      );
    });

    it('should schedule pool ticket expiry every 4 hours', () => {
      SchedulerService.init();

      expect(cron.schedule).toHaveBeenCalledWith(
        '0 4,8,12,16,20 * * *',
        expect.any(Function)
      );
    });

    it('should schedule session cleanup at 4:00 AM', () => {
      SchedulerService.init();

      expect(cron.schedule).toHaveBeenCalledWith(
        '0 4 * * *',
        expect.any(Function)
      );
    });

    it('should log initialization message', () => {
      SchedulerService.init();

      expect(logger.info).toHaveBeenCalledWith('Initializing scheduler service...');
    });
  });

  describe('scheduled job callbacks', () => {
    it('should execute backup job callback without errors', async () => {
      let backupCallback: Function | undefined;
      
      vi.mocked(cron.schedule).mockImplementation((expression, callback) => {
        if (expression === '0 3 * * *') {
          backupCallback = callback;
        }
        return {} as any;
      });

      SchedulerService.init();

      // Execute the backup callback
      if (backupCallback) {
        await backupCallback();
        expect(logger.info).toHaveBeenCalledWith('Starting scheduled daily backup...');
      }
    });

    it('should execute pool ticket expiry callback without errors', async () => {
      let poolCallback: Function | undefined;
      
      vi.mocked(cron.schedule).mockImplementation((expression, callback) => {
        if (expression === '0 0 * * *') {
          poolCallback = callback;
        }
        return {} as any;
      });

      SchedulerService.init();

      // Execute the pool ticket callback
      if (poolCallback) {
        await poolCallback();
        expect(logger.info).toHaveBeenCalledWith('Starting scheduled pool ticket expiry (midnight)...');
      }
    });
  });

  describe('cron expressions', () => {
    it('should use valid cron expressions', () => {
      SchedulerService.init();

      const calls = vi.mocked(cron.schedule).mock.calls;
      
      // Verify cron expressions are valid patterns
      expect(calls[0][0]).toMatch(/^[\d*,/\- ]+$/);
      expect(calls[1][0]).toMatch(/^[\d*,/\- ]+$/);
      expect(calls[2][0]).toMatch(/^[\d*,/\- ]+$/);
      expect(calls[3][0]).toMatch(/^[\d*,/\- ]+$/);
    });
  });
});
