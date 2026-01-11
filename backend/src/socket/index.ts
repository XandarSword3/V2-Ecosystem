import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { config } from "../config/index";
import { logger } from "../utils/logger";
import { verifyToken } from "../modules/auth/auth.utils";

let io: Server;

// Track active connections
const activeConnections = new Map<string, { userId?: string; connectedAt: Date }>();

// Function to check if origin is allowed for socket.io (same as Express CORS)
function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001', 
    'http://localhost:3002',
    'http://localhost:3003',
    config.frontendUrl,
    'https://v2-ecosystem.vercel.app',
  ].filter(Boolean);
  
  // Check exact match
  if (allowedOrigins.includes(origin)) return true;
  
  // Allow all Vercel preview URLs for this project
  if (origin.includes('vercel.app')) return true;
  
  return false;
}

export function getOnlineUsers(): string[] {
  if (!io) return [];
  const userIds = new Set<string>();
  
  // Iterate through all connected sockets
  io.sockets.sockets.forEach((socket) => {
    if (socket.data.userId) {
      userIds.add(socket.data.userId);
    }
  });

  return Array.from(userIds);
}

export function initializeSocketServer(httpServer: HttpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (isAllowedOrigin(origin)) {
          callback(null, true);
        } else {
          logger.warn(`Socket.io CORS blocked origin: ${origin}`);
          callback(new Error('Not allowed by CORS'));
        }
      },
      methods: ['GET', 'POST'],
      credentials: true,
    },
    // Connection state recovery - handles brief disconnections gracefully
    connectionStateRecovery: {
      maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
      skipMiddlewares: true,
    },
    // CRITICAL: Improved connection stability settings
    pingTimeout: 120000,       // 2 minutes before considering connection dead
    pingInterval: 25000,       // Ping every 25 seconds (keep-alive)
    connectTimeout: 60000,     // 60 seconds to establish connection
    allowUpgrades: true,
    transports: ['websocket', 'polling'],
    // Upgrade timeout for switching from polling to websocket
    upgradeTimeout: 30000,
    // Allow request buffering during connection
    maxHttpBufferSize: 1e6,    // 1MB
  });

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (token) {
        const payload = verifyToken(token);
        socket.data.userId = payload.userId;
        socket.data.roles = payload.roles;
      }
      next();
    } catch (error) {
      // Allow unauthenticated connections for public updates
      next();
    }
  });

  io.on('connection', (socket: Socket) => {
    // Track connection
    activeConnections.set(socket.id, {
      userId: socket.data.userId,
      connectedAt: new Date(),
    });
    
    logger.info(`Socket connected: ${socket.id} (Total: ${activeConnections.size})`);

    // Join rooms based on user role
    if (socket.data.roles) {
      socket.data.roles.forEach((role: string) => {
        socket.join(`role:${role}`);
      });
    }

    // Join user-specific room
    if (socket.data.userId) {
      socket.join(`user:${socket.data.userId}`);
    }

    // Broadcast online count to admins
    const onlineCount = io.engine.clientsCount;
    io.to('role:admin').to('role:super_admin').emit('stats:online_users', { count: onlineCount });

    // Handle heartbeat to keep connection alive
    socket.on('heartbeat', () => {
      socket.emit('heartbeat:ack', { timestamp: Date.now() });
    });

    // Staff can join business unit rooms
    socket.on('join:unit', (unit: string) => {
      if (['restaurant', 'snack_bar', 'chalets', 'pool'].includes(unit)) {
        socket.join(`unit:${unit}`);
        logger.debug(`Socket ${socket.id} joined unit:${unit}`);
      }
    });

    // Handle room joining with acknowledgment
    socket.on('join-room', (room: string, callback?: (success: boolean) => void) => {
      socket.join(room);
      logger.debug(`Socket ${socket.id} joined room: ${room}`);
      if (callback) callback(true);
    });

    // Handle room leaving
    socket.on('leave-room', (room: string) => {
      socket.leave(room);
      logger.debug(`Socket ${socket.id} left room: ${room}`);
    });

    // Handle ping for connection testing
    socket.on('ping', (callback?: () => void) => {
      if (callback) callback();
    });

    socket.on('disconnect', (reason: string) => {
      activeConnections.delete(socket.id);
      logger.info(`Socket disconnected: ${socket.id} - Reason: ${reason} (Remaining: ${activeConnections.size})`);
      
      // Broadcast online count to admins (after a small delay to ensure count is updated)
      setTimeout(() => {
        const count = io.engine.clientsCount;
        io.to('role:admin').to('role:super_admin').emit('stats:online_users', { count });
      }, 100);
    });

    // Handle errors gracefully
    socket.on('error', (error: Error) => {
      logger.error(`Socket error for ${socket.id}: ${error.message}`);
    });
  });

  // Log connection stats periodically
  setInterval(() => {
    const stats = {
      totalConnections: activeConnections.size,
      engineClients: io.engine.clientsCount,
    };
    if (stats.totalConnections > 0) {
      logger.debug(`Socket stats: ${JSON.stringify(stats)}`);
    }
  }, 60000); // Every minute

  return io;
}

export function getIO() {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
}

// Emit helpers
export function emitToUser(userId: string, event: string, data: unknown) {
  getIO().to(`user:${userId}`).emit(event, data);
}

export function emitToUnit(unit: string, event: string, data: unknown) {
  getIO().to(`unit:${unit}`).emit(event, data);
}

export function emitToRole(role: string, event: string, data: unknown) {
  getIO().to(`role:${role}`).emit(event, data);
}

export function emitToAll(event: string, data: unknown) {
  getIO().emit(event, data);
}
