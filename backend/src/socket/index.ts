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
  tenantId?: string;   // tenant-scoped room key
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

  // Iterate through all connected sockets in BOTH namespaces: the public /
  // (default) namespace used by most pages via lib/socket.ts, and the /admin
  // namespace used by the admin live-users cockpit. A user with a socket open
  // in either is online; the Set dedupes multi-namespace / multi-tab users.
  const scanSockets = (sockets: Map<string, Socket>) => {
    sockets.forEach((socket) => {
      if (socket.data.userId) {
        userIds.add(socket.data.userId);
      }
    });
  };
  scanSockets(io.sockets.sockets);
  scanSockets(io.of('/admin').sockets);

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
 *
 * Pass tenantId to scope results to one tenant. Omitting it returns every
 * connection platform-wide — callers other than super_admin must always
 * pass tenantId or this leaks cross-tenant presence data.
 */
export function getOnlineUsersDetailed(tenantId?: string): ActiveConnection[] {
  // userId → most-recently-active connection
  const byUser = new Map<string, ActiveConnection>();
  const anon: ActiveConnection[] = [];

  activeConnections.forEach(conn => {
    if (tenantId && conn.tenantId !== tenantId) return;
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

// Get count of authenticated users only. Pass tenantId to scope the count
// to one tenant — omitting it returns the platform-wide count, which must
// only ever be exposed to super_admin (see request:online_users handlers).
function getAuthenticatedUserCount(tenantId?: string): number {
  const userIds = new Set<string>();
  activeConnections.forEach(conn => {
    if (conn.userId && (!tenantId || conn.tenantId === tenantId)) {
      userIds.add(conn.userId);
    }
  });
  return userIds.size;
}

// Broadcast online users update to admins — scoped per tenant so
// tenant A's admins never receive tenant B's stats.
//
// IMPORTANT: socket.io's .to(roomA).to(roomB) is a UNION, not an
// intersection. io.to(`tenant:${id}`).to('role:admin') broadcasts to every
// socket in tenant:{id} (any role, including non-admins) PLUS every socket
// in role:admin (every tenant's admins) — the exact cross-tenant leak this
// function exists to close. Tenant+role targeting must use the compound
// `tenant:{id}:role:{role}` room that sockets join on connection instead.
function broadcastOnlineUsersToAdmins() {
  if (!io) return;

  // Collect unique tenant IDs currently connected
  const tenantIds = new Set<string>();
  activeConnections.forEach(conn => { if (conn.tenantId) tenantIds.add(conn.tenantId); });

  for (const tenantId of tenantIds) {
    const tenantCount = getAuthenticatedUserCount(tenantId);
    const tenantDetailed = getOnlineUsersDetailed(tenantId);

    // Emit ONLY to this tenant's admin room (compound room — true AND, not OR)
    const tenantAdminRoom = `tenant:${tenantId}:role:admin`;
    io.of('/admin').to(tenantAdminRoom).emit('stats:online_users', { count: tenantCount });
    io.of('/admin').to(tenantAdminRoom).emit('stats:online_users_detailed', { users: tenantDetailed, count: tenantCount });
  }

  // super_admin gets cross-tenant global count — intentional, the one role
  // with legitimate platform-wide visibility.
  const globalCount = getAuthenticatedUserCount();
  io.of('/admin').to('role:super_admin').emit('stats:online_users', { count: globalCount });
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
      tenantId: socket.data.tenantId,
      currentPage: '/',
      connectedAt: new Date(),
      lastActivity: new Date(),
      userAgent,
      ipAddress,
    });

    logger.info(`Socket connected [${namespaceType}]: ${socket.id} (user: ${socket.data.userId || 'anon'})`);

    // Standard heartbeat
    socket.on('heartbeat', () => socket.emit('heartbeat:ack', { timestamp: Date.now() }));

    // Anonymous & authenticated order room join for live tracking (Phase 3.3)
    socket.on('order:join', (data: { orderId?: string }) => {
      if (typeof data?.orderId === 'string' && data.orderId) {
        socket.join(`order:${data.orderId}`);
        logger.info(`Socket ${socket.id} joined order room order:${data.orderId}`);
      }
    });

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

    // Join tenant room — broad tenant-scope membership, any role. NOTE: this
    // does NOT scope the role rooms below — see broadcastOnlineUsersToAdmins
    // for why chaining .to(tenant).to(role) doesn't intersect.
    if (socket.data.tenantId) {
      socket.join(`tenant:${socket.data.tenantId}`);
    }

    // Join Role Rooms. `role:{r}` is a global cross-tenant room — reserve it
    // for genuinely platform-wide targets (role:super_admin). Tenant-scoped
    // admin events must target the compound `tenant:{id}:role:{r}` room.
    socket.data.roles?.forEach((r: string) => {
      socket.join(`role:${r}`);
      if (socket.data.tenantId) socket.join(`tenant:${socket.data.tenantId}:role:${r}`);
    });
    if (socket.data.userId) socket.join(`user:${socket.data.userId}`);

    // Admin-specific listeners
    broadcastOnlineUsersToAdmins();

    const isSuperAdmin = socket.data.roles?.includes('super_admin');

    socket.on('request:online_users', () => {
      const count = getAuthenticatedUserCount(isSuperAdmin ? undefined : socket.data.tenantId);
      socket.emit('stats:online_users', { count });
    });

    socket.on('request:online_users_detailed', () => {
      if (socket.data.roles?.includes('admin') || isSuperAdmin) {
        const tenantId = isSuperAdmin ? undefined : socket.data.tenantId;
        const users = getOnlineUsersDetailed(tenantId);
        // Use authenticated user count (unique users) not socket count
        socket.emit('stats:online_users_detailed', { users, count: getAuthenticatedUserCount(tenantId) });
      }
    });

    socket.on('join:unit', (unit: string) => {
      // Accept any valid module slug — modules are dynamically created so
      // the server cannot maintain a hardcoded allowlist. Data security is
      // enforced by RLS on the database layer, not by socket room membership.
      // Room is tenant-namespaced to prevent cross-tenant real-time leaks.
      if (unit && typeof unit === 'string' && socket.data.tenantId) {
        socket.join(`tenant:${socket.data.tenantId}:unit:${unit}`);
      }
    });
  });

  // --- NAMESPACE: PUBLIC (Mandatory Auth — Item 15) ---
  // Unauthenticated connections are refused at the handshake.
  // Customer/guest pages that previously relied on anonymous sockets must
  // either obtain a guest token or use polling for public data.
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        next(new Error('Authentication required'));
        return;
      }
      const payload = verifyToken(token);
      socket.data = { ...socket.data, ...payload };
      next();
    } catch {
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    handleConnection(socket, 'public');

    // Join tenant room (scopes all subsequent room chatter)
    if (socket.data.tenantId) {
      socket.join(`tenant:${socket.data.tenantId}`);
    }

    if (socket.data.userId) socket.join(`user:${socket.data.userId}`);

    // Join role rooms so public-namespace clients receive role-targeted events.
    // Also join the compound tenant+role room — see broadcastOnlineUsersToAdmins
    // for why plain `role:{r}` can't be combined with `tenant:{id}` via .to() chaining.
    const isSuperAdmin = socket.data.roles?.includes('super_admin');
    socket.data.roles?.forEach((r: string) => {
      socket.join(`role:${r}`);
      if (socket.data.tenantId) socket.join(`tenant:${socket.data.tenantId}:role:${r}`);
    });

    // Allow public-namespace clients to join unit rooms (any active module slug)
    socket.on('join:unit', (unit: string) => {
      if (unit && typeof unit === 'string' && socket.data.tenantId) {
        socket.join(`tenant:${socket.data.tenantId}:unit:${unit}`);
      }
    });

    // Allow public-namespace clients to request online users
    socket.on('request:online_users', () => {
      const count = getAuthenticatedUserCount(isSuperAdmin ? undefined : socket.data.tenantId);
      socket.emit('stats:online_users', { count });
    });

    socket.on('request:online_users_detailed', () => {
      if (socket.data.roles?.includes('admin') || isSuperAdmin) {
        const tenantId = isSuperAdmin ? undefined : socket.data.tenantId;
        const users = getOnlineUsersDetailed(tenantId);
        socket.emit('stats:online_users_detailed', { users, count: getAuthenticatedUserCount(tenantId) });
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

export function emitToOrder(orderId: string, event: string, data: unknown) {
  getIO().to(`order:${orderId}`).emit(event, data);
  getIO().of('/admin').to(`order:${orderId}`).emit(event, data);
}

// FLAG resolved: unit rooms are now tenant-namespaced (`tenant:{id}:unit:{slug}`).
export function emitToUnit(tenantId: string, unit: string, event: string, data: unknown) {
  getIO().of('/admin').to(`tenant:${tenantId}:unit:${unit}`).emit(event, data);
  getIO().to(`tenant:${tenantId}:unit:${unit}`).emit(event, data);
}

// Roles are strict admin/staff concept. `super_admin` is the one role with
// legitimate platform-wide visibility — every other role is tenant data and
// MUST be scoped via tenantId, or this re-introduces the exact cross-tenant
// leak item 12 closes (chaining .to(tenant).to(role) is a union, not an
// intersection, so it can't be fixed by adding a tenant room to the chain).
export function emitToRole(role: string, event: string, data: unknown, tenantId?: string) {
  if (role === 'super_admin') {
    getIO().of('/admin').to(`role:${role}`).emit(event, data);
    return;
  }
  if (!tenantId) {
    logger.warn(`emitToRole('${role}', '${event}') called without tenantId — refusing to broadcast cross-tenant.`);
    return;
  }
  getIO().of('/admin').to(`tenant:${tenantId}:role:${role}`).emit(event, data);
}

// FLAG: true platform-wide broadcast, bypasses tenant scoping entirely.
// Per item 12 this should only ever be used for genuine platform-wide
// system events (the shutdown notice in closeSocketServer is the one
// legitimate case). Any caller using this for tenant data is a leak — audit
// call sites.
export function emitToAll(event: string, data: unknown) {
  getIO().emit(event, data);
  getIO().of('/admin').emit(event, data);
}
