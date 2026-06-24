import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { config } from "../config/index";
import { logger } from "../utils/logger.js";
import { verifyToken } from "../modules/auth/auth.utils.js";

// Matches any subdomain (including multi-level, e.g. resort-1.tenant-a.v2platform.local)
// used by the property-level dev URLs introduced in session 7-8.
const DEV_SUBDOMAIN_PATTERN = /^http:\/\/(?:[a-z0-9-]+\.)+(?:v2platform\.local|localhost)(?::\d+)?$/;

let io: Server;

// Enhanced connection tracking with user details and activity
interface ActiveConnection {
  socketId: string;
  userId?: string;
  email?: string;
  fullName?: string;
  roles: string[];
  currentPage?: string;
  connectedAt: Date;
  lastActivity: Date;
  userAgent?: string;
  ipAddress?: string;
}

const activeConnections = new Map<string, ActiveConnection>();

// Function to check if origin is allowed for socket.io (same as Express CORS)
function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true;

  // Dev-mode localhost origins (never in production)
  const devOrigins = process.env.NODE_ENV !== 'production'
    ? ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002', 'http://localhost:3003']
    : [];

  // Runtime-configurable extra origins from environment variable.
  // Set SOCKET_EXTRA_ORIGINS in your .env / deployment config (comma-separated).
  // Example: SOCKET_EXTRA_ORIGINS=https://your-app.vercel.app,https://your-custom-domain.com
  const extraOrigins = (process.env.SOCKET_EXTRA_ORIGINS ?? '')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);

  const allowedOrigins = [
    ...devOrigins,
    config.frontendUrl,
    ...extraOrigins,
  ].filter(Boolean) as string[];

  // Check exact match first
  if (allowedOrigins.includes(origin)) return true;

  // In development, also check against subdomain pattern for multi-property routing
  if (process.env.NODE_ENV !== 'production' && DEV_SUBDOMAIN_PATTERN.test(origin)) {
    return true;
  }

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

/**
 * Get detailed online users info for admin dashboard.
 *
 * Deduplicates by userId: if a user has multiple tabs/sockets open, only
 * their most-recently-active connection is included. Anonymous connections
 * (no userId) are included as-is since they cannot be deduplicated.
 *
 * This mirrors the behaviour of getAuthenticatedUserCount() — one user
 * with 3 tabs counts as 1 entry, not 3.
 */
export function getOnlineUsersDetailed(): ActiveConnection[] {
  // userId → most-recently-active connection
  const byUser = new Map<string, ActiveConnection>();
  const anon: ActiveConnection[] = [];

  activeConnections.forEach(conn => {
    if (!conn.userId) {
      anon.push(conn);
      return;
    }
    const existing = byUser.get(conn.userId);
    if (!existing || conn.lastActivity > existing.lastActivity) {
      byUser.set(conn.userId, conn);
    }
  });

  return [...Array.from(byUser.values()), ...anon];
}

// Get count of authenticated users only
function getAuthenticatedUserCount(): number {
  const userIds = new Set<string>();
  activeConnections.forEach(conn => {
    if (conn.userId) {
      userIds.add(conn.userId);
    }
  });
  return userIds.size;
}

