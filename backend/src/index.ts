import app, { loadDynamicModules } from './app.js';
import { config } from './config/index.js';
import { logger } from './utils/logger.js';
import { initializeDatabase, closeDatabase } from './database/connection.js';
import { seedSystemModules } from './database/system-modules.seeder.js';
import { initializeSocketServer, closeSocketServer } from './socket/index.js';
import { initSentry } from './utils/sentry.js';
import { SchedulerService } from './services/scheduler.service.js';
import http from 'http';
import { permissionCache } from './security/permission-cache.service.js';

// Track server state for graceful shutdown
let isShuttingDown = false;

async function main() {
  try {
    // Create HTTP server first (so health check works immediately)
    const server = http.createServer(app);

    // Initialize Sentry for error tracking (must be early)
    initSentry(app);

    // Start server immediately so Render health check passes
    server.listen(config.port, '0.0.0.0', () => {
      logger.info(`Server running on ${config.port}`);
      logger.info(`🚀 Server running on port ${config.port}`);
      logger.info(`📍 Environment: ${config.env}`);
      logger.info(`🔗 API URL: ${config.apiUrl}`);
    });

    // Initialize database in background (don't block startup)
    initializeDatabase()
      .then(async () => {
        logger.info('Database connected successfully');
        await permissionCache.initialize();
        await seedSystemModules();
        await loadDynamicModules();
      })
      .catch(async (error) => {
        logger.error('Database connection failed:', error);
        await permissionCache.initialize();
      });

    // Initialize WebSocket
    initializeSocketServer(server);
    logger.info('WebSocket server initialized');

    // Initialize Scheduler
    SchedulerService.init();

    // Graceful shutdown with timeout and proper cleanup
    const shutdown = async (signal: string) => {
      if (isShuttingDown) {
        logger.warn('Shutdown already in progress, ignoring duplicate signal');
        return;
      }
      isShuttingDown = true;
      logger.info(`Received ${signal}, shutting down gracefully...`);

      // Force exit after timeout (30 seconds)
      const forceExitTimeout = setTimeout(() => {
        logger.error('Graceful shutdown timed out, forcing exit');
        process.exit(1);
      }, 30000);

      try {
        // Stop accepting new connections
        server.close(() => {
          logger.info('HTTP server closed');
        });

        // Close WebSocket connections
        try {
          await closeSocketServer();
          logger.info('WebSocket server closed');
        } catch (err) {
          logger.warn('Error closing WebSocket server:', err);
        }

        // Close database connections
        try {
          await closeDatabase();
          logger.info('Database connections closed');
        } catch (err) {
          logger.warn('Error closing database:', err);
        }

        clearTimeout(forceExitTimeout);
        logger.info(`Graceful shutdown completed for signal: ${signal}`);
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown:', error);
        clearTimeout(forceExitTimeout);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Handle uncaught exceptions and unhandled rejections
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception:', error);

      // Don't shutdown for "headers already sent" errors - these are recoverable
      if (error && (error as any).message?.includes('Cannot set headers after they are sent')) {
        logger.warn('Ignoring "headers already sent" error - not triggering shutdown');
        return;
      }

      shutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason) => {
      logger.error('Unhandled rejection:', reason);
      // Don't shutdown on unhandled rejection, just log it
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

main();
