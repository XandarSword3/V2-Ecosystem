import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { config } from "../config/index";
import { logger } from "../utils/logger";
import { verifyToken } from "../modules/auth/auth.utils";

let io: Server;

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
    // Improve connection stability
    pingTimeout: 60000,
    pingInterval: 25000,
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
    logger.debug(`Socket connected: ${socket.id}`);

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

    // Staff can join business unit rooms
    socket.on('join:unit', (unit: string) => {
      if (['restaurant', 'snack_bar', 'chalets', 'pool'].includes(unit)) {
        socket.join(`unit:${unit}`);
        logger.debug(`Socket ${socket.id} joined unit:${unit}`);
      }
    });

    socket.on('disconnect', () => {
      logger.debug(`Socket disconnected: ${socket.id}`);
      
      // Broadcast online count to admins (after a small delay to ensure count is updated)
      setTimeout(() => {
        const count = io.engine.clientsCount;
        io.to('role:admin').to('role:super_admin').emit('stats:online_users', { count });
      }, 100);
    });
  });

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