// Broadcast online users update to admins
function broadcastOnlineUsersToAdmins() {
  if (!io) return;
  // Use authenticated user count instead of all socket connections
  const count = getAuthenticatedUserCount();
  const detailedUsers = getOnlineUsersDetailed();
  io.to('role:admin').to('role:super_admin').emit('stats:online_users', { count });
  io.to('role:admin').to('role:super_admin').emit('stats:online_users_detailed', { users: detailedUsers, count });
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

  // --- SHARED CONNECTION LOGIC ---
  const handleConnection = (socket: Socket, namespaceType: 'admin' | 'public') => {
    // Get connection metadata
    const userAgent = socket.handshake.headers['user-agent'];
    const ipAddress = socket.handshake.address;

    activeConnections.set(socket.id, {
      socketId: socket.id,
      userId: socket.data.userId,
      email: socket.data.email,
      fullName: socket.data.fullName,
      roles: socket.data.roles || [],
      currentPage: '/',
      connectedAt: new Date(),
      lastActivity: new Date(),
      userAgent,
      ipAddress,
    });

    logger.info(`Socket connected [${namespaceType}]: ${socket.id} (user: ${socket.data.userId || 'anon'})`);

    // Standard heartbeat
    socket.on('heartbeat', () => socket.emit('heartbeat:ack', { timestamp: Date.now() }));

    // Route tracking: client emits 'page:update' on every navigation.
    // Updates currentPage and lastActivity on the stored connection so the
    // admin cockpit reflects where each user currently is.
    // The payload is capped at 200 chars to prevent abuse.
    socket.on('page:update', (page: unknown) => {
      const conn = activeConnections.get(socket.id);
      if (!conn) return;
      conn.currentPage = typeof page === 'string' ? page.slice(0, 200) : conn.currentPage;
      conn.lastActivity = new Date();
    });

    socket.on('disconnect', (reason: string) => {
      activeConnections.delete(socket.id);
      logger.info(`Socket disconnected [${namespaceType}]: ${socket.id} - ${reason}`);
      if (namespaceType === 'admin') setTimeout(() => broadcastOnlineUsersToAdmins(), 100);
    });

    socket.on('error', (err: Error) => logger.error(`Socket error [${namespaceType}]: ${err.message}`));
  };

  // --- NAMESPACE: ADMIN (Strict Auth) ---
  const adminIo = io.of('/admin');
  adminIo.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (token) {
        const payload = verifyToken(token);
        socket.data = { ...socket.data, ...payload };
        next();
      } else {
        next(new Error("Authentication required"));
      }
    } catch {
      next(new Error("Authentication failed"));
    }
  });

  adminIo.on('connection', (socket) => {
    handleConnection(socket, 'admin');

    // Join Role Rooms
    socket.data.roles?.forEach((r: string) => socket.join(`role:${r}`));
    if (socket.data.userId) socket.join(`user:${socket.data.userId}`);

    // Admin-specific listeners
    broadcastOnlineUsersToAdmins();

    socket.on('request:online_users', () => {
      socket.emit('stats:online_users', { count: getAuthenticatedUserCount() });
    });

    socket.on('request:online_users_detailed', () => {
      if (socket.data.roles?.includes('admin') || socket.data.roles?.includes('super_admin')) {
        const users = getOnlineUsersDetailed();
        // Use authenticated user count (unique users) not socket count
        socket.emit('stats:online_users_detailed', { users, count: getAuthenticatedUserCount() });
      }
    });

    socket.on('join:unit', (unit: string) => {
      // Accept any valid module slug — modules are dynamically created so
      // the server cannot maintain a hardcoded allowlist. Data security is
      // enforced by RLS on the database layer, not by socket room membership.
      if (unit && typeof unit === 'string') socket.join(`unit:${unit}`);
    });
  });

  // --- NAMESPACE: PUBLIC (Legacy/Default) ---
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (token) {
        const payload = verifyToken(token);
        socket.data = { ...socket.data, ...payload };
      }
    } catch { /* Allow anonymous */ }
    next();
  });

  io.on('connection', (socket) => {
    handleConnection(socket, 'public');
    if (socket.data.userId) socket.join(`user:${socket.data.userId}`);

    // Join role rooms so public-namespace clients receive role-targeted events
    socket.data.roles?.forEach((r: string) => socket.join(`role:${r}`));

    // Allow public-namespace clients to join unit rooms (any active module slug)
    socket.on('join:unit', (unit: string) => {
      if (unit && typeof unit === 'string') socket.join(`unit:${unit}`);
    });

    // Allow public-namespace clients to request online users
    socket.on('request:online_users', () => {
      socket.emit('stats:online_users', { count: getAuthenticatedUserCount() });
    });

    socket.on('request:online_users_detailed', () => {
      if (socket.data.roles?.includes('admin') || socket.data.roles?.includes('super_admin')) {
        const users = getOnlineUsersDetailed();
        socket.emit('stats:online_users_detailed', { users, count: getAuthenticatedUserCount() });
      }
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

/**
 * Close the Socket.io server gracefully
 * Disconnects all clients and cleans up resources
 */
export async function closeSocketServer(): Promise<void> {
  if (!io) return;

  return new Promise((resolve) => {
    // Notify all connected clients
    io.emit('server:shutdown', { message: 'Server is shutting down' });

    // Disconnect all sockets
    io.sockets.sockets.forEach((socket) => {
      socket.disconnect(true);
    });

    // Clear active connections
    activeConnections.clear();

    // Close the server
    io.close(() => {
      logger.info('Socket.io server closed');
      resolve();
    });
  });
}

// Emit helpers
export function emitToUser(userId: string, event: string, data: unknown) {
  // Emit to both namespaces to ensure delivery
  getIO().to(`user:${userId}`).emit(event, data);
  getIO().of('/admin').to(`user:${userId}`).emit(event, data);
}

export function emitToUnit(unit: string, event: string, data: unknown) {
  // Units are operational (staff), so emit to admin namespace
  // Also emit to public just in case of mixed usage
  getIO().of('/admin').to(`unit:${unit}`).emit(event, data);
  getIO().to(`unit:${unit}`).emit(event, data);
}

export function emitToRole(role: string, event: string, data: unknown) {
  // Roles are strict admin/staff concept
  getIO().of('/admin').to(`role:${role}`).emit(event, data);
}

export function emitToAll(event: string, data: unknown) {
  getIO().emit(event, data);
  getIO().of('/admin').emit(event, data);
}
