/**
 * V2 Resort - Socket.io Redis Adapter for Horizontal Scaling
 * Enables WebSocket communication across multiple backend instances
 */

import { Server as SocketIOServer } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient, RedisClientType } from 'redis';
import { Server as HttpServer } from 'http';
import { logger } from '../utils/logger';

// Environment variables
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const NODE_ENV = process.env.NODE_ENV || 'development';

// Redis clients for pub/sub
let pubClient: RedisClientType;
let subClient: RedisClientType;

/**
 * Configure Socket.io with Redis adapter for horizontal scaling
 */
export const configureSocketRedisAdapter = async (
  io: SocketIOServer
): Promise<void> => {
  // Create Redis clients for pub/sub
  pubClient = createClient({ url: REDIS_URL });
  subClient = pubClient.duplicate();

  // Error handling
  pubClient.on('error', (err: Error) => {
    logger.error(`[Socket.io Redis] Pub client error: ${err.message}`);
  });

  subClient.on('error', (err: Error) => {
    logger.error(`[Socket.io Redis] Sub client error: ${err.message}`);
  });

  // Connect clients
  await Promise.all([
    pubClient.connect(),
    subClient.connect(),
  ]);

  logger.info('[Socket.io Redis] Connected to Redis for pub/sub');

  // Configure adapter
  io.adapter(createAdapter(pubClient, subClient));
  
  logger.info('[Socket.io Redis] Adapter configured successfully');
};

/**
 * Initialize Socket.io server with all configurations
 */
export const initializeSocketServer = async (
  httpServer: HttpServer
): Promise<SocketIOServer> => {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    pingInterval: 25000,
    pingTimeout: 60000,
    connectTimeout: 45000,
    allowEIO3: true,
    path: '/socket.io',
  });

  // Configure Redis adapter if not in development without Redis
  if (NODE_ENV === 'production' || process.env.REDIS_URL) {
    await configureSocketRedisAdapter(io);
  } else {
    logger.info('[Socket.io] Running without Redis adapter (development mode)');
  }

  // Connection handling
  io.on('connection', (socket) => {
    logger.debug(`[Socket.io] Client connected: ${socket.id}`);

    // Join user to their personal room
    socket.on('join:user', (userId: string) => {
      socket.join(`user:${userId}`);
      logger.debug(`[Socket.io] User ${userId} joined personal room`);
    });

    // Join user to role-based rooms
    socket.on('join:role', (role: string) => {
      socket.join(`role:${role}`);
      logger.debug(`[Socket.io] Socket joined role room: ${role}`);
    });

    // Kitchen namespace rooms
    socket.on('join:kitchen', () => {
      socket.join('kitchen');
      logger.debug('[Socket.io] Socket joined kitchen room');
    });

    // Admin namespace rooms
    socket.on('join:admin', () => {
      socket.join('admin');
      logger.debug('[Socket.io] Socket joined admin room');
    });

    // Pool monitoring room
    socket.on('join:pool-monitor', () => {
      socket.join('pool-monitor');
      logger.debug('[Socket.io] Socket joined pool monitor room');
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      logger.debug(`[Socket.io] Client disconnected: ${socket.id}, reason: ${reason}`);
    });

    // Handle errors
    socket.on('error', (error) => {
      logger.error(`[Socket.io] Socket error: ${socket.id}`, error);
    });
  });

  // Middleware for authentication
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token && NODE_ENV === 'production') {
      return next(new Error('Authentication required'));
    }
    // In production, verify JWT token here
    // const decoded = verifyJWT(token);
    // socket.data.user = decoded;
    next();
  });

  return io;
};

/**
 * Emit event to all connected clients across all instances
 */
export const emitToAll = (io: SocketIOServer, event: string, data: any): void => {
  io.emit(event, data);
};

/**
 * Emit event to a specific user across all instances
 */
export const emitToUser = (
  io: SocketIOServer,
  userId: string,
  event: string,
  data: any
): void => {
  io.to(`user:${userId}`).emit(event, data);
};

/**
 * Emit event to users with specific role across all instances
 */
export const emitToRole = (
  io: SocketIOServer,
  role: string,
  event: string,
  data: any
): void => {
  io.to(`role:${role}`).emit(event, data);
};

/**
 * Emit event to kitchen staff across all instances
 */
export const emitToKitchen = (
  io: SocketIOServer,
  event: string,
  data: any
): void => {
  io.to('kitchen').emit(event, data);
};

/**
 * Emit event to admin users across all instances
 */
export const emitToAdmin = (
  io: SocketIOServer,
  event: string,
  data: any
): void => {
  io.to('admin').emit(event, data);
};

/**
 * Emit event to pool monitors across all instances
 */
export const emitToPoolMonitor = (
  io: SocketIOServer,
  event: string,
  data: any
): void => {
  io.to('pool-monitor').emit(event, data);
};

/**
 * Get count of connected sockets across all instances
 */
export const getConnectedCount = async (io: SocketIOServer): Promise<number> => {
  const sockets = await io.fetchSockets();
  return sockets.length;
};

/**
 * Get sockets in a specific room across all instances
 */
export const getSocketsInRoom = async (
  io: SocketIOServer,
  room: string
): Promise<string[]> => {
  const sockets = await io.in(room).fetchSockets();
  return sockets.map((s) => s.id);
};

/**
 * Graceful shutdown
 */
export const closeSocketServer = async (io: SocketIOServer): Promise<void> => {
  logger.info('[Socket.io] Closing server...');
  
  // Close all connections
  io.disconnectSockets(true);
  
  // Close Redis clients
  if (pubClient) {
    await pubClient.quit();
  }
  if (subClient) {
    await subClient.quit();
  }
  
  logger.info('[Socket.io] Server closed');
};

// Standard events
export const SOCKET_EVENTS = {
  // Kitchen events
  ORDER_NEW: 'kitchen:order:new',
  ORDER_UPDATE: 'kitchen:order:update',
  ORDER_READY: 'kitchen:order:ready',
  
  // Pool events
  POOL_CAPACITY_UPDATE: 'pool:capacity:update',
  POOL_TICKET_VALIDATED: 'pool:ticket:validated',
  
  // Booking events
  BOOKING_NEW: 'booking:new',
  BOOKING_UPDATE: 'booking:update',
  BOOKING_CANCELLED: 'booking:cancelled',
  
  // Admin events
  ADMIN_ALERT: 'admin:alert',
  STATS_UPDATE: 'admin:stats:update',
  
  // User events
  NOTIFICATION: 'user:notification',
  SESSION_EXPIRED: 'user:session:expired',
};
