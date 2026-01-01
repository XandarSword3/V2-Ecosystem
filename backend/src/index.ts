import app from './app.js';
import { config } from './config/index.js';
import { logger } from './utils/logger.js';
import { initializeDatabase } from './database/connection.js';
import { initializeSocketServer } from './socket/index.js';
import http from 'http';

async function main() {
  try {
    // Initialize database
    await initializeDatabase();
    logger.info('Database connected successfully');

    // Create HTTP server
    const server = http.createServer(app);

    // Initialize WebSocket
    initializeSocketServer(server);
    logger.info('WebSocket server initialized');

    // Start server
    server.listen(config.port, () => {
      logger.info(`🚀 Server running on port ${config.port}`);
      logger.info(`📍 Environment: ${config.env}`);
      logger.info(`🔗 API URL: ${config.apiUrl}`);
    });

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
