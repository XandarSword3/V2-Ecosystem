import cron from 'node-cron';
import { BackupService } from './backup.service.js';
import { logger } from '../utils/logger.js';

export class SchedulerService {
  /**
   * Initialize all cron jobs
   */
  static init() {
    logger.info('Initializing scheduler service...');
    
    // Daily Backup at 3:00 AM
    this.scheduleDailyBackup();
    
    logger.info('Scheduler service initialized.');
  }

  /**
   * Schedule daily database backup
   */
  private static scheduleDailyBackup() {
    // Schedule task to run at 3:00 AM every day
    cron.schedule('0 3 * * *', async () => {
      logger.info('Starting scheduled daily backup...');
      try {
        const result = await BackupService.createBackup('system-scheduler');
        logger.info(`Scheduled backup completed successfully. Filename: ${result.filename}, Size: ${result.sizeBytes} bytes`);
      } catch (error) {
        logger.error('Scheduled backup failed:', error);
      }
    });
    
    logger.info('Scheduled daily backup job (0 3 * * *)');
  }
}
