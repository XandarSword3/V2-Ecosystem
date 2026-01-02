import app from './app.js';
import { config } from './config/index.js';
import { logger } from './utils/logger.js';
import { initializeDatabase } from './database/connection.js';
import { initializeSocketServer } from './socket/index.js';
import http from 'http';

async function main() {
  try {
    // Create HTTP server first (so health check works immediately)
    const server = http.createServer(app);

    // Start server immediately so Render health check passes
    server.listen(config.port, '0.0.0.0', () => {
      logger.info(`🚀 Server running on port ${config.port}`);
      logger.info(`📍 Environment: ${config.env}`);
      logger.info(`🔗 API URL: ${config.apiUrl}`);
    });

    // Initialize database in background (don't block startup)
    initializeDatabase()
      .then(() => logger.info('Database connected successfully'))
      .catch((error) => logger.error('Database connection failed:', error));

    // Initialize WebSocket
    initializeSocketServer(server);
    logger.info('WebSocket server initialized');

    // Graceful shutdown
    const shutdown = async () => {
      logger.info('Shutting down gracefully...');
      server.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

main();
